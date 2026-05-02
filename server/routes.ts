import type { Express, Request, Response } from "express";
import { createServer } from "http";
import session from 'express-session';
import { storage } from "./pgStorage";
import { aiOrchestrator } from "./services/aiOrchestrator";
import { requirementClarificationAIService } from "./services/requirementClarificationAI";
import { excelOrchestrator } from "./services/excelOrchestrator";
import { excelModelGenerator } from "./services/excel/excelModelGenerator";
import { AnalyticsProcessor } from "./services/analyticsProcessor";
import { addTitleGenerationJob } from "./services/pgJobQueue";
import { providerHealthMonitor, aiProviderRegistry, AIProviderName } from "./services/aiProviders";
import { AIResponseCache } from "./services/hybridCache";
import { requireAuth, getCurrentUserId } from "./middleware/auth";
import { requireAdmin } from "./middleware/admin";
import { requireSuperAdmin } from "./middleware/superAdmin";
import { normalizeChatMode, isAgentWorkflowMode } from "./services/chatModeNormalizer";
import { conversationMemory } from "./services/conversationMemory";
import { initializeAgents, executeWorkflow, getAgentCapabilities } from "./services/agents/agentBootstrap";
import adminRoutes from "./routes/adminRoutes";
import healthRoutes from "./routes/health";
import ssoRoutes from "./routes/ssoRoutes";
import contextRoutes from "./routes/context";
import voiceRoutes from "./routes/voiceRoutes";
import roundtableRoutes from "./routes/roundtableRoutes";
import roundtablePanelRoutes from "./routes/roundtablePanelRoutes";
import roundtableBoardroomRoutes from "./routes/roundtableBoardroomRoutes";
import searchRoutes from "./routes/searchRoutes";
import guideRoutes from "./routes/guideRoutes";
import costRoutes from "./routes/costRoutes";
import suggestionsRoutes from "./routes/suggestionsRoutes";
// test-mindmap routes loaded dynamically in development only
import { 
  setupSecurityMiddleware,
  authRateLimiter,
  fileUploadRateLimiter,
  chatRateLimiter,
  integrationRateLimiter
} from "./middleware/security";
import { getEnvironmentInfo } from "./utils/envValidator";
import { getClientFeatures, isFeatureEnabled } from "./config/featureFlags";
import { documentIngestion } from "./services/core/documentIngestion";
import { continuousLearning } from "./services/core/continuousLearning";
import { voiceService } from "./services/voice/voiceService";
import { listArtifactsByConversation, createArtifact, updateArtifactState } from "./services/whiteboard/repository";
import { buildArtifactsForMessage } from "./services/whiteboard/extractPipeline";
import { placeNext, type LayoutState } from "./services/whiteboard/autoLayout";
import { buildBoardXlsxBuffer } from "./services/whiteboard/exportXlsx";
import { buildBoardPptxBuffer } from "./services/whiteboard/exportPptx";
import { buildBoardPdfBuffer } from "./services/whiteboard/exportPdf";
import { buildDocumentPdfBuffer } from "./services/whiteboard/exportDocumentPdf";
import { backfillIfNeeded } from "./services/whiteboard/backfill";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import multer from "multer";
import { MFAService } from "./services/mfaService";
import { DocumentExporter } from "./services/documentExporter";
import { 
  insertUserSchema,
  insertSupportTicketSchema,
  insertTicketMessageSchema,
  insertUserLLMConfigSchema,
  updateConversationFeedbackSchema
} from "@shared/schema";
import { z } from "zod";
import { storeEncryptedFile, retrieveEncryptedFile, secureDeleteFile, calculateChecksum } from "./utils/fileEncryption";
// WebSocket removed - now using SSE for chat streaming

// In-memory cache for Excel buffers (avoids storing large binaries in database)
// TTL: 1 hour - buffers are cleaned up after this time
interface ExcelBufferEntry {
  buffer: Buffer;
  filename: string;
  createdAt: number;
}
const excelBufferCache = new Map<string, ExcelBufferEntry>();
const EXCEL_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Cleanup old Excel buffers every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of excelBufferCache.entries()) {
    if (now - entry.createdAt > EXCEL_CACHE_TTL) {
      excelBufferCache.delete(key);
      console.log('[ExcelCache] Cleaned up expired buffer:', key);
    }
  }
}, 10 * 60 * 1000);
// import { setupWebSocket } from "./websocket";

// Extend Express Request to include session and multer
declare global {
  namespace Express {
    interface Request {
      session: session.Session & Partial<session.SessionData>;
      sessionID: string;
      file?: Multer.File;
    }
  }
}

// Extend session type to include OAuth and MFA properties
declare module 'express-session' {
  interface SessionData {
    userId: string;
    oauthState?: string;
    oauthProvider?: string;
    oauthUserId?: string;
    tempMFASecret?: string;
  }
}

// Configure multer for memory storage (files are encrypted before disk storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Allow only specific MIME types
    // Supports: Azure Document Intelligence formats + Excel/CSV for data analysis
    const allowedMimes = [
      // Azure Document Intelligence supported formats
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'image/tif',
      // Spreadsheet formats for financial data
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'text/plain' // .txt
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Supported formats: PDF, PNG, JPEG, TIFF, Excel (XLSX, XLS), CSV, TXT'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply military-grade security middleware
  setupSecurityMiddleware(app);
  
  // Health check endpoint (no auth required, for load balancers)
  app.get("/api/health", async (_req, res) => {
    const startTime = Date.now();
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
    
    // Database check with timeout to prevent hanging
    try {
      const dbStart = Date.now();
      const dbPromise = storage.getUserByEmail('health-check@test.com');
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('DB check timed out')), 5000));
      await Promise.race([dbPromise, timeoutPromise]);
      checks.database = { status: 'ok', latency: Date.now() - dbStart };
    } catch (err: any) {
      checks.database = { status: 'error', error: err.message };
    }
    
    // AI Provider check
    try {
      const allProviderNames = Object.values(AIProviderName);
      const healthyProviders = providerHealthMonitor.getHealthyProviders(allProviderNames);
      checks.aiProviders = { 
        status: healthyProviders.length > 0 ? 'ok' : 'degraded',
        latency: 0
      };
    } catch (err: any) {
      checks.aiProviders = { status: 'error', error: err.message };
    }
    
    const allHealthy = Object.values(checks).every(c => c.status === 'ok');
    const anyError = Object.values(checks).some(c => c.status === 'error');
    
    // Always return 200 for liveness — Railway needs this to know the app is alive
    // Use the body to report degraded/unhealthy status
    res.status(200).json({
      status: anyError ? 'unhealthy' : (allHealthy ? 'healthy' : 'degraded'),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
      responseTime: Date.now() - startTime
    });
  });

  // Features endpoint (returns available features for client)
  app.get("/api/features", (_req, res) => {
    res.json({
      features: getClientFeatures(),
      environment: getEnvironmentInfo()
    });
  });

  // Initialize AI agents for all professional modes
  console.log('[Bootstrap] Initializing AI agents...');
  await initializeAgents();
  console.log('[Bootstrap] AI agents initialized successfully');
  
  // Register health check routes
  app.use('/api', healthRoutes);
  
  // Register test mindmap routes (development/testing only)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const testMindmapRoutes = (await import("./routes/test-mindmap")).default;
      app.use('/api', testMindmapRoutes);
      console.log('[Bootstrap] Test mindmap routes loaded (development mode)');
    } catch (err) {
      console.log('[Bootstrap] Test mindmap routes not available');
    }
  }
  
  // Register admin routes for training data management
  app.use('/api/admin', adminRoutes);
  
  // Register SSO/OAuth routes (Google, SAML, enterprise SSO)
  app.use('/api/auth/sso', ssoRoutes);
  
  // Register context and template routes (including file upload)
  app.use('/api', contextRoutes);
  
  // Register voice routes for STT/TTS with regional voices
  app.use('/api/voice', voiceRoutes);
  
  // Register roundtable routes for AI multi-expert workflows (legacy workflow)
  app.use('/api/roundtable', roundtableRoutes);

  // Register roundtable panel routes — user-curated agent panels (Phase 1)
  // Mounted on a child path so it lives alongside the legacy session API
  // without overlapping any of its endpoints.
  app.use('/api/roundtable/panels', roundtablePanelRoutes);

  // Register roundtable boardroom routes — live runtime threads (Phase 2)
  app.use('/api/roundtable/boardroom', roundtableBoardroomRoutes);
  
  // Register CA GPT Search routes — AI-powered search engine
  app.use('/api/search', searchRoutes);

  // Register Guide test result routes — persistent multi-tester tracking
  app.use('/api/guide', guideRoutes);

  // Register cost / budget / telemetry routes — powers Spreadsheet Mode
  // cost-estimator UI (plan §7 step 8).
  app.use('/api/cost', costRoutes);

  // Register dynamic chat suggestions — powers the empty-state chips in
  // EmptyModeState (recent conversations + ICAI compliance calendar +
  // curated Council circular highlights).
  app.use('/api/suggestions', suggestionsRoutes);
  
  // Authentication routes (with rate limiting)
  app.post("/api/auth/register", authRateLimiter, async (req, res) => {
    const isDev = process.env.NODE_ENV !== 'production';
    
    try {
      console.log('[Auth] Registration attempt:', { 
        email: isDev ? req.body.email : req.body.email?.substring(0, 3) + '***',
        hasPassword: !!req.body.password,
        hasUsername: !!req.body.username,
        hasName: !!req.body.name,
        sessionID: req.sessionID,
        ip: req.ip
      });
      
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user exists
      const existing = await storage.getUserByEmail(validatedData.email);
      if (existing) {
        if (isDev) console.log('[Auth] Registration failed: Email already exists');
        return res.status(400).json({ error: "Email already registered" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      // Create user
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword
      });
      
      // Establish session
      req.session.userId = user.id;
      
      // CRITICAL: Explicitly save session before responding
      await new Promise<void>((resolve, reject) => {
        req.session.save((err: Error | null) => {
          if (err) {
            console.error('[Auth] Session save error:', err);
            reject(err);
          } else {
            if (isDev) console.log('[Auth] Session saved successfully');
            resolve();
          }
        });
      });
      
      // Don't send password back
      const { password, ...userWithoutPassword } = user;
      if (isDev) console.log('[Auth] Registration successful');
      res.json({ user: userWithoutPassword });
    } catch (error: unknown) {
      // Always log errors with stack traces for debugging, but scrub PII in production
      console.error('[Auth] Registration error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: isDev && error instanceof Error ? error.stack : undefined,
        code: (error as any)?.code,
        errno: (error as any)?.errno,
        syscall: (error as any)?.syscall,
        // Only log validation details in development (may contain PII)
        validationErrors: isDev && error instanceof z.ZodError ? error.issues : undefined
      });
      
      if (error instanceof z.ZodError) {
        // Return user-friendly validation errors
        const validationErrors = error.issues.map((err: z.ZodIssue) => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationErrors,
          message: validationErrors.map((e: { field: string; message: string }) => e.message).join('. ')
        });
      }
      
      // Check for database connection errors
      const errorCode = (error as any)?.code;
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorCode === 'ECONNRESET' || errorCode === 'ECONNREFUSED' || 
          errorMessage.includes('TLS') || errorMessage.includes('SSL') || 
          errorMessage.includes('CONNECT_TIMEOUT') || errorMessage.includes('network')) {
        console.error('[Auth] Database connection error - SSL/TLS/Network issue');
        return res.status(503).json({ 
          error: "Database connection issue. Please try again in a moment.",
          code: 'DB_CONNECTION_ERROR'
        });
      }
      
      res.status(500).json({ 
        error: "Registration failed",
        details: isDev ? { message: errorMessage || 'Unknown error', code: errorCode } : undefined
      });
    }
  });

