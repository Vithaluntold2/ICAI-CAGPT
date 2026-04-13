/**
 * Storage Service Unit Tests
 * Tests for PostgreSQL storage layer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database module
vi.mock('../../pgStorage', () => {
  const mockDb = new Map();
  
  return {
    storage: {
      // User operations
      getUser: vi.fn(async (id: string) => mockDb.get(`user:${id}`) || null),
      getUserByEmail: vi.fn(async (email: string) => {
        for (const [key, value] of mockDb.entries()) {
          if (key.startsWith('user:') && value.email === email) {
            return value;
          }
        }
        return null;
      }),
      createUser: vi.fn(async (data: any) => {
        const user = { ...data, id: crypto.randomUUID(), createdAt: new Date() };
        mockDb.set(`user:${user.id}`, user);
        return user;
      }),
      
      // Conversation operations
      getConversation: vi.fn(async (id: string) => mockDb.get(`conversation:${id}`)),
      getUserConversations: vi.fn(async (userId: string) => {
        const conversations = [];
        for (const [key, value] of mockDb.entries()) {
          if (key.startsWith('conversation:') && value.userId === userId) {
            conversations.push(value);
          }
        }
        return conversations;
      }),
      createConversation: vi.fn(async (data: any) => {
        const conversation = { ...data, id: crypto.randomUUID(), createdAt: new Date() };
        mockDb.set(`conversation:${conversation.id}`, conversation);
        return conversation;
      }),
      
      // Message operations
      getConversationMessages: vi.fn(async (conversationId: string) => {
        const messages = [];
        for (const [key, value] of mockDb.entries()) {
          if (key.startsWith('message:') && value.conversationId === conversationId) {
            messages.push(value);
          }
        }
        return messages.sort((a, b) => a.createdAt - b.createdAt);
      }),
      createMessage: vi.fn(async (data: any) => {
        const message = { ...data, id: crypto.randomUUID(), createdAt: new Date() };
        mockDb.set(`message:${message.id}`, message);
        return message;
      }),
      
      // Utility
      _clearMock: () => mockDb.clear(),
    },
  };
});

import { storage } from '../../pgStorage';

describe('Storage Service - User Operations', () => {
  beforeEach(() => {
    (storage as any)._clearMock();
  });

  it('should create a new user', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hashed_password',
    };

    const user = await storage.createUser(userData);

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.username).toBe('testuser');
    expect(user.email).toBe('test@example.com');
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('should retrieve user by ID', async () => {
    const user = await storage.createUser({
      username: 'john',
      email: 'john@example.com',
      passwordHash: 'hash123',
    });

    const retrieved = await storage.getUser(user.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(user.id);
    expect(retrieved?.username).toBe('john');
  });

  it('should retrieve user by email', async () => {
    await storage.createUser({
      username: 'jane',
      email: 'jane@example.com',
      passwordHash: 'hash456',
    });

    const retrieved = await storage.getUserByEmail('jane@example.com');

    expect(retrieved).toBeDefined();
    expect(retrieved?.username).toBe('jane');
    expect(retrieved?.email).toBe('jane@example.com');
  });

  it('should return null for non-existent user', async () => {
    const user = await storage.getUser('nonexistent-id');
    expect(user).toBeNull();
  });
});

describe('Storage Service - Conversation Operations', () => {
  beforeEach(() => {
    (storage as any)._clearMock();
  });

  it('should create a new conversation', async () => {
    const user = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hash',
    });

    const conversation = await storage.createConversation({
      userId: user.id,
      title: 'Test Chat',
    });

    expect(conversation).toBeDefined();
    expect(conversation.id).toBeDefined();
    expect(conversation.userId).toBe(user.id);
    expect(conversation.title).toBe('Test Chat');
  });

  it('should retrieve conversation by ID', async () => {
    const user = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hash',
    });

    const conversation = await storage.createConversation({
      userId: user.id,
      title: 'My Conversation',
    });

    const retrieved = await storage.getConversation(conversation.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(conversation.id);
    expect(retrieved?.title).toBe('My Conversation');
  });

  it('should retrieve all conversations for a user', async () => {
    const user = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hash',
    });

    await storage.createConversation({ userId: user.id, title: 'Chat 1' });
    await storage.createConversation({ userId: user.id, title: 'Chat 2' });
    await storage.createConversation({ userId: user.id, title: 'Chat 3' });

    const conversations = await storage.getUserConversations(user.id);

    expect(conversations).toHaveLength(3);
    expect(conversations[0].title).toBe('Chat 1');
    expect(conversations[1].title).toBe('Chat 2');
    expect(conversations[2].title).toBe('Chat 3');
  });
});

describe('Storage Service - Message Operations', () => {
  beforeEach(() => {
    (storage as any)._clearMock();
  });

  it('should create a new message', async () => {
    const user = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hash',
    });

    const conversation = await storage.createConversation({
      userId: user.id,
      title: 'Test Chat',
    });

    const message = await storage.createMessage({
      conversationId: conversation.id,
      role: 'user',
      content: 'Hello, AI!',
    });

    expect(message).toBeDefined();
    expect(message.id).toBeDefined();
    expect(message.conversationId).toBe(conversation.id);
    expect(message.role).toBe('user');
    expect(message.content).toBe('Hello, AI!');
  });

  it('should retrieve messages by conversation ID', async () => {
    const user = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hash',
    });

    const conversation = await storage.createConversation({
      userId: user.id,
      title: 'Test Chat',
    });

    await storage.createMessage({
      conversationId: conversation.id,
      role: 'user',
      content: 'First message',
    });

    await storage.createMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: 'Second message',
    });

    const messages = await storage.getConversationMessages(conversation.id);

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('First message');
    expect(messages[1].content).toBe('Second message');
  });

  it('should return messages in chronological order', async () => {
    const user = await storage.createUser({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hash',
    });

    const conversation = await storage.createConversation({
      userId: user.id,
      title: 'Test Chat',
    });

    const msg1 = await storage.createMessage({
      conversationId: conversation.id,
      role: 'user',
      content: 'First',
    });

    const msg2 = await storage.createMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: 'Second',
    });

    const messages = await storage.getConversationMessages(conversation.id);

    expect(messages[0].createdAt.getTime()).toBeLessThanOrEqual(messages[1].createdAt.getTime());
  });
});
