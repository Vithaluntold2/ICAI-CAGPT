import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from 'pg';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { VirusScanService } from "./services/virusScanService";
import { apmService } from "./services/apmService";
import { validateEnvironmentOrThrow, getEnvironmentInfo } from "./utils/envValidator";
import { getFeatureFlags, getDisabledFeatures } from "./config/featureFlags";

// =============================================================================
// GLOBAL ERROR HANDLERS - Catch unhandled errors to prevent crashes
// =============================================================================

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  console.error(error.stack);
  
  // Log to APM if available
  try {
    apmService.trackError(error, { type: 'uncaughtException', fatal: true });
  } catch (e) {
    // APM might not be initialized
  }
  
  // Give time for logs to flush, then exit
  // In production, the process manager (PM2, Docker, etc.) will restart
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Log environment information on startup
const envInfo = getEnvironmentInfo();
console.log('[INFO] Environment:', envInfo.environment);
console.log('[INFO] Node version:', envInfo.nodeVersion);
console.log('[INFO] Features enabled:', Object.keys(envInfo.features || {}).filter(k => envInfo.features![k]).join(', '));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('[ERROR] Unhandled Promise Rejection:', reason);
  console.error('[ERROR] Promise:', promise);
  
  // Log to APM if available
  try {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    apmService.trackError(error, { 
      type: 'unhandledRejection',
      promise: String(promise)
    });
  } catch (e) {
    // APM might not be initialized
  }
  
  // In Node.js 15+, unhandled rejections cause the process to exit by default
  // We log but don't exit immediately to allow graceful handling
});

// Handle SIGTERM (graceful shutdown)
process.on('SIGTERM', () => {
  console.log('[Shutdown] SIGTERM received, shutting down gracefully...');
  
  // Give time for in-flight requests to complete
  setTimeout(() => {
    console.log('[Shutdown] Goodbye!');
    process.exit(0);
  }, 5000);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('[Shutdown] SIGINT received, shutting down...');
  
  process.exit(0);
});

const app = express();

// Session secret (export for WebSocket authentication)
export const SESSION_SECRET = process.env.SESSION_SECRET || 'ca-gpt-session-secret-change-in-production';

// Cleanup old session table and create new one before connect-pg-simple runs
async function initializeSessionTable(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Drop old conflicting index and table
    await pool.query('DROP INDEX IF EXISTS "IDX_session_expire"');
    await pool.query('DROP TABLE IF EXISTS "sessions"');
    console.log('[Session] Cleaned up old session artifacts');
    
    // Create user_sessions table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid")
      )
    `);
    
    // Create index only if it doesn't exist
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "user_sessions_expire_idx" ON "user_sessions" ("expire")
    `);
    
    console.log('[Session] ✓ Session table ready');
  } catch (err: any) {
    console.error('[Session] Table init error:', err.message);
  } finally {
    await pool.end();
  }
}

// Session store will be set after initialization
let sessionStore: any = null;

// Create session store using PostgreSQL (persistent across restarts)
const createSessionStore = () => {
  const PgStore = connectPgSimple(session);
  
  console.log('[Session] Using PostgreSQL session store');
  return new PgStore({
    conString: process.env.DATABASE_URL,
    tableName: 'user_sessions',
    createTableIfMissing: false, // We create it ourselves above
    pruneSessionInterval: false, // Disable auto-prune to prevent log spam (rely on TTL)
    ttl: 30 * 24 * 60 * 60, // 30 days - sessions auto-expire
    errorLog: (error: any) => {
      // Ignore "already exists" and prune errors (handled by TTL)
      if (error?.message?.includes('already exists') || 
          error?.message?.includes('prune') ||
          error?.code === '42P01') { // relation does not exist
        return;
      }
      // Only log genuine errors
      console.error('[Session] Store error:', error?.message || error);
    }
  });
};

export { sessionStore };

// Session configuration with hardened security
const sessionConfig: session.SessionOptions = {
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'cagpt.sid', // Custom session name (hides tech stack)
  cookie: {
    httpOnly: true, // Prevents client-side JavaScript access
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const, // Allow cross-site in production for OAuth
  },
  store: sessionStore,
  rolling: true, // Reset maxAge on every request (keeps active sessions alive)
};

// In production, enforce secure cookies
if (process.env.NODE_ENV === 'production') {
  if (sessionConfig.cookie) {
    sessionConfig.cookie.secure = true;
    sessionConfig.cookie.sameSite = 'lax'; // Changed from 'strict' to allow authentication redirects
  }
}

// Log session configuration for debugging
if (process.env.NODE_ENV !== 'production') {
  console.log('[Session] Configuration:', {
    secure: sessionConfig.cookie?.secure,
    sameSite: sessionConfig.cookie?.sameSite,
    store: process.env.DATABASE_URL ? 'PostgreSQL' : 'Memory'
  });
}

// Flag to track if server is ready
let serverReady = false;

// Early middleware to reject requests until server is ready
app.use((req, res, next) => {
  if (!serverReady && !req.path.startsWith('/health')) {
    return res.status(503).json({ error: 'Server starting up, please wait...' });
  }
  next();
});

