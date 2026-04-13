/**
 * Application Performance Monitoring (APM) Service
 * Custom metrics, error tracking, and alerting
 */

import { Request, Response, NextFunction } from 'express';
import { systemMonitor } from './systemMonitor';

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags: Record<string, string>;
}

export interface ErrorLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userId?: string;
  requestId?: string;
}

export interface Alert {
  id: string;
  type: 'performance' | 'error' | 'security' | 'availability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

class APMService {
  private metrics: PerformanceMetric[] = [];
  private errors: ErrorLog[] = [];
  private alerts: Alert[] = [];
  private readonly MAX_METRICS_HISTORY = 10000;
  private readonly MAX_ERROR_HISTORY = 5000;
  private readonly METRICS_RETENTION_HOURS = 24;

  /**
   * Express middleware for request tracking
   */
  trackRequest() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Attach request ID to request
      (req as any).requestId = requestId;

      // Track response
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const isError = res.statusCode >= 400;

        // Record performance metric
        this.recordMetric({
          name: 'http_request_duration',
          value: duration,
          unit: 'ms',
          tags: {
            method: req.method,
            path: req.path,
            status: res.statusCode.toString(),
            requestId
          }
        });

        // Record route health
        systemMonitor.recordRouteMetrics(req.path, req.method, duration, isError);

        // Track errors
        if (isError) {
          this.logError({
            level: res.statusCode >= 500 ? 'error' : 'warning',
            message: `HTTP ${res.statusCode} - ${req.method} ${req.path}`,
            context: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              duration,
              userAgent: req.get('user-agent')
            },
            userId: (req as any).userId,
            requestId
          });
        }

