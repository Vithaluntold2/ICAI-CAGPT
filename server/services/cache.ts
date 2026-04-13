/**
 * Redis Caching Layer - PRODUCTION ONLY
 * NO MEMORY FALLBACKS - Redis is required
 * Handles caching for conversations, users, AI responses
 */

import { redisClient } from './jobQueue';
import type { Conversation, User } from '@shared/schema';

// Validate Redis is available at startup
function requireRedis() {
  if (!redisClient) {
    throw new Error('Redis client not available - REDIS_URL must be configured for production');
  }
  return redisClient;
}

export class CacheService {
  /**
   * Get from Redis cache - NO FALLBACKS
   */
  static async get<T>(key: string): Promise<T | null> {
    const client = requireRedis();
    
    const value = await client.get(key);
    if (value) {
      return JSON.parse(value) as T;
    }
    return null;
  }

  /**
   * Set in Redis cache with TTL - NO FALLBACKS
   */
  static async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    const client = requireRedis();
    const serialized = JSON.stringify(value);
    await client.setex(key, ttlSeconds, serialized);
  }

  /**
   * Delete from Redis cache - NO FALLBACKS
   */
  static async del(key: string | string[]): Promise<void> {
    const client = requireRedis();
    const keys = Array.isArray(key) ? key : [key];
    
    if (keys.length > 0) {
      await client.del(...keys);
    }
  }

  /**
   * Clear all cache - NO FALLBACKS
   */
  static async flush(): Promise<void> {
    const client = requireRedis();
    await client.flushdb();
  }

  /**
   * Get cache stats
   */
  static async getStats() {
    const client = requireRedis();
    const info = await client.info('stats');
    const memory = await client.info('memory');
    const keyCount = await client.dbsize();
    
    return {
      redis: {
        status: client.status,
        ready: client.status === 'ready',
        keyCount,
        info: info.substring(0, 500),
        memory: memory.substring(0, 500)
      }
    };
  }

  /**
   * Check if Redis is connected
   */
  static isConnected(): boolean {
    return redisClient?.status === 'ready';
  }

  /**
   * Health check for Redis
   */
  static async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const client = requireRedis();
    const start = Date.now();
    await client.ping();
    return {
      healthy: true,
      latencyMs: Date.now() - start
    };
  }
}

/**
 * Domain-specific cache functions
 */

export const ConversationCache = {
  /**
   * Cache user's conversation list
   */
  async getUserConversations(userId: string): Promise<Conversation[] | null> {
    return CacheService.get<Conversation[]>(`user:${userId}:conversations`);
  },

  async setUserConversations(userId: string, conversations: Conversation[]): Promise<void> {
    await CacheService.set(`user:${userId}:conversations`, conversations, 300); // 5 min
  },

  async invalidateUserConversations(userId: string): Promise<void> {
    await CacheService.del(`user:${userId}:conversations`);
  },

  /**
   * Cache single conversation
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    return CacheService.get<Conversation>(`conversation:${conversationId}`);
  },

  async setConversation(conversation: Conversation): Promise<void> {
    await CacheService.set(`conversation:${conversation.id}`, conversation, 600); // 10 min
  },

  async invalidateConversation(conversationId: string): Promise<void> {
    await CacheService.del(`conversation:${conversationId}`);
  }
};

export const UserCache = {
  /**
   * Cache user data
   */
  async getUser(userId: string): Promise<User | null> {
    return CacheService.get<User>(`user:${userId}`);
  },

  async setUser(user: User): Promise<void> {
    await CacheService.set(`user:${user.id}`, user, 1800); // 30 min
  },

  async invalidateUser(userId: string): Promise<void> {
    await CacheService.del(`user:${userId}`);
  }
};

export const AIResponseCache = {
  /**
   * Cache AI responses for duplicate queries
   */
  getCacheKey(query: string, chatMode: string, userTier: string): string {
    // Simple hash for cache key
    const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
    const hash = Buffer.from(normalized).toString('base64').substring(0, 50);
    return `ai:${chatMode}:${userTier}:${hash}`;
  },

  async get(query: string, chatMode: string, userTier: string): Promise<string | null> {
    const key = this.getCacheKey(query, chatMode, userTier);
    return CacheService.get<string>(key);
  },

  async set(query: string, chatMode: string, userTier: string, response: string): Promise<void> {
    const key = this.getCacheKey(query, chatMode, userTier);
    // Shorter TTL for AI responses (questions change frequently)
    await CacheService.set(key, response, 1800); // 30 min
  }
};

export default CacheService;