// NOTE: Session middleware is applied in async startup after table initialization

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '10mb', // Increased from default 100kb to handle file metadata and long messages
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// APM Tracking Middleware
app.use(apmService.trackRequest());

// Security headers - conditional based on request path
app.use((req, res, next) => {
  // Stricter CSP for auth routes, relaxed for API routes
  const isAuthRoute = req.path.startsWith('/api/auth');
  const isApiRoute = req.path.startsWith('/api/');
  
  if (isAuthRoute) {
    // Stricter policy for authentication endpoints
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self'; " +
      "img-src 'self' data:; " +
      "connect-src 'self';"
    );
  } else if (isApiRoute) {
    // Relaxed for API endpoints
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "media-src 'self' data: blob:; " +
      "connect-src 'self' https://api.openai.com https://*.openai.com https://*.anthropic.com;"
    );
  } else {
    // Default for other routes
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "media-src 'self' data: blob:; " +
      "connect-src 'self' https://api.openai.com https://*.openai.com https://*.anthropic.com;"
    );
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize session table FIRST (cleanup old artifacts and create table)
  await initializeSessionTable();

  // Ensure guide_test_results table exists (created on first deploy via raw SQL)
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "guide_test_results" (
          "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          "test_id" text NOT NULL,
          "tester" text NOT NULL,
          "status" text NOT NULL DEFAULT 'pending',
          "notes" text DEFAULT '',
          "updated_at" timestamp NOT NULL DEFAULT now(),
          "created_at" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "guide_test_results_test_id_tester_idx" UNIQUE ("test_id", "tester")
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS "guide_test_results_test_id_idx" ON "guide_test_results" ("test_id")`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "guide_test_results_tester_idx" ON "guide_test_results" ("tester")`);
      console.log('[Startup] ✓ guide_test_results table ready');
    } catch (err: any) {
      console.error('[Startup] guide_test_results table init error:', err.message);
    } finally {
      await pool.end();
    }
  }
  
  // Now create the session store (table already exists)
  sessionStore = createSessionStore();
  
  // Update session config with the store
  sessionConfig.store = sessionStore;
  
  // Apply session middleware NOW (after store is ready)
  app.use(session(sessionConfig));
  
  // Validate environment at startup
  try {
    validateEnvironmentOrThrow();
    log('[Startup] ✓ Environment validation passed');
  } catch (err: any) {
    console.error('[Startup] ✗ Environment validation failed:', err.message);
    process.exit(1);
  }

  // Log feature flags
  const features = getFeatureFlags();
  const disabledFeatures = getDisabledFeatures();
  log('[Features] Enabled features:');
  Object.entries(features)
    .filter(([_, enabled]) => enabled)
    .forEach(([feature]) => log(`  ✓ ${feature}`));
  
  if (disabledFeatures.length > 0) {
    log('[Features] Disabled features:');
    disabledFeatures.forEach(f => log(`  ✗ ${f.feature}: ${f.reason}`));
  }

  const server = await registerRoutes(app);

  // Global error handler - catches all unhandled errors
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    // Handle CORS errors gracefully (shouldn't happen now but just in case)
    if (err.message?.includes('CORS')) {
      console.warn('[APM] CORS rejection:', req.method, req.path, err.message);
      return res.status(403).json({ error: 'CORS policy violation' });
    }
    
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log server errors for APM
    if (status >= 500) {
      console.error(`[APM] ERROR: HTTP ${status} - ${req.method} ${req.path}`, err);
    }
    
    res.status(status).json({ error: message });
    // Don't re-throw - this was causing unhandled rejections
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  const isProduction = process.env.NODE_ENV === 'production';
  log(`[Startup] NODE_ENV: ${process.env.NODE_ENV}, isProduction: ${isProduction}`);
  
  if (!isProduction) {
    log('[Vite] Setting up Vite dev server...');
    await setupVite(app, server);
    log('[Vite] Vite dev server ready');
  } else {
    log('[Static] Serving static files (production mode)');
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = process.env.HOST || "localhost";
  
  // Note: reusePort is not supported on Windows, so we conditionally use it
  const listenOptions: { port: number; host: string; reusePort?: boolean } = {
    port,
    host,
  };
  
  // Only enable reusePort on non-Windows systems
  if (process.platform !== 'win32') {
    listenOptions.reusePort = true;
  }
  
  server.listen(listenOptions, () => {
    // Mark server as ready to accept requests
    serverReady = true;
    log(`serving on port ${port}`);
    
    // Start periodic virus scanning for uploaded tax files
    // Increased interval to 15 minutes to reduce DB load
    const scanIntervalMinutes = parseInt(process.env.VIRUS_SCAN_INTERVAL || '15', 10);
    VirusScanService.startPeriodicScanning(scanIntervalMinutes);
    log(`Virus scanning enabled (provider: ${process.env.VIRUS_SCAN_PROVIDER || 'clamav'}, interval: ${scanIntervalMinutes}min)`);
  });
})();
