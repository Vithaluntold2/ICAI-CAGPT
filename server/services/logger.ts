/**
 * Structured Logging Service using Pino
 * 
 * Replaces console.log with production-grade structured logging:
 * - JSON formatted logs for easy parsing
 * - Request ID tracking across services
 * - Performance metrics
 * - Error context capture
 * - Log levels (trace, debug, info, warn, error, fatal)
 * - Pretty printing in development
 */

import pino from 'pino';
import { randomUUID } from 'crypto';

// Development: Pretty print with colors
// Production: JSON for log aggregation
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  
  // Pretty print in development for readability
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname',
      singleLine: false,
    },
  } : undefined,

  // Base fields included in every log
  base: {
    env: process.env.NODE_ENV,
    service: 'lucaagent',
  },

  // Format timestamps
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,

  // Serialize errors properly
  serializers: {
    error: pino.stdSerializers.err,
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    user: (user) => ({
      id: user.id,
      email: user.email,
      tier: user.subscriptionTier,
    }),
  },
});

/**
 * Express middleware to add request logging
 * Adds unique request ID to each request
 */
export function requestLogger(req: any, res: any, next: any) {
  const requestId = randomUUID();
  req.id = requestId;
  req.log = logger.child({ requestId });

  // Log request
  req.log.info({ req }, 'Incoming request');

  // Track response time
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    
    req.log[logLevel]({
      req,
      res,
      duration,
    }, 'Request completed');
  });

  next();
}

/**
 * AI Request Logger
 * Track AI provider calls with detailed metrics
 */
export const aiLogger = logger.child({ module: 'ai' });

export function logAIRequest(params: {
  provider: string;
  model: string;
  userId?: string;
  conversationId?: string;
  tokens?: number;
  duration?: number;
  cached?: boolean;
  error?: Error;
}) {
  const { error, ...rest } = params;
  
  if (error) {
    aiLogger.error({ ...rest, error }, 'AI request failed');
  } else {
    aiLogger.info(rest, 'AI request completed');
  }
}

/**
 * Database Query Logger
 */
export const dbLogger = logger.child({ module: 'database' });

export function logQuery(query: string, duration: number, error?: Error) {
  if (error) {
    dbLogger.error({ query, duration, error }, 'Database query failed');
  } else {
    dbLogger.debug({ query, duration }, 'Database query executed');
  }
}

/**
 * Security Logger
 * For authentication, authorization, and security events
 */
export const securityLogger = logger.child({ module: 'security' });

export function logSecurityEvent(event: {
  type: 'login' | 'logout' | 'failed_login' | 'mfa_enabled' | 'password_reset' | 'suspicious_activity';
  userId?: string;
  email?: string;
  ip?: string;
  details?: any;
}) {
  securityLogger.info(event, `Security event: ${event.type}`);
}

/**
 * Performance Logger
 * Track slow operations
 */
export const perfLogger = logger.child({ module: 'performance' });

export function logSlowOperation(operation: string, duration: number, threshold = 1000) {
  if (duration > threshold) {
    perfLogger.warn({ operation, duration, threshold }, 'Slow operation detected');
  }
}

/**
 * Example Usage:
 * 
 * // Basic logging
 * logger.info('Server started', { port: 3000 });
 * logger.debug('Processing request', { userId: '123' });
 * logger.error({ error }, 'Failed to process payment');
 * 
 * // With request context
 * req.log.info('User authenticated');
 * 
 * // AI requests
 * logAIRequest({
 *   provider: 'openai',
 *   model: 'gpt-4',
 *   userId: user.id,
 *   tokens: 1500,
 *   duration: 2300,
 *   cached: false
 * });
 * 
 * // Security events
 * logSecurityEvent({
 *   type: 'failed_login',
 *   email: 'user@example.com',
 *   ip: req.ip,
 *   details: { reason: 'invalid_password' }
 * });
 * 
 * // Slow operations
 * const start = Date.now();
 * await someExpensiveOperation();
 * logSlowOperation('document_processing', Date.now() - start);
 */
