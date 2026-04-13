import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';

interface AuditEvent {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

// Audit logging middleware
export const auditLog = (action: string, resource: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Capture original res.json to log response
    const originalJson = res.json;
    let responseData: any;
    let success = true;
    let errorMessage: string | undefined;

    res.json = function(data: any) {
      responseData = data;
      success = res.statusCode < 400;
      if (!success) {
        errorMessage = data?.error || data?.message || 'Unknown error';
      }
      return originalJson.call(this, data);
    };

    // Continue with request
    next();

    // Log after response is sent
    res.on('finish', async () => {
      try {
        const duration = Date.now() - startTime;
        
        await logAuditEvent({
          userId: req.userId,
          action,
          resource,
          resourceId: req.params.id || req.params.profileId || req.body?.id,
          details: {
            method: req.method,
            path: req.path,
            query: req.query,
            body: sanitizeBody(req.body),
            statusCode: res.statusCode,
            duration,
            responseSize: JSON.stringify(responseData || {}).length
          },
          ipAddress: getClientIP(req),
          userAgent: req.get('User-Agent'),
          success,
          errorMessage
        });
      } catch (error) {
        console.error('Audit logging failed:', error);
      }
    });
  };
};

// Log security events
export const logSecurityEvent = async (
  eventType: 'auth_failure' | 'permission_denied' | 'suspicious_activity' | 'data_breach' | 'admin_action',
  details: any,
  req?: Request
) => {
  try {
    await db.query(`
      INSERT INTO security_audit_log (
        event_type,
        user_id,
        ip_address,
        user_agent,
        details,
        severity,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      eventType,
      (req as any)?.userId || null,
      req ? getClientIP(req) : null,
      req?.get('User-Agent') || null,
      JSON.stringify(details),
      getSeverityLevel(eventType)
    ]);

    // Alert on high-severity events
    if (['data_breach', 'suspicious_activity'].includes(eventType)) {
      await sendSecurityAlert(eventType, details);
    }
  } catch (error) {
    console.error('Security event logging failed:', error);
  }
};

// Main audit event logger
async function logAuditEvent(event: AuditEvent) {
  try {
    // Sanitize details to prevent log injection
    const sanitizedDetails = sanitizeForLogging(event.details || {});
    
    await db.query(`
      INSERT INTO audit_log (
        user_id,
        action,
        resource,
        resource_id,
        details,
        ip_address,
        user_agent,
        success,
        error_message,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `, [
      event.userId || null,
      event.action,
      event.resource,
      event.resourceId || null,
      JSON.stringify(sanitizedDetails),
      event.ipAddress,
      event.userAgent,
      event.success,
      event.errorMessage || null
    ]);

    // Log failed actions as security events
    if (!event.success && isSecurityRelevant(event.action)) {
      await logSecurityEvent('permission_denied', {
        action: event.action,
        resource: event.resource,
        error: event.errorMessage
      });
    }
  } catch (error) {
    console.error('Audit event logging failed:', error);
    // Audit failures should not block operations but should be monitored
  }
}

// Middleware for high-risk operations
export const auditHighRisk = (action: string, resource: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Pre-action logging
    await logAuditEvent({
      userId: req.userId,
      action: `${action}_attempt`,
      resource,
      details: {
        method: req.method,
        path: req.path,
        body: sanitizeBody(req.body)
      },
      ipAddress: getClientIP(req),
      userAgent: req.get('User-Agent'),
      success: true
    });

    // Apply regular audit logging
    return auditLog(action, resource)(req, res, next);
  };
};

// Data access logging for compliance
export const auditDataAccess = (dataType: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    let dataAccessed = false;
    let recordCount = 0;

    res.send = function(data: any) {
      try {
        const parsed = JSON.parse(data);
        if (parsed && (Array.isArray(parsed) || parsed.data || parsed.results)) {
          dataAccessed = true;
          recordCount = Array.isArray(parsed) ? parsed.length : 
                       Array.isArray(parsed.data) ? parsed.data.length :
                       Array.isArray(parsed.results) ? parsed.results.length : 1;
        }
      } catch (e) {
        // Not JSON, skip counting
      }
      return originalSend.call(this, data);
    };

    next();

    res.on('finish', async () => {
      if (dataAccessed && res.statusCode < 400) {
        await logAuditEvent({
          userId: req.userId,
          action: 'data_access',
          resource: dataType,
          details: {
            recordCount,
            query: req.query,
            filters: req.body?.filters
          },
          ipAddress: getClientIP(req),
          userAgent: req.get('User-Agent'),
          success: true
        });
      }
    });
  };
};

// Helper functions
function sanitizeBody(body: any): any {
  if (!body) return {};
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'panNumber', 'aadharNumber', 'ssn', 'creditCard'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

function sanitizeForLogging(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = Array.isArray(data) ? [] : {};
  
  for (const [key, value] of Object.entries(data)) {
    // Remove potential log injection characters
    const cleanKey = String(key).replace(/[\r\n\t]/g, '_');
    
    if (typeof value === 'string') {
      // Sanitize string values to prevent log injection
      sanitized[cleanKey] = value.replace(/[\r\n\t]/g, '_').substring(0, 1000);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[cleanKey] = sanitizeForLogging(value);
    } else {
      sanitized[cleanKey] = value;
    }
  }
  
  return sanitized;
}

function getClientIP(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         'unknown';
}

function getSeverityLevel(eventType: string): 'low' | 'medium' | 'high' | 'critical' {
  const severityMap = {
    auth_failure: 'medium',
    permission_denied: 'medium',
    suspicious_activity: 'high',
    data_breach: 'critical',
    admin_action: 'high'
  };
  return severityMap[eventType as keyof typeof severityMap] || 'low';
}

function isSecurityRelevant(action: string): boolean {
  const securityActions = [
    'login', 'logout', 'password_change', 'profile_update',
    'admin_action', 'data_export', 'user_create', 'user_delete'
  ];
  return securityActions.some(sa => action.includes(sa));
}

async function sendSecurityAlert(eventType: string, details: any) {
  // Implementation would send alerts via email, Slack, etc.
  console.error(`SECURITY ALERT: ${eventType}`, details);
  
  // Could integrate with alerting services:
  // - AWS SNS
  // - Slack webhooks
  // - Email notifications
  // - PagerDuty
}

// Compliance reporting queries
export const generateComplianceReport = async (startDate: Date, endDate: Date) => {
  const report = await db.query(`
    SELECT 
      DATE(created_at) as date,
      action,
      resource,
      COUNT(*) as count,
      COUNT(CASE WHEN success = false THEN 1 END) as failures
    FROM audit_log 
    WHERE created_at BETWEEN $1 AND $2
    GROUP BY DATE(created_at), action, resource
    ORDER BY date DESC, count DESC
  `, [startDate, endDate]);

  const securityEvents = await db.query(`
    SELECT 
      DATE(created_at) as date,
      event_type,
      severity,
      COUNT(*) as count
    FROM security_audit_log 
    WHERE created_at BETWEEN $1 AND $2
    GROUP BY DATE(created_at), event_type, severity
    ORDER BY date DESC, count DESC
  `, [startDate, endDate]);

  return {
    auditSummary: report.rows,
    securityEvents: securityEvents.rows,
    period: { startDate, endDate }
  };
};