        // Alert on slow requests
        if (duration > 5000) {
          this.createAlert({
            type: 'performance',
            severity: duration > 10000 ? 'high' : 'medium',
            message: `Slow request detected: ${req.method} ${req.path} took ${duration}ms`,
            metadata: {
              method: req.method,
              path: req.path,
              duration,
              requestId
            }
          });
        }
      });

      next();
    };
  }

  /**
   * Record custom performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): void {
    const newMetric: PerformanceMetric = {
      ...metric,
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    this.metrics.push(newMetric);
    this.cleanupMetrics();
  }

  /**
   * Get metrics by name
   */
  getMetrics(name: string, limit = 100): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.name === name)
      .slice(0, limit);
  }

  /**
   * Get metric statistics
   */
  getMetricStats(name: string, windowMinutes = 60): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const cutoffTime = Date.now() - (windowMinutes * 60 * 1000);
    const relevantMetrics = this.metrics
      .filter(m => m.name === name && m.timestamp.getTime() > cutoffTime)
      .map(m => m.value)
      .sort((a, b) => a - b);

    if (relevantMetrics.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sum = relevantMetrics.reduce((a, b) => a + b, 0);
    const avg = sum / relevantMetrics.length;
    const min = relevantMetrics[0];
    const max = relevantMetrics[relevantMetrics.length - 1];
    const p50 = relevantMetrics[Math.floor(relevantMetrics.length * 0.5)];
    const p95 = relevantMetrics[Math.floor(relevantMetrics.length * 0.95)];
    const p99 = relevantMetrics[Math.floor(relevantMetrics.length * 0.99)];

    return {
      count: relevantMetrics.length,
      avg: Math.round(avg),
      min,
      max,
      p50,
      p95,
      p99
    };
  }

  /**
   * Track an error (convenience method for global error handlers)
   */
  trackError(error: Error, context?: Record<string, any>): void {
    this.logError({
      level: context?.fatal ? 'critical' : 'error',
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        name: error.name,
        timestamp: new Date().toISOString()
      }
    });
  }
  /**
   * Log error
   */
  logError(error: Omit<ErrorLog, 'id' | 'timestamp'>): void {
    const newError: ErrorLog = {
      ...error,
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    this.errors.push(newError);
    this.cleanupErrors();

    // Create alert for critical errors
    if (error.level === 'critical') {
      this.createAlert({
        type: 'error',
        severity: 'critical',
        message: error.message,
        metadata: { errorId: newError.id }
      });
    }

    // Console logging
    const logMethod = error.level === 'critical' || error.level === 'error' 
      ? console.error 
      : error.level === 'warning' 
      ? console.warn 
      : console.log;

    logMethod(`[APM] ${error.level.toUpperCase()}: ${error.message}`, error.stack || '');
  }

  /**
   * Get recent errors
   */
  getErrors(level?: ErrorLog['level'], limit = 100): ErrorLog[] {
    let filtered = this.errors;
    if (level) {
      filtered = filtered.filter(e => e.level === level);
    }
    return filtered.slice(0, limit);
  }

  /**
   * Get error statistics
   */
  getErrorStats(windowMinutes = 60): {
    total: number;
    byLevel: Record<string, number>;
    errorRate: number;
  } {
    const cutoffTime = Date.now() - (windowMinutes * 60 * 1000);
    const recentErrors = this.errors.filter(e => e.timestamp.getTime() > cutoffTime);

    const byLevel = recentErrors.reduce((acc, e) => {
      acc[e.level] = (acc[e.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalRequests = this.metrics.filter(m => 
      m.name === 'http_request_duration' && 
      m.timestamp.getTime() > cutoffTime
    ).length;

    const errorRate = totalRequests > 0 ? (recentErrors.length / totalRequests) * 100 : 0;

    return {
      total: recentErrors.length,
      byLevel,
      errorRate: Math.round(errorRate * 100) / 100
    };
  }

  /**
   * Create alert
   */
  createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
    const newAlert: Alert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(newAlert);

    // Log critical alerts
    if (alert.severity === 'critical' || alert.severity === 'high') {
      console.error('[APM] ALERT:', newAlert.message, newAlert.metadata);
    }
  }

  /**
   * Resolve alert
   */
  resolveAlert(id: string): boolean {
    const alert = this.alerts.find(a => a.id === id);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date();
    console.log('[APM] Alert resolved:', id);
    return true;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(limit = 100): Alert[] {
    return this.alerts.slice(0, limit);
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    active: number;
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  } {
    const active = this.alerts.filter(a => !a.resolved).length;
    const total = this.alerts.length;

    const bySeverity = this.alerts.reduce((acc, a) => {
      acc[a.severity] = (acc[a.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byType = this.alerts.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { active, total, bySeverity, byType };
  }

  /**
   * Track database query performance
   */
  trackDatabaseQuery(query: string, duration: number, success: boolean): void {
    this.recordMetric({
      name: 'database_query_duration',
      value: duration,
      unit: 'ms',
      tags: {
        success: success.toString(),
        query: query.substring(0, 50) // Truncate long queries
      }
    });

    if (duration > 1000) {
      this.createAlert({
        type: 'performance',
        severity: 'medium',
        message: `Slow database query: ${duration}ms`,
        metadata: { query: query.substring(0, 100), duration }
      });
    }
  }

  /**
   * Track AI API call performance
   */
  trackAICall(provider: string, model: string, duration: number, tokens: number, cost: number): void {
    this.recordMetric({
      name: 'ai_api_duration',
      value: duration,
      unit: 'ms',
      tags: { provider, model }
    });

    this.recordMetric({
      name: 'ai_api_tokens',
      value: tokens,
      unit: 'tokens',
      tags: { provider, model }
    });

    this.recordMetric({
      name: 'ai_api_cost',
      value: cost,
      unit: 'usd',
      tags: { provider, model }
    });
  }

  /**
   * Cleanup old metrics
   */
  private cleanupMetrics(): void {
    const cutoffTime = Date.now() - (this.METRICS_RETENTION_HOURS * 60 * 60 * 1000);
    this.metrics = this.metrics
      .filter(m => m.timestamp.getTime() > cutoffTime)
      .slice(-this.MAX_METRICS_HISTORY);
  }

  /**
   * Cleanup old errors
   */
  private cleanupErrors(): void {
    this.errors = this.errors.slice(-this.MAX_ERROR_HISTORY);
  }
}

export const apmService = new APMService();
