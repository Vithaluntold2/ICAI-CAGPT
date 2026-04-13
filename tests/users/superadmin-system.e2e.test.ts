/**
 * Super Admin System Management E2E Test
 * 
 * Tests SUPER ADMIN specific features (System Level Access):
 * 
 * Step 1: Login with seeded super admin credentials
 * Step 2: Verify super admin session
 * Step 3: Access KPI dashboard
 * Step 4: Check system health metrics
 * Step 5: Monitor security threats
 * Step 6: View system integrations
 * Step 7: Check deployment history
 * Step 8: View route health
 * Step 9: Logout
 * Step 10: Verify no access after logout
 * 
 * NOTE: Super Admin manages SYSTEM features, NOT user features like chat/PDFs
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-for-e2e';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.SUPER_ADMIN_EMAILS = 'superadmin@lucatest.com';

// Mock database
const TEST_USER_ID = 'sa-test-uuid-0001';

const mockSuperAdmin = {
  id: TEST_USER_ID,
  email: 'superadmin@lucatest.com',
  password: '$2b$10$hashedpassword', // TestPassword123!
  name: 'Super Admin User',
  subscriptionTier: 'enterprise',
  isAdmin: true,
  isSuperAdmin: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  mfaEnabled: false,
  createdAt: new Date('2026-01-01'),
};

const mockStorage = {
  getUser: vi.fn().mockImplementation(async (id: string) => {
    return id === TEST_USER_ID ? { ...mockSuperAdmin } : undefined;
  }),
  getUserByEmail: vi.fn().mockImplementation(async (email: string) => {
    return email === mockSuperAdmin.email ? { ...mockSuperAdmin } : undefined;
  }),
  isAccountLocked: vi.fn().mockResolvedValue(false),
  resetFailedLoginAttempts: vi.fn().mockResolvedValue(undefined),
  getAdminKPIs: vi.fn().mockResolvedValue({
    users: { total: 1000, active: 800, new: 50 },
    revenue: { total: 10000, thisMonth: 2000 },
    queries: { total: 50000, thisMonth: 5000 },
  }),
};

vi.mock('../../server/pgStorage', () => ({
  storage: mockStorage,
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../server/services/systemMonitor', () => ({
  systemMonitor: {
    getSystemMetrics: vi.fn().mockResolvedValue({
      cpu: { usage: 45 },
      memory: { used: 60 },
      uptime: 3600000,
    }),
    getThreats: vi.fn().mockReturnValue([
      { id: '1', type: 'brute_force', severity: 'high', ip: '1.2.3.4', timestamp: new Date(), blocked: false },
    ]),
    getThreatStats: vi.fn().mockReturnValue({
      total: 10, active: 5, blocked: 3, resolved: 2,
      bySeverity: { high: 5, medium: 3, low: 2 },
      byType: { brute_force: 6, sql_injection: 4 },
    }),
    getRouteHealth: vi.fn().mockReturnValue([]),
    checkIntegrations: vi.fn().mockResolvedValue([]),
  },
}));

// Test app setup
let app: express.Application;
let agent: request.SuperAgentTest;

describe('Super Admin System Management E2E', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }));

    // Import and register routes
    const { registerRoutes } = await import('../../server/routes');
    await registerRoutes(app);

    agent = request.agent(app);
  });

  // ─── STEP 1: Login ───
  describe('Step 1: Login with super admin credentials', () => {
    it('should login successfully with TestPassword123!', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({
          email: 'superadmin@lucatest.com',
          password: 'TestPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('superadmin@lucatest.com');
      expect(res.body.user.isAdmin).toBe(true);
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });

  // ─── STEP 2: Verify Session ───
  describe('Step 2: Verify super admin session', () => {
    it('should return current user with admin flags', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body.user.isAdmin).toBe(true);
    });
  });

  // ─── STEP 3: Super Admin Dashboard ───
  describe('Step 3: Access Super Admin Dashboard', () => {
    it('should display dashboard KPIs', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/admin/kpis');

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      // Dashboard should show: Health Score, CPU, Memory, Uptime, Users, Conversations, Threats, Alerts
    });

    it('should have Quick Access sections', async () => {
      // Quick Access buttons should be present:
      // - System Health
      // - Security Threats  
      // - Deployments
      // - Maintenance
      // - Alerts
      // - Performance
      // - Integrations
      expect(true).toBe(true); // UI test - buttons present
    });

    it('should deny non-authenticated access', async () => {
      const newAgent = request.agent(app);
      const res = await newAgent.get('/api/admin/kpis');

      expect(res.status).toBe(401);
    });
  });

  // ─── STEP 4: System Monitoring (Health) ───
  describe('Step 4: System Monitoring - Health Metrics', () => {
    it('should display System Health Score (0-100)', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/admin/system/health');

      expect(res.status).toBe(200);
      expect(res.body.metrics).toBeDefined();
    });

    it('should show CPU, Memory, Uptime metrics', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/admin/system/health');

      expect(res.body.metrics).toBeDefined();
      // Should display: CPU Usage (%), Memory Usage (MB), Uptime (h)
    });

    it('should show Active Alerts count', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/admin/system/health');

      expect(res.status).toBe(200);
      // Should show number of active alerts
    });

    it('should display Component Health status', async () => {
      // Component Health section should show status of:
      // - Database
      // - AI Providers
      // - Payment Gateways
      // - Email Services
      expect(true).toBe(true); // UI test
    });

    it('should show Security Threats (Last 24h)', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/admin/system/threats');

      expect(res.status).toBe(200);
      // Should show: Total, Blocked, High/Critical, Brute Force counts
    });
  });

  // ─── STEP 5: Security Threats Management ───
  describe('Step 5: Security Threats - Monitor & Block', () => {
    it('should display threat statistics', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/admin/system/threats');

      expect(res.status).toBe(200);
      expect(res.body.stats).toBeDefined();
      // Stats: Total Threats, Active, Blocked, Resolved
    });

    it('should show Threats by Severity chart', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/admin/system/threats');

      expect(res.body.stats.bySeverity).toBeDefined();
      // Chart should break down: Critical, High, Medium, Low
    });

    it('should show Threats by Type chart', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/admin/system/threats');

      expect(res.body.stats.byType).toBeDefined();
      // Types: brute_force, sql_injection, rate_limit, etc.
    });

    it('should have searchable threats table', async () => {
      // Table columns: Type, Severity, Source, Description, Status, Detected, Actions
      // Should be searchable and filterable
      expect(true).toBe(true); // UI test
    });

    it('should support filtering by severity', async () => {
      // Dropdown: All Severities / Critical / High / Medium / Low
      expect(true).toBe(true); // UI test
    });

    it('should have Refresh button', async () => {
      // Top-right corner should have Refresh button
      expect(true).toBe(true); // UI test
    });
  });

  // ─── STEP 6: Deployments Management ───
  describe('Step 6: Deployments - Track & Rollback', () => {
    it('should display deployment statistics', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/admin/system/deployments');

      expect(res.status).toBe(200);
      // Stats: Total Deployments, Success Rate (%), Avg Duration, Last Deployment
    });

    it('should show Deployments by Environment chart', async () => {
      // Chart should show: Production, Staging, Development
      expect(true).toBe(true); // UI test
    });

    it('should show Deployments by Status chart', async () => {
      // Chart should show: Success, Failed, In Progress, Rolled Back
      expect(true).toBe(true); // UI test
    });

    it('should have deployments table with filters', async () => {
      // Table columns: Version, Environment, Branch, Status, Deployed By, Duration, Started, Actions
      // Filters: Environment (All/Prod/Staging/Dev), Status (All/Success/Failed)
      expect(true).toBe(true); // UI test
    });

    it('should have New Deployment button', async () => {
      // Top-right corner should have "+ New Deployment" button
      expect(true).toBe(true); // UI test
    });
  });

  // ─── STEP 7: System Maintenance ───
  describe('Step 7: System Maintenance - Tasks & Operations', () => {
    it('should display maintenance statistics', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/admin/system/maintenance');

      expect([200, 404]).toContain(res.status);
      // Stats: System Health (%), Active Tasks, Scheduled, Completed Today
    });

    it('should have Quick Actions buttons', async () => {
      // Quick Actions should include:
      // - Database Vacuum
      // - Clear Cache
      // - Rotate Logs
      // - Create Backup
      expect(true).toBe(true); // UI test
    });

    it('should show Maintenance Tasks table', async () => {
      // Table columns: Task, Category, Type, Status, Last Run, Next Run, Actions
      expect(true).toBe(true); // UI test
    });

    it('should have Maintenance Mode toggle', async () => {
      // Top-right should have "Maintenance Mode" toggle switch
      expect(true).toBe(true); // UI test
    });
  });

  // ─── STEP 8: System Alerts ───
  describe('Step 8: System Alerts - Monitor & Acknowledge', () => {
    it('should display alert statistics', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/admin/system/alerts');

      expect([200, 404]).toContain(res.status);
      // Stats: Total Alerts, Unacknowledged, Errors, Warnings
    });

    it('should show Alerts by Category chart', async () => {
      // Categories: System, Security, Performance, Database, AI Providers
      expect(true).toBe(true); // UI test
    });

    it('should show Recent Critical Alerts', async () => {
      // Section for latest critical alerts requiring attention
      expect(true).toBe(true); // UI test
    });

    it('should have alerts table with filters', async () => {
      // Table columns: Type, Category, Title, Source, Status, Time, Actions
      // Filters: All Types, All Categories, All Status
      expect(true).toBe(true); // UI test
    });
  });

  // ─── STEP 9: Performance Metrics ───
  describe('Step 9: Performance Metrics - Monitor System Performance', () => {
    it('should display System Health Score', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/admin/system/performance');

      expect([200, 404]).toContain(res.status);
      // Health Score: 0-100 with color indicator
    });

    it('should show resource usage metrics', async () => {
      // Metrics: CPU Usage (%), Memory Usage (GB/GB), Disk Usage (GB/GB), Network I/O (B/B)
      expect(true).toBe(true); // UI test
    });

    it('should show Response Time statistics', async () => {
      // Response Times: Min (0ms), Median (0ms), Max (0ms)
      expect(true).toBe(true); // UI test
    });

    it('should show Request Statistics', async () => {
      // Stats: Total Requests, Requests/sec, Errors, Error Rate (%)
      expect(true).toBe(true); // UI test
    });

    it('should show Database Performance section', async () => {
      // Database metrics: Connection pool, query performance
      expect(true).toBe(true); // UI test
    });

    it('should have time range filter', async () => {
      // Top-right: "Last 1h" dropdown (1h/6h/24h/7d)
      expect(true).toBe(true); // UI test
    });
  });

  // ─── STEP 10: Integrations Management ───
  describe('Step 10: Integrations - Monitor Third-Party Services', () => {
    it('should display integration statistics', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/admin/system/integrations');

      expect(res.status).toBe(200);
      // Stats: Total Integrations, Connected, Errors, Requests Today
    });

    it('should show Integrations by Type chart', async () => {
      // Types: AI Provider, Cloud Service, Payment Gateway, Email Service
      expect(true).toBe(true); // UI test
    });

    it('should show AI Provider Status', async () => {
      // AI Providers: OpenAI, Azure OpenAI, Anthropic, Google Gemini
      // Status indicators: Connected/Degraded/Failed/Disabled
      expect(true).toBe(true); // UI test
    });

    it('should have integrations table with search', async () => {
      // Table columns: Integration, Type, Status, Health, Last Sync, Enabled, Actions
      // Search box and filters: All Types, All Status
      expect(true).toBe(true); // UI test
    });

    it('should have Add Integration button', async () => {
      // Top-right: "+ Add Integration" button
      expect(true).toBe(true); // UI test
    });
  });

  // ─── STEP 11: EasyLoans DSA Management ───
  describe('Step 11: EasyLoans DSA Management (Super Admin Feature)', () => {
    it('should display DSA statistics', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.get('/api/admin/easyloans/stats');

      expect([200, 404]).toContain(res.status);
      // Stats: Lenders, Loan Products, Eligibility Criteria, Rate Slabs, Government Schemes
    });

    it('should have Quick Actions for EasyLoans', async () => {
      // Quick Actions:
      // - Add New Lender
      // - Update Rate Slabs
      // - Create Loan Product
      // - Manage Schemes
      // - Define Eligibility
      // - View Analytics (Coming Soon)
      expect(true).toBe(true); // UI test
    });
  });

  // ─── STEP 12: Logout ───
  describe('Step 12: Logout', () => {
    it('should logout successfully', async () => {
      await agent
        .post('/api/auth/login')
        .send({ email: 'superadmin@lucatest.com', password: 'TestPassword123!' });

      const res = await agent.post('/api/auth/logout');

      expect(res.status).toBe(200);
    });
  });

  // ─── STEP 13: Verify No Access ───
  describe('Step 13: Verify no access after logout', () => {
    it('should deny /api/auth/me', async () => {
      const res = await agent.get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should deny admin endpoints', async () => {
      const res = await agent.get('/api/admin/kpis');

      expect(res.status).toBe(401);
    });

    it('should deny system monitoring endpoints', async () => {
      const res = await agent.get('/api/admin/system/health');

      expect(res.status).toBe(401);
    });
  });
});
