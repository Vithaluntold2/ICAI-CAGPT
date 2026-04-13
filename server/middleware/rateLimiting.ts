import { Request, Response, NextFunction } from 'express';
import { db, client } from '../db';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: any;
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Generic rate limiter
export const rateLimit = (config: RateLimitConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = config.keyGenerator ? config.keyGenerator(req) : getClientIP(req);
      const now = Date.now();
      
      let record = rateLimitStore.get(key);
      
      if (!record || now > record.resetTime) {
        record = {
          count: 1,
          resetTime: now + config.windowMs
        };
        rateLimitStore.set(key, record);
        return next();
      }
      
      if (record.count >= config.maxRequests) {
        res.set({
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(record.resetTime).toISOString()
        });
        
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((record.resetTime - now) / 1000)
        });
      }
      
      record.count++;
      rateLimitStore.set(key, record);
      
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': (config.maxRequests - record.count).toString(),
        'X-RateLimit-Reset': new Date(record.resetTime).toISOString()
      });
      
      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      next(); // Don't block on rate limit errors
    }
  };
};

// Authentication endpoint rate limiting
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  keyGenerator: (req) => `auth:${getClientIP(req)}`
});

// Token validation rate limiting
export const tokenValidationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
  keyGenerator: (req) => `token:${getClientIP(req)}`
});

// API rate limiting per user
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute per user
  keyGenerator: (req) => {
    const authReq = req as AuthenticatedRequest;
    return `api:${authReq.userId || getClientIP(req)}`;
  }
});

// Admin operations rate limiting
export const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 200, // Higher limit for admin operations
  keyGenerator: (req) => {
    const authReq = req as AuthenticatedRequest;
    return `admin:${authReq.userId || getClientIP(req)}`;
  }
});

// Database-backed rate limiting for critical operations
export const databaseRateLimit = (resource: string, maxRequests: number, windowMs: number) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const windowStart = new Date(Date.now() - windowMs);
      
      // Count requests in the current window
      const countResult = await client.query(`
        SELECT COUNT(*) as request_count
        FROM audit_log 
        WHERE user_id = $1 
          AND resource = $2 
          AND created_at > $3
          AND success = true
      `, [userId, resource, windowStart]);

      const currentCount = parseInt(countResult.rows[0]?.request_count || '0');
      
      if (currentCount >= maxRequests) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          resource,
          limit: maxRequests,
          windowMs,
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      next();
    } catch (error) {
      console.error('Database rate limiting error:', error);
      next(); // Don't block on rate limit errors
    }
  };
};

// Suspicious activity detection
export const suspiciousActivityDetector = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = getClientIP(req);
    const userAgent = req.get('User-Agent') || '';
    const authReq = req as AuthenticatedRequest;
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      // SQL injection attempts
      /(\b(union|select|insert|update|delete|drop|create|alter)\b)/i,
      // XSS attempts
      /<script|javascript:|on\w+\s*=/i,
      // Path traversal
      /\.\.\//,
      // Command injection
      /[;&|`$()]/
    ];
    
    const requestString = JSON.stringify({
      url: req.url,
      body: req.body,
      query: req.query,
      headers: req.headers
    });
    
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(requestString));
    
    if (isSuspicious) {
      // Log suspicious activity
      await client.query(`
        INSERT INTO security_audit_log (
          event_type, user_id, ip_address, user_agent, details, severity
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        'suspicious_activity',
        authReq.userId || null,
        ip,
        userAgent,
        JSON.stringify({
          url: req.url,
          method: req.method,
          suspiciousContent: requestString.substring(0, 500)
        }),
        'high'
      ]);
      
      // Block the request
      return res.status(400).json({ error: 'Request blocked due to suspicious activity' });
    }
    
    next();
  } catch (error) {
    console.error('Suspicious activity detection error:', error);
    next(); // Don't block on detection errors
  }
};

function getClientIP(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         'unknown';
}

export { AuthenticatedRequest };