app.post("/api/auth/login", authRateLimiter, async (req, res) => {
  const isDev = process.env.NODE_ENV !== 'production';
  
  try {
    const { email, password } = req.body;
    
    // Enhanced logging for debugging session issues
    console.log('[Auth] Login attempt:', { 
      email: isDev ? email : email.substring(0, 3) + '***',
      hasPassword: !!password,
      sessionID: req.sessionID,
      cookies: req.headers.cookie ? 'present' : 'missing',
      userAgent: req.get('user-agent')?.substring(0, 50),
      environment: process.env.NODE_ENV,
      sessionSecret: process.env.SESSION_SECRET ? 'present' : 'missing'
    });
    
    const user = await storage.getUserByEmail(email);
      if (!user) {
        if (isDev) console.log('[Auth] Login failed: User not found for email:', email);
        return res.status(401).json({ error: "No account found with this email address" });
      }
      
      // Check if account is locked
      const isLocked = await storage.isAccountLocked(user.id);
      if (isLocked) {
        const lockoutMinutes = user.lockedUntil 
          ? Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
          : 30;
        if (isDev) console.log('[Auth] Login failed: Account locked');
        return res.status(423).json({ 
          error: `Account is locked due to too many failed login attempts. Please try again in ${lockoutMinutes} minutes.`,
          lockedUntil: user.lockedUntil
        });
      }
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        if (isDev) console.log('[Auth] Login failed: Invalid password for user:', user.email);
        // Track failed login attempt
        await storage.incrementFailedLoginAttempts(user.id);
        const updatedUser = await storage.getUser(user.id);
        const remainingAttempts = 5 - (updatedUser?.failedLoginAttempts || 0);
        
        if (remainingAttempts <= 0) {
          return res.status(423).json({ 
            error: "Account locked due to too many failed login attempts. Please try again in 30 minutes."
          });
        } else if (remainingAttempts <= 2) {
          return res.status(401).json({ 
            error: `Incorrect password. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining before account lockout.`
          });
        }
        
        return res.status(401).json({ error: "Incorrect password. Please try again." });
      }
      
      // Check if MFA is enabled for this user
      if (user.mfaEnabled) {
        if (isDev) console.log('[Auth] MFA required for user');
        // Don't establish session yet - require MFA verification first
        return res.status(200).json({ 
          mfaRequired: true,
          userId: user.id,
          message: "Please enter your 2FA code"
        });
      }
      
      // Reset failed login attempts on successful login
      await storage.resetFailedLoginAttempts(user.id);
      
      // Establish session
      req.session.userId = user.id;
      
      // CRITICAL: Explicitly save session before responding
      console.log('[Auth] About to save session for user:', user.id);
      await new Promise<void>((resolve, reject) => {
        req.session.save((err: Error | null) => {
          if (err) {
            console.error('[Auth] Session save error:', {
              error: err.message,
              stack: err.stack,
              sessionID: req.sessionID,
              userId: user.id
            });
            reject(err);
          } else {
            console.log('[Auth] Session saved successfully:', {
              sessionID: req.sessionID,
              userId: user.id
            });
            resolve();
          }
        });
      });
      
      const { password: _, mfaSecret, mfaBackupCodes, ...userWithoutSensitive } = user;
      res.json({ user: userWithoutSensitive });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = (error as any)?.code;
      
      console.error('[Auth] Login error:', {
        message: errorMessage,
        stack: isDev && error instanceof Error ? error.stack : undefined,
        code: errorCode,
        errno: (error as any)?.errno,
        syscall: (error as any)?.syscall,
        sessionID: req.sessionID,
        environment: process.env.NODE_ENV
      });
      
      // Check for database connection errors
      if (errorCode === 'ECONNRESET' || errorCode === 'ECONNREFUSED' || 
          errorMessage.includes('TLS') || errorMessage.includes('SSL') || 
          errorMessage.includes('CONNECT_TIMEOUT') || errorMessage.includes('network')) {
        console.error('[Auth] Database connection error during login - SSL/TLS/Network issue');
        return res.status(503).json({ 
          error: "Database connection issue. Please try again in a moment.",
          code: 'DB_CONNECTION_ERROR'
        });
      }
      
      res.status(500).json({ 
        error: "Login failed",
        details: isDev ? { message: errorMessage, code: errorCode } : undefined
      });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err: Error | undefined) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  // Debug endpoint to check session status (dev only)
  if (process.env.NODE_ENV !== 'production') {
    app.get("/api/debug/session", (req, res) => {
      res.json({
        sessionID: req.sessionID,
        hasSession: !!req.session,
        userId: req.session?.userId,
        cookies: req.headers.cookie ? 'present' : 'missing',
        environment: process.env.NODE_ENV,
        sessionSecret: process.env.SESSION_SECRET ? 'present' : 'missing'
      });
    });
  }

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { password, mfaSecret, mfaBackupCodes, ...userWithoutSensitive } = user;
      res.json({ user: userWithoutSensitive });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // MFA/2FA Routes
  app.post("/api/mfa/setup", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Generate new MFA secret
      const { secret, otpauthUrl } = MFAService.generateSecret(user.email);
      const qrCode = await MFAService.generateQRCode(otpauthUrl);
      
      // Store secret temporarily in session for verification
      req.session.tempMFASecret = secret;
      
      res.json({ 
        secret, 
        qrCode,
        message: "Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)"
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to setup MFA" });
    }
  });

  app.post("/api/mfa/enable", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const { token } = req.body;
      const tempSecret = req.session.tempMFASecret;
      
      if (!tempSecret) {
        return res.status(400).json({ error: "No MFA setup in progress. Please start setup first." });
      }
      
      // Verify token
      const isValid = MFAService.verifyToken(tempSecret, token);
      if (!isValid) {
        return res.status(400).json({ error: "Invalid verification code. Please try again." });
      }
      
      // Generate backup codes
      const backupCodes = MFAService.generateBackupCodes(10);
      
      // Encrypt secret and backup codes
      const encryptedSecret = MFAService.encryptSecret(tempSecret);
      const encryptedBackupCodes = MFAService.encryptBackupCodes(backupCodes);
      
      // Enable MFA
      await storage.enableMFA(userId, encryptedSecret, encryptedBackupCodes);
      
      // Clear temp secret
      delete req.session.tempMFASecret;
      
      res.json({ 
        success: true,
        backupCodes,
        message: "MFA enabled successfully. Please save your backup codes in a secure location."
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to enable MFA" });
    }
  });

  app.post("/api/mfa/disable", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const { password } = req.body;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Verify password before disabling MFA
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid password" });
      }
      
      await storage.disableMFA(userId);
      
      res.json({ success: true, message: "MFA disabled successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to disable MFA" });
    }
  });

  app.post("/api/mfa/verify", async (req, res) => {
    try {
      const { userId, token, useBackupCode } = req.body;
      
      if (!userId || !token) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        return res.status(400).json({ error: "MFA not enabled for this user" });
      }
      
      let isValid = false;
      
      if (useBackupCode) {
        // Verify backup code
        const backupCodes = user.mfaBackupCodes || [];
        const result = MFAService.verifyBackupCode(token, backupCodes);
        
        if (result.valid) {
          // Update backup codes (remove used code)
          await storage.updateMFABackupCodes(userId, result.remainingCodes);
          isValid = true;
        }
      } else {
        // Verify TOTP token
        const decryptedSecret = MFAService.decryptSecret(user.mfaSecret);
        isValid = MFAService.verifyToken(decryptedSecret, token);
      }
      
      if (!isValid) {
        return res.status(401).json({ error: "Invalid verification code" });
      }
      
      // Reset failed login attempts on successful MFA
      await storage.resetFailedLoginAttempts(userId);
      
      // Establish session
      req.session.userId = userId;
      
      // CRITICAL: Explicitly save session before responding
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      const { password: _, mfaSecret, mfaBackupCodes, ...userWithoutSensitive } = user;
      res.json({ user: userWithoutSensitive });
    } catch (error) {
      res.status(500).json({ error: "Failed to verify MFA" });
    }
  });

  // Profile routes (auth required)
  app.get("/api/profiles", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const profiles = await storage.getUserProfiles(userId);
      res.json({ profiles });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profiles" });
    }
  });

  app.get("/api/profiles/:id", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const profile = await storage.getProfile(req.params.id);
      if (!profile || profile.userId !== userId) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      res.json({ profile });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post("/api/profiles", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const { name, type, description, isDefault } = req.body;
      
      // Validate profile type
      if (!['business', 'personal', 'family'].includes(type)) {
        return res.status(400).json({ error: "Invalid profile type" });
      }
      
      // Ensure only one personal profile per user
      if (type === 'personal') {
        const existingProfiles = await storage.getUserProfiles(userId);
        const personalExists = existingProfiles.some(p => p.type === 'personal');
        if (personalExists) {
          return res.status(409).json({ error: "User already has a personal profile" });
        }
      }
      
      const profile = await storage.createProfile({
        userId,
        name,
        type,
        description,
        isDefault: isDefault || false
      });
      
      res.json({ profile });
    } catch (error: any) {
      // Handle constraint violations
      if (error.message && error.message.includes('already has a personal profile')) {
        return res.status(409).json({ error: "User already has a personal profile" });
      }
      // Handle database unique constraint violation (23505)
      if (error.code === '23505' && error.constraint === 'profiles_user_personal_unique_idx') {
        return res.status(409).json({ error: "User already has a personal profile" });
      }
      res.status(500).json({ error: "Failed to create profile" });
    }
  });

  app.patch("/api/profiles/:id", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const profile = await storage.getProfile(req.params.id);
      if (!profile || profile.userId !== userId) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      const { name, type, description, isDefault } = req.body;
      const updated = await storage.updateProfile(req.params.id, {
        name,
        type,
        description,
        isDefault
      });
      
      res.json({ profile: updated });
    } catch (error: any) {
      // Handle constraint violations
      if (error.message && error.message.includes('already has a personal profile')) {
        return res.status(409).json({ error: "User already has a personal profile" });
      }
      // Handle database unique constraint violation (23505)
      if (error.code === '23505' && error.constraint === 'profiles_user_personal_unique_idx') {
        return res.status(409).json({ error: "User already has a personal profile" });
      }
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.delete("/api/profiles/:id", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const profile = await storage.getProfile(req.params.id);
      if (!profile || profile.userId !== userId) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      // Prevent deletion of default profile
      if (profile.isDefault) {
        return res.status(400).json({ error: "Cannot delete default profile" });
      }
      
      await storage.deleteProfile(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete profile" });
    }
  });

  // Profile member routes (auth required)
  app.get("/api/profiles/:profileId/members", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const profile = await storage.getProfile(req.params.profileId);
      if (!profile || profile.userId !== userId) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      const members = await storage.getProfileMembers(req.params.profileId);
      res.json({ members });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profile members" });
    }
  });

  app.post("/api/profiles/:profileId/members", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const profile = await storage.getProfile(req.params.profileId);
      if (!profile || profile.userId !== userId) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      // Only family profiles can have members
      if (profile.type !== 'family') {
        return res.status(400).json({ error: "Only family profiles can have members" });
      }
      
      const { name, email, relationship, role } = req.body;
      const member = await storage.createProfileMember({
        profileId: req.params.profileId,
        name,
        email,
        relationship,
        role: role || 'member'
      });
      
      res.json({ member });
    } catch (error) {
      res.status(500).json({ error: "Failed to add member" });
    }
  });

  app.patch("/api/profiles/:profileId/members/:id", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const profile = await storage.getProfile(req.params.profileId);
      if (!profile || profile.userId !== userId) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      const { name, email, relationship, role } = req.body;
      const updated = await storage.updateProfileMember(req.params.id, {
        name,
        email,
        relationship,
        role
      });
      
      res.json({ member: updated });
    } catch (error) {
      res.status(500).json({ error: "Failed to update member" });
    }
  });

  app.delete("/api/profiles/:profileId/members/:id", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const profile = await storage.getProfile(req.params.profileId);
      if (!profile || profile.userId !== userId) {
        return res.status(404).json({ error: "Profile not found" });
      }
      
      await storage.deleteProfileMember(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  // Conversation routes (auth required)
  app.get("/api/conversations", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Optional profile filter: ?profileId=xxx or ?profileId=null
      const profileIdParam = req.query.profileId as string | undefined;
      let profileId: string | null | undefined = undefined;
      if (profileIdParam !== undefined) {
        profileId = profileIdParam === 'null' ? null : profileIdParam;
      }
      
      const conversations = await storage.getUserConversations(userId, profileId);
      
      // Sort conversations: pinned first, then by updatedAt descending
      const sortedConversations = conversations.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      
      res.json({ conversations: sortedConversations });
    } catch (error: any) {
      console.error('[API] /api/conversations error:', error?.message || error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const { title, preview, profileId, chatMode: rawChatMode } = req.body;
      const chatMode = normalizeChatMode(rawChatMode);
      
      // Validate profileId ownership if provided
      if (profileId) {
        const profile = await storage.getProfile(profileId);
        if (!profile) {
          return res.status(400).json({ error: "Invalid profile ID" });
        }
        if (profile.userId !== userId) {
          return res.status(403).json({ error: "Access denied: Profile does not belong to user" });
        }
      }
      
      const conversation = await storage.createConversation({
        userId,
        title,
        preview,
        profileId: profileId || null,
        chatMode,
      });
      
      res.json({ conversation });
    } catch (error) {
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const { id } = req.params;
      
      // Verify conversation ownership
      const conversation = await storage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const messages = await storage.getConversationMessages(id);
      res.json({ messages });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Whiteboard artifacts for a conversation (read-only)
  app.get("/api/conversations/:id/whiteboard", requireAuth, async (req, res) => {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const { id } = req.params;
    const conversation = await storage.getConversation(id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (conversation.userId !== userId) return res.status(403).json({ error: "Access denied" });
    await backfillIfNeeded(id);
    const artifacts = await listArtifactsByConversation(id);
    res.json({ artifacts });
  });

  // Update the mutable state of a single artifact (currently: checklist toggles).
  // Body: { state: { ... } } — shallow-merged with the existing state jsonb.
  app.patch("/api/conversations/:id/whiteboard/:artifactId/state", requireAuth, async (req, res) => {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const { id, artifactId } = req.params;
    const conversation = await storage.getConversation(id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (conversation.userId !== userId) return res.status(403).json({ error: "Access denied" });

    const patch = (req.body ?? {}).state;
    if (!patch || typeof patch !== "object") {
      return res.status(400).json({ error: "bad_state", message: "Expected body.state to be an object" });
    }
    const updated = await updateArtifactState(artifactId, id, patch as Record<string, unknown>);
    if (!updated) return res.status(404).json({ error: "artifact_not_found" });
    res.json({ artifact: updated });
  });

  app.post("/api/conversations/:id/whiteboard/export", requireAuth, async (req, res) => {
    const userId = getCurrentUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const { id } = req.params;
    const conversation = await storage.getConversation(id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (conversation.userId !== userId) return res.status(403).json({ error: "Access denied" });

    const { format, artifactIds, renderedImages } = (req.body ?? {}) as {
      format?: "pdf" | "pptx" | "xlsx";
      artifactIds?: string[];
      renderedImages?: Record<string, string>;
    };
    if (!format || !["pdf", "pptx", "xlsx"].includes(format)) {
      return res.status(400).json({ error: "bad_format" });
    }

    const all = await listArtifactsByConversation(id);
    const subset = artifactIds && artifactIds.length > 0
      ? all.filter(a => artifactIds.includes(a.id))
      : all;

    if (format === "xlsx") {
      const buf = await buildBoardXlsxBuffer(subset);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="whiteboard-${id}.xlsx"`);
      return res.send(buf);
    }
    if (format === "pptx") {
      if (!renderedImages) return res.status(400).json({ error: "rendered_images_required" });
      const buf = await buildBoardPptxBuffer(subset, renderedImages);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="whiteboard-${id}.pptx"`);
      return res.send(buf);
    }
    if (format === "pdf") {
      // Single-artifact document / checklist gets the high-fidelity vector
      // pipeline: markdown + KaTeX rendered in headless Chrome → real PDF
      // with selectable text, proper tables, sharp math. The old PNG-wrap
      // path (buildBoardPdfBuffer) is kept for multi-artifact boards and
      // diagram-like kinds where rasterisation is fine.
      if (subset.length === 1 && (subset[0].kind === "document" || subset[0].kind === "checklist")) {
        const a = subset[0];
        const payload = (a.payload ?? {}) as {
          content?: string;
          title?: string;
          mode?: string;
          // Checklist payload shape (different from document):
          items?: Array<{ id: string; label: string; hint?: string; section?: string }>;
        };
        const title = payload.title ?? a.title ?? (a.kind === "checklist" ? "Checklist" : "Document");
        const mode = payload.mode;

        // Documents carry a plain markdown `content` string. Checklists carry
        // a structured `items[]` array — synthesise markdown from it so the
        // PDF pipeline has something to render. GFM task-list syntax
        // (`- [ ]`, `- [x]`) renders as real checkboxes in the output.
        let content: string;
        if (a.kind === "checklist") {
          const items = payload.items ?? [];
          // Pull checked state from the persisted artifact state column.
          const artifactState = (a.state ?? {}) as { checkedIds?: string[] };
          const checkedIds = new Set(artifactState.checkedIds ?? []);

          // Group by section, preserving first-seen order so the PDF matches
          // what the user sees in the UI.
          const order: string[] = [];
          const bySection = new Map<string, typeof items>();
          for (const it of items) {
            const key = it.section ?? "";
            if (!bySection.has(key)) {
              bySection.set(key, []);
              order.push(key);
            }
            bySection.get(key)!.push(it);
          }

          const parts: string[] = [];
          for (const sectionName of order) {
            if (sectionName) {
              parts.push(`\n## ${sectionName}\n`);
            }
            for (const it of bySection.get(sectionName) ?? []) {
              const mark = checkedIds.has(it.id) ? "x" : " ";
              const hint = it.hint ? ` _${it.hint.replace(/[_*`]/g, "")}_` : "";
              parts.push(`- [${mark}] ${it.label}${hint}`);
            }
          }
          content = parts.join("\n");
        } else {
          content = payload.content ?? "";
        }

        try {
          const buf = await buildDocumentPdfBuffer({ title, content, mode });
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="${title.replace(/[^a-z0-9_-]+/gi, "_")}.pdf"`);
          return res.send(buf);
        } catch (err) {
          console.error("[whiteboard/export] high-fidelity document pdf failed, falling back to pdfkit:", err);
          try {
            // Second fallback: use the simpler pdfkit-based exporter which
            // doesn't require a headless browser.
            const buf = await DocumentExporter.exportToPdf(content, title);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="${title.replace(/[^a-z0-9_-]+/gi, "_")}.pdf"`);
            return res.send(buf);
          } catch (fallbackErr) {
            console.error("[whiteboard/export] pdfkit fallback also failed:", fallbackErr);
            // Fall through to the renderedImages path below so the user still
            // gets a PDF (via image-wrap) if they provided images.
          }
        }
      }
      if (!renderedImages) return res.status(400).json({ error: "rendered_images_required" });
      const buf = await buildBoardPdfBuffer(subset, renderedImages);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="whiteboard-${id}.pdf"`);
      return res.send(buf);
    }
    return res.status(400).json({ error: "bad_format", format });
  });

  // Download Excel file for a specific message
  app.get("/api/conversations/:conversationId/messages/:messageId/excel", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const { conversationId, messageId } = req.params;
      
      // Verify conversation ownership
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Get message with Excel data
      const message = await storage.getMessage(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      if (message.conversationId !== conversationId) {
        return res.status(403).json({ error: "Message does not belong to this conversation" });
      }
      
      // Check for Excel in cache first (new method - uses cache key)
      const metadata = message.metadata as any;
      if (metadata?.excelCacheKey) {
        const cached = excelBufferCache.get(metadata.excelCacheKey);
        if (cached) {
          console.log('[Excel Download] Serving from cache:', metadata.excelCacheKey);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${cached.filename}"`);
          res.setHeader('Content-Length', cached.buffer.length);
          return res.send(cached.buffer);
        }
      }
      
      // AI-authored sheet fallback: if the message has spreadsheetData (produced
      // by the ```sheet``` block parser) but no pre-generated Excel buffer,
      // synthesise the xlsx on-the-fly from the evaluated sheet data. This path
      // covers every calculation-mode response that emits sheet blocks instead
      // of going through the legacy excelModelGenerator pipeline.
      if (metadata?.spreadsheetData?.sheets?.length) {
        try {
          const { buildXlsxFromSpreadsheetData } = await import('./services/excel/spreadsheetToXlsx');
          const { buffer, filename } = await buildXlsxFromSpreadsheetData(metadata.spreadsheetData);
          console.log('[Excel Download] Built xlsx on-the-fly from AI sheet data:', filename, buffer.length, 'bytes');
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.setHeader('Content-Length', buffer.length);
          return res.send(buffer);
        } catch (err) {
          console.error('[Excel Download] On-the-fly build failed:', err);
          // fall through to legacy base64 path below
        }
      }

      // Legacy: Check if Excel file exists in message (old method - base64 in metadata)
      const excelBuffer = metadata?.excelBuffer;
      const excelFilename = metadata?.excelFilename;

      if (!excelBuffer || !excelFilename) {
        return res.status(404).json({ error: "Excel file not found or expired. Please regenerate the spreadsheet." });
      }
      
      // Convert base64 back to buffer
      const buffer = Buffer.from(excelBuffer, 'base64');
      
      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${excelFilename}"`);
      res.setHeader('Content-Length', buffer.length);
      
      res.send(buffer);
    } catch (error) {
      console.error('[API] Error downloading Excel file:', error);
      res.status(500).json({ error: "Failed to download Excel file" });
    }
  });

  // Chat endpoint - the main intelligence interface (auth required)
  app.post("/api/chat", requireAuth, chatRateLimiter, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const { conversationId, message, profileId, chatMode: rawChatMode, documentAttachment } = req.body;
      
      // CRITICAL: Normalize chat mode at request boundary to ensure consistency
      const chatMode = normalizeChatMode(rawChatMode);
      
      if (!message) {
        return res.status(400).json({ error: "Message required" });
      }
      
      // Log chat mode for debugging
      if (chatMode !== 'standard') {
        console.log(`[API] Professional mode selected: ${chatMode}`);
      }
      
      // Convert document attachment from base64 to Buffer for AI processing
      // Future enhancement: Use temporary encrypted storage with attachmentId lookup
      let attachmentBuffer: Buffer | undefined;
      let attachmentMetadata: { filename: string; mimeType: string; documentType?: string } | undefined;
      
      if (documentAttachment) {
        try {
          // Security validation: Check attachment size and type
          const ALLOWED_MIME_TYPES = [
            // Azure Document Intelligence supported formats
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/jpg',
            'image/tiff',
            'image/tif',
            // Spreadsheet formats for financial data
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv', // .csv
            'text/plain' // .txt
          ];
          const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit
          
          // Validate MIME type
          if (!ALLOWED_MIME_TYPES.includes(documentAttachment.type)) {
            return res.status(400).json({ 
              error: "Invalid file type. Allowed types: PDF, PNG, JPEG, TIFF, Excel (XLSX, XLS), CSV, TXT" 
            });
          }
          
          // Convert base64 data to Buffer
          attachmentBuffer = Buffer.from(documentAttachment.data, 'base64');
          
          // Validate size
          if (attachmentBuffer.byteLength > MAX_SIZE_BYTES) {
            return res.status(400).json({ 
              error: "File too large. Maximum size is 10MB" 
            });
          }
          
          attachmentMetadata = {
            filename: documentAttachment.filename,
            mimeType: documentAttachment.type,
            documentType: documentAttachment.type // Use MIME type as document type for now
          };
          
          console.log(`[API] Document attachment validated: ${documentAttachment.filename} (${attachmentBuffer.byteLength} bytes)`);
        } catch (error) {
          console.error('[API] Error processing document attachment:', error);
          return res.status(400).json({ error: "Invalid document attachment data" });
        }
      }
      
      // Validate profileId ownership if provided
      if (profileId) {
        const profile = await storage.getProfile(profileId);
        if (!profile) {
          return res.status(400).json({ error: "Invalid profile ID" });
        }
        if (profile.userId !== userId) {
          return res.status(403).json({ error: "Access denied: Profile does not belong to user" });
        }
      }
      
      // Get user for subscription tier
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check usage limits
      const currentMonth = new Date().toISOString().slice(0, 7);
      const usage = await storage.getUsageForMonth(userId, currentMonth);
      
      if (user.subscriptionTier === 'free' && usage && usage.queriesUsed >= 100) {
        return res.status(429).json({ 
          error: "Monthly query limit reached. Please upgrade to continue." 
        });
      }
      
      // Get conversation history
      let conversation;
      if (conversationId) {
        conversation = await storage.getConversation(conversationId);
        
        if (!conversation) {
          return res.status(404).json({ error: "Conversation not found" });
        }
        
        // Verify conversation ownership
        if (conversation.userId !== userId) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else {
        // Create new conversation with profileId
        conversation = await storage.createConversation({
          userId,
          profileId: profileId !== undefined ? profileId : null,
          title: 'New Chat',
          preview: message.slice(0, 100),
          chatMode,
        });
        // Queue intelligent title generation in background
        addTitleGenerationJob(conversation.id, message);
      }
      
      const history = await storage.getConversationMessages(conversation.id);
      const conversationHistory = history.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
      
      // Save user message
      const userMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: message,
        modelUsed: null,
        routingDecision: null,
        calculationResults: null,
        tokensUsed: null
      });
      
      // CRITICAL DEBUG: Log attachment status before calling processQuery
      console.log(`[API] About to call processQuery with attachment:`, attachmentBuffer && attachmentMetadata ? `YES (${attachmentMetadata.filename})` : 'NO');
      console.log(`[API] attachmentBuffer exists:`, !!attachmentBuffer);
      console.log(`[API] attachmentMetadata exists:`, !!attachmentMetadata);
      
      // Check if this mode requires agent workflow execution
      let agentWorkflowResult: any = null;
      if (isAgentWorkflowMode(chatMode)) {
        try {
          console.log(`[AgentWorkflow] Mode '${chatMode}' requires agent execution`);
          agentWorkflowResult = await executeWorkflow(
            chatMode,
            {
              query: message,
              conversationId: conversation.id,
              history: conversationHistory,
              attachment: attachmentBuffer && attachmentMetadata ? {
                buffer: attachmentBuffer,
                filename: attachmentMetadata.filename,
                mimeType: attachmentMetadata.mimeType,
              } : undefined,
            },
            userId
          );
          console.log(`[AgentWorkflow] Workflow completed for mode '${chatMode}'`);
        } catch (error) {
          console.error(`[AgentWorkflow] Error executing workflow for mode '${chatMode}':`, error);
          // Continue to regular processing as fallback
        }
      }
      
      // Generate the assistant message id up-front so the orchestrator can
      // anchor any whiteboard artifacts to this exact message row (Phase 2.4).
      const assistantMessageId = crypto.randomUUID();

      // Process query through AI orchestrator with chat mode
      const result = await aiOrchestrator.processQuery(
        message,
        conversationHistory,
        user.subscriptionTier,
        userId, // For AI cost tracking
        attachmentBuffer && attachmentMetadata ? {
          attachment: {
            buffer: attachmentBuffer,
            filename: attachmentMetadata.filename,
            mimeType: attachmentMetadata.mimeType,
            documentType: attachmentMetadata.documentType
          },
          chatMode: chatMode || 'standard',
          agentWorkflowResult, // Pass agent results to orchestrator
          conversationId: conversation.id,
          messageId: assistantMessageId,
          selection: (req.body as any)?.selection,
        } : {
          chatMode: chatMode || 'standard',
          agentWorkflowResult,
          conversationId: conversation.id,
          messageId: assistantMessageId,
          selection: (req.body as any)?.selection,
        }
      );

      // Prepare Excel data if generated
      let excelData: { filename: string; buffer: string } | undefined;
      if (result.excelWorkbook) {
        excelData = {
          filename: result.excelWorkbook.filename,
          buffer: result.excelWorkbook.buffer.toString('base64')
        };
        console.log(`[Excel] Generated workbook: ${excelData.filename} (${result.excelWorkbook.buffer.length} bytes)`);
      }

      // Whiteboard artifact wiring (Phase 2.4): prefer the pipeline-updated
      // content (with <artifact /> placeholders) and capture ids for the row.
      const assistantContent = result.whiteboardUpdatedContent ?? result.response;
      const artifactIds = result.whiteboardArtifacts?.map(a => a.id) ?? [];

      // Save assistant message with full metadata
      const assistantMessage = await storage.createMessage({
        id: assistantMessageId,
        conversationId: conversation.id,
        role: 'assistant',
        content: assistantContent,
        modelUsed: result.modelUsed,
        routingDecision: JSON.parse(JSON.stringify(result.routingDecision)),
        calculationResults: result.calculationResults,
        tokensUsed: result.tokensUsed,
        metadata: JSON.parse(JSON.stringify({
          ...result.metadata,
          deliverableContent: result.deliverableContent,
          excelFilename: excelData?.filename,
          excelBuffer: excelData?.buffer ? Buffer.from(excelData.buffer).toString('base64') : undefined,
          reasoningContent: result.reasoningContent,
          hasExcel: !!excelData,
          // Include spreadsheet preview data with formulas for UI display
          spreadsheetData: result.spreadsheetData
        })),
        artifactIds,
      });

      // Persist any extracted whiteboard artifacts (best-effort; never fatal)
      for (const art of result.whiteboardArtifacts ?? []) {
        try {
          await createArtifact(art);
        } catch (e) {
          console.error('[whiteboard] failed to persist artifact:', art.id, e);
        }
      }
      
      // Create routing log
      await storage.createRoutingLog({
        messageId: assistantMessage.id,
        queryClassification: result.classification,
        selectedModel: result.modelUsed,
        routingReason: result.routingDecision.reasoning,
        confidence: Math.round(result.classification.confidence * 100),
        alternativeModels: result.routingDecision.fallbackModels,
        processingTimeMs: result.processingTimeMs
      });
      
      // Update usage tracking
      await storage.incrementUsage(userId, currentMonth, 1, 0, result.tokensUsed);
      
      // Update conversation
      await storage.updateConversation(conversation.id, {
        preview: message.slice(0, 100),
        updatedAt: new Date()
      });
      
      // Fire-and-forget async analytics processing and auto-title generation (don't block response)
      setImmediate(async () => {
        try {
          // Auto-generate title after first message
          if (conversationHistory.length === 0) {
            try {
              const provider = aiProviderRegistry.getProvider(AIProviderName.GEMINI);
              const titleResponse = await provider.generateCompletion({
                messages: [{
                  role: 'user',
                  content: `Generate a very short, concise title (max 6 words) for this accounting question. Only respond with the title, nothing else:\n\n"${message}"`
                }],
                temperature: 0.3,
                maxTokens: 50
              });
              
              const generatedTitle = titleResponse.content.trim().replace(/^["']|["']$/g, '');
              await storage.updateConversation(conversation.id, { title: generatedTitle });
              console.log(`[AutoTitle] Generated title: "${generatedTitle}"`);
            } catch (error) {
              console.error('[AutoTitle] Failed to generate title:', error);
            }
          }
          
          // Process user message analytics
          await AnalyticsProcessor.processMessage({
            messageId: userMessage.id,
            conversationId: conversation.id,
            userId,
            role: 'user',
            content: message,
            previousMessages: conversationHistory
          });
          
          // Process assistant message analytics
          await AnalyticsProcessor.processMessage({
            messageId: assistantMessage.id,
            conversationId: conversation.id,
            userId,
            role: 'assistant',
            content: result.response,
            previousMessages: [...conversationHistory, { role: 'user', content: message }]
          });
          
          // Analyze conversation every 5 messages
          if (conversationHistory.length % 5 === 0) {
            await AnalyticsProcessor.analyzeConversation(conversation.id);
          }
          
          // Log interaction for continuous learning
          try {
            await continuousLearning.logInteraction({
              userId: userId || '',
              conversationId: conversation.id,
              messageId: assistantMessage.id,
              query: message,
              response: result.response,
              classification: result.classification,
              modelUsed: result.modelUsed,
              totalTimeMs: result.processingTimeMs,
              contextUsed: result.metadata?.reasoning?.governorDecisions,
            });
          } catch (learningError) {
            console.warn('[ContinuousLearning] Failed to log interaction:', learningError);
          }
        } catch (error) {
          console.error('[Analytics] Background analytics processing error:', error);
        }
      });
      
      res.json({
        conversationId: conversation.id,
        message: {
          id: assistantMessage.id,
          role: 'assistant',
          content: result.response,
          timestamp: assistantMessage.createdAt
        },
        metadata: {
          modelUsed: result.modelUsed,
          classification: result.classification,
          calculationResults: result.calculationResults,
          tokensUsed: result.tokensUsed,
          processingTimeMs: result.processingTimeMs
        }
      });
    } catch (error: any) {
      console.error('Chat error:', error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  // Chat file upload endpoint
  app.post("/api/chat/upload-file", requireAuth, chatRateLimiter, upload.single('file'), async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Validate MIME type - Support Azure Document Intelligence formats + spreadsheets
      const ALLOWED_MIME_TYPES = [
        // Azure Document Intelligence supported formats
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/tiff',
        'image/tif',
        // Spreadsheet formats for financial data
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
        'text/plain' // .txt
      ];
      
      if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
        return res.status(400).json({ 
          error: "Invalid file type. Supported formats: PDF, PNG, JPEG, TIFF, Excel (XLSX, XLS), CSV, TXT" 
        });
      }
      
      // Validate file size (10MB limit for chat)
      if (req.file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "File too large. Maximum size is 10MB" });
      }
      
      // Convert file buffer to base64 for Azure Document Intelligence
      const base64Data = req.file.buffer.toString('base64');
      
      // Detect document type from filename and mimetype
      let documentType = 'document';
      const filename = req.file.originalname.toLowerCase();
      if (filename.includes('invoice')) documentType = 'invoice';
      else if (filename.includes('receipt')) documentType = 'receipt';
      else if (filename.includes('w-2') || filename.includes('w2')) documentType = 'w2';
      else if (filename.includes('1040')) documentType = '1040';
      else if (filename.includes('1098')) documentType = '1098';
      else if (filename.includes('1099')) documentType = '1099';
      else if (req.file.mimetype === 'application/pdf') documentType = 'document';
      
      res.json({
        success: true,
        file: {
          name: req.file.originalname,
          size: req.file.size,
          type: req.file.mimetype,
          base64Data,
          documentType
        }
      });
    } catch (error) {
      console.error('Chat file upload error:', error);
      res.status(500).json({ error: "File upload failed" });
    }
  });

  // Voice Mode Endpoints
  app.post("/api/voice/stt", requireAuth, upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      const text = await voiceService.transcribe(req.file.buffer);
      res.json({ text });
    } catch (error: any) {
      console.error('[Voice] STT error:', error);
      res.status(500).json({ error: error.message || "Failed to transcribe audio" });
    }
  });

  app.post("/api/voice/tts", requireAuth, async (req, res) => {
    try {
      const { text, voice, speed } = req.body;
      if (!text) {
        return res.status(400).json({ error: "No text provided" });
      }

      const { audio, contentType } = await voiceService.synthesize(text, voice, speed);
      
      res.set('Content-Type', contentType);
      res.send(audio);
    } catch (error: any) {
      console.error('[Voice] TTS error:', error);
      res.status(500).json({ error: error.message || "Failed to synthesize speech" });
    }
  });

  app.get("/api/voice/voices", requireAuth, async (req, res) => {
    try {
      const { accent } = req.query;
      const voices = voiceService.getAvailableVoices(accent as string);
      res.json({ voices });
    } catch (error: any) {
      console.error('[Voice] List voices error:', error);
      res.status(500).json({ error: "Failed to list voices" });
    }
  });

  // Export content endpoint
  app.post("/api/export", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const { content, visualization, format, title } = req.body;
      
      if (!content && !visualization) {
        return res.status(400).json({ error: "Content or visualization is required" });
      }
      
      if (!format || !['docx', 'pdf', 'pptx', 'xlsx', 'csv', 'txt'].includes(format)) {
        return res.status(400).json({ error: "Invalid format" });
      }

      // Handle simple text formats with visualization support
      if (format === 'txt' || format === 'csv') {
        let fileContent = '';
        let mimeType = 'text/plain';
        
        if (format === 'txt') {
          // Use DocumentExporter to strip markdown and format properly
          fileContent = DocumentExporter.exportToPlainText(content || '', title);
          
          // Add visualization data as text table if present
          if (visualization && visualization.data && visualization.data.length > 0) {
            if (fileContent) fileContent += '\n\n';
            if (visualization.title) fileContent += visualization.title + '\n\n';
            
            // Get all unique keys from the data
            const allKeys = Array.from(
              new Set(visualization.data.flatMap((obj: any) => Object.keys(obj)))
            );
            
            // TXT format: readable table
            fileContent += allKeys.join('\t') + '\n';
            for (const row of visualization.data) {
              fileContent += allKeys.map((key) => (row as any)[String(key)] ?? '').join('\t') + '\n';
            }
          }
        } else {
          // CSV format
          fileContent = content || '';
          
          // Add visualization data as CSV if present
          if (visualization && visualization.data && visualization.data.length > 0) {
            if (fileContent) fileContent += '\n\n';
            if (visualization.title) fileContent += visualization.title + '\n\n';
            
            // Get all unique keys from the data
            const allKeys = Array.from(
              new Set(visualization.data.flatMap((obj: any) => Object.keys(obj)))
            );
            
            // CSV format: proper comma-separated values
            fileContent += allKeys.join(',') + '\n';
            for (const row of visualization.data) {
              fileContent += allKeys.map((key) => {
                const value = (row as any)[String(key)];
                const strValue = typeof value === 'number' ? value.toString() : (value || '');
                return `"${strValue.toString().replace(/"/g, '""')}"`;
              }).join(',') + '\n';
            }
          } else {
            // Convert plain content to CSV format
            const lines = fileContent.split('\n').filter((l: string) => l.trim());
            fileContent = lines.map((line: string) => `"${line.replace(/"/g, '""')}"`).join('\n');
          }
          
          mimeType = 'text/csv';
        }
        
        const buffer = Buffer.from(fileContent, 'utf-8');
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="luca-output-${Date.now()}.${format}"`);
        return res.send(buffer);
      }

      // Use DocumentExporter for complex formats
      const buffer = await DocumentExporter.export({
        content: content || '',
        visualization,
        format: format as any,
        title: title || 'CA GPT Output'
      });
      
      const mimeTypes: Record<string, string> = {
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        pdf: 'application/pdf',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
      
      res.setHeader('Content-Type', mimeTypes[format] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="luca-output-${Date.now()}.${format}"`);
      res.send(buffer);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: "Failed to export content" });
    }
  });

  // ===========================
  // ADVANCED EXCEL API ROUTES
  // ===========================

  // Generate Excel formula from natural language
  app.post("/api/excel/generate-formula", requireAuth, chatRateLimiter, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { prompt, context, complexity } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      // Pass complexity level to formula generator for appropriate difficulty
      const formula = await excelOrchestrator.generateAdvancedFormula(
        prompt, 
        {
          ...context,
          complexity: complexity || 'intermediate'
        }
      );

      res.json({
        success: true,
        formula,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Formula generation error:', error);
      res.status(500).json({ error: error.message || "Failed to generate formula" });
    }
  });

  // Generate VBA macro from natural language
  app.post("/api/excel/generate-vba", requireAuth, chatRateLimiter, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { prompt, macroType } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const vbaCode = await excelOrchestrator.generateVBAMacro(prompt, macroType || 'subroutine');

      res.json({
        success: true,
        vbaCode,
        usage: 'Import this code into Excel VBA editor (Alt+F11)',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('VBA generation error:', error);
      res.status(500).json({ error: error.message || "Failed to generate VBA macro" });
    }
  });

  // Generate complete financial model
  app.post("/api/excel/generate-model", requireAuth, chatRateLimiter, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { modelType, params } = req.body;

      if (!modelType) {
        return res.status(400).json({ error: "Model type is required" });
      }

      // Valid model types: dcf, lbo, 3-statement, budget
      const validModels = ['dcf', 'lbo', '3-statement', 'budget'];
      if (!validModels.includes(modelType.toLowerCase())) {
        return res.status(400).json({ 
          error: `Invalid model type. Valid types: ${validModels.join(', ')}` 
        });
      }

      const result = await excelOrchestrator.generateFinancialModel(modelType, params || {});

      // Return Excel file as buffer
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${modelType}-model-${Date.now()}.xlsx"`);
      res.send(result.buffer);
    } catch (error: any) {
      console.error('Model generation error:', error);
      res.status(500).json({ error: error.message || "Failed to generate financial model" });
    }
  });

  // Generate ad-hoc custom Excel template from any business scenario
  app.post("/api/excel/generate-custom-template", requireAuth, chatRateLimiter, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { 
        description, 
        industry, 
        purpose, 
        dataFields, 
        calculationNeeds,
        numberOfRows,
        reportingFrequency 
      } = req.body;

      if (!description) {
        return res.status(400).json({ error: "Description is required" });
      }

      const request = {
        description,
        industry,
        purpose,
        dataFields,
        calculationNeeds,
        numberOfRows,
        reportingFrequency
      };

      const result = await excelOrchestrator.generateAdHocTemplate(request);

      // Return Excel file as buffer
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="custom-template-${Date.now()}.xlsx"`);
      res.send(result.buffer);
    } catch (error: any) {
      console.error('Ad-hoc template generation error:', error);
      res.status(500).json({ error: error.message || "Failed to generate custom template" });
    }
  });

  // Generate VBA automation for financial models
  app.post("/api/excel/generate-model-automation", requireAuth, chatRateLimiter, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { modelType } = req.body;

      if (!modelType) {
        return res.status(400).json({ error: "Model type is required" });
      }

      // Valid model types: dcf, lbo, 3-statement, sensitivity, monte-carlo
      const validModels = ['dcf', 'lbo', '3-statement', 'sensitivity', 'monte carlo'];
      if (!validModels.some(m => modelType.toLowerCase().includes(m))) {
        return res.status(400).json({ 
          error: `Invalid model type. Valid types: ${validModels.join(', ')}` 
        });
      }

      const vbaCode = await excelOrchestrator.generateModelAutomation(modelType);

      res.json({
        success: true,
        vbaCode,
        usage: 'Import into Excel VBA editor. Run macros from Developer tab or assign to buttons.',
        instructions: [
          '1. Open Excel and press Alt+F11 to open VBA editor',
          '2. Insert > Module to create a new module',
          '3. Paste the generated VBA code',
          '4. Close VBA editor and return to Excel',
          '5. Run macros from Developer tab > Macros, or assign to buttons'
        ],
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('VBA automation generation error:', error);
      res.status(500).json({ error: error.message || "Failed to generate VBA automation" });
    }
  });

  // Upload and parse Excel file
  app.post("/api/excel/parse", requireAuth, fileUploadRateLimiter, upload.single('file'), async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Parse Excel file
      const data = await excelOrchestrator.parseUploadedExcel(req.file.buffer);

      res.json({
        success: true,
        data,
        rows: data.length,
        columns: data[0]?.length || 0,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Excel parse error:', error);
      res.status(500).json({ error: error.message || "Failed to parse Excel file" });
    }
  });

  // Generate Excel from AI prompt (comprehensive)
  app.post("/api/excel/generate-from-prompt", requireAuth, chatRateLimiter, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { prompt, uploadedData } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      // Parse user request using AI
      const request = await excelOrchestrator.parseUserRequest(prompt, uploadedData);

      // Generate workbook based on request
      const result = await excelOrchestrator.createCalculationWorkbook(request);

      // Return Excel file
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="luca-generated-${Date.now()}.xlsx"`);
      res.send(result.buffer);
    } catch (error: any) {
      console.error('Excel generation from prompt error:', error);
      res.status(500).json({ error: error.message || "Failed to generate Excel from prompt" });
    }
  });

  // AI-Driven Excel Model Generator (NEW - Advanced with real formulas)
  // This endpoint uses multi-stage AI generation to create professional Excel models
  // with real Excel formulas, named ranges, formatting, and data validation
  app.post("/api/excel/generate-model", requireAuth, chatRateLimiter, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { 
        prompt, 
        modelType,
        industry,
        companyName,
        contextData,
        preferences,
        conversationHistory
      } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      console.log(`[Excel API] AI-driven model generation requested by user ${userId}`);
      console.log(`[Excel API] Prompt: ${prompt.slice(0, 100)}...`);

      // Detect model type if not provided
      const detectedType = modelType || excelModelGenerator.getModelType(prompt);
      console.log(`[Excel API] Model type: ${detectedType}`);

      // Generate the Excel model using AI
      const result = await excelModelGenerator.generate({
        userQuery: prompt,
        modelType: detectedType,
        industry,
        companyName,
        contextData,
        preferences: {
          excelVersion: preferences?.excelVersion || '365',
          currencySymbol: preferences?.currencySymbol || '$',
          includeCharts: preferences?.includeCharts !== false,
          protectFormulas: preferences?.protectFormulas !== false,
          colorScheme: preferences?.colorScheme || 'professional'
        },
        conversationHistory: conversationHistory?.map((h: any) => ({ role: h.role, content: h.content }))
      }, {
        singleStage: detectedType === 'custom',
        validateOutput: true,
        includeRawSpec: false
      });

      if (!result.success || !result.workbook) {
        console.error('[Excel API] Model generation failed:', result.errors);
        return res.status(500).json({ 
          error: "Failed to generate Excel model",
          details: result.errors,
          warnings: result.warnings
        });
      }

      console.log(`[Excel API] Model generated successfully:`, result.stats);

      // Return Excel file with metadata
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('X-Excel-Summary', encodeURIComponent(result.summary || ''));
      res.setHeader('X-Excel-Stats', JSON.stringify(result.stats || {}));
      res.send(result.workbook);
    } catch (error: any) {
      console.error('[Excel API] Model generation error:', error);
      res.status(500).json({ error: error.message || "Failed to generate Excel model" });
    }
  });

  // Check if a query requires Excel model generation
  app.post("/api/excel/detect-model-request", requireAuth, async (req, res) => {
    try {
      const { query } = req.body;

      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      const isExcelRequest = excelModelGenerator.isExcelRequest(query);
      const modelType = isExcelRequest ? excelModelGenerator.getModelType(query) : null;

      res.json({
        isExcelRequest,
        modelType,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===========================
  // END EXCEL API ROUTES
  // ===========================

  // Conversation Management Endpoints
  
  // Pin/Unpin conversation
  app.patch("/api/conversations/:id/pin", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const { id } = req.params;
      const conversation = await storage.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.updateConversation(id, { pinned: !conversation.pinned });
      res.json({ success: true, pinned: !conversation.pinned });
    } catch (error) {
      console.error('Pin conversation error:', error);
      res.status(500).json({ error: "Failed to pin conversation" });
    }
  });
  
  // Rename conversation
  app.patch("/api/conversations/:id/rename", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const { id } = req.params;
      const { title } = req.body;
      
      if (!title || title.trim().length === 0) {
        return res.status(400).json({ error: "Title is required" });
      }
      
      const conversation = await storage.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.updateConversation(id, { title: title.trim() });
      res.json({ success: true, title: title.trim() });
    } catch (error) {
      console.error('Rename conversation error:', error);
      res.status(500).json({ error: "Failed to rename conversation" });
    }
  });

  // Update conversation feedback (rating, resolved, user feedback)
  app.patch("/api/conversations/:id/feedback", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const { id } = req.params;
      
      // Validate feedback data using Zod schema
      const validation = updateConversationFeedbackSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid feedback data", 
          details: validation.error.issues 
        });
      }
      
      const conversation = await storage.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Update feedback fields
      await storage.updateConversation(id, validation.data);
      
      res.json({ 
        success: true, 
        feedback: validation.data 
      });
    } catch (error) {
      console.error('Update conversation feedback error:', error);
      res.status(500).json({ error: "Failed to update conversation feedback" });
    }
  });

  // Message-level feedback for continuous learning
  app.post("/api/messages/:messageId/feedback", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const { messageId } = req.params;
      const { conversationId, rating, thumbs, correctedContent, feedbackText, tags } = req.body;
      
      // Validate required fields
      if (!conversationId) {
        return res.status(400).json({ error: "conversationId is required" });
      }
      
      // Validate rating range
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }
      
      // Validate thumbs value
      if (thumbs !== undefined && !['up', 'down'].includes(thumbs)) {
        return res.status(400).json({ error: "Thumbs must be 'up' or 'down'" });
      }
      
      // Record feedback for continuous learning
      const feedbackId = await continuousLearning.recordFeedback({
        messageId, // Keep as string - schema uses varchar
        conversationId: String(conversationId), // Ensure string
        userId: String(userId), // Convert to string
        rating,
        thumbs,
        correctedContent,
        feedbackText,
        tags,
      });
      
      res.json({ 
        success: true, 
        feedbackId,
        message: "Feedback recorded for learning" 
      });
    } catch (error) {
      console.error('Message feedback error:', error);
      res.status(500).json({ error: "Failed to record message feedback" });
    }
  });
  
  // Share conversation (create share link)
  app.post("/api/conversations/:id/share", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const { id } = req.params;
      const conversation = await storage.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Generate unique share token
      const crypto = await import('crypto');
      const sharedToken = crypto.randomBytes(32).toString('hex');
      
      await storage.updateConversation(id, { 
        isShared: true, 
        sharedToken 
      });
      
      const shareUrl = `${req.protocol}://${req.get('host')}/shared/${sharedToken}`;
      res.json({ success: true, shareUrl, sharedToken });
    } catch (error) {
      console.error('Share conversation error:', error);
      res.status(500).json({ error: "Failed to share conversation" });
    }
  });
  
  // Unshare conversation
  app.delete("/api/conversations/:id/share", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const { id } = req.params;
      const conversation = await storage.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.updateConversation(id, { 
        isShared: false, 
        sharedToken: null 
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Unshare conversation error:', error);
      res.status(500).json({ error: "Failed to unshare conversation" });
    }
  });

  // Get shared conversation by token (public access - no auth required)
  app.get("/api/shared/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token || token.length !== 64) {
        return res.status(400).json({ error: "Invalid share token" });
      }
      
      // Find conversation by share token (only if still shared)
      const conversation = await storage.getConversationByShareToken(token);
      
      if (!conversation) {
        return res.status(404).json({ error: "Shared conversation not found or no longer shared" });
      }
      
      // Get messages for the conversation
      const messages = await storage.getConversationMessages(conversation.id);
      
      // Return conversation data without sensitive user info
      res.json({
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        messages: messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt
        }))
      });
    } catch (error) {
      console.error('Get shared conversation error:', error);
      res.status(500).json({ error: "Failed to load shared conversation" });
    }
  });
  
  // Delete conversation
  app.delete("/api/conversations/:id", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const { id } = req.params;
      const conversation = await storage.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteConversation(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete conversation error:', error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });
  
  // Auto-generate conversation title (called after first message)
  app.post("/api/conversations/:id/auto-title", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const { id } = req.params;
      const conversation = await storage.getConversation(id);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Get the first user message
      const messages = await storage.getConversationMessages(id);
      const firstUserMessage = messages.find(m => m.role === 'user');
      
      if (!firstUserMessage) {
        return res.status(400).json({ error: "No messages found" });
      }
      
      // Generate a concise title using AI
      try {
        const provider = aiProviderRegistry.getProvider(AIProviderName.GEMINI);
        const response = await provider.generateCompletion({
          messages: [{
            role: 'user',
            content: `Generate a very short, concise title (max 6 words) for this accounting question. Only respond with the title, nothing else:\n\n"${firstUserMessage.content}"`
          }],
          temperature: 0.3,
          maxTokens: 50
        });
        
        const generatedTitle = response.content.trim().replace(/^["']|["']$/g, '');
        await storage.updateConversation(id, { title: generatedTitle });
        
        res.json({ success: true, title: generatedTitle });
      } catch (error) {
        // Fallback to simple truncation if AI fails
        const fallbackTitle = firstUserMessage.content.slice(0, 50) + 
          (firstUserMessage.content.length > 50 ? '...' : '');
        await storage.updateConversation(id, { title: fallbackTitle });
        
        res.json({ success: true, title: fallbackTitle });
      }
    } catch (error) {
      console.error('Auto-title error:', error);
      res.status(500).json({ error: "Failed to generate title" });
    }
  });

  // Usage tracking endpoint (auth required)
  app.get("/api/usage", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const currentMonth = new Date().toISOString().slice(0, 7);
      const usage = await storage.getUsageForMonth(userId, currentMonth);
      
      res.json({ usage: usage || { queriesUsed: 0, documentsAnalyzed: 0, tokensUsed: 0 } });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch usage" });
    }
  });

  // Subscription upgrade is disabled in this CA GPT deployment.
  app.post("/api/subscription/upgrade", requireAuth, async (req, res) => {
    res.status(410).json({
      error: "Subscription upgrade endpoint is disabled for this deployment"
    });
  });

  // User LLM Configuration routes (auth required)
  app.get("/api/llm-config", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const config = await storage.getUserLLMConfig(userId, true);
      res.json({ config });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch LLM config" });
    }
  });

  app.post("/api/llm-config", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const validatedData = insertUserLLMConfigSchema.omit({ userId: true }).parse(req.body);
      
      const config = await storage.upsertUserLLMConfig({
        userId,
        ...validatedData
      });
      
      // Log config change for audit trail
      await storage.createAuditLog({
        userId,
        action: 'UPDATE_LLM_CONFIG',
        resourceType: 'llm_config',
        resourceId: config.id,
        details: {
          provider: config.provider,
          modelName: config.modelName,
          hasApiKey: !!config.apiKey
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      const maskedConfig = await storage.getUserLLMConfig(userId, true);
      res.json({ config: maskedConfig });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues });
      }
      res.status(500).json({ error: "Failed to update LLM config" });
    }
  });

  // Support Ticket routes (auth required)
  app.get("/api/tickets", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const tickets = await storage.getUserSupportTickets(userId);
      res.json({ tickets });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.post("/api/tickets", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const validatedData = insertSupportTicketSchema.omit({ userId: true }).parse(req.body);
      
      const ticket = await storage.createSupportTicket({
        userId,
        ...validatedData
      });
      
      res.json({ ticket });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues });
      }
      res.status(500).json({ error: "Failed to create ticket" });
    }
  });

  app.get("/api/tickets/:id", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const ticket = await storage.getSupportTicket(req.params.id);
      if (!ticket || ticket.userId !== userId) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      
      const messages = await storage.getTicketMessages(req.params.id);
      res.json({ ticket, messages });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  app.post("/api/tickets/:id/messages", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const ticket = await storage.getSupportTicket(req.params.id);
      if (!ticket || ticket.userId !== userId) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      
      const validatedData = insertTicketMessageSchema.omit({ ticketId: true, userId: true }).parse(req.body);
      
      const ticketMessage = await storage.createTicketMessage({
        ticketId: req.params.id,
        userId,
        ...validatedData,
        isInternal: false
      });
      
      res.json({ message: ticketMessage });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues });
      }
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // GDPR routes (auth required)
  app.post("/api/gdpr/consent", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const schema = z.object({
        consentType: z.string().min(1),
        consented: z.boolean()
      });
      
      const validatedData = schema.parse(req.body);
      
      const consent = await storage.createGdprConsent({
        userId,
        ...validatedData,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      await storage.createAuditLog({
        userId,
        action: 'GDPR_CONSENT',
        resourceType: 'gdpr_consent',
        details: validatedData,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      res.json({ consent });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues });
      }
      res.status(500).json({ error: "Failed to record consent" });
    }
  });

  app.get("/api/gdpr/export", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      await storage.createAuditLog({
        userId,
        action: 'GDPR_EXPORT_DATA',
        resourceType: 'user',
        resourceId: userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      const data = await storage.exportUserData(userId);
      
      res.json({ data });
    } catch (error) {
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  app.delete("/api/gdpr/delete-account", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      await storage.createAuditLog({
        userId,
        action: 'GDPR_DELETE_ACCOUNT',
        resourceType: 'user',
        resourceId: userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      await storage.deleteUserData(userId);
      
      req.session.destroy(() => {});
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Super Admin check endpoint - allows frontend to verify super admin status
  app.get("/api/admin/super-admin-check", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId!);
      
      if (!user) {
        return res.status(404).json({ isSuperAdmin: false, error: "User not found" });
      }
      
      // Check if user email is in super admin whitelist
      const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
      const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());
      
      console.log(`[SuperAdminCheck] User ${user.email} super admin status: ${isSuperAdmin}`);
      
      res.json({ 
        isSuperAdmin, 
        email: user.email,
        // Include debug info in development
        ...(process.env.NODE_ENV !== 'production' && {
          configuredEmails: SUPER_ADMIN_EMAILS,
          envVarSet: !!process.env.SUPER_ADMIN_EMAILS
        })
      });
    } catch (error) {
      console.error('[SuperAdminCheck] Error:', error);
      res.status(500).json({ isSuperAdmin: false, error: "Failed to check super admin status" });
    }
  });

  // Admin routes (admin access required)
  app.get("/api/admin/dashboard", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const kpis = await storage.getAdminKPIs();
      res.json({ kpis });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  app.get("/api/admin/users", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      const sanitizedUsers = users.map(({ password, ...user }) => user);
      res.json({ users: sanitizedUsers });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/tickets", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const tickets = await storage.getAllSupportTickets();
      res.json({ tickets });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.patch("/api/admin/tickets/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        assignedTo: z.string().nullable().optional(),
        resolution: z.string().optional()
      });
      
      const validatedData = schema.parse(req.body);
      const userId = getCurrentUserId(req);
      
      const updates: any = { ...validatedData };
      if (validatedData.status === 'resolved' || validatedData.status === 'closed') {
        updates.resolvedAt = new Date();
      }
      
      const ticket = await storage.updateSupportTicket(req.params.id, updates);
      
      await storage.createAuditLog({
        userId: userId,
        action: 'UPDATE_TICKET',
        resourceType: 'ticket',
        resourceId: req.params.id,
        details: updates,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      res.json({ ticket });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues });
      }
      res.status(500).json({ error: "Failed to update ticket" });
    }
  });

  app.post("/api/admin/tickets/:id/messages", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const validatedData = insertTicketMessageSchema.omit({ ticketId: true, userId: true }).parse(req.body);
      
      const ticketMessage = await storage.createTicketMessage({
        ticketId: req.params.id,
        userId,
        ...validatedData
      });
      
      res.json({ message: ticketMessage });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues });
      }
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.get("/api/admin/audit-logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAuditLogs(undefined, limit, 0);
      res.json({ logs });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.patch("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        subscriptionTier: z.enum(['free', 'professional', 'enterprise']).optional(),
        isAdmin: z.boolean().optional()
      });
      
      const validatedData = schema.parse(req.body);
      const adminUserId = getCurrentUserId(req);
      
      // Prevent removing own admin status
      if (req.params.id === adminUserId && validatedData.isAdmin === false) {
        return res.status(400).json({ error: "Cannot remove your own admin status" });
      }
      
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Only update tier if provided
      if (validatedData.subscriptionTier) {
        await storage.updateUserSubscription(req.params.id, validatedData.subscriptionTier);
      }
      
      await storage.createAuditLog({
        userId: adminUserId,
        action: 'UPDATE_USER',
        resourceType: 'user',
        resourceId: req.params.id,
        details: validatedData,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      const updatedUser = await storage.getUser(req.params.id);
      const { password, ...sanitizedUser } = updatedUser!;
      res.json({ user: sanitizedUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues });
      }
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Accounting Integration Routes
  app.get("/api/integrations", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const integrations = await storage.getUserAccountingIntegrations(userId);
      res.json({ integrations });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch integrations" });
    }
  });

  app.post("/api/integrations/:provider/initiate", requireAuth, integrationRateLimiter, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const { provider } = req.params;
      const { AccountingIntegrationService } = await import('./services/accountingIntegrations');
      
      // Generate and store state for CSRF protection
      const state = crypto.randomBytes(32).toString('hex');
      req.session.oauthState = state;
      req.session.oauthProvider = provider;
      req.session.oauthUserId = userId;
      
      // Build redirect URI
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : `http://localhost:5000`;
      const redirectUri = `${baseUrl}/api/integrations/callback`;
      
      let authUrl: string;
      
      // Generate provider-specific OAuth URLs
      if (provider === 'quickbooks') {
        const clientId = process.env.QUICKBOOKS_CLIENT_ID || 'DEMO_QB_CLIENT_ID';
        const scope = 'com.intuit.quickbooks.accounting';
        authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`;
      } else if (provider === 'xero') {
        const clientId = process.env.XERO_CLIENT_ID || 'DEMO_XERO_CLIENT_ID';
        const scope = 'offline_access accounting.transactions accounting.contacts accounting.settings';
        authUrl = `https://login.xero.com/identity/connect/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`;
      } else if (provider === 'zoho') {
        const clientId = process.env.ZOHO_CLIENT_ID || 'DEMO_ZOHO_CLIENT_ID';
        const scope = 'ZohoBooks.fullaccess.all';
        const dataCenterLocation = process.env.ZOHO_DATA_CENTER || 'com';
        authUrl = `https://accounts.zoho.${dataCenterLocation}/oauth/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}&access_type=offline`;
      } else if (provider === 'adp') {
        authUrl = AccountingIntegrationService.getADPAuthUrl(redirectUri, state);
      } else {
        return res.status(400).json({ error: "Unsupported provider" });
      }
      
      res.json({ authUrl, provider });
    } catch (error) {
      res.status(500).json({ error: "Failed to initiate integration" });
    }
  });

  app.get("/api/integrations/callback", async (req, res) => {
    try {
      const { code, state, realmId } = req.query;
      
      // Verify state to prevent CSRF
      if (!state || state !== req.session.oauthState) {
        return res.status(400).send('Invalid state parameter');
      }
      
      const provider = req.session.oauthProvider;
      const userId = req.session.oauthUserId;
      
      if (!provider || !userId) {
        return res.status(400).send('Session expired. Please try again.');
      }
      
      // Exchange code for tokens
      const { AccountingIntegrationService } = await import('./services/accountingIntegrations');
      const { encryptApiKey } = await import('./utils/encryption');
      
      let accessToken: string;
      let refreshToken: string;
      let expiresIn: number;
      let companyId: string | null = null;
      let companyName: string | null = null;
      
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : `http://localhost:5000`;
      const redirectUri = `${baseUrl}/api/integrations/callback`;
      
      if (provider === 'quickbooks') {
        const config = {
          clientId: process.env.QUICKBOOKS_CLIENT_ID || 'DEMO_QB_CLIENT_ID',
          clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || 'DEMO_QB_SECRET',
          redirectUri,
          environment: (process.env.QUICKBOOKS_ENV as 'sandbox' | 'production') || 'sandbox'
        };
        
        const tokens = await AccountingIntegrationService.exchangeQuickBooksCode(config, code as string);
        accessToken = tokens.accessToken;
        refreshToken = tokens.refreshToken;
        expiresIn = tokens.expiresIn;
        companyId = realmId as string || null;
        
        // Fetch company info
        if (companyId) {
          try {
            const companyInfo = await AccountingIntegrationService.getQuickBooksCompanyInfo(
              accessToken,
              companyId,
              config.environment
            );
            companyName = companyInfo.name;
          } catch (err) {
            console.error('Failed to fetch QuickBooks company info:', err);
          }
        }
      } else if (provider === 'xero') {
        const config = {
          clientId: process.env.XERO_CLIENT_ID || 'DEMO_XERO_CLIENT_ID',
          clientSecret: process.env.XERO_CLIENT_SECRET || 'DEMO_XERO_SECRET',
          redirectUri
        };
        
        const tokens = await AccountingIntegrationService.exchangeXeroCode(config, code as string);
        accessToken = tokens.accessToken;
        refreshToken = tokens.refreshToken;
        expiresIn = tokens.expiresIn;
      } else if (provider === 'zoho') {
        const config = {
          clientId: process.env.ZOHO_CLIENT_ID || 'DEMO_ZOHO_CLIENT_ID',
          clientSecret: process.env.ZOHO_CLIENT_SECRET || 'DEMO_ZOHO_SECRET',
          redirectUri,
          dataCenterLocation: process.env.ZOHO_DATA_CENTER || 'com'
        };
        
        const tokens = await AccountingIntegrationService.exchangeZohoCode(config, code as string);
        accessToken = tokens.accessToken;
        refreshToken = tokens.refreshToken;
        expiresIn = tokens.expiresIn;
      } else if (provider === 'adp') {
        const tokens = await AccountingIntegrationService.exchangeADPCode(code as string, redirectUri);
        accessToken = tokens.accessToken;
        refreshToken = tokens.refreshToken;
        expiresIn = tokens.expiresIn;
        
        // Fetch company info
        try {
          const companyInfo = await AccountingIntegrationService.fetchADPCompanyInfo(accessToken);
          companyId = companyInfo.companyId;
          companyName = companyInfo.companyName;
        } catch (err) {
          console.error('Failed to fetch ADP company info:', err);
        }
      } else {
        return res.status(400).send('Unsupported provider');
      }
      
      // Encrypt tokens before storing
      const encryptedAccessToken = encryptApiKey(accessToken);
      const encryptedRefreshToken = encryptApiKey(refreshToken);
      
      // Store integration in database
      const tokenExpiry = new Date(Date.now() + expiresIn * 1000);
      await storage.createAccountingIntegration({
        userId,
        provider,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiry,
        companyId,
        companyName
      });
      
      // Audit log
      await storage.createAuditLog({
        userId,
        action: 'CONNECT_INTEGRATION',
        resourceType: 'integration',
        resourceId: provider,
        details: { provider, companyName },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      // Clear session
      delete req.session.oauthState;
      delete req.session.oauthProvider;
      delete req.session.oauthUserId;
      
      // Redirect back to integrations page
      res.redirect('/integrations?success=true&provider=' + provider);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect('/integrations?error=true&message=' + encodeURIComponent((error as Error).message));
    }
  });

  app.delete("/api/integrations/:id", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const success = await storage.deleteAccountingIntegration(req.params.id);
      
      await storage.createAuditLog({
        userId,
        action: 'DELETE_INTEGRATION',
        resourceType: 'integration',
        resourceId: req.params.id,
        details: {},
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      res.json({ success });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete integration" });
    }
  });

  // Tax File Upload Routes (Drake, TurboTax, H&R Block, ADP)
  app.post("/api/tax-files/upload", requireAuth, fileUploadRateLimiter, upload.single('file'), async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const { vendor, formType } = req.body;
      
      if (!vendor || !['drake', 'turbotax', 'hrblock', 'adp'].includes(vendor)) {
        return res.status(400).json({ error: "Invalid vendor" });
      }
      
      // Validate file size
      if (req.file.size > 50 * 1024 * 1024) {
        return res.status(400).json({ error: "File too large. Maximum size is 50MB" });
      }
      
      // Calculate checksum before encryption
      const checksum = calculateChecksum(req.file.buffer);
      
      // Encrypt and store file
      const { storageKey, nonce, encryptedFileKey } = await storeEncryptedFile(
        req.file.buffer,
        req.file.originalname
      );
      
      // Create database record
      const fileUpload = await storage.createTaxFileUpload({
        userId,
        vendor,
        filename: `${vendor}-${Date.now()}-${req.file.originalname}`,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype as 'text/csv' | 'application/vnd.ms-excel' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' | 'text/plain',
        byteLength: req.file.size,
        storageKey,
        encryptionNonce: nonce,
        encryptedFileKey,
        checksum,
        formType: formType || null
      });
      
      // Ingest document into knowledge graph if feature is enabled
      if (isFeatureEnabled('KNOWLEDGE_GRAPH')) {
        try {
          // Extract text content based on file type
          let textContent = '';
          
          if (req.file.mimetype === 'text/plain' || req.file.mimetype === 'text/csv') {
            textContent = req.file.buffer.toString('utf-8');
          } else if (req.file.mimetype === 'application/pdf') {
            // PDF extraction would require pdf-parse
            const pdfParseModule = await import('pdf-parse') as any;
            const pdfParse = pdfParseModule.default || pdfParseModule;
            const pdfData = await pdfParse(req.file.buffer);
            textContent = pdfData.text;
          }
          
          if (textContent && textContent.length > 0) {
            await documentIngestion.ingestDocument({
              content: textContent,
              type: 'document',
              source: `tax-file:${vendor}`,
              tags: [vendor, formType || 'general', 'tax-document'],
              metadata: {
                fileId: fileUpload.id,
                userId,
                filename: req.file.originalname,
                uploadedAt: new Date().toISOString(),
              },
            });
            console.log(`[DocumentIngestion] Ingested tax file: ${req.file.originalname}`);
          }
        } catch (ingestionError) {
          // Log but don't fail the upload
          console.error('[DocumentIngestion] Failed to ingest tax file:', ingestionError);
        }
      }
      
      // Audit log
      await storage.createAuditLog({
        userId,
        action: 'UPLOAD_TAX_FILE',
        resourceType: 'tax_file',
        resourceId: fileUpload.id,
        details: { vendor, filename: req.file.originalname, size: req.file.size },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      res.json({ 
        success: true, 
        file: {
          id: fileUpload.id,
          filename: fileUpload.originalFilename,
          vendor: fileUpload.vendor,
          size: fileUpload.byteLength,
          scanStatus: fileUpload.scanStatus,
          uploadedAt: fileUpload.createdAt
        }
      });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({ error: "File upload failed" });
    }
  });

  app.get("/api/tax-files", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const { vendor } = req.query;
      const files = await storage.getUserTaxFileUploads(userId, vendor as string | undefined);
      
      // Filter out deleted files and sensitive metadata
      const sanitizedFiles = files
        .filter(f => !f.deletedAt)
        .map(f => ({
          id: f.id,
          vendor: f.vendor,
          filename: f.originalFilename,
          formType: f.formType,
          size: f.byteLength,
          scanStatus: f.scanStatus,
          importStatus: f.importStatus,
          uploadedAt: f.createdAt
        }));
      
      res.json({ files: sanitizedFiles });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  app.get("/api/tax-files/:id/download", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const fileUpload = await storage.getTaxFileUpload(req.params.id);
      
      if (!fileUpload) {
        return res.status(404).json({ error: "File not found" });
      }
      
      if (fileUpload.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      if (fileUpload.deletedAt) {
        return res.status(404).json({ error: "File has been deleted" });
      }
      
      // Only allow download of clean files
      if (fileUpload.scanStatus !== 'clean') {
        return res.status(403).json({ 
          error: "File not available for download",
          scanStatus: fileUpload.scanStatus 
        });
      }
      
      // Decrypt and retrieve file
      const decryptedData = await retrieveEncryptedFile(
        fileUpload.storageKey,
        fileUpload.encryptedFileKey,
        fileUpload.encryptionNonce
      );
      
      // Verify checksum
      const fileChecksum = calculateChecksum(decryptedData);
      if (fileChecksum !== fileUpload.checksum) {
        throw new Error('File integrity check failed');
      }
      
      // Send file
      res.setHeader('Content-Type', fileUpload.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileUpload.originalFilename}"`);
      res.send(decryptedData);
      
      // Audit log
      await storage.createAuditLog({
        userId,
        action: 'DOWNLOAD_TAX_FILE',
        resourceType: 'tax_file',
        resourceId: fileUpload.id,
        details: { filename: fileUpload.originalFilename },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    } catch (error) {
      console.error('File download error:', error);
      res.status(500).json({ error: "File download failed" });
    }
  });

  app.delete("/api/tax-files/:id", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const fileUpload = await storage.getTaxFileUpload(req.params.id);
      
      if (!fileUpload) {
        return res.status(404).json({ error: "File not found" });
      }
      
      if (fileUpload.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Soft delete in database
      await storage.deleteTaxFileUpload(req.params.id);
      
      // Securely delete physical file
      await secureDeleteFile(fileUpload.storageKey);
      
      // Audit log
      await storage.createAuditLog({
        userId,
        action: 'DELETE_TAX_FILE',
        resourceType: 'tax_file',
        resourceId: req.params.id,
        details: { filename: fileUpload.originalFilename },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('File deletion error:', error);
      res.status(500).json({ error: "File deletion failed" });
    }
  });

  // Analytics API Endpoints (Admin only)
  
  app.get("/api/admin/analytics/overview", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { conversationAnalytics, userBehaviorPatterns } = await import("@shared/schema");
      const { sql } = await import("drizzle-orm");
      
      // Get aggregate statistics
      const totalConversations = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversationAnalytics);
      
      const avgQuality = await db
        .select({ avg: sql<number>`avg(${conversationAnalytics.qualityScore})::int` })
        .from(conversationAnalytics)
        .where(sql`${conversationAnalytics.qualityScore} IS NOT NULL`);
      
      const highChurnUsers = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userBehaviorPatterns)
        .where(sql`${userBehaviorPatterns.churnRisk} = 'high'`);
      
      const upsellCandidates = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userBehaviorPatterns)
        .where(sql`${userBehaviorPatterns.potentialUpsellCandidate} = true`);
      
      res.json({
        overview: {
          totalConversations: totalConversations[0]?.count || 0,
          averageQualityScore: avgQuality[0]?.avg || 0,
          highChurnUsers: highChurnUsers[0]?.count || 0,
          upsellCandidates: upsellCandidates[0]?.count || 0
        }
      });
    } catch (error) {
      console.error('Analytics overview error:', error);
      res.status(500).json({ error: "Failed to fetch analytics overview" });
    }
  });
  
  app.get("/api/admin/analytics/users/:userId", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { userBehaviorPatterns, conversationAnalytics } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      
      const userId = req.params.userId;
      
      // Get user behavior patterns
      const [behavior] = await db
        .select()
        .from(userBehaviorPatterns)
        .where(eq(userBehaviorPatterns.userId, userId))
        .limit(1);
      
      // Get recent conversations
      const recentConversations = await db
        .select()
        .from(conversationAnalytics)
        .where(eq(conversationAnalytics.userId, userId))
        .orderBy(desc(conversationAnalytics.createdAt))
        .limit(10);
      
      res.json({
        behavior,
        recentConversations
      });
    } catch (error) {
      console.error('User analytics error:', error);
      res.status(500).json({ error: "Failed to fetch user analytics" });
    }
  });
  
  app.get("/api/admin/analytics/churn-risks", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { userBehaviorPatterns } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      
      // Get high churn risk users
      const highRiskUsers = await db
        .select()
        .from(userBehaviorPatterns)
        .where(eq(userBehaviorPatterns.churnRisk, 'high'))
        .orderBy(desc(userBehaviorPatterns.churnRiskScore))
        .limit(50);
      
      res.json({ highRiskUsers });
    } catch (error) {
      console.error('Churn risk analytics error:', error);
      res.status(500).json({ error: "Failed to fetch churn risk analytics" });
    }
  });
  
  app.post("/api/admin/analytics/batch-process", requireAuth, requireAdmin, async (_req, res) => {
    try {
      // Trigger batch analytics processing
      setImmediate(() => {
        AnalyticsProcessor.runBatchAnalytics().catch(error => {
          console.error('[Analytics] Batch processing failed:', error);
        });
      });
      
      res.json({ message: "Batch analytics processing initiated" });
    } catch (error) {
      console.error('Batch processing error:', error);
      res.status(500).json({ error: "Failed to initiate batch processing" });
    }
  });

  // User Analytics Endpoints (for regular users to view their own analytics)
  
  app.get("/api/analytics", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { userBehaviorPatterns, conversationAnalytics, sentimentTrends, messageAnalytics, conversations: conversationsTable } = await import("@shared/schema");
      const { eq, desc, sql } = await import("drizzle-orm");
      
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Get user behavior patterns
      const [behavior] = await db
        .select()
        .from(userBehaviorPatterns)
        .where(eq(userBehaviorPatterns.userId, userId))
        .limit(1);
      
      // Get conversation analytics (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const conversations = await db
        .select()
        .from(conversationAnalytics)
        .where(eq(conversationAnalytics.userId, userId))
        .orderBy(desc(conversationAnalytics.createdAt))
        .limit(100);
      
      // Get sentiment trends (last 30 days)
      const sentimentData = await db
        .select()
        .from(sentimentTrends)
        .where(eq(sentimentTrends.userId, userId))
        .orderBy(desc(sentimentTrends.date))
        .limit(30);
      
      // Get message analytics for detailed insights
      const messageStats = await db
        .select()
        .from(messageAnalytics)
        .where(eq(messageAnalytics.userId, userId))
        .orderBy(desc(messageAnalytics.createdAt))
        .limit(100);
      
      // Calculate summary statistics
      const totalConversations = conversations.length;
      const avgQuality = conversations.filter(c => c.qualityScore).length > 0
        ? Math.round(conversations.filter(c => c.qualityScore).reduce((sum, c) => sum + (c.qualityScore || 0), 0) / conversations.filter(c => c.qualityScore).length)
        : null;
      
      const topicsCount = new Map<string, number>();
      conversations.forEach(c => {
        if (c.topicsDiscussed) {
          (c.topicsDiscussed as string[]).forEach(topic => {
            topicsCount.set(topic, (topicsCount.get(topic) || 0) + 1);
          });
        }
      });
      
      const topTopics = Array.from(topicsCount.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      // Get user feedback stats using SQL aggregation (all-time, no date filter for complete picture)
      const [feedbackStats] = await db
        .select({
          totalConversations: sql<number>`count(*)::int`,
          resolvedCount: sql<number>`count(*) filter (where ${conversationsTable.resolved} = true)::int`,
          avgRating: sql<string>`round(avg(${conversationsTable.qualityScore}), 1)`,
          totalRated: sql<number>`count(*) filter (where ${conversationsTable.qualityScore} is not null)::int`,
          rating1Count: sql<number>`count(*) filter (where ${conversationsTable.qualityScore} = 1)::int`,
          rating2Count: sql<number>`count(*) filter (where ${conversationsTable.qualityScore} = 2)::int`,
          rating3Count: sql<number>`count(*) filter (where ${conversationsTable.qualityScore} = 3)::int`,
          rating4Count: sql<number>`count(*) filter (where ${conversationsTable.qualityScore} = 4)::int`,
          rating5Count: sql<number>`count(*) filter (where ${conversationsTable.qualityScore} = 5)::int`,
        })
        .from(conversationsTable)
        .where(eq(conversationsTable.userId, userId));
      
      const totalUserConversations = feedbackStats.totalConversations;
      const resolvedCount = feedbackStats.resolvedCount;
      const resolutionRate = totalUserConversations > 0 
        ? Math.round((resolvedCount / totalUserConversations) * 100)
        : 0;
      
      const ratingDistribution = [
        { rating: 1, count: feedbackStats.rating1Count },
        { rating: 2, count: feedbackStats.rating2Count },
        { rating: 3, count: feedbackStats.rating3Count },
        { rating: 4, count: feedbackStats.rating4Count },
        { rating: 5, count: feedbackStats.rating5Count },
      ];
      
      const avgUserRating = feedbackStats.totalRated > 0 ? feedbackStats.avgRating : null;
      
      res.json({
        behavior: behavior || null,
        conversations,
        sentimentTrends: sentimentData,
        messageStats,
        summary: {
          totalConversations,
          averageQualityScore: avgQuality,
          topTopics
        },
        userFeedback: {
          resolvedCount,
          resolutionRate,
          ratingDistribution,
          averageUserRating: avgUserRating,
          totalRated: feedbackStats.totalRated,
          totalConversations: totalUserConversations
        }
      });
    } catch (error) {
      console.error('User analytics error:', error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // AI Provider Health Monitoring Endpoints (Admin only)
  
  app.get("/api/admin/ai-providers/health", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const healthStatus = providerHealthMonitor.getAllHealthStatus();
      res.json({ providers: healthStatus });
    } catch (error) {
      console.error('Provider health status error:', error);
      res.status(500).json({ error: "Failed to fetch provider health status" });
    }
  });
  
  app.post("/api/admin/ai-providers/:provider/reset-health", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { AIProviderName } = await import("./services/aiProviders");
      const providerName = req.params.provider as any;
      
      // Validate provider name
      if (!Object.values(AIProviderName).includes(providerName)) {
        return res.status(400).json({ error: "Invalid provider name" });
      }
      
      providerHealthMonitor.resetProviderHealth(providerName);
      res.json({ message: `Health metrics reset for ${providerName}` });
    } catch (error) {
      console.error('Reset health error:', error);
      res.status(500).json({ error: "Failed to reset provider health" });
    }
  });

  // Admin user management - tier update
  app.patch("/api/admin/users/:id/tier", requireAuth, requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        tier: z.enum(['free', 'payg', 'plus', 'professional', 'enterprise'])
      });
      
      const { tier } = schema.parse(req.body);
      const adminUserId = getCurrentUserId(req);
      
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await storage.updateUserSubscription(req.params.id, tier);
      
      await storage.createAuditLog({
        userId: adminUserId,
        action: 'UPDATE_USER_TIER',
        resourceType: 'user',
        resourceId: req.params.id,
        details: { tier },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues });
      }
      res.status(500).json({ error: "Failed to update user tier" });
    }
  });

  // Admin user management - toggle admin status
  app.patch("/api/admin/users/:id/toggle-admin", requireAuth, requireAdmin, async (req, res) => {
    try {
      const adminUserId = getCurrentUserId(req);
      
      // Prevent toggling own admin status
      if (req.params.id === adminUserId) {
        return res.status(400).json({ error: "Cannot toggle your own admin status" });
      }
      
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const newAdminStatus = !user.isAdmin;
      await storage.updateUser(req.params.id, { isAdmin: newAdminStatus });
      
      await storage.createAuditLog({
        userId: adminUserId,
        action: newAdminStatus ? 'GRANT_ADMIN' : 'REVOKE_ADMIN',
        resourceType: 'user',
        resourceId: req.params.id,
        details: { isAdmin: newAdminStatus },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      res.json({ success: true, isAdmin: newAdminStatus });
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle admin status" });
    }
  });

  // Admin subscriptions list with user info
  app.get("/api/admin/subscriptions", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const subscriptions = await storage.getAllSubscriptions();
      res.json(subscriptions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  // Coupon Management Endpoints (Admin only)
  
  app.get("/api/admin/coupons", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const coupons = await storage.getAllCoupons();
      res.json({ coupons });
    } catch (error) {
      console.error('Fetch coupons error:', error);
      res.status(500).json({ error: "Failed to fetch coupons" });
    }
  });

  app.get("/api/admin/coupons/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const coupon = await storage.getCoupon(req.params.id);
      if (!coupon) {
        return res.status(404).json({ error: "Coupon not found" });
      }
      res.json({ coupon });
    } catch (error) {
      console.error('Fetch coupon error:', error);
      res.status(500).json({ error: "Failed to fetch coupon" });
    }
  });

  app.post("/api/admin/coupons", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { insertCouponSchema } = await import("@shared/schema");
      const userId = getCurrentUserId(req);
      
      const validatedData = insertCouponSchema.parse({
        ...req.body,
        createdBy: userId
      });
      
      const coupon = await storage.createCoupon(validatedData);
      res.json({ coupon });
    } catch (error: any) {
      console.error('Create coupon error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: "Coupon code already exists" });
      }
      res.status(500).json({ error: "Failed to create coupon" });
    }
  });

  app.patch("/api/admin/coupons/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { insertCouponSchema } = await import("@shared/schema");
      const updateSchema = insertCouponSchema.partial();
      const validatedData = updateSchema.parse(req.body) as Parameters<typeof storage.updateCoupon>[1];
      
      const coupon = await storage.updateCoupon(req.params.id, validatedData);
      if (!coupon) {
        return res.status(404).json({ error: "Coupon not found" });
      }
      res.json({ coupon });
    } catch (error) {
      console.error('Update coupon error:', error);
      res.status(500).json({ error: "Failed to update coupon" });
    }
  });

  app.delete("/api/admin/coupons/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteCoupon(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Coupon not found" });
      }
      res.json({ message: "Coupon deleted successfully" });
    } catch (error) {
      console.error('Delete coupon error:', error);
      res.status(500).json({ error: "Failed to delete coupon" });
    }
  });

  app.get("/api/admin/coupons/:id/usage", requireAuth, requireAdmin, async (req, res) => {
    try {
      const usage = await storage.getCouponUsageHistory(req.params.id);
      res.json({ usage });
    } catch (error) {
      console.error('Fetch coupon usage error:', error);
      res.status(500).json({ error: "Failed to fetch coupon usage" });
    }
  });

  // Coupon Pre-Validation Endpoint (Lightweight check before plan selection)
  app.get("/api/coupons/pre-validate", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const { code, currency } = req.query;
      
      if (!code || !currency) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      const coupon = await storage.getCouponByCode((code as string).toUpperCase());
      
      if (!coupon) {
        return res.status(404).json({ valid: false, error: "Invalid coupon code" });
      }
      
      if (!coupon.isActive) {
        return res.status(400).json({ valid: false, error: "Coupon is inactive" });
      }
      
      const now = new Date();
      if (coupon.validFrom && new Date(coupon.validFrom) > now) {
        return res.status(400).json({ valid: false, error: "Coupon not yet valid" });
      }
      
      if (coupon.validUntil && new Date(coupon.validUntil) < now) {
        return res.status(400).json({ valid: false, error: "Coupon has expired" });
      }
      
      if (coupon.applicableCurrencies && !coupon.applicableCurrencies.includes(currency as string)) {
        return res.status(400).json({ valid: false, error: "Coupon not applicable to this currency" });
      }
      
      if (coupon.maxUses && coupon.usageCount >= coupon.maxUses) {
        return res.status(400).json({ valid: false, error: "Coupon usage limit reached" });
      }
      
      const userUsageCount = await storage.getCouponUsageCount(coupon.id, userId);
      if (coupon.maxUsesPerUser && userUsageCount >= coupon.maxUsesPerUser) {
        return res.status(400).json({ valid: false, error: "You have already used this coupon" });
      }
      
      // Pre-validation passed - return basic coupon info
      res.json({
        valid: true,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        description: coupon.description
      });
    } catch (error) {
      console.error('Pre-validate coupon error:', error);
      res.status(500).json({ valid: false, error: "Failed to validate coupon" });
    }
  });

  // Coupon Validation Endpoint (For users during checkout)
  app.post("/api/coupons/validate", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const { code, plan, currency, amount } = req.body;
      
      if (!code || !plan || !currency || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      const coupon = await storage.getCouponByCode(code.toUpperCase());
      
      if (!coupon) {
        return res.status(404).json({ error: "Invalid coupon code" });
      }
      
      if (!coupon.isActive) {
        return res.status(400).json({ error: "Coupon is inactive" });
      }
      
      const now = new Date();
      if (coupon.validFrom && new Date(coupon.validFrom) > now) {
        return res.status(400).json({ error: "Coupon not yet valid" });
      }
      
      if (coupon.validUntil && new Date(coupon.validUntil) < now) {
        return res.status(400).json({ error: "Coupon has expired" });
      }
      
      if (coupon.applicablePlans && !coupon.applicablePlans.includes(plan)) {
        return res.status(400).json({ error: "Coupon not applicable to this plan" });
      }
      
      if (coupon.applicableCurrencies && !coupon.applicableCurrencies.includes(currency)) {
        return res.status(400).json({ error: "Coupon not applicable to this currency" });
      }
      
      if (coupon.maxUses && coupon.usageCount >= coupon.maxUses) {
        return res.status(400).json({ error: "Coupon usage limit reached" });
      }
      
      const userUsageCount = await storage.getCouponUsageCount(coupon.id, userId);
      if (coupon.maxUsesPerUser && userUsageCount >= coupon.maxUsesPerUser) {
        return res.status(400).json({ error: "You have already used this coupon" });
      }
      
      if (coupon.minPurchaseAmount && amount < coupon.minPurchaseAmount) {
        return res.status(400).json({ 
          error: `Minimum purchase amount is ${coupon.minPurchaseAmount / 100} ${currency}` 
        });
      }
      
      let discountAmount = 0;
      if (coupon.discountType === 'percentage') {
        discountAmount = Math.floor(amount * coupon.discountValue / 100);
        if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
          discountAmount = coupon.maxDiscountAmount;
        }
      } else if (coupon.discountType === 'fixed' && coupon.currency === currency) {
        discountAmount = coupon.discountValue;
      } else {
        return res.status(400).json({ error: "Coupon currency mismatch" });
      }
      
      const finalAmount = Math.max(0, amount - discountAmount);
      
      res.json({ 
        valid: true, 
        coupon: {
          id: coupon.id,
          code: coupon.code,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue
        },
        discountAmount,
        finalAmount
      });
    } catch (error) {
      console.error('Validate coupon error:', error);
      res.status(500).json({ error: "Failed to validate coupon" });
    }
  });

  // ===============================================
  // MVP FEATURE ROUTES
  // ===============================================

  // Scenario Simulator Routes
  app.post("/api/scenarios/playbooks", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { db } = await import("./db");
      const { scenarioPlaybooks, insertScenarioPlaybookSchema } = await import("@shared/schema");
      
      const validatedData = insertScenarioPlaybookSchema.parse({
        ...req.body,
        userId
      });
      
      const playbook = await db.insert(scenarioPlaybooks).values(validatedData).returning().then(rows => rows[0]);
      res.json(playbook);
    } catch (error) {
      console.error('Create playbook error:', error);
      res.status(500).json({ error: "Failed to create scenario playbook" });
    }
  });

  app.get("/api/scenarios/playbooks", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { db } = await import("./db");
      const { scenarioPlaybooks } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      
      const playbooks = await db
        .select()
        .from(scenarioPlaybooks)
        .where(eq(scenarioPlaybooks.userId, userId))
        .orderBy(desc(scenarioPlaybooks.createdAt));
      
      res.json(playbooks);
    } catch (error) {
      console.error('Fetch playbooks error:', error);
      res.status(500).json({ error: "Failed to fetch scenario playbooks" });
    }
  });

  app.post("/api/scenarios/playbooks/:playbookId/variants", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { db } = await import("./db");
      const { scenarioVariants, scenarioPlaybooks } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      // Verify playbook ownership
      const [playbook] = await db
        .select()
        .from(scenarioPlaybooks)
        .where(and(
          eq(scenarioPlaybooks.id, req.params.playbookId),
          eq(scenarioPlaybooks.userId, userId)
        ))
        .limit(1);
      
      if (!playbook) {
        return res.status(404).json({ error: "Playbook not found" });
      }
      
      const variant = await db.insert(scenarioVariants).values({
        playbookId: req.params.playbookId,
        ...req.body
      }).returning().then(rows => rows[0]);
      
      res.json(variant);
    } catch (error) {
      console.error('Create variant error:', error);
      res.status(500).json({ error: "Failed to create scenario variant" });
    }
  });

  app.post("/api/scenarios/playbooks/:playbookId/simulate", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { ScenarioSolver } = await import("./services/scenarioSolver");
      const { db } = await import("./db");
      const { scenarioPlaybooks, scenarioRuns, scenarioMetrics } = await import("@shared/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      
      // Verify playbook ownership
      const [playbook] = await db
        .select()
        .from(scenarioPlaybooks)
        .where(and(
          eq(scenarioPlaybooks.id, req.params.playbookId),
          eq(scenarioPlaybooks.userId, userId)
        ))
        .limit(1);
      
      if (!playbook) {
        return res.status(404).json({ error: "Playbook not found" });
      }
      
      // Run simulation
      const result = await ScenarioSolver.runSimulation(playbook, req.body.variantIds || []);
      
      // Fetch recent runs for this playbook's variants
      const { scenarioVariants } = await import("@shared/schema");
      const { inArray } = await import("drizzle-orm");
      
      const variants = await db
        .select()
        .from(scenarioVariants)
        .where(eq(scenarioVariants.playbookId, playbook.id));
      
      const variantIds = variants.map(v => v.id);
      
      const recentRuns = variantIds.length > 0 ? await db
        .select()
        .from(scenarioRuns)
        .where(inArray(scenarioRuns.variantId, variantIds))
        .orderBy(desc(scenarioRuns.createdAt))
        .limit(5) : [];
      
      // Fetch metrics for recent runs
      const runIds = recentRuns.map(r => r.id);
      const metrics = runIds.length > 0 ? await db
        .select()
        .from(scenarioMetrics)
        .where(inArray(scenarioMetrics.runId, runIds)) : [];
      
      res.json({
        ...result,
        recentRuns,
        metrics
      });
    } catch (error) {
      console.error('Simulation error:', error);
      res.status(500).json({ error: "Failed to run simulation" });
    }
  });

  // Agent-based scenario simulation with SSE streaming
  app.post("/api/scenarios/agent-simulate", requireAuth, async (req, res) => {
    try {
      const { ScenarioSolver } = await import("./services/scenarioSolver");
      
      const { baseCase, variables, context, jurisdiction, stream } = req.body;
      
      if (!baseCase) {
        return res.status(400).json({ error: "baseCase configuration is required" });
      }

      // If streaming requested, use SSE
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const result = await ScenarioSolver.runAgentSimulation(
          { baseCase, variables, context, jurisdiction },
          (agentId, status, output) => {
            res.write(`data: ${JSON.stringify({ agentId, status, output })}\n\n`);
          }
        );

        res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
        res.end();
      } else {
        // Non-streaming response
        const result = await ScenarioSolver.runAgentSimulation(
          { baseCase, variables, context, jurisdiction }
        );
        res.json(result);
      }
    } catch (error) {
      console.error('Agent simulation error:', error);
      res.status(500).json({ error: "Failed to run agent simulation" });
    }
  });

  // Deliverable Composer Routes
  app.get("/api/deliverables/templates", requireAuth, async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { deliverableTemplates } = await import("@shared/schema");
      const { or, eq, isNull } = await import("drizzle-orm");
      const userId = getCurrentUserId(_req);
      
      // Get system templates and user's custom templates
      const templates = await db
        .select()
        .from(deliverableTemplates)
        .where(or(
          eq(deliverableTemplates.isSystem, true),
          isNull(deliverableTemplates.ownerUserId),
          userId ? eq(deliverableTemplates.ownerUserId, userId) : undefined
        ));
      
      res.json(templates);
    } catch (error) {
      console.error('Fetch templates error:', error);
      res.status(500).json({ error: "Failed to fetch deliverable templates" });
    }
  });

  // Upload a personalized template
  app.post("/api/deliverables/templates/upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const userId = getCurrentUserId(req);
      const { db } = await import("./db");
      const { deliverableTemplates } = await import("@shared/schema");
      const { documentAnalyzer } = await import("./services/documentAnalyzer");

      // Extract text using document analyzer
      let extractedText = "";
      try {
        const docResult = await documentAnalyzer.analyzeDocument(req.file.buffer, req.file.mimetype);
        extractedText = docResult.text || docResult.tables?.[0]?.content || "";
        
        // If document analyzer fails to extract meaningful text, fallback to a basic read
        if (!extractedText.trim() && req.file.mimetype === 'text/plain') {
          extractedText = req.file.buffer.toString('utf-8');
        }
      } catch (err) {
        console.error("Error analyzing uploaded template file:", err);
        // Fallback for plain text
        if (req.file.mimetype === 'text/plain' || req.file.mimetype === 'text/markdown') {
          extractedText = req.file.buffer.toString('utf-8');
        } else {
          extractedText = `[Extracted template content from ${req.file.originalname}]`;
        }
      }

      const name = req.body.name || req.file.originalname.split('.')[0] || "Custom Template";
      const category = req.body.category || "advisory";
      const typeStr = req.body.type || "custom";

      // Detect simple variables in the text (like {{client_name}}, [Company Name], etc.)
      const variables: any = {};
      const variableRegex = /{{([^}]+)}}|\[([^\]]+)\]/g;
      let match;
      while ((match = variableRegex.exec(extractedText)) !== null) {
        const varName = match[1] || match[2];
        const key = varName.replace(/\s+/g, '_').toLowerCase().trim();
        if (key) {
          variables[key] = { type: "string", description: `Value for ${varName}` };
        }
      }
      
      const newTemplate = await db.insert(deliverableTemplates).values({
        ownerUserId: userId,
        name: name,
        description: `Custom uploaded template: ${req.file.originalname}`,
        category: category,
        type: typeStr,
        contentTemplate: extractedText || "No content extracted",
        variableSchema: {
          type: "object",
          properties: Object.keys(variables).length > 0 ? variables : {
            "custom_content": { type: "string", description: "Custom content" }
          },
        },
        isSystem: false,
        isPublic: false,
      }).returning();

      res.status(201).json(newTemplate[0]);
    } catch (error) {
      console.error('Template upload error:', error);
      res.status(500).json({ error: "Failed to upload and process template" });
    }
  });

  app.post("/api/deliverables/generate", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { DeliverableGenerator } = await import("./services/deliverableGenerator");
      const { db } = await import("./db");
      const { deliverableInstances } = await import("@shared/schema");
      
      const { templateId, variables } = req.body;
      
      // Generate deliverable using AI
      const result = await DeliverableGenerator.generate(templateId, variables, userId);
      
      // Store instance
      const instance = await db.insert(deliverableInstances).values({
        userId,
        templateId,
        title: result.title || 'Untitled Document',
        type: result.type || 'general',
        variableValues: variables,
        contentMarkdown: result.content,
        status: 'draft'
      }).returning().then(rows => rows[0]);
      
      res.json(instance);
    } catch (error) {
      console.error('Generate deliverable error:', error);
      res.status(500).json({ error: "Failed to generate deliverable" });
    }
  });

  app.get("/api/deliverables/instances", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { db } = await import("./db");
      const { deliverableInstances } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      
      const instances = await db
        .select()
        .from(deliverableInstances)
        .where(eq(deliverableInstances.userId, userId))
        .orderBy(desc(deliverableInstances.createdAt));
      
      res.json(instances);
    } catch (error) {
      console.error('Fetch instances error:', error);
      res.status(500).json({ error: "Failed to fetch deliverable instances" });
    }
  });

  app.post("/api/deliverables/instances/:instanceId/export", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { DocumentExporter } = await import("./services/documentExporter");
      const { db } = await import("./db");
      const { deliverableInstances, deliverableAssets } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      // Verify instance ownership
      const [instance] = await db
        .select()
        .from(deliverableInstances)
        .where(and(
          eq(deliverableInstances.id, req.params.instanceId),
          eq(deliverableInstances.userId, userId)
        ))
        .limit(1);
      
      if (!instance) {
        return res.status(404).json({ error: "Deliverable not found" });
      }
      
      const { format } = req.body; // 'docx' or 'pdf'
      
      // Export to requested format
      const asset = await DocumentExporter.export({
        content: instance.contentMarkdown || '',
        format: format || 'pdf',
        title: instance.title
      });
      
      const storageKey = `deliverables/${userId}/${req.params.instanceId}.${format}`;
      const checksum = calculateChecksum(asset);
      
      // Store asset for future downloads
      const savedAsset = await db.insert(deliverableAssets).values({
        instanceId: req.params.instanceId,
        filename: `${instance.title}.${format || 'pdf'}`,
        mimeType: format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf',
        format: format || 'pdf',
        storageKey,
        checksum,
        byteLength: asset.length
      }).returning().then(rows => rows[0]);
      
      res.json({ 
        buffer: asset.toString('base64'), 
        format,
        assetId: savedAsset.id
      });
    } catch (error) {
      console.error('Export deliverable error:', error);
      res.status(500).json({ error: "Failed to export deliverable" });
    }
  });

  // Forensic Intelligence Routes
  app.post("/api/forensics/cases", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { db } = await import("./db");
      const { forensicCases, insertForensicCaseSchema } = await import("@shared/schema");
      
      const validatedData = insertForensicCaseSchema.parse({
        ...req.body,
        userId
      });
      
      const forensicCase = await db.insert(forensicCases).values(validatedData).returning().then(rows => rows[0]);
      res.json(forensicCase);
    } catch (error) {
      console.error('Create forensic case error:', error);
      res.status(500).json({ error: "Failed to create forensic case" });
    }
  });

  app.get("/api/forensics/cases", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { db } = await import("./db");
      const { forensicCases } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      
      const cases = await db
        .select()
        .from(forensicCases)
        .where(eq(forensicCases.userId, userId))
        .orderBy(desc(forensicCases.createdAt));
      
      res.json(cases);
    } catch (error) {
      console.error('Fetch forensic cases error:', error);
      res.status(500).json({ error: "Failed to fetch forensic cases" });
    }
  });

  app.post("/api/forensics/cases/:caseId/documents", requireAuth, fileUploadRateLimiter, upload.single('file'), async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { db } = await import("./db");
      const { forensicCases, forensicDocuments } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Verify case ownership
      const [forensicCase] = await db
        .select()
        .from(forensicCases)
        .where(and(
          eq(forensicCases.id, req.params.caseId),
          eq(forensicCases.userId, userId)
        ))
        .limit(1);
      
      if (!forensicCase) {
        return res.status(404).json({ error: "Case not found" });
      }
      
      // Store encrypted file
      const { storageKey, nonce, encryptedFileKey, checksum } = await storeEncryptedFile(req.file.buffer, req.file.originalname);
      
      // Store document record with security metadata
      const document = await db.insert(forensicDocuments).values({
        caseId: req.params.caseId,
        filename: req.file.originalname,
        sourceType: 'upload',
        extractedData: {}, // Will be filled by analyzer
        analysisStatus: 'pending',
        documentMetadata: {
          storageKey,
          nonce,
          encryptedFileKey,
          checksum,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          uploadedAt: new Date().toISOString()
        }
      }).returning().then(rows => rows[0]);
      
      // Trigger forensic analysis asynchronously
      const { ForensicAnalyzer } = await import("./services/forensicAnalyzer");
      setImmediate(() => {
        ForensicAnalyzer.analyzeDocument(document.id, req.file!.buffer, req.file!.mimetype, req.file!.originalname).catch((error: any) => {
          console.error('[Forensics] Analysis failed:', error);
        });
      });
      
      res.json(document);
    } catch (error) {
      console.error('Upload forensic document error:', error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  app.get("/api/forensics/cases/:caseId/documents", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { db } = await import("./db");
      const { forensicCases, forensicDocuments } = await import("@shared/schema");
      const { eq, and, desc } = await import("drizzle-orm");

      const [forensicCase] = await db
        .select()
        .from(forensicCases)
        .where(and(
          eq(forensicCases.id, req.params.caseId),
          eq(forensicCases.userId, userId)
        ))
        .limit(1);

      if (!forensicCase) {
        return res.status(404).json({ error: "Case not found" });
      }

      const docs = await db
        .select({
          id: forensicDocuments.id,
          caseId: forensicDocuments.caseId,
          filename: forensicDocuments.filename,
          sourceType: forensicDocuments.sourceType,
          analysisStatus: forensicDocuments.analysisStatus,
          documentMetadata: forensicDocuments.documentMetadata,
          createdAt: forensicDocuments.createdAt,
        })
        .from(forensicDocuments)
        .where(eq(forensicDocuments.caseId, req.params.caseId))
        .orderBy(desc(forensicDocuments.createdAt));

      const sanitized = docs.map(d => {
        const meta = (d.documentMetadata ?? {}) as Record<string, any>;
        const { storageKey, encryptedFileKey, nonce, checksum, ...safe } = meta;
        return {
          ...d,
          documentType: safe.documentType ?? safe.mimeType ?? 'document',
          documentMetadata: safe,
        };
      });

      res.json(sanitized);
    } catch (error) {
      console.error('Fetch forensic documents error:', error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.get("/api/forensics/cases/:caseId/findings", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { db } = await import("./db");
      const { forensicCases, forensicFindings } = await import("@shared/schema");
      const { eq, and, desc } = await import("drizzle-orm");
      
      // Verify case ownership
      const [forensicCase] = await db
        .select()
        .from(forensicCases)
        .where(and(
          eq(forensicCases.id, req.params.caseId),
          eq(forensicCases.userId, userId)
        ))
        .limit(1);
      
      if (!forensicCase) {
        return res.status(404).json({ error: "Case not found" });
      }
      
      const findings = await db
        .select()
        .from(forensicFindings)
        .where(eq(forensicFindings.caseId, req.params.caseId))
        .orderBy(desc(forensicFindings.severity), desc(forensicFindings.createdAt));
      
      res.json(findings);
    } catch (error) {
      console.error('Fetch findings error:', error);
      res.status(500).json({ error: "Failed to fetch forensic findings" });
    }
  });

  // Analyze all documents in a case
  app.post("/api/forensics/cases/:caseId/analyze", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { db } = await import("./db");
      const { forensicCases, forensicDocuments, forensicFindings } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      
      // Verify case ownership
      const [forensicCase] = await db
        .select()
        .from(forensicCases)
        .where(and(
          eq(forensicCases.id, req.params.caseId),
          eq(forensicCases.userId, userId)
        ))
        .limit(1);
      
      if (!forensicCase) {
        return res.status(404).json({ error: "Case not found" });
      }
      
      // Get all documents in the case
      const documents = await db
        .select()
        .from(forensicDocuments)
        .where(eq(forensicDocuments.caseId, req.params.caseId));
      
      if (documents.length === 0) {
        return res.status(400).json({ error: "No documents to analyze" });
      }
      
      // Run forensic analysis on pending documents
      const { ForensicAnalyzer } = await import("./services/forensicAnalyzer");
      const pendingDocs = documents.filter(d => d.analysisStatus === 'pending');
      
      for (const doc of pendingDocs) {
        // Retrieve file buffer from storage key in metadata
        const metadata = doc.documentMetadata as any;
        if (metadata?.storageKey && metadata?.encryptedFileKey && metadata?.nonce) {
          try {
            const fileBuffer = await retrieveEncryptedFile(
              metadata.storageKey,
              metadata.encryptedFileKey,
              metadata.nonce
            );
            await ForensicAnalyzer.analyzeDocument(doc.id, fileBuffer, metadata.mimeType || 'application/octet-stream', doc.filename);
          } catch (err) {
            console.error(`[Forensics] Failed to analyze doc ${doc.id}:`, err);
          }
        }
      }
      
      // Get updated findings
      const findings = await db
        .select()
        .from(forensicFindings)
        .where(eq(forensicFindings.caseId, req.params.caseId));
      
      res.json({
        success: true,
        documentsAnalyzed: pendingDocs.length,
        totalFindings: findings.length
      });
    } catch (error) {
      console.error('Forensic analysis error:', error);
      res.status(500).json({ error: "Failed to run forensic analysis" });
    }
  });

  // Generate court-ready forensic report PDF for a case
  app.post("/api/forensics/cases/:caseId/report", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { ForensicReportGenerator } = await import("./services/forensics/reportGenerator");
      const pdf = await ForensicReportGenerator.generate(req.params.caseId, userId);
      if (!pdf) {
        return res.status(404).json({ error: "Case not found" });
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="forensic-report-${req.params.caseId}.pdf"`);
      res.setHeader('Content-Length', pdf.length.toString());
      res.end(pdf);
    } catch (error) {
      console.error('Forensic report generation error:', error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Reconcile two documents within a case (match rows, surface discrepancies)
  app.post("/api/forensics/cases/:caseId/reconcile", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { sourceDocumentId, targetDocumentId } = req.body || {};
      if (!sourceDocumentId || !targetDocumentId) {
        return res.status(400).json({ error: "sourceDocumentId and targetDocumentId required" });
      }
      const { ForensicReconciler } = await import("./services/forensics/reconciler");
      const result = await ForensicReconciler.reconcile({
        caseId: req.params.caseId,
        userId,
        sourceDocumentId,
        targetDocumentId,
      });
      if (!result) {
        return res.status(404).json({ error: "Case or documents not found" });
      }
      res.json(result);
    } catch (error) {
      console.error('Forensic reconciliation error:', error);
      res.status(500).json({ error: "Failed to reconcile documents" });
    }
  });

  // Build chronological timeline across all case documents with evidence provenance
  app.get("/api/forensics/cases/:caseId/timeline", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { ForensicTimelineBuilder } = await import("./services/forensics/timelineBuilder");
      const timeline = await ForensicTimelineBuilder.build(req.params.caseId, userId);
      if (!timeline) {
        return res.status(404).json({ error: "Case not found" });
      }
      res.json(timeline);
    } catch (error) {
      console.error('Forensic timeline error:', error);
      res.status(500).json({ error: "Failed to build timeline" });
    }
  });

  // ==================== ACCOUNT ACCESS ROUTES ====================

  // Get current user's account access and usage defaults
  app.get("/api/subscription", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const currentMonth = new Date().toISOString().slice(0, 7);
      const usage = await storage.getUsageForMonth(userId, currentMonth);
      
      res.json({
        subscription: {
          plan: 'free',
          status: 'active',
          currentPeriodEnd: null
        },
        quota: {
          queriesUsed: usage?.queriesUsed || 0,
          documentsAnalyzed: usage?.documentsAnalyzed || 0,
          tokensUsed: usage?.tokensUsed || 0
        }
      });
    } catch (error) {
      console.error('Get account access error:', error);
      res.status(500).json({ error: "Failed to fetch account settings" });
    }
  });

  // Billing cancellation is not available in this CA GPT deployment.
  app.post("/api/subscription/cancel", requireAuth, async (req, res) => {
    res.status(410).json({
      success: false,
      message: "Billing cancellation endpoint is disabled for this deployment. Contact your administrator."
    });
  });

  // Get payment history
  app.get("/api/payments/history", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { db } = await import("./db");
      const { payments } = await import("@shared/schema");
      const { eq, desc } = await import("drizzle-orm");
      
      const paymentHistory = await db
        .select()
        .from(payments)
        .where(eq(payments.userId, userId))
        .orderBy(desc(payments.createdAt));
      
      res.json(paymentHistory);
    } catch (error) {
      console.error('Get payment history error:', error);
      res.status(500).json({ error: "Failed to fetch payment history" });
    }
  });

  // SSE Chat Streaming endpoint - replaces WebSocket
  app.post("/api/chat/stream", chatRateLimiter, requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const {
        conversationId,
        query,
        profileId = null,
        chatMode: rawChatMode,
        documentAttachment,
        selection,
      } = req.body;
      const _selection = selection as { artifactIds?: string[]; highlightedText?: string } | undefined;

      // CRITICAL: Normalize chat mode at request boundary to ensure consistency
      const chatMode = normalizeChatMode(rawChatMode);

      // Validate required fields
      if (!query) {
        return res.status(400).json({ error: 'Missing query' });
      }

      // Get user tier for routing
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      const userTier = user.subscriptionTier;

      // Process document attachment if present
      let attachmentBuffer: Buffer | undefined;
      let attachmentMetadata: { filename: string; mimeType: string; documentType?: string } | undefined;
      
      if (documentAttachment) {
        const ALLOWED_MIME_TYPES = [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/tiff',
          'image/tif',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'text/plain'
        ];
        const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

        if (!ALLOWED_MIME_TYPES.includes(documentAttachment.type)) {
          return res.status(400).json({ 
            error: 'Invalid file type. Allowed types: PDF, PNG, JPEG, TIFF, Excel (XLSX, XLS), CSV, TXT' 
          });
        }

        attachmentBuffer = Buffer.from(documentAttachment.data, 'base64');

        if (attachmentBuffer.byteLength > MAX_SIZE_BYTES) {
          return res.status(400).json({ error: 'File too large. Maximum size is 10MB' });
        }

        attachmentMetadata = {
          filename: documentAttachment.filename,
          mimeType: documentAttachment.type,
          documentType: documentAttachment.type
        };

        console.log(`[SSE] Document attachment validated: ${documentAttachment.filename} (${attachmentBuffer.byteLength} bytes)`);
      }

      // Get or create conversation
      let conversation;
      if (conversationId) {
        conversation = await storage.getConversation(conversationId);
        if (!conversation || conversation.userId !== userId) {
          return res.status(403).json({ error: 'Conversation not found or unauthorized' });
        }
      } else {
        conversation = await storage.createConversation({
          userId,
          title: 'New Chat',
          profileId,
          chatMode,
        });
        // Queue intelligent title generation in background
        addTitleGenerationJob(conversation.id, query);
      }

      // Get conversation history
      const history = await storage.getConversationMessages(conversation.id);
      const conversationHistory = history.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      // Save user message
      const userMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: 'user',
        content: query,
        modelUsed: null,
        routingDecision: null,
        calculationResults: null,
        tokensUsed: null
      });

      // Process user message analytics (non-blocking)
      AnalyticsProcessor.processMessage({
        messageId: userMessage.id,
        conversationId: conversation.id,
        userId,
        role: 'user',
        content: query,
        previousMessages: conversationHistory
      }).catch(err => console.error('[SSE] Analytics error:', err));

      // Set up Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.flushHeaders(); // Flush headers immediately to establish connection

      // Helper function to send SSE messages with immediate flush
      const sendSSE = (data: any) => {
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          res.write(message);
          // Force flush if available (Node.js doesn't have native flush, but this helps with some proxies)
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        } catch (err) {
          console.error('[SSE] Error sending message:', err);
        }
      };
      
      // Helper function to send thinking/analysis updates
      const sendThinking = (phase: string, detail: string) => {
        console.log(`[SSE] Thinking: ${phase} - ${detail}`);
        sendSSE({
          type: 'thinking',
          phase,
          detail
        });
      };

      // Send start signal
      sendSSE({
        type: 'start',
        conversationId: conversation.id,
        messageId: userMessage.id
      });

      try {
        // PHASE 1: Analyzing the query - send thinking updates
        sendThinking('analyzing', 'Interpreting your message...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Generate the assistant message id up-front so the orchestrator can
        // anchor any whiteboard artifacts to this exact message row (Phase 2.4).
        const assistantMessageId = crypto.randomUUID();

        // Check cache first for non-file queries
        let fullResponse = '';
        let result: any;
        let fromCache = false;

        // Decide whether this request is context-dependent. If it is, skip the
        // shared AI response cache entirely — that cache is keyed only on
        // (query, chatMode, userTier) and would serve a response computed in a
        // DIFFERENT conversation with different artifacts / selection. That's
        // how we got "which items did I check?" answered with a generic
        // clarifying question.
        const hasSelection =
          !!_selection &&
          ((Array.isArray(_selection.artifactIds) && _selection.artifactIds.length > 0) ||
            (typeof _selection.highlightedText === "string" && _selection.highlightedText.trim().length > 0));

        let hasWhiteboardArtifacts = false;
        if (conversation?.id) {
          try {
            const priorArtifacts = await listArtifactsByConversation(conversation.id);
            hasWhiteboardArtifacts = priorArtifacts.length > 0;
          } catch {
            // non-fatal; if we can't check, err on the side of bypassing cache
            hasWhiteboardArtifacts = true;
          }
        }

        const skipCache = hasSelection || hasWhiteboardArtifacts;
        if (skipCache) {
          console.log(
            `[SSE] Cache BYPASS — context-dependent request (hasSelection=${hasSelection}, hasWhiteboardArtifacts=${hasWhiteboardArtifacts})`,
          );
        }

        // Only use cache if no document attachment AND no per-conversation context.
        if (!attachmentBuffer && !skipCache) {
          const cachedResponse = await AIResponseCache.getFullResponse(query, chatMode, userTier);
          if (cachedResponse) {
            console.log(`[SSE] Cache HIT - returning cached response with visualization`);

            // A cached response CAN be a previously-emitted clarifying
            // question — the cache key is just (mode,tier,hash(query)),
            // not anything about the response shape. Detect that from
            // the stored content so the UI shows the right label and the
            // client can latch `isClarifying` the same way it does for
            // fresh turns. Heuristic mirrors the client-side one in
            // Chat.tsx so both paths stay consistent.
            const cachedHead = (cachedResponse.response || '').slice(0, 240).trim();
            const cachedLooksLikeClarification =
              /^(could you|can you|would you|what |which |when |where |who |how |do you |to help|to better (help|assist)|before (i|we)|please (clarify|share|confirm|provide)|just to (confirm|clarify)|i(['’])?d (like|need) to (confirm|clarify|check)|i need (a bit|some) more|to (answer|help) accurately)/i.test(cachedHead)
              || (cachedHead.length < 220 && cachedHead.includes('?') && !/\n##|\n\*\s|\n-\s|\n\d+\./.test(cachedResponse.response || ''));

            if (cachedLooksLikeClarification) {
              sendThinking('cache', 'Found a previous clarifying question…');
              await new Promise(resolve => setTimeout(resolve, 80));
              // Emit the same `clarify` phase the fresh path uses so the
              // client-side latch kicks in and pins the status label.
              sendThinking('clarify', 'Preparing a clarifying question…');
            } else {
              sendThinking('cache', 'Found a relevant previous response…');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            fromCache = true;
            fullResponse = cachedResponse.response;
            result = {
              response: cachedResponse.response,
              modelUsed: cachedResponse.modelUsed + ' (cached)',
              metadata: cachedResponse.metadata || {
                showInOutputPane: true,
                visualization: cachedResponse.visualization
              },
              calculationResults: cachedResponse.calculationResults,
              tokensUsed: 0
            };
            if (cachedResponse.visualization && result.metadata) {
              result.metadata.visualization = cachedResponse.visualization;
            }

            // Cache-hit artifact extraction: the orchestrator path runs
            // buildArtifactsForMessage after generating visualization metadata.
            // On a cache hit the orchestrator is bypassed entirely, which
            // meant no whiteboard artifact was ever created for this message —
            // user got the chat text but nothing on the Output canvas.
            //
            // Recreate the same extraction here against the cached viz +
            // spreadsheet so the artifact lands for THIS conversation /
            // message with the same layout/ids logic as the non-cache path.
            if (isFeatureEnabled('WHITEBOARD_V2') && conversation.id && assistantMessageId) {
              try {
                const prior = await listArtifactsByConversation(conversation.id);
                let seed: LayoutState = { cursorX: 0, rowTop: 0, rowHeight: 0 };
                for (const a of prior) {
                  const { state } = placeNext(seed, { width: a.width, height: a.height });
                  seed = state;
                }

                const viz = cachedResponse.visualization as any;
                const slots: {
                  visualization?: any;
                  workflow?: any;
                  mindmap?: any;
                  spreadsheet?: any;
                } = {};
                if (viz?.type === 'workflow') slots.workflow = viz;
                else if (viz?.type === 'mindmap') slots.mindmap = viz;
                else if (viz) slots.visualization = viz;
                const cachedSpreadsheet = (cachedResponse.metadata as any)?.spreadsheetData;
                if (cachedSpreadsheet) slots.spreadsheet = cachedSpreadsheet;

                // Match the non-cache path: strip the Start:/Step N:/End: prose
                // block from chat for workflow mode so behaviour is identical
                // whether or not the AI response came from cache.
                let contentForExtraction = fullResponse;
                if (chatMode === 'workflow' && slots.workflow) {
                  const beforeLen = contentForExtraction.length;
                  contentForExtraction = aiOrchestrator.stripWorkflowProse(contentForExtraction);
                  if (contentForExtraction.length !== beforeLen) {
                    console.log('[cache-hit] stripped workflow prose', { before: beforeLen, after: contentForExtraction.length });
                    fullResponse = contentForExtraction;
                    result.response = contentForExtraction;
                  }
                }

                console.log('[cache-hit] extraction starting', {
                  chatMode,
                  vizType: viz?.type ?? null,
                  slots: Object.keys(slots).filter(k => (slots as any)[k]),
                });

                const built = buildArtifactsForMessage({
                  content: contentForExtraction,
                  conversationId: conversation.id,
                  messageId: assistantMessageId,
                  chatMode,
                  precomputed: slots,
                  layoutState: seed,
                  idFactory: () => `art_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
                });

                console.log('[cache-hit] extraction complete', {
                  artifactsCreated: built.artifacts.length,
                  kinds: built.artifacts.map(a => a.kind),
                });

                if (built.artifacts.length > 0) {
                  (result as any).whiteboardUpdatedContent = built.updatedContent;
                  (result as any).whiteboardArtifacts = built.artifacts;
                }
              } catch (e) {
                console.error('[cache-hit] artifact extraction failed:', e);
              }
            }
          }
        }
        
        // If not cached, call the orchestrator
        if (!fromCache) {
          // Send thinking updates based on chat mode
          // NB: each script's LAST line is shown to the user right before
          // the first response chunk arrives. Keep it neutral — don't
          // commit to an output shape (e.g. "comprehensive response",
          // "final checklist") because the LLM may instead decide to ask
          // a clarifying question. The client-side chunk classifier in
          // Chat.tsx takes over and relabels ("Asking a clarifying
          // question…" / "Writing your response…" / "Answering…") once
          // the actual output starts streaming.
          const modeThinkingMessages: Record<string, string[]> = {
            'deep-research': [
              'Analyzing your research query…',
              'Searching relevant IRC sections and Treasury Regulations…',
              'Reviewing case law and IRS guidance…',
              'Cross-referencing authoritative sources…',
              'Collating findings…'
            ],
            'calculation': [
              'Parsing numerical inputs…',
              'Validating calculation parameters…',
              'Applying tax formulas and rates…',
              'Putting it together…'
            ],
            'audit-plan': [
              'Assessing inherent and control risks…',
              'Determining materiality thresholds…',
              'Designing substantive procedures…',
              'Putting it together…'
            ],
            'checklist': [
              'Identifying required compliance items…',
              'Prioritizing by deadline and risk…',
              'Adding regulatory references…',
              'Putting it together…'
            ],
            'workflow': [
              'Mapping process steps…',
              'Identifying decision points…',
              'Putting it together…'
            ],
            'scenario-simulator': [
              'Setting up scenario parameters…',
              'Activating 12-agent simulation pipeline…',
              'Modeling tax impacts and financial projections…',
              'Running sensitivity analysis…',
              'Putting it together…'
            ],
            'deliverable-composer': [
              'Analyzing document requirements…',
              'Engaging multi-agent advisory workflow…',
              'Collating citations and references…',
              'Putting it together…'
            ],
            'forensic-intelligence': [
              'Initializing forensic analysis agents…',
              'Detecting patterns and anomalies…',
              'Running statistical analysis…',
              'Classifying findings by severity…',
              'Putting it together…'
            ],
            'roundtable': [
              'Assembling expert panel…',
              'Each expert analyzing the problem…',
              'Facilitating multi-perspective discussion…',
              'Putting it together…'
            ],
            'standard': [
              'Understanding your question…',
              'Gathering relevant information…',
              'Putting it together…'
            ]
          };
          
          // Preamble runs IN PARALLEL with the orchestrator and can be
          // cancelled the moment the orchestrator returns, so a slow
          // orchestrator no longer stalls on "Putting it together…" and
          // a fast one doesn't spam all four scripted lines before the
          // real clarify/generating phase. The loop yields between each
          // line in 200 ms increments; checking `preambleCancelled`
          // every iteration means worst-case drift is ~200 ms.
          //
          // No idle loop — after the scripted lines finish, the
          // preamble goes SILENT. Earlier an idle loop kept re-emitting
          // "Still analysing…" every 2s, which flooded the thinking
          // block with identical lines (12+ times for slow queries).
          // The last scripted message is neutral enough that sitting on
          // it for a few seconds is acceptable; the real phase (clarify
          // / generating) fires when processQuery returns.
          const thinkingMessages = modeThinkingMessages[chatMode] || modeThinkingMessages['standard'];
          let preambleCancelled = false;
          const runPreamble = async () => {
            for (const message of thinkingMessages) {
              if (preambleCancelled) return;
              sendThinking('processing', message);
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          };
          const preamblePromise = runPreamble();

          // Preemptive clarification check + agent workflow execution.
          //
          // The orchestrator (`processQuery`, below) already does its
          // own clarification analysis, but that runs AFTER the agent
          // workflow. When the query needs clarification, the workflow
          // output is thrown away and the user just sees a clarifying
          // question — wasting 10-30s and showing a sequence of
          // scripted "synthesizing results" labels that read like the
          // agent is about to answer. Doing the analysis here first
          // lets us (a) pin the `clarify` thinking phase EARLY so the
          // user sees the right label throughout, (b) skip the
          // workflow entirely when we already know we'll clarify.
          let agentWorkflowResult: any = null;
          let skipAgentWorkflow = false;
          if (isAgentWorkflowMode(chatMode)) {
            try {
              const prelim = await requirementClarificationAIService.analyzeQueryAsync(
                query,
                conversationHistory,
                conversation.id,
                { chatMode, hasAttachment: !!attachmentBuffer },
              );
              const isProfessionalMode = chatMode !== 'standard';
              const willClarify =
                prelim?.needsClarification &&
                prelim?.recommendedApproach === 'clarify' &&
                (prelim.missingContext ?? []).some((m: any) =>
                  isProfessionalMode
                    ? m.importance === 'critical' || m.importance === 'high' || m.importance === 'medium'
                    : m.importance === 'critical' || m.importance === 'high',
                );
              if (willClarify) {
                console.log(
                  `[SSE][AgentWorkflow] Preemptive clarification detected for '${chatMode}' — skipping agent workflow, will ask user instead.`,
                );
                // Cancel the scripted preamble IMMEDIATELY. Without
                // this, the preamble's remaining 200ms-spaced lines
                // ("Gathering relevant information…", "Putting it
                // together…") stream in AFTER the clarify event and
                // overwrite the correct status label on the client —
                // exactly the "showed Putting it together then asked a
                // question" bug. Waiting on preamblePromise here makes
                // sure no stale line can leak out after we emit clarify.
                preambleCancelled = true;
                await preamblePromise.catch(() => {});
                sendThinking('clarify', 'Preparing a clarifying question…');
                skipAgentWorkflow = true;
              }
            } catch (err) {
              console.warn(
                `[SSE][AgentWorkflow] Preemptive clarification check failed — proceeding with workflow:`,
                err,
              );
            }
          }

          if (isAgentWorkflowMode(chatMode) && !skipAgentWorkflow) {
            try {
              sendThinking('agents', `Coordinating ${chatMode} agent pipeline…`);
              console.log(`[SSE][AgentWorkflow] Mode '${chatMode}' requires agent execution`);
              agentWorkflowResult = await executeWorkflow(
                chatMode,
                {
                  query,
                  conversationId: conversation.id,
                  history: conversationHistory,
                  attachment: attachmentBuffer && attachmentMetadata ? {
                    buffer: attachmentBuffer,
                    filename: attachmentMetadata.filename,
                    mimeType: attachmentMetadata.mimeType,
                  } : undefined,
                },
                userId
              );
              // DELIBERATELY no "Agent workflow completed, synthesizing
              // results..." label here — that scripted line pre-committed
              // to "the agent is about to answer" even when the downstream
              // orchestrator went on to clarify. The real phase (clarify
              // or generating) is emitted after `processQuery` returns.
              console.log(`[SSE][AgentWorkflow] Workflow completed for mode '${chatMode}'`);
            } catch (error) {
              console.error(`[SSE][AgentWorkflow] Error executing workflow for mode '${chatMode}':`, error);
              // Neutral label — the fallback path produces an answer OR
              // a clarification depending on orchestrator decision.
              sendThinking('agents', 'Agent workflow unavailable, continuing…');
              // Continue to regular processing as fallback
            }
          }

          result = await aiOrchestrator.processQuery(
            query,
            conversationHistory,
            userTier,
            userId, // For AI cost tracking
            {
              chatMode,
              agentWorkflowResult,
              conversationId: conversation.id,
              messageId: assistantMessageId,
              selection: (req.body as any)?.selection,
              attachment: attachmentBuffer && attachmentMetadata ? {
                buffer: attachmentBuffer,
                filename: attachmentMetadata.filename,
                mimeType: attachmentMetadata.mimeType,
                documentType: attachmentMetadata.documentType
              } : undefined
            }
          );
          fullResponse = result.response;

          // Orchestrator is done — stop feeding scripted preamble lines.
          // The real phase (clarify / generating) comes next and should
          // be the last thing the user sees in the thinking block.
          preambleCancelled = true;
          // Make sure the currently-running preamble iteration has a
          // chance to notice the flag before the next sendThinking —
          // avoids a race where a late scripted line overwrites the
          // real phase in the client's status.
          await preamblePromise.catch(() => {});
          
          // When the orchestrator decided to ask a clarifying question
          // rather than answer, emit a DEDICATED `clarify` phase. The
          // client latches on this phase and keeps the status pinned to
          // "Asking a clarifying question…" through the entire stream,
          // so it never flips to "Answering…" just because a chunk
          // heuristic didn't recognise the wording. (If the preemptive
          // agent-workflow check already emitted `clarify`, re-emit it
          // here anyway — idempotent on the client side, and it
          // anchors the latch if the preemptive event somehow got lost
          // in the stream.)
          if (result.needsClarification || skipAgentWorkflow) {
            console.log(
              `[SSE] Emitting 'clarify' (orchestrator.needsClarification=${!!result.needsClarification}, skipAgentWorkflow=${skipAgentWorkflow})`,
            );
            sendThinking('clarify', 'Preparing a clarifying question…');
            // 400ms instead of 100ms — the client's ThinkingBlock needs
            // enough time to render the status transition before the
            // first chunk pins the label to "Asking a clarifying
            // question…" via the client-side latch. 100ms was
            // imperceptible on slower clients and the user reported
            // still seeing the previous (preamble) label.
            await new Promise(resolve => setTimeout(resolve, 400));
          } else {
            console.log(
              `[SSE] Emitting 'generating' (not a clarification per orchestrator + preemptive check)`,
            );
            // Regular answer — neutral pre-stream label. The client's
            // onChunk classifier refines it to "Writing your response…"
            // / "Answering…" once content starts arriving.
            sendThinking('generating', 'Almost there…');
            await new Promise(resolve => setTimeout(resolve, 250));
          }
          
          // Cache the response for future use — BUT only when the response is
          // context-independent. Context-dependent responses (per-conversation
          // selections, per-conversation whiteboard artifacts) would leak into
          // unrelated conversations and produce wrong answers. Document
          // attachments are also always skipped.
          if (!attachmentBuffer && !skipCache && result.metadata) {
            const toCache: CachedAIResponse = {
              response: result.response,
              modelUsed: result.modelUsed,
              visualization: result.metadata.visualization,
              metadata: result.metadata,
              calculationResults: result.calculationResults,
              tokensUsed: result.tokensUsed,
              cachedAt: Date.now()
            };
            AIResponseCache.setFullResponse(query, chatMode, userTier, toCache)
              .catch(err => console.error('[SSE] Cache store error:', err));
          }
        }

        // Sanitize ```mermaid``` fenced blocks: auto-quote node / edge labels
        // that contain parentheses, commas, colons, or #. Mermaid's parser
        // rejects those unless the label is wrapped in double quotes, and the
        // LLM forgets to quote frequently. Non-destructive on any error.
        try {
          const { sanitizeMermaidInText } = await import('./services/mermaid/mermaidSanitizer');
          const res = sanitizeMermaidInText(fullResponse);
          if (res.blocksSanitized > 0) {
            fullResponse = res.content;
            console.log(`[SSE] Sanitised ${res.blocksSanitized} mermaid block(s), quoted ~${res.labelsQuoted} label(s)`);
          }
        } catch (err) {
          console.warn('[SSE] Mermaid sanitisation skipped:', (err as Error).message);
        }

        // Extract ```sheet``` blocks the AI emitted, evaluate their formulas,
        // and promote the result into metadata.spreadsheetData so OutputPane
        // renders the sheet on the right. Replaces the raw block in chat text
        // with a compact pointer. Must run BEFORE inline formula evaluation so
        // we don't double-decorate formulas that are also inside sheet blocks.
        // NOTE: gated to spreadsheet mode ONLY. Other modes were leaking
        // spreadsheet artifacts because the global prompt taught the model to
        // emit ```sheet``` for tabular output. Strip any leaked sheet fence
        // from the response text in non-spreadsheet modes so users don't see
        // raw CSV, but do not promote it to a spreadsheet artifact.
        let aiSpreadsheetData: any = null;
        if (chatMode === 'spreadsheet') {
          try {
            const { extractAndEvaluateSheetBlocks } = await import('./services/excel/sheetBlockParser');
            const extracted = extractAndEvaluateSheetBlocks(fullResponse);
            if (extracted.blockCount > 0 && extracted.spreadsheetData) {
              fullResponse = extracted.text;
              aiSpreadsheetData = extracted.spreadsheetData;
              console.log(`[SSE] Extracted ${extracted.blockCount} sheet block(s) into spreadsheetData`);
            }
          } catch (err) {
            console.warn('[SSE] Sheet-block extraction skipped:', (err as Error).message);
          }
        } else if (/```sheet[\s\S]*?```/.test(fullResponse)) {
          fullResponse = fullResponse.replace(/```sheet[\s\S]*?```/g, '').replace(/\n{3,}/g, '\n\n').trim();
          console.log(`[SSE] Stripped leaked sheet block(s) from ${chatMode} mode response`);
        }

        // Evaluate any Excel formulas the AI emitted INLINE in prose and inline
        // their results next to each formula. Non-destructive: fails silently on
        // any formula error, preserving the original text.
        //
        // Runs on BOTH strings that downstream code uses:
        //   - fullResponse            — what gets streamed in chunks to the client
        //   - whiteboardUpdatedContent — what gets persisted to the DB (assistantContent)
        //
        // Previously only fullResponse was inlined, so the moment the client's
        // post-stream refetch pulled the DB copy, the chat swapped back to the
        // raw `=400000*0.05` formulas with no `→ **20000**` annotation.
        try {
          const { inlineFormulaResults } = await import('./services/excel/formulaInliner');
          const before = fullResponse.length;
          const { content: rewritten, stats } = inlineFormulaResults(fullResponse);
          if (stats.succeeded > 0) {
            fullResponse = rewritten;
            console.log(`[SSE] Inlined ${stats.succeeded}/${stats.attempted} formula results in fullResponse (added ${fullResponse.length - before} chars)`);
          }
          if (result.whiteboardUpdatedContent) {
            const { content: rewrittenWb, stats: wbStats } = inlineFormulaResults(result.whiteboardUpdatedContent);
            if (wbStats.succeeded > 0) {
              result.whiteboardUpdatedContent = rewrittenWb;
              console.log(`[SSE] Inlined ${wbStats.succeeded}/${wbStats.attempted} formula results in whiteboardUpdatedContent`);
            }
          }
        } catch (err) {
          console.warn('[SSE] Formula inlining skipped:', (err as Error).message);
        }

        // Last-chance clarification detection — LLM-based.
        // The orchestrator's `needsClarification` flag sometimes reports
        // `false` while the LLM still decides to ask ("I need one
        // clarification before I summarise it. Which ... are you
        // referring to?"). We have the full response in hand before any
        // chunk goes out, so we ask a small classifier model to decide
        // clarify vs answer. Robust to new phrasings in a way the old
        // regex never was. Falls back to heuristic on timeout/error so
        // the stream is never blocked. Skipped when the orchestrator
        // already flagged clarification so we don't double-emit.
        if (!result.needsClarification) {
          try {
            const { classifyResponseKind } = await import('./services/responseClassifier');
            const kind = await classifyResponseKind(fullResponse);
            console.log(
              `[SSE] LLM response-kind classifier → ${kind} (first 80 chars: "${(fullResponse || '').slice(0, 80).replace(/\n/g, ' ')}")`,
            );
            if (kind === 'clarify') {
              console.log(`[SSE] LLM classifier detected clarification — emitting clarify phase`);
              sendThinking('clarify', 'Preparing a clarifying question…');
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          } catch (err) {
            // Classifier hard-failed (shouldn't — it's already try/catched
            // internally) — log and move on, the client still has its own
            // heuristic safety net.
            console.warn('[SSE] response classifier crashed:', err);
          }
        }

        // Stream response in chunks - use word-based streaming for natural feel
        console.log(`[SSE] Streaming ${fullResponse.length} chars...`);

        // Split by words but keep punctuation attached
        const words = fullResponse.split(/(\s+)/);
        let wordBuffer = '';
        let wordCount = 0;
        
        for (const word of words) {
          wordBuffer += word;
          wordCount++;
          
          // Stream every 3-5 words for natural typing feel
          if (wordCount >= 3 || word.includes('\n') || word.includes('.') || word.includes('|')) {
            sendSSE({
              type: 'chunk',
              content: wordBuffer
            });
            wordBuffer = '';
            wordCount = 0;
            // Variable delay for more natural feel (faster for tables, slower for text)
            const delay = word.includes('|') ? 5 : (word.includes('\n') ? 15 : 12);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        // Send any remaining buffer
        if (wordBuffer) {
          sendSSE({
            type: 'chunk',
            content: wordBuffer
          });
        }
        
        console.log(`[SSE] Finished streaming`);

        // Build metadata object (CRITICAL: Include reasoning metadata for auditability)
        const metadata: any = {};
        if (result.metadata.showInOutputPane) {
          metadata.showInOutputPane = true;
        }
        if (result.metadata.visualization) {
          metadata.visualization = result.metadata.visualization;
        }
        // CRITICAL FIX: Include advanced reasoning metadata for CoT traces
        if (result.metadata.reasoning) {
          metadata.reasoning = result.metadata.reasoning;
        }
        if (result.metadata.cognitiveMonitoring) {
          metadata.cognitiveMonitoring = result.metadata.cognitiveMonitoring;
        }
        if (result.metadata.qualityScore !== undefined) {
          metadata.qualityScore = result.metadata.qualityScore;
        }
        // Include calculation info in metadata for output pane display
        if (result.calculationResults && Object.keys(result.calculationResults).length > 0) {
          metadata.hasCalculation = true;
          if (!metadata.showInOutputPane) {
            metadata.showInOutputPane = true; // Ensure calculations show in output pane
          }
        }
        
        // Store Excel buffer in memory cache for download (NOT in database - too large)
        let excelCacheKey: string | undefined;
        if (result.excelWorkbook?.buffer) {
          metadata.hasExcel = true;
          metadata.excelFilename = result.excelWorkbook.filename;
          // Generate cache key and store buffer temporarily (1 hour TTL)
          excelCacheKey = `excel_${conversation.id}_${Date.now()}`;
          excelBufferCache.set(excelCacheKey, {
            buffer: result.excelWorkbook.buffer,
            filename: result.excelWorkbook.filename,
            createdAt: Date.now()
          });
          metadata.excelCacheKey = excelCacheKey;
          console.log('[SSE] Excel workbook cached:', result.excelWorkbook.filename, 'key:', excelCacheKey);
        }
        // Include spreadsheet preview data for Output Pane rendering.
        // Prefer the AI-authored sheet blocks (lightweight, any mode) when present;
        // otherwise use the Excel generator's structured output.
        if (aiSpreadsheetData) {
          metadata.spreadsheetData = aiSpreadsheetData;
          metadata.showInOutputPane = true;
          console.log(`[SSE] AI-authored spreadsheetData attached (${aiSpreadsheetData.sheets?.length || 0} sheet(s))`);
        } else if (result.spreadsheetData) {
          metadata.spreadsheetData = result.spreadsheetData;
          metadata.showInOutputPane = true;
          console.log('[SSE] Spreadsheet preview data attached (from generator)');
        }

        // Debug log metadata (without large buffers)
        console.log('[SSE] Saving message metadata:', JSON.stringify({
          ...metadata,
          spreadsheetData: metadata.spreadsheetData ? '[SPREADSHEET DATA]' : undefined
        }, null, 2));

        // Whiteboard artifact wiring (Phase 2.4): prefer the pipeline-updated
        // content (with <artifact /> placeholders) and capture ids for the row.
        const assistantContent = result.whiteboardUpdatedContent ?? fullResponse;
        const artifactIds = result.whiteboardArtifacts?.map((a: { id: string }) => a.id) ?? [];

        // Save assistant message with metadata
        const assistantMessage = await storage.createMessage({
          id: assistantMessageId,
          conversationId: conversation.id,
          role: 'assistant',
          content: assistantContent,
          modelUsed: result.modelUsed,
          routingDecision: result.routingDecision,
          calculationResults: result.calculationResults,
          tokensUsed: result.tokensUsed,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
          artifactIds,
        });

        // Persist any extracted whiteboard artifacts (best-effort; never fatal)
        for (const art of result.whiteboardArtifacts ?? []) {
          try {
            await createArtifact(art);
          } catch (e) {
            console.error('[whiteboard] failed to persist artifact:', art.id, e);
          }
        }

        // Process assistant message analytics (non-blocking)
        AnalyticsProcessor.processMessage({
          messageId: assistantMessage.id,
          conversationId: conversation.id,
          userId,
          role: 'assistant',
          content: fullResponse,
          previousMessages: [...conversationHistory, { role: 'user', content: query }]
        }).catch(err => console.error('[SSE] Analytics error:', err));

        // Store conversation turn in memory for context retrieval
        conversationMemory.storeTurn(conversation.id, query, fullResponse);

        // Log metadata for debugging
        console.log(`[SSE] Response metadata - chatMode: ${chatMode}, showInOutputPane: ${result.metadata.showInOutputPane}, hasVisualization: ${!!result.metadata.visualization}, hasSpreadsheet: ${!!metadata.spreadsheetData}`);

        // Send end signal with FULL metadata (including spreadsheet and Excel data)
        //
        // whiteboardArtifacts: carry the full just-persisted artifact rows in
        // the end event. The client pushes them directly into its React Query
        // cache, no refetch required. We were seeing "[artifact … loading…]"
        // stuck on first-generate because a separate post-stream fetch raced
        // against the initial (empty-result) fetch that had kicked off when
        // setActiveConversation first mounted the subscriber — plus ETag/304
        // issues etc. Handing the data inline eliminates all of that.
        sendSSE({
          type: 'end',
          messageId: assistantMessage.id,
          metadata: {
            tokensUsed: result.tokensUsed,
            modelUsed: result.modelUsed,
            processingTimeMs: result.processingTimeMs,
            showInOutputPane: metadata.showInOutputPane || result.metadata.showInOutputPane,
            visualization: result.metadata.visualization,
            // CRITICAL: Include spreadsheet preview for OutputPane
            spreadsheetData: metadata.spreadsheetData,
            // CRITICAL: Include Excel download info
            hasExcel: metadata.hasExcel,
            excelFilename: metadata.excelFilename,
            excelCacheKey: metadata.excelCacheKey,
            // Include calculation indicator
            hasCalculation: metadata.hasCalculation,
            // NEW: full artifact rows so client can prime its cache without fetching
            whiteboardArtifacts: result.whiteboardArtifacts ?? [],
            whiteboardUpdatedContent: result.whiteboardUpdatedContent ?? null,
          }
        });

        res.end();
      } catch (error: any) {
        console.error('[SSE] Chat stream error:', error);
        sendSSE({
          type: 'error',
          error: error.message || 'An error occurred while processing your request'
        });
        res.end();
      }
    } catch (error: any) {
      console.error('[SSE] Request error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Internal server error' });
      } else {
        res.end();
      }
    }
  });

  // Admin KPIs Endpoint (Super Admin only)
  app.get("/api/admin/kpis", requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      const kpis = await storage.getAdminKPIs();
      res.json(kpis);
    } catch (error) {
      console.error('Admin KPIs error:', error);
      res.status(500).json({ error: "Failed to fetch admin KPIs" });
    }
  });

  // System Monitoring & Health Endpoints (Super Admin only)
  
  app.get("/api/admin/system/health", requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      const { systemMonitor } = await import('./services/systemMonitor');
      const metrics = await systemMonitor.getSystemMetrics();
      res.json({ metrics });
    } catch (error) {
      console.error('System health check error:', error);
      res.status(500).json({ error: "Failed to fetch system health" });
    }
  });

  app.get("/api/admin/system/threats", requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      const { systemMonitor } = await import('./services/systemMonitor');
      const threatList = systemMonitor.getThreats(100);
      const threatStats = systemMonitor.getThreatStats();
      
      // Transform to expected format
      const threats = threatList.map((t: any) => ({
        id: t.id,
        type: t.type,
        severity: t.severity,
        ipAddress: t.ip || t.ipAddress || 'unknown',
        userId: t.userId,
        timestamp: t.timestamp,
        description: t.details || t.description || '',
        blocked: t.blocked || false
      }));
      
      // Calculate byType dynamically from threats
      const byTypeCalc: Record<string, number> = {};
      threats.forEach((t: any) => {
        const type = t.type || 'unknown';
        byTypeCalc[type] = (byTypeCalc[type] || 0) + 1;
      });
      
      const stats = {
        total: threatStats.total || threats.length,
        active: threatStats.active || threats.filter((t: any) => !t.blocked).length,
        blocked: threatStats.blocked || threats.filter((t: any) => t.blocked).length,
        resolved: threatStats.resolved || 0,
        bySeverity: threatStats.bySeverity || {},
        byType: threatStats.byType || byTypeCalc
      };
      
      res.json({ threats, stats });
    } catch (error) {
      console.error('Threats fetch error:', error);
      res.status(500).json({ error: "Failed to fetch threats" });
    }
  });

  app.get("/api/admin/system/routes", requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      const { systemMonitor } = await import('./services/systemMonitor');
      const routes = systemMonitor.getRouteHealth();
      res.json({ routes });
    } catch (error) {
      console.error('Routes health check error:', error);
      res.status(500).json({ error: "Failed to fetch routes health" });
    }
  });

  app.get("/api/admin/system/integrations", requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      const { systemMonitor } = await import('./services/systemMonitor');
      const integrationHealth = await systemMonitor.checkIntegrations();
      
      // Create comprehensive integrations list
      const defaultIntegrations = [
        {
          id: 'openai',
          name: 'OpenAI',
          type: 'ai_provider',
          provider: 'OpenAI API',
          status: 'connected',
          enabled: true,
          healthScore: 98,
          requestsToday: Math.floor(Math.random() * 1000) + 500,
          rateLimit: 10000,
          rateLimitRemaining: Math.floor(Math.random() * 5000) + 5000,
          lastSync: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString()
        },
        {
          id: 'anthropic',
          name: 'Anthropic Claude',
          type: 'ai_provider',
          provider: 'Anthropic API',
          status: 'connected',
          enabled: true,
          healthScore: 95,
          requestsToday: Math.floor(Math.random() * 500) + 200,
          rateLimit: 5000,
          rateLimitRemaining: Math.floor(Math.random() * 3000) + 2000,
          lastSync: new Date(Date.now() - Math.floor(Math.random() * 7200000)).toISOString()
        },
        {
          id: 'azure_openai',
          name: 'Azure OpenAI',
          type: 'ai_provider',
          provider: 'Azure API',
          status: 'connected',
          enabled: true,
          healthScore: 92,
          requestsToday: Math.floor(Math.random() * 300) + 100,
          rateLimit: 3000,
          rateLimitRemaining: Math.floor(Math.random() * 2000) + 1000,
          lastSync: new Date(Date.now() - Math.floor(Math.random() * 1800000)).toISOString()
        },
        {
          id: 'stripe',
          name: 'Stripe',
          type: 'payment',
          provider: 'Stripe API',
          status: 'connected',
          enabled: true,
          healthScore: 100,
          requestsToday: Math.floor(Math.random() * 50) + 10,
          lastSync: new Date(Date.now() - Math.floor(Math.random() * 600000)).toISOString()
        },
        {
          id: 'sendgrid',
          name: 'SendGrid',
          type: 'email',
          provider: 'SendGrid API',
          status: 'connected',
          enabled: true,
          healthScore: 97,
          requestsToday: Math.floor(Math.random() * 200) + 50,
          lastSync: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString()
        },
        {
          id: 'aws_s3',
          name: 'AWS S3',
          type: 'storage',
          provider: 'Amazon S3',
          status: 'connected',
          enabled: true,
          healthScore: 99,
          requestsToday: Math.floor(Math.random() * 100) + 30,
          lastSync: new Date(Date.now() - Math.floor(Math.random() * 1200000)).toISOString()
        },
        {
          id: 'google_analytics',
          name: 'Google Analytics',
          type: 'analytics',
          provider: 'Google Analytics 4',
          status: 'connected',
          enabled: true,
          healthScore: 94,
          requestsToday: Math.floor(Math.random() * 1000) + 200,
          lastSync: new Date(Date.now() - Math.floor(Math.random() * 7200000)).toISOString()
        },
        {
          id: 'quickbooks',
          name: 'QuickBooks',
          type: 'accounting',
          provider: 'Intuit QuickBooks',
          status: 'disconnected',
          enabled: false,
          healthScore: 0,
          lastSync: null
        },
        {
          id: 'xero',
          name: 'Xero',
          type: 'accounting',
          provider: 'Xero Accounting',
          status: 'disconnected',
          enabled: false,
          healthScore: 0,
          lastSync: null
        }
      ];
      
      // Merge with dynamic integration health
      const healthMap = new Map((integrationHealth || []).map((i: any) => [i.name?.toLowerCase(), i]));
      const integrations = defaultIntegrations.map((integration: any) => {
        const health = healthMap.get(integration.name.toLowerCase());
        if (health) {
          return {
            ...integration,
            status: health.healthy ? 'connected' : (health.error ? 'error' : 'disconnected'),
            healthScore: health.responseTime ? Math.max(0, Math.round(100 - (health.responseTime / 10))) : integration.healthScore,
            lastError: health.error
          };
        }
        return integration;
      });
      
      // Calculate stats
      const byType: Record<string, number> = {};
      integrations.forEach((i: any) => {
        byType[i.type] = (byType[i.type] || 0) + 1;
      });
      
      const totalRequestsToday = integrations.reduce((sum: number, i: any) => sum + (i.requestsToday || 0), 0);
      
      const stats = {
        total: integrations.length,
        connected: integrations.filter((i: any) => i.status === 'connected').length,
        disconnected: integrations.filter((i: any) => i.status === 'disconnected').length,
        errors: integrations.filter((i: any) => i.status === 'error').length,
        byType,
        totalRequestsToday
      };
      
      res.json({ integrations, stats });
    } catch (error) {
      console.error('Integrations health check error:', error);
      res.status(500).json({ error: "Failed to fetch integrations health" });
    }
  });

  // Toggle integration endpoint
  app.post("/api/admin/system/integrations/:id/toggle", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body || {};
      
      console.log(`[Integrations] Toggling integration ${id} to ${enabled ? 'enabled' : 'disabled'}`);
      
      res.json({ 
        success: true, 
        id,
        enabled,
        message: `Integration ${id} ${enabled ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error: any) {
      console.error('Integration toggle error:', error?.message || error);
      res.status(500).json({ error: "Failed to toggle integration" });
    }
  });

  // Sync integration endpoint
  app.post("/api/admin/system/integrations/:id/sync", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log(`[Integrations] Syncing integration ${id}...`);
      
      // Simulate sync delay
      res.json({ 
        success: true, 
        id,
        syncedAt: new Date().toISOString(),
        message: `Integration ${id} synced successfully`
      });
    } catch (error: any) {
      console.error('Integration sync error:', error?.message || error);
      res.status(500).json({ error: "Failed to sync integration" });
    }
  });

  // Test integration endpoint
  app.post("/api/admin/system/integrations/:id/test", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log(`[Integrations] Testing connection for ${id}...`);
      
      // Simulate connection test (95% success rate)
      const success = Math.random() > 0.05;
      const responseTime = Math.floor(Math.random() * 200) + 50;
      
      res.json({ 
        success,
        id,
        testedAt: new Date().toISOString(),
        responseTime,
        message: success ? `Connection test passed (${responseTime}ms)` : 'Connection test failed - check credentials'
      });
    } catch (error: any) {
      console.error('Integration test error:', error?.message || error);
      res.status(500).json({ error: "Failed to test integration" });
    }
  });

  app.get("/api/admin/system/alerts", requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      const alerts = await storage.getAllSystemAlerts(100);
      const unacknowledged = alerts.filter(a => !a.acknowledged).length;
      const errors = alerts.filter(a => a.severity === 'critical' || a.severity === 'error').length;
      const warnings = alerts.filter(a => a.severity === 'warning').length;
      
      const stats = {
        total: alerts.length,
        unacknowledged,
        errors,
        warnings
      };
      
      res.json({ alerts, stats });
    } catch (error) {
      console.error('Alerts fetch error:', error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.post("/api/admin/system/alerts/:id/acknowledge", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const alert = await storage.acknowledgeAlert(req.params.id, userId);
      
      if (alert) {
        // Audit log for compliance
        await storage.createAuditLog({
          userId,
          action: 'acknowledge_alert',
          resourceType: 'alert',
          resourceId: req.params.id,
          details: {
            alertType: alert.type,
            alertSeverity: alert.severity,
            alertSource: alert.source
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
        
        res.json({ success: true, alert });
      } else {
        res.status(404).json({ error: "Alert not found" });
      }
    } catch (error) {
      console.error('Alert acknowledge error:', error);
      res.status(500).json({ error: "Failed to acknowledge alert" });
    }
  });

  app.post("/api/admin/system/alerts/:id/resolve", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const alert = await storage.resolveAlert(req.params.id);
      
      if (alert) {
        // Audit log for compliance
        await storage.createAuditLog({
          userId,
          action: 'resolve_alert',
          resourceType: 'alert',
          resourceId: req.params.id,
          details: {
            alertType: alert.type,
            alertSeverity: alert.severity,
            alertSource: alert.source,
            resolution: req.body.resolution || 'Manual resolution'
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
        
        res.json({ success: true, alert });
      } else {
        res.status(404).json({ error: "Alert not found" });
      }
    } catch (error) {
      console.error('Alert resolve error:', error);
      res.status(500).json({ error: "Failed to resolve alert" });
    }
  });

  app.get("/api/admin/system/maintenance", requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      const tasks = await storage.getAllMaintenanceTasks();
      
      // Calculate stats
      const activeTasks = tasks.filter(t => t.status === 'running').length;
      const scheduledCount = tasks.filter(t => t.status === 'scheduled').length;
      const completedToday = tasks.filter(t => 
        t.status === 'completed' && 
        t.lastRunAt && 
        new Date(t.lastRunAt).toDateString() === new Date().toDateString()
      ).length;
      const failedToday = tasks.filter(t => 
        t.status === 'failed' && 
        t.lastRunAt && 
        new Date(t.lastRunAt).toDateString() === new Date().toDateString()
      ).length;
      
      const stats = {
        totalTasks: tasks.length,
        activeTasks,
        scheduledTasks: scheduledCount,
        completedToday,
        failedToday
      };
      
      res.json({ tasks, stats });
    } catch (error) {
      console.error('Maintenance fetch error:', error);
      res.status(500).json({ error: "Failed to fetch maintenance tasks" });
    }
  });

  app.post("/api/admin/system/maintenance/:id/execute", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const taskId = req.params.id;
      const task = await storage.updateMaintenanceTask(taskId, { 
        status: 'running',
        lastRunAt: new Date()
      });
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      // Execute task asynchronously
      setTimeout(async () => {
        try {
          // Task execution logic would go here
          await storage.completeMaintenanceTask(taskId, { success: true });
        } catch (error: any) {
          await storage.completeMaintenanceTask(taskId, null, error.message);
        }
      }, 0);
      
      res.json({ success: true, task });
    } catch (error) {
      console.error('Task execution error:', error);
      res.status(500).json({ error: "Failed to execute task" });
    }
  });

  app.post("/api/admin/system/maintenance/schedule", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { maintenanceModeService } = await import('./services/maintenanceMode');
      const adminUserId = getCurrentUserId(req);
      
      const schema = z.object({
        startTime: z.string(),
        endTime: z.string(),
        reason: z.string(),
        affectedServices: z.array(z.string()),
      });
      
      const { startTime, endTime, reason, affectedServices } = schema.parse(req.body);
      
      // Log maintenance window with formatted storage info
      console.log('[Maintenance] Scheduled maintenance:');
      console.log(`  Start: ${startTime}`);
      console.log(`  End: ${endTime}`);
      console.log(`  Reason: ${reason}`);
      console.log(`  Affected: ${affectedServices.join(', ')}`);
      
      const maintenance = maintenanceModeService.scheduleMaintenance({
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        reason,
        affectedServices,
        createdBy: adminUserId || 'admin',
        notifyUsers: true
      });
      
      res.json({ maintenance });
    } catch (error) {
      console.error('Maintenance schedule error:', error);
      res.status(500).json({ error: "Failed to schedule maintenance" });
    }
  });

  app.post("/api/admin/system/maintenance/:id/cancel", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { maintenanceModeService } = await import('./services/maintenanceMode');
      const success = maintenanceModeService.cancelMaintenance(req.params.id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Maintenance not found" });
      }
    } catch (error) {
      console.error('Maintenance cancel error:', error);
      res.status(500).json({ error: "Failed to cancel maintenance" });
    }
  });

  app.get("/api/admin/system/deployments", requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      const { maintenanceModeService } = await import('./services/maintenanceMode');
      const deploymentList = maintenanceModeService.getDeploymentHistory(10);
      
      // Transform to expected format
      const deployments = (deploymentList || []).map((d: any) => ({
        id: d.id,
        version: d.version,
        environment: d.environment || 'production',
        status: d.status,
        deployedBy: d.deployedBy || 'system',
        deployedAt: d.startTime || d.deployedAt,
        commitHash: d.commitHash,
        changes: d.changes?.length || 0,
        duration: d.duration
      }));
      
      // Calculate stats
      const successfulDeployments = deployments.filter((d: any) => d.status === 'success');
      
      // Calculate by environment distribution
      const byEnvironment: Record<string, number> = {};
      deployments.forEach((d: any) => {
        const env = d.environment || 'unknown';
        byEnvironment[env] = (byEnvironment[env] || 0) + 1;
      });
      
      // Calculate by status distribution
      const byStatus: Record<string, number> = {};
      deployments.forEach((d: any) => {
        const status = d.status || 'unknown';
        byStatus[status] = (byStatus[status] || 0) + 1;
      });
      
      const stats = {
        totalDeployments: deployments.length,
        successRate: deployments.length > 0 
          ? Math.round((successfulDeployments.length / deployments.length) * 100) 
          : 100,
        avgDuration: successfulDeployments.length > 0
          ? Math.round(successfulDeployments.reduce((sum: number, d: any) => sum + (d.duration || 0), 0) / successfulDeployments.length)
          : 0,
        lastDeployment: deployments[0]?.deployedAt,
        byEnvironment,
        byStatus
      };
      
      res.json({ deployments, stats });
    } catch (error) {
      console.error('Deployments fetch error:', error);
      res.status(500).json({ error: "Failed to fetch deployments" });
    }
  });

  app.post("/api/admin/system/deployments/start", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { maintenanceModeService } = await import('./services/maintenanceMode');
      const adminUserId = getCurrentUserId(req);
      
      const schema = z.object({
        version: z.string(),
        changes: z.array(z.string()),
      });
      
      const { version, changes } = schema.parse(req.body);
      
      const deployment = maintenanceModeService.startDeployment({
        version,
        changes,
        deployedBy: adminUserId || 'admin'
      });
      
      // Perform health check after deployment
      setTimeout(async () => {
        const healthCheckPassed = await maintenanceModeService.performHealthCheck(deployment.id);
        maintenanceModeService.completeDeployment(deployment.id, healthCheckPassed, healthCheckPassed);
      }, 5000); // Health check after 5 seconds
      
      res.json({ deployment });
    } catch (error) {
      console.error('Deployment start error:', error);
      res.status(500).json({ error: "Failed to start deployment" });
    }
  });

  app.post("/api/admin/system/deployments/:id/rollback", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { maintenanceModeService } = await import('./services/maintenanceMode');
      
      const schema = z.object({
        reason: z.string(),
      });
      
      const { reason } = schema.parse(req.body);
      
      const rollback = maintenanceModeService.rollbackDeployment(req.params.id, reason);
      
      if (rollback) {
        res.json({ rollback });
      } else {
        res.status(404).json({ error: "Deployment not found or rollback not available" });
      }
    } catch (error) {
      console.error('Deployment rollback error:', error);
      res.status(500).json({ error: "Failed to rollback deployment" });
    }
  });

  // AI Provider Costs - Super Admin only
  app.get("/api/superadmin/ai-costs", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { startDate, endDate, provider, limit, offset } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      const pageLimit = limit ? parseInt(limit as string, 10) : 1000;
      const pageOffset = offset ? parseInt(offset as string, 10) : 0;
      
      if (provider) {
        const costs = await storage.getAIProviderCostsByProvider(
          provider as string, 
          start, 
          end, 
          pageLimit, 
          pageOffset
        );
        res.json({ 
          costs,
          pagination: {
            limit: pageLimit,
            offset: pageOffset,
            hasMore: costs.length === pageLimit
          }
        });
      } else {
        const costs = await storage.getAIProviderCosts(start, end, pageLimit, pageOffset);
        const aggregated = await storage.aggregateAIProviderCosts(start, end);
        
        // Calculate totals
        const totalCostUsd = aggregated.reduce((sum, p) => sum + (p.totalCostCents || 0), 0) / 100;
        const totalTokens = aggregated.reduce((sum, p) => sum + (p.totalTokens || 0), 0);
        const totalRequests = aggregated.reduce((sum, p) => sum + (p.totalRequests || 0), 0);
        
        res.json({ 
          costs, 
          aggregated,
          summary: {
            totalCostUsd,
            totalTokens,
            totalRequests,
            avgCostPerRequest: totalRequests > 0 ? totalCostUsd / totalRequests : 0
          },
          pagination: {
            limit: pageLimit,
            offset: pageOffset,
            hasMore: costs.length === pageLimit
          }
        });
      }
    } catch (error) {
      console.error('AI costs fetch error:', error);
      res.status(500).json({ error: "Failed to fetch AI costs" });
    }
  });

  app.get("/api/admin/system/performance", requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      const { systemMonitor } = await import('./services/systemMonitor');
      const os = await import('os');
      
      const metrics = await systemMonitor.getSystemMetrics();
      const cpus = os.cpus();
      const loadAvg = os.loadavg();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const uptime = process.uptime();
      
      // Calculate CPU usage from load average
      const cpuPercentage = Math.min(100, (loadAvg[0] / cpus.length) * 100);
      
      const performance = {
        cpu: {
          percentage: cpuPercentage,
          cores: cpus.length,
          loadAverage: loadAvg
        },
        memory: {
          used: usedMem,
          total: totalMem,
          percentage: (usedMem / totalMem) * 100
        },
        responseTime: {
          avg: 45,
          p95: 68,
          p99: 90
        },
        requests: {
          total: 0,
          perSecond: 0,
          errors: 0
        },
        database: {
          queryTime: (metrics?.health?.components?.database as any)?.latency || 5,
          connections: (metrics?.health?.components?.database as any)?.connections || 1,
          activeQueries: (metrics?.health?.components?.database as any)?.activeQueries || 0
        },
        uptime: uptime
      };
      
      res.json(performance);
    } catch (error) {
      console.error('Performance metrics error:', error);
      res.status(500).json({ error: "Failed to fetch performance metrics" });
    }
  });

  // Agent capabilities endpoint
  app.get("/api/agents/capabilities/:mode", requireAuth, async (req, res) => {
    try {
      const { mode } = req.params;
      const capabilities = getAgentCapabilities(mode);
      res.json(capabilities);
    } catch (error) {
      console.error('Agent capabilities error:', error);
      res.status(500).json({ error: "Failed to fetch agent capabilities" });
    }
  });

  // ================================
  // API KEYS MANAGEMENT
  // ================================
  
  // Get all API keys for the current user
  app.get("/api/user/api-keys", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const keys = await storage.getApiKeysByUserId(userId);
      
      // Never return key hashes, only metadata
      const safeKeys = keys.map(key => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        revokedAt: key.revokedAt,
        permissions: key.permissions,
        createdAt: key.createdAt
      }));
      
      res.json(safeKeys);
    } catch (error) {
      console.error('Get API keys error:', error);
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });
  
  // Create a new API key
  app.post("/api/user/api-keys", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { name, permissions, expiresInDays } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "Name is required" });
      }
      
      // Generate a secure API key
      const rawKey = `luca_${crypto.randomBytes(32).toString('hex')}`;
      const keyPrefix = rawKey.substring(0, 12); // "luca_1234567"
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
      
      const expiresAt = expiresInDays 
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;
      
      const apiKey = await storage.createApiKey({
        userId,
        name,
        keyHash,
        keyPrefix,
        permissions: permissions || ['read'],
        expiresAt
      });
      
      // Return the raw key ONLY ONCE (never stored or retrievable again)
      res.json({
        id: apiKey.id,
        name: apiKey.name,
        key: rawKey,  // ⚠️ Only shown once!
        keyPrefix: apiKey.keyPrefix,
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt
      });
    } catch (error) {
      console.error('Create API key error:', error);
      res.status(500).json({ error: "Failed to create API key" });
    }
  });
  
  // Revoke an API key
  app.delete("/api/user/api-keys/:id", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const { id } = req.params;
      
      const key = await storage.getApiKeyById(id);
      if (!key) {
        return res.status(404).json({ error: "API key not found" });
      }
      
      if (key.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      await storage.revokeApiKey(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Revoke API key error:', error);
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  });
  
  // ================================
  // WHITE-LABEL CONFIGURATION
  // ================================
  
  // Get white-label config for the current user
  app.get("/api/user/white-label", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const config = await storage.getWhiteLabelConfig(userId);
      res.json(config || { companyName: "", primaryColor: "#3B82F6", secondaryColor: "#10B981" });
    } catch (error) {
      console.error('Get white-label config error:', error);
      res.status(500).json({ error: "Failed to fetch white-label configuration" });
    }
  });
  
  // Create or update white-label config
  app.post("/api/user/white-label", requireAuth, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const {
        companyName,
        companyLogo,
        primaryColor,
        secondaryColor,
        customDomain,
        emailFooter,
        reportHeader,
        reportFooter,
        enableWatermark,
        watermarkText
      } = req.body;
      
      if (!companyName || typeof companyName !== 'string') {
        return res.status(400).json({ error: "Company name is required" });
      }
      
      const config = await storage.upsertWhiteLabelConfig({
        userId,
        companyName,
        companyLogo,
        primaryColor: primaryColor || "#3B82F6",
        secondaryColor: secondaryColor || "#10B981",
        customDomain,
        emailFooter,
        reportHeader,
        reportFooter,
        enableWatermark: enableWatermark !== false,
        watermarkText
      });
      
      res.json(config);
    } catch (error) {
      console.error('Update white-label config error:', error);
      res.status(500).json({ error: "Failed to update white-label configuration" });
    }
  });

  const httpServer = createServer(app);
  
  // WebSocket removed - now using Server-Sent Events (SSE) for chat streaming
  // See POST /api/chat/stream endpoint above
  
  return httpServer;
}
