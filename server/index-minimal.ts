import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import { setupVite, serveStatic, log } from "./vite";
import { setupTempAuth } from "./tempAuth";

const app = express();

const MemoryStoreSession = MemoryStore(session);

// Create session store
export const sessionStore = new MemoryStoreSession({
  checkPeriod: 86400000 // Prune expired entries every 24h
});

// Session secret
export const SESSION_SECRET = process.env.SESSION_SECRET || 'luca-session-secret-change-in-production';

// Session configuration
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'luca.sid',
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'lax',
  },
  store: sessionStore,
  rolling: true,
}));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

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
  // Setup temporary authentication
  setupTempAuth(app);
  
  // Basic health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  
  // Basic user info endpoint
  app.get("/api/user", (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    res.json({
      user: {
        id: 'admin-123',
        email: 'admin@sterling.com',
        name: 'Admin User',
        subscription_tier: 'professional',
        isAdmin: true  // Frontend expects isAdmin not is_admin
      }
    });
  });
  
  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie('luca.sid');
      res.json({ message: "Logged out successfully" });
    });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Start server first
  const port = parseInt(process.env.PORT || '3000', 10);
  const server = app.listen(port, "0.0.0.0", () => {
    log(`🚀 Server running on port ${port}`);
    log(`🔧 Using temporary authentication`);
    log(`📧 Login: admin@sterling.com`);
    log(`🔑 Password: password123456`);
  });

  // Setup Vite after server is created
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
})();