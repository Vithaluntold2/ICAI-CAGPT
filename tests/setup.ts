/**
 * Global Test Setup
 * Configures test environment, mocks, and utilities
 */

import { beforeAll, afterAll, vi, expect } from 'vitest';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/lucaagent_test';
// Local test Postgres typically runs without SSL. Default DB_SSL=false so
// server/db.ts's pg Pool doesn't force an SSL handshake that the local server
// rejects. CI/remote runs can still opt in by explicitly setting DB_SSL.
process.env.DB_SSL = process.env.DB_SSL ?? 'false';

// Mock external services by default
vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// Global test setup
beforeAll(async () => {
  console.log('[TEST] Starting test suite');
  console.log('[TEST] Environment:', process.env.NODE_ENV);
  console.log('[TEST] Database:', process.env.DATABASE_URL?.replace(/\/\/.*@/, '//*****@'));
});

// Global test cleanup
afterAll(async () => {
  console.log('[TEST] Test suite completed');
  // Close database connections, etc.
});

// Extend Vitest matchers (optional)
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      pass,
      message: () => pass 
        ? `Expected ${received} not to be a valid UUID`
        : `Expected ${received} to be a valid UUID`,
    };
  },
});

// Extend TypeScript types for custom matchers
declare module 'vitest' {
  interface Assertion {
    toBeValidUUID(): void;
  }
  interface AsymmetricMatchersContaining {
    toBeValidUUID(): void;
  }
}
