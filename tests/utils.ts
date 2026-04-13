/**
 * Test Utilities and Helpers
 * Reusable functions for testing
 */

import { vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Create a mock Express request object
 */
export function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    session: {} as any,
    user: undefined,
    method: 'GET',
    path: '/',
    ...overrides,
  };
}

/**
 * Create a mock Express response object
 */
export function createMockResponse(): Partial<Response> {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    sendStatus: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    locals: {},
  };
  return res;
}

/**
 * Create a mock Next function for middleware testing
 */
export function createMockNext() {
  return vi.fn();
}

/**
 * Wait for a specified time (useful for testing async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock user object for testing
 */
export function createMockUser(overrides: any = {}) {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock conversation for testing
 */
export function createMockConversation(overrides: any = {}) {
  return {
    id: '223e4567-e89b-12d3-a456-426614174000',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Conversation',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock message for testing
 */
export function createMockMessage(overrides: any = {}) {
  return {
    id: '323e4567-e89b-12d3-a456-426614174000',
    conversationId: '223e4567-e89b-12d3-a456-426614174000',
    role: 'user',
    content: 'Test message',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Mock database operations
 */
export function createMockDb() {
  return {
    query: vi.fn(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    execute: vi.fn(),
  };
}

/**
 * Mock AI provider response
 */
export function createMockAIResponse(content: string = 'Mock AI response') {
  return {
    content,
    model: 'gpt-4',
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
    finishReason: 'stop',
  };
}

/**
 * Assert that a function throws a specific error
 */
export async function expectError(fn: () => any | Promise<any>, errorMessage?: string) {
  try {
    await fn();
    throw new Error('Expected function to throw an error');
  } catch (error: any) {
    if (errorMessage && !error.message.includes(errorMessage)) {
      throw new Error(`Expected error message to contain "${errorMessage}", got "${error.message}"`);
    }
    return error;
  }
}

/**
 * Mock file upload
 */
export function createMockFile(overrides: any = {}) {
  return {
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('test file content'),
    ...overrides,
  };
}

/**
 * Mock Redis client
 */
export function createMockRedis() {
  const store = new Map<string, string>();
  
  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    setex: vi.fn(async (key: string, seconds: number, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    exists: vi.fn(async (key: string) => store.has(key) ? 1 : 0),
    expire: vi.fn(async () => 1),
    ttl: vi.fn(async () => 3600),
    clear: () => store.clear(),
    _store: store, // For inspection in tests
  };
}
