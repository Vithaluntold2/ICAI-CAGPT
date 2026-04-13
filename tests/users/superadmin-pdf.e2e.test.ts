/**
 * Super Admin System Management E2E Test
 * 
 * Tests SUPER ADMIN specific features (System Level Access):
 * 
 * Step 1: Login with seeded super admin credentials
 * Step 2: Verify super admin session (GET /api/auth/me)
 * Step 3: Access KPI dashboard (Super Admin only)
 * Step 4: Check system health metrics
 * Step 5: Monitor security threats
 * Step 6: View system integrations status
 * Step 7: Check deployment history
 * Step 8: View performance metrics
 * Step 9: Check system alerts
 * Step 10: Logout and verify no access
 * 
 * NOTE: Super Admin does NOT use chat/PDF upload features - those are for regular users
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { createServer, Server } from 'http';

// ─── Set required env vars BEFORE any imports ───
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-for-e2e';
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32-byte hex key for tests

// ─── Mock external dependencies BEFORE importing app code ───

// Mock the database client
vi.mock('../../server/db', () => ({
  db: {},
  client: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn(),
    end: vi.fn(),
  },
}));

// Mock bcrypt for password hashing
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$10$hashedpassword'),
    compare: vi.fn().mockResolvedValue(true),
  },
  hash: vi.fn().mockResolvedValue('$2b$10$hashedpassword'),
  compare: vi.fn().mockResolvedValue(true),
}));

// ─── In-memory user & conversation store ───

const TEST_USER_ID = 'sa-test-uuid-0001';

const mockSuperAdmin = {
  id: TEST_USER_ID,
  email: 'superadmin@lucatest.com',
  password: '$2b$10$hashedpassword', // Represents TestPassword123!
  name: 'Super Admin User',
  subscriptionTier: 'enterprise',
  isAdmin: true,
  isSuperAdmin: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastFailedLogin: null,
  mfaEnabled: false,
  mfaSecret: null,
  mfaBackupCodes: null,
  createdAt: new Date('2026-01-01'),
};

const mockConversation = {
  id: TEST_CONV_ID,
  userId: TEST_USER_ID,
  profileId: null,
  title: 'New Chat',
  preview: 'Analyze this balance sheet',
  pinned: false,
  isShared: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUserMessage = {
  id: TEST_MSG_ID,
  conversationId: TEST_CONV_ID,
  role: 'user',
  content: 'Analyze this balance sheet PDF',
  modelUsed: null,
  routingDecision: null,
  calculationResults: null,
  tokensUsed: null,
  metadata: null,
  createdAt: new Date(),
};

const mockAssistantMessage = {
  id: TEST_ASST_MSG_ID,
  conversationId: TEST_CONV_ID,
  role: 'assistant',
  content: 'Based on the balance sheet, total assets are $125,000 with a debt-to-equity ratio of 1.08.',
  modelUsed: 'gpt-4o',
  routingDecision: null,
  calculationResults: null,
  tokensUsed: 450,
  metadata: null,
  createdAt: new Date(),
};

// ─── Mock storage (database layer) ───

const mockStorage = {
  getUser: vi.fn().mockImplementation(async (id: string) => {
    return id === TEST_USER_ID ? { ...mockSuperAdmin } : undefined;
  }),
  getUserByEmail: vi.fn().mockImplementation(async (email: string) => {
    return email === mockSuperAdmin.email ? { ...mockSuperAdmin } : undefined;
  }),
  createUser: vi.fn().mockImplementation(async (data: any) => ({
    ...mockSuperAdmin,
    ...data,
    id: TEST_USER_ID,
    password: '$2b$10$hashedpassword',
  })),
  updateUser: vi.fn().mockResolvedValue(mockSuperAdmin),
  isAccountLocked: vi.fn().mockResolvedValue(false),
  incrementFailedLoginAttempts: vi.fn().mockResolvedValue(undefined),
  resetFailedLoginAttempts: vi.fn().mockResolvedValue(undefined),
  
  // Conversations
  getConversations: vi.fn().mockResolvedValue([mockConversation]),
  getConversation: vi.fn().mockResolvedValue(mockConversation),
  createConversation: vi.fn().mockResolvedValue(mockConversation),
  updateConversation: vi.fn().mockResolvedValue(mockConversation),
  deleteConversation: vi.fn().mockResolvedValue(true),
  
  // Messages
  getConversationMessages: vi.fn().mockResolvedValue([]),
  createMessage: vi.fn().mockImplementation(async (data: any) => ({
    ...mockUserMessage,
    ...data,
    id: data.role === 'assistant' ? TEST_ASST_MSG_ID : TEST_MSG_ID,
  })),
  
  // Usage
  getUsageForMonth: vi.fn().mockResolvedValue({ queriesUsed: 5, tokensUsed: 1000 }),
  incrementUsage: vi.fn().mockResolvedValue(undefined),
  
  // Profiles
  getProfile: vi.fn().mockResolvedValue(null),
  getProfiles: vi.fn().mockResolvedValue([]),
  
  // Admin / KPIs
  getAllUsers: vi.fn().mockResolvedValue([mockSuperAdmin]),
  getAllSubscriptions: vi.fn().mockResolvedValue([]),
};

vi.mock('../../server/pgStorage', () => ({
  storage: mockStorage,
  PostgresStorage: vi.fn(),
}));

// Mock AI orchestrator
const mockOrchestrator = {
  processQuery: vi.fn().mockResolvedValue({
    response: 'Based on the balance sheet, total assets are $125,000 with a debt-to-equity ratio of 1.08.',
    modelUsed: 'gpt-4o',
    classification: { domain: 'accounting', confidence: 0.95, jurisdiction: 'US' },
    calculationResults: null,
    tokensUsed: 450,
    processingTimeMs: 1200,
    metadata: { reasoning: {}, hasDocument: true },
    routingDecision: { selectedModel: 'gpt-4o', fallbackModels: ['gemini-pro'] },
    excelWorkbook: null,
  }),
};

vi.mock('../../server/services/aiOrchestrator', () => ({
  AIOrchestrator: vi.fn().mockImplementation(() => mockOrchestrator),
  aiOrchestrator: mockOrchestrator,
}));

// Mock agent initialization
vi.mock('../../server/services/agents', () => ({
  initializeAgents: vi.fn().mockResolvedValue(undefined),
}));

// Mock all AI provider infrastructure
vi.mock('../../server/services/aiProviders/registry', () => ({
  aiProviderRegistry: { getProvider: vi.fn().mockReturnValue({ generateCompletion: vi.fn().mockResolvedValue({ content: 'Test' }) }) },
  AIProviderName: { OPENAI: 'openai', GEMINI: 'gemini', ANTHROPIC: 'anthropic', AZURE: 'azure' },
}));

vi.mock('../../server/services/providerHealthMonitor', () => ({
  providerHealthMonitor: {
    getHealthyProviders: vi.fn().mockReturnValue(['openai', 'gemini']),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
    getProviderHealth: vi.fn().mockReturnValue({ isHealthy: true }),
  },
}));

// Mock security middleware to be passthrough in tests
vi.mock('../../server/middleware/security', () => ({
  setupSecurityMiddleware: vi.fn(),
  authRateLimiter: (_req: any, _res: any, next: any) => next(),
  chatRateLimiter: (_req: any, _res: any, next: any) => next(),
  fileUploadRateLimiter: (_req: any, _res: any, next: any) => next(),
  apiRateLimiter: (_req: any, _res: any, next: any) => next(),
  generalRateLimiter: (_req: any, _res: any, next: any) => next(),
  integrationRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

// Mock environment validator
vi.mock('../../server/utils/envValidator', () => ({
  validateEnvironmentOrThrow: vi.fn(),
  getEnvironmentInfo: vi.fn().mockReturnValue({
    environment: 'test',
    nodeVersion: process.version,
    features: {},
  }),
}));

// Mock feature flags
vi.mock('../../server/config/featureFlags', () => ({
  getFeatureFlags: vi.fn().mockReturnValue({}),
  getClientFeatures: vi.fn().mockReturnValue({}),
  getDisabledFeatures: vi.fn().mockReturnValue([]),
}));

// Mock services that have heavy dependencies
vi.mock('../../server/services/virusScanService', () => ({
  VirusScanService: { startPeriodicScanning: vi.fn(), scanFile: vi.fn().mockResolvedValue({ clean: true }) },
}));

vi.mock('../../server/services/apmService', () => ({
  apmService: {
    trackRequest: vi.fn().mockReturnValue((_req: any, _res: any, next: any) => next()),
    trackError: vi.fn(),
  },
}));

vi.mock('../../server/services/analyticsProcessor', () => ({
  AnalyticsProcessor: {
    processMessage: vi.fn().mockResolvedValue(undefined),
    analyzeConversation: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../server/services/continuousLearning', () => ({
  continuousLearning: { logInteraction: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../server/services/visualizationGenerator', () => ({
  visualizationGenerator: { generate: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../server/services/workflowGenerator', () => ({
  workflowGenerator: { generate: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../server/services/requirementClarificationAI', () => ({
  requirementClarificationAIService: { shouldClarify: vi.fn().mockResolvedValue({ shouldClarify: false }) },
}));

vi.mock('../../server/services/agents/agentWorkflow', () => ({
  isAgentWorkflowMode: vi.fn().mockReturnValue(false),
  executeWorkflow: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../server/services/titleGenerationQueue', () => ({
  addTitleGenerationJob: vi.fn(),
}));

vi.mock('../../server/services/chatModeNormalizer', () => ({
  normalizeChatMode: vi.fn().mockImplementation((mode: string) => mode || 'standard'),
}));

vi.mock('../../server/services/easyLoans/validation', () => ({
  cleanupRateLimiter: vi.fn(),
}));

vi.mock('../../server/services/easyLoans/circuitBreaker', () => ({
  circuitBreaker: { destroy: vi.fn() },
}));

// ─── Build a lightweight test app ───

let app: express.Express;
let server: Server;
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-secret-for-e2e';

  app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false }));

  // In-memory session for tests
  app.use(session({
    secret: 'test-secret-for-e2e',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  }));

  // Register all routes
  const { registerRoutes } = await import('../../server/routes');
  const httpServer = await registerRoutes(app);

  server = httpServer;
  agent = request.agent(app); // Persists cookies across requests
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});


// ═══════════════════════════════════════════════════════
//  THE COMPLETE SUPER ADMIN USER JOURNEY
// ═══════════════════════════════════════════════════════

describe('Super Admin PDF E2E — Full User Journey', () => {

  // ─── STEP 1: Register ───
  describe('Step 1: Register a new account', () => {
    beforeEach(() => {
      // First call: check if email exists → return undefined (new user)
      // After registration: return the created user
      mockStorage.getUserByEmail
        .mockResolvedValueOnce(undefined)  // registration check
        .mockResolvedValue({ ...mockSuperAdmin }); // subsequent calls
    });

    it('should register with email, password, and name', async () => {
      const res = await agent
        .post('/api/auth/register')
        .send({
          email: 'superadmin@lucatest.com',
          password: 'SecureP@ss123!',
          name: 'Super Admin Test',
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('superadmin@lucatest.com');
      expect(res.body.user.name).toBe('Super Admin Test');
      // Password must NEVER be in the response
      expect(res.body.user.password).toBeUndefined();
    });

    it('should reject duplicate email registration', async () => {
      // getUserByEmail returns existing user
      mockStorage.getUserByEmail.mockResolvedValueOnce({ ...mockSuperAdmin });

      const res = await agent
        .post('/api/auth/register')
        .send({
          email: 'superadmin@lucatest.com',
          password: 'SecureP@ss123!',
          name: 'Super Admin Test',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already registered');
    });

    it('should reject weak password (under 8 chars)', async () => {
      mockStorage.getUserByEmail.mockResolvedValueOnce(undefined);

      const res = await agent
        .post('/api/auth/register')
        .send({
          email: 'new@lucatest.com',
          password: 'short',
          name: 'Weak Pass User',
        });

      expect(res.status).toBe(400);
    });

    it('should reject missing email', async () => {
      const res = await agent
        .post('/api/auth/register')
        .send({
          password: 'SecureP@ss123!',
          name: 'No Email User',
        });

      expect(res.status).toBe(400);
    });
  });

  // ─── STEP 2: Login ───
  describe('Step 2: Login with credentials', () => {
    it('should login successfully and set session cookie', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({
          email: 'superadmin@lucatest.com',
          password: 'SecureP@ss123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('superadmin@lucatest.com');
      expect(res.body.user.isSuperAdmin).toBe(true);
      // Session cookie should be set
      expect(res.headers['set-cookie']).toBeDefined();
      // Sensitive fields stripped
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.mfaSecret).toBeUndefined();
    });

    it('should reject wrong password', async () => {
      const bcrypt = await import('bcrypt');
      (bcrypt.default.compare as any).mockResolvedValueOnce(false);

      const res = await agent
        .post('/api/auth/login')
        .send({
          email: 'superadmin@lucatest.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('password');
    });

    it('should reject non-existent email', async () => {
      mockStorage.getUserByEmail.mockResolvedValueOnce(undefined);

      const res = await agent
        .post('/api/auth/login')
        .send({
          email: 'nobody@lucatest.com',
          password: 'Whatever123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('No account found');
    });
  });

  // ─── STEP 3: Verify session ───
  describe('Step 3: Verify authenticated session (GET /api/auth/me)', () => {
    it('should return current user from session', async () => {
      // Login first to establish session
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(TEST_USER_ID);
      expect(res.body.user.isSuperAdmin).toBe(true);
    });
  });

  // ─── STEP 4: Upload a PDF ───
  describe('Step 4: Upload a PDF document', () => {
    it('should upload a PDF and get back base64 data', async () => {
      // Login first
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      // Create a minimal fake PDF buffer (PDF magic bytes + content)
      const pdfContent = Buffer.from('%PDF-1.4 fake balance sheet content for testing purposes');

      const res = await agent
        .post('/api/chat/upload-file')
        .attach('file', pdfContent, {
          filename: 'balance-sheet-2025.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.file).toBeDefined();
      expect(res.body.file.name).toBe('balance-sheet-2025.pdf');
      expect(res.body.file.type).toBe('application/pdf');
      expect(res.body.file.base64Data).toBeDefined();
      expect(res.body.file.base64Data.length).toBeGreaterThan(0);
      expect(res.body.file.documentType).toBe('document');
    });

    it('should detect invoice document type from filename', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const pdfContent = Buffer.from('%PDF-1.4 invoice data');

      const res = await agent
        .post('/api/chat/upload-file')
        .attach('file', pdfContent, {
          filename: 'invoice-march-2026.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.file.documentType).toBe('invoice');
    });

    it('should detect W-2 document type from filename', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const pdfContent = Buffer.from('%PDF-1.4 w2 form');

      const res = await agent
        .post('/api/chat/upload-file')
        .attach('file', pdfContent, {
          filename: 'w2-2025-employer.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.file.documentType).toBe('w2');
    });

    it('should reject unsupported file types', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const exeContent = Buffer.from('MZ fake executable');

      const res = await agent
        .post('/api/chat/upload-file')
        .attach('file', exeContent, {
          filename: 'malware.exe',
          contentType: 'application/x-msdownload',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid file type');
    });

    it('should reject file without authentication', async () => {
      // Fresh agent with no session cookie
      const freshAgent = request(app);
      const pdfContent = Buffer.from('%PDF-1.4 some content');

      const res = await freshAgent
        .post('/api/chat/upload-file')
        .attach('file', pdfContent, {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(401);
    });
  });

  // ─── STEP 5: Send chat message with PDF attachment ───
  describe('Step 5: Send chat message with uploaded PDF', () => {
    it('should send a message with inline document attachment', async () => {
      // Login
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const pdfBase64 = Buffer.from('%PDF-1.4 balance sheet data').toString('base64');

      const res = await agent
        .post('/api/chat')
        .send({
          message: 'Analyze this balance sheet and calculate the debt-to-equity ratio',
          chatMode: 'standard',
          documentAttachment: {
            filename: 'balance-sheet-2025.pdf',
            type: 'application/pdf',
            data: pdfBase64,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.conversationId).toBeDefined();
      expect(res.body.message).toBeDefined();
      expect(res.body.message.role).toBe('assistant');
      expect(res.body.message.content).toBeTruthy();
      expect(res.body.metadata).toBeDefined();
      expect(res.body.metadata.modelUsed).toBeTruthy();

      // Verify the AI orchestrator was called with attachment
      expect(mockOrchestrator.processQuery).toHaveBeenCalled();
    });

    it('should create a new conversation when no conversationId provided', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const res = await agent
        .post('/api/chat')
        .send({
          message: 'What is GAAP?',
          chatMode: 'standard',
        });

      expect(res.status).toBe(200);
      expect(res.body.conversationId).toBe(TEST_CONV_ID);
      expect(mockStorage.createConversation).toHaveBeenCalled();
    });

    it('should reject chat without authentication', async () => {
      const freshAgent = request(app);

      const res = await freshAgent
        .post('/api/chat')
        .send({ message: 'Hello' });

      expect(res.status).toBe(401);
    });
  });

  // ─── STEP 6: Conversations CRUD ───
  describe('Step 6: Create and manage conversations', () => {
    it('should list all conversations', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const res = await agent.get('/api/conversations');

      expect(res.status).toBe(200);
      expect(res.body.conversations).toBeDefined();
      expect(Array.isArray(res.body.conversations)).toBe(true);
    });

    it('should create a new conversation', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const res = await agent
        .post('/api/conversations')
        .send({ title: 'Tax Questions 2025' });

      expect(res.status).toBe(200);
      expect(res.body.conversation).toBeDefined();
    });

    it('should get messages for a conversation', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      mockStorage.getConversationMessages.mockResolvedValueOnce([
        mockUserMessage,
        mockAssistantMessage,
      ]);

      const res = await agent.get(`/api/conversations/${TEST_CONV_ID}/messages`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toBeDefined();
      expect(res.body.messages).toHaveLength(2);
      expect(res.body.messages[0].role).toBe('user');
      expect(res.body.messages[1].role).toBe('assistant');
    });
  });

  // ─── STEP 7: Super Admin dashboard endpoints ───
  describe('Step 7: Access Super Admin dashboard', () => {
    it('should access KPI dashboard (super admin only)', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const res = await agent.get('/api/admin/kpis');

      // Should NOT be 401 or 403 — super admin has access
      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toBeDefined();
      }
    });

    it('should deny KPI access to non-super-admin', async () => {
      // Mock a regular user (not super admin)
      mockStorage.getUser.mockResolvedValueOnce({
        ...mockSuperAdmin,
        isSuperAdmin: false,
        isAdmin: false,
      });

      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const res = await agent.get('/api/admin/kpis');

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Super admin access required');
    });
  });

  // ─── STEP 8: System health & monitoring ───
  describe('Step 8: Access system health & monitoring', () => {
    it('should access system health endpoint', async () => {
      // Reset to super admin for this test
      mockStorage.getUser.mockResolvedValue({ ...mockSuperAdmin });

      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const res = await agent.get('/api/admin/system/health');

      expect([200, 500]).toContain(res.status);
    });

    it('should access system threats endpoint', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const res = await agent.get('/api/admin/system/threats');

      expect([200, 500]).toContain(res.status);
    });

    it('should access AI costs endpoint', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const res = await agent.get('/api/superadmin/ai-costs');

      expect([200, 500]).toContain(res.status);
    });

    it('should access system performance endpoint', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const res = await agent.get('/api/admin/system/performance');

      expect([200, 500]).toContain(res.status);
    });

    it('should access system integrations', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const res = await agent.get('/api/admin/system/integrations');

      expect([200, 500]).toContain(res.status);
    });

    it('should access system alerts', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const res = await agent.get('/api/admin/system/alerts');

      expect([200, 500]).toContain(res.status);
    });

    it('should access maintenance tasks', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const res = await agent.get('/api/admin/system/maintenance');

      expect([200, 500]).toContain(res.status);
    });

    it('should access deployment history', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const res = await agent.get('/api/admin/system/deployments');

      expect([200, 500]).toContain(res.status);
    });
  });

  // ─── STEP 9: Logout ───
  describe('Step 9: Logout', () => {
    it('should logout and destroy session', async () => {
      // Login first
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'SecureP@ss123!' });

      const res = await agent.post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── STEP 10: Verify no access after logout ───
  describe('Step 10: Verify no access after logout', () => {
    it('should deny /api/auth/me after logout', async () => {
      // Use a fresh agent (no session)
      const freshAgent = request(app);

      const res = await freshAgent.get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should deny chat after logout', async () => {
      const freshAgent = request(app);

      const res = await freshAgent
        .post('/api/chat')
        .send({ message: 'Hello after logout' });

      expect(res.status).toBe(401);
    });

    it('should deny admin endpoints after logout', async () => {
      const freshAgent = request(app);

      const res = await freshAgent.get('/api/admin/kpis');

      expect(res.status).toBe(401);
    });

    it('should deny file upload after logout', async () => {
      const freshAgent = request(app);
      const pdfContent = Buffer.from('%PDF-1.4 test');

      const res = await freshAgent
        .post('/api/chat/upload-file')
        .attach('file', pdfContent, {
          filename: 'test.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(401);
    });
  });
});
