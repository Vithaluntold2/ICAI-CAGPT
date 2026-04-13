/**
 * PostgreSQL-based Caching Layer
 * No Redis required - uses existing PostgreSQL database
 * Handles caching for conversations, users, AI responses
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import type { Conversation, User } from '@shared/schema';

// Create cache table if it doesn't exist
async function ensureCacheTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cache_entries (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Create index for expiry cleanup
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at)
    `);
    
    console.log('[PgCache] ✓ Cache table ready');
  } catch (error) {
    console.error('[PgCache] Error creating cache table:', error);
  }
}

// Initialize on module load
let initialized = false;
async function init() {
  if (!initialized) {
    await ensureCacheTable();
    initialized = true;
    
    // Prune expired entries every 5 minutes
    setInterval(async () => {
      try {
        await db.execute(sql`
          DELETE FROM cache_entries WHERE expires_at < NOW()
        `);
      } catch (e) {
        // Ignore cleanup errors
      }
    }, 5 * 60 * 1000);
  }
}

export class CacheService {
  /**
   * Get from PostgreSQL cache
   */
  static async get<T>(key: string): Promise<T | null> {
    await init();
    
    try {
      const result = await db.execute(sql`
        SELECT value FROM cache_entries 
        WHERE key = ${key} AND expires_at > NOW()
      `);
      
      if (result.rows && result.rows.length > 0) {
        return result.rows[0].value as T;
      }
      return null;
    } catch (error) {
      console.error('[PgCache] Get error:', error);
      return null;
    }
  }

  /**
   * Set in PostgreSQL cache with TTL
   */
  static async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    await init();
    
    try {
      await db.execute(sql`
        INSERT INTO cache_entries (key, value, expires_at)
        VALUES (${key}, ${JSON.stringify(value)}::jsonb, NOW() + ${ttlSeconds} * INTERVAL '1 second')
        ON CONFLICT (key) DO UPDATE SET
          value = ${JSON.stringify(value)}::jsonb,
          expires_at = NOW() + ${ttlSeconds} * INTERVAL '1 second'
      `);
    } catch (error) {
      console.error('[PgCache] Set error:', error);
    }
  }

  /**
   * Delete from PostgreSQL cache
   */
  static async del(key: string | string[]): Promise<void> {
    await init();
    
    const keys = Array.isArray(key) ? key : [key];
    
    try {
      for (const k of keys) {
        await db.execute(sql`DELETE FROM cache_entries WHERE key = ${k}`);
      }
    } catch (error) {
      console.error('[PgCache] Delete error:', error);
    }
  }

  /**
   * Clear all cache
   */
  static async flush(): Promise<void> {
    await init();
    
    try {
      await db.execute(sql`DELETE FROM cache_entries`);
    } catch (error) {
      console.error('[PgCache] Flush error:', error);
    }
  }

  /**
   * Get cache stats
   */
  static async getStats() {
    await init();
    
    try {
      const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM cache_entries`);
      const keyCount = countResult.rows?.[0]?.count || 0;
      
      return {
        postgres: {
          status: 'ready',
          ready: true,
          keyCount: Number(keyCount),
        }
      };
    } catch (error) {
      return {
        postgres: {
          status: 'error',
          ready: false,
          keyCount: 0,
        }
      };
    }
  }

  /**
   * Check if cache is connected
   */
  static isConnected(): boolean {
    return initialized;
  }

  /**
   * Health check for cache
   */
  static async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    
    try {
      await db.execute(sql`SELECT 1`);
      return {
        healthy: true,
        latencyMs: Date.now() - start
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start
      };
    }
  }
}

/**
 * Domain-specific cache functions
 */

export const ConversationCache = {
  async getUserConversations(userId: string): Promise<Conversation[] | null> {
    return CacheService.get<Conversation[]>(`user:${userId}:conversations`);
  },

  async setUserConversations(userId: string, conversations: Conversation[]): Promise<void> {
    await CacheService.set(`user:${userId}:conversations`, conversations, 300); // 5 min
  },

  async invalidateUserConversations(userId: string): Promise<void> {
    await CacheService.del(`user:${userId}:conversations`);
  },

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
  getCacheKey(query: string, chatMode: string, userTier: string): string {
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
    await CacheService.set(key, response, 1800); // 30 min
  }
};

export default CacheService;
