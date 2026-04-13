import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type { Express } from 'express';

/**
 * Military-grade security middleware
 * - CORS for cross-origin requests
 * - Helmet for HTTP security headers
 * - Rate limiting to prevent abuse
 * - Content Security Policy
 * - HSTS
 * - XSS Protection
 */

export function setupSecurityMiddleware(app: Express) {
  // Trust proxy for rate limiting behind reverse proxy
  app.set('trust proxy', 1);
  
  // CORS - Environment-specific origin allowlists with wildcard support
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  app.use(cors({
    origin: (origin, callback) => {
      // Allow same-origin requests (no origin header)
      if (!origin) return callback(null, true);
      
      try {
        const originUrl = new URL(origin);
        const hostname = originUrl.hostname.toLowerCase(); // Normalize to lowercase
        
        // Development: Allow localhost and 127.0.0.1
        if (isDevelopment) {
          if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return callback(null, true);
          }
          // Still allow Replit domains in dev for testing deployed previews
          if (hostname.endsWith('.repl.co') || hostname.endsWith('.replit.dev')) {
            return callback(null, true);
          }
          // Unknown origin in dev: Allow but warn (helps local testing)
          console.warn('[CORS] Unknown origin in development:', origin);
          return callback(null, true);
        }
        
        // Production: Strict wildcard matching for Replit domains and production domains
        if (hostname.endsWith('.repl.co') || hostname.endsWith('.replit.dev')) {
          return callback(null, true);
        }
        
        // Production: Allow Railway deployment domains
        if (hostname.endsWith('.up.railway.app') || hostname.endsWith('.railway.app')) {
          return callback(null, true);
        }
        
        // Production: Allow cagpt.icai.org and www.cagpt.icai.org
        if (hostname === 'cagpt.icai.org' || hostname === 'www.cagpt.icai.org') {
          return callback(null, true);
        }
        
        // Production: Allow luca.tekaccel.org
        if (hostname === 'luca.tekaccel.org') {
          return callback(null, true);
        }
        
        // Production: Allow Render deployment domain
        if (hostname === 'luca-agent.onrender.com') {
          return callback(null, true);
        }
        
        // Production: Block unknown origins - use false instead of error to avoid 500
        // Security scanners like Mozilla HTTP Observatory will be gracefully rejected
        console.warn('[CORS] Blocked origin in production:', origin);
        return callback(null, false);
        
      } catch (err) {
        // Invalid origin URL - reject gracefully
        console.error('[CORS] Invalid origin URL:', origin);
        return callback(null, false);
      }
    },
    credentials: true, // Allow cookies for authenticated origins
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
    maxAge: isDevelopment ? 600 : 86400, // 10min dev, 24h prod
  }));
  
  // Helmet - Security headers (environment-specific CSP)
  const isDev = process.env.NODE_ENV !== 'production';
  
  app.use(helmet({
    // HTTP Strict Transport Security (HSTS) - production only
    hsts: isDev ? false : {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    
    // Content Security Policy - Split by environment
    contentSecurityPolicy: {
      directives: isDev ? {
        // Development: Relaxed for Vite HMR (including ws://)
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Vite needs eval
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          "ws://localhost:*",
          "ws://127.0.0.1:*",
          "wss://localhost:*",
          "http://localhost:*",
          "http://127.0.0.1:*",
          "https://*.repl.co",
          "https://*.replit.dev",
          "wss://*.repl.co",
          "wss://*.replit.dev"
        ],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://r2cdn.perplexity.ai"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      } : {
        // Production: Strict security
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // Allow Google Fonts
        styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // Explicit style-src-elem
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          "https://*.repl.co",
          "https://*.replit.dev",
          "https://*.up.railway.app",
          "https://*.railway.app",
          "wss://*.repl.co",
          "wss://*.replit.dev",
          "wss://*.up.railway.app",
          "wss://*.railway.app",
          "wss://cagpt.icai.org",
          "wss://www.cagpt.icai.org",
          "wss://luca.tekaccel.org",
          "wss://luca-agent.onrender.com"
        ],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://r2cdn.perplexity.ai"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    
    // X-Frame-Options: Prevent clickjacking
    frameguard: {
      action: 'deny'
    },
    
    // X-Content-Type-Options: Prevent MIME sniffing
    noSniff: true,
    
    // X-XSS-Protection
    xssFilter: true,
    
    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
    
    // Hide X-Powered-By header
    hidePoweredBy: true,
  }));
}

/**
 * Rate limiting configurations for different endpoints
 */

// General API rate limit: 100 requests per 15 minutes
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

// Auth endpoints: Stricter rate limiting
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful logins
});

// File upload rate limiter: Very strict
export const fileUploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Upload limit exceeded. Please try again later.',
});

// Chat/AI endpoints: Moderate rate limiting
export const chatRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests. Please slow down.',
});

// OAuth integration rate limiter
export const integrationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 integration attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many integration attempts. Please try again later.',
});
