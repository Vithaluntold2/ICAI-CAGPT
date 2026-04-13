/**
 * Sentry Error Tracking Integration
 * 
 * Production-grade error monitoring with:
 * - Automatic error capture
 * - Performance monitoring
 * - User context
 * - Breadcrumbs (action trails)
 * - Source maps support
 * - Release tracking
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import type { Request, Response, NextFunction } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Initialize Sentry for backend
 */
export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('⚠️ SENTRY_DSN not set - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.RELEASE_VERSION || 'dev',
    
    // Performance monitoring
    tracesSampleRate: isProduction ? 0.1 : 1.0, // 10% in prod, 100% in dev
    profilesSampleRate: isProduction ? 0.1 : 1.0,
    
    integrations: [
      nodeProfilingIntegration(),
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
      Sentry.postgresIntegration(),
    ],

    // Filter out noise
    ignoreErrors: [
      'AbortError',
      'ECONNRESET',
      'ETIMEDOUT',
      'Rate limit exceeded',
    ],

    // Before sending, sanitize sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }

      // Remove sensitive query params
      if (event.request?.query_string && typeof event.request.query_string === 'string') {
        const sanitized = event.request.query_string
          .replace(/api_key=[^&]*/g, 'api_key=***')
          .replace(/token=[^&]*/g, 'token=***');
        event.request.query_string = sanitized;
      }

      return event;
    },
  });

  console.log('✅ Sentry initialized');
}

/**
 * Express middleware for request tracking
 */
export function sentryRequestHandler() {
  return Sentry.setupExpressErrorHandler;
}

/**
 * Express middleware for error handling
 */
export function sentryErrorHandler() {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    Sentry.captureException(err);
    next(err);
  };
}

/**
 * Custom error handler with Sentry
 */
export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Add user context
  if (req.user) {
    Sentry.setUser({
      id: req.user.id,
      email: req.user.email,
      tier: req.user.tier,
    });
  }

  // Add breadcrumbs
  Sentry.addBreadcrumb({
    category: 'http',
    message: `${req.method} ${req.url}`,
    level: 'info',
    data: {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
    },
  });

  // Capture exception
  Sentry.captureException(err);

  // Send error response
  const statusCode = (err as any).statusCode || 500;
  res.status(statusCode).json({
    error: isProduction ? 'Internal server error' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

/**
 * Capture custom error with context
 */
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('custom', context);
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture custom message (warnings, info)
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Track AI provider errors
 */
export function captureAIError(error: Error, provider: string, model: string) {
  Sentry.withScope((scope) => {
    scope.setTag('provider', provider);
    scope.setTag('model', model);
    scope.setContext('ai', {
      provider,
      model,
      error: error.message,
    });
    Sentry.captureException(error);
  });
}

/**
 * Track performance of operations
 */
export function trackPerformance(operation: string, duration: number) {
  Sentry.withScope((scope) => {
    scope.setTransactionName(operation);
    Sentry.metrics.distribution(operation, duration, {
      unit: 'millisecond',
    });
  });
}

/**
 * Set user context for tracking
 */
export function setUserContext(user: { id: string; email?: string; tier?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    tier: user.tier,
  });
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    level: 'info',
    data,
  });
}

/**
 * Example Usage:
 * 
 * // In server/index.ts
 * import { initSentry, sentryRequestHandler, sentryErrorHandler } from './services/sentry';
 * 
 * initSentry();
 * app.use(sentryRequestHandler());
 * 
 * // Your routes...
 * 
 * app.use(sentryErrorHandler());
 * app.use(errorMiddleware);
 * 
 * // In AI orchestrator
 * try {
 *   const response = await callAI(prompt);
 * } catch (error) {
 *   captureAIError(error, 'openai', 'gpt-4');
 *   throw error;
 * }
 * 
 * // Track slow operations
 * const start = Date.now();
 * await heavyOperation();
 * trackPerformance('heavy_operation', Date.now() - start);
 * 
 * // Add debugging context
 * addBreadcrumb('User uploaded document', { fileSize: file.size });
 */

/**
 * Environment Variables Required:
 * 
 * SENTRY_DSN=https://xxx@sentry.io/xxx
 * RELEASE_VERSION=1.0.0  # Optional, for release tracking
 * NODE_ENV=production
 */
