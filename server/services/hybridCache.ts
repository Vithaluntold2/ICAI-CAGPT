/**
 * Hybrid Caching Layer - Redis (fast) + PostgreSQL (fallback)
 * 
 * Strategy:
 * - Redis: Primary cache (millisecond response times)
 * - PostgreSQL: Fallback when Redis unavailable (persistent)
 * 
 * This gives you BOTH speed AND reliability!
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import type { Conversation, User } from '@shared/schema';

// Redis client (optional - for speed)
let redisClient: Redis | null = null;
let redisAvailable = false;

// PostgreSQL cache table initialization
let pgInitialized = false;

/**
 * Initialize Redis connection (optional speed layer)
 */
function initRedis(): void {
  if (!process.env.REDIS_URL) {
    console.log('[Cache] Redis not configured - using PostgreSQL only');
    return;
  }

  try {
    let redisErrorLogged = false;
    redisClient = new Redis(process.env.REDIS_URL, {
      keyPrefix: 'luca:cache:',
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times > 10) {
          console.warn('[Cache] Redis unreachable after 10 retries — giving up, using PostgreSQL only');
          return null;
        }
        return Math.min(times * 200, 3000);
      },
      lazyConnect: false,
    });

    redisClient.on('error', (err) => {
      if (!redisErrorLogged) {
        console.error('[Cache] Redis error:', err.message);
        redisErrorLogged = true;
      }
      redisAvailable = false;
    });

    redisClient.on('connect', () => {
      console.log('[Cache] ✓ Redis connected (fast cache layer)');
      redisAvailable = true;
    });

    redisClient.on('close', () => {
      redisAvailable = false;
    });
  } catch (error) {
    console.warn('[Cache] Redis init failed, using PostgreSQL only');
    redisClient = null;
    redisAvailable = false;
  }
}

/**
 * Initialize PostgreSQL cache table (fallback layer)
 */
async function initPostgres(): Promise<void> {
  if (pgInitialized) return;

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cache_entries (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_entries(expires_at)
    `);
    
    pgInitialized = true;
    console.log('[Cache] ✓ PostgreSQL cache table ready (fallback layer)');

    // Prune expired entries every 5 minutes
    setInterval(async () => {
      try {
        await db.execute(sql`DELETE FROM cache_entries WHERE expires_at < NOW()`);
      } catch (e) {
        // Ignore cleanup errors
      }
    }, 5 * 60 * 1000);
  } catch (error) {
    console.error('[Cache] PostgreSQL cache init error:', error);
  }
}

// Initialize both layers on module load
initRedis();

export class CacheService {
  /**
   * Get from cache - tries Redis first, falls back to PostgreSQL
   */
  static async get<T>(key: string): Promise<T | null> {
    // Try Redis first (fastest)
    if (redisAvailable && redisClient) {
      try {
        const value = await redisClient.get(key);
        if (value) {
          return JSON.parse(value) as T;
        }
      } catch (error) {
        console.warn('[Cache] Redis get error, trying PostgreSQL:', error);
      }
    }

    // Fallback to PostgreSQL
    await initPostgres();
    try {
      const result = await db.execute(sql`
        SELECT value FROM cache_entries 
        WHERE key = ${key} AND expires_at > NOW()
      `);
      
      if (result.rows && result.rows.length > 0) {
        const value = result.rows[0].value as T;
        
        // Warm Redis cache if it's back online
        if (redisAvailable && redisClient) {
          redisClient.setex(key, 300, JSON.stringify(value)).catch(() => {});
        }
        
        return value;
      }
      return null;
    } catch (error) {
      console.error('[Cache] Get error:', error);
      return null;
    }
  }

  /**
   * Set in cache - writes to BOTH Redis and PostgreSQL
   */
  static async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    const serialized = JSON.stringify(value);

    // Write to Redis (fast reads)
    if (redisAvailable && redisClient) {
      try {
        await redisClient.setex(key, ttlSeconds, serialized);
      } catch (error) {
        console.warn('[Cache] Redis set error:', error);
      }
    }

    // Write to PostgreSQL (persistence)
    await initPostgres();
    try {
      await db.execute(sql`
        INSERT INTO cache_entries (key, value, expires_at)
        VALUES (${key}, ${serialized}::jsonb, NOW() + ${ttlSeconds} * INTERVAL '1 second')
        ON CONFLICT (key) DO UPDATE SET
          value = ${serialized}::jsonb,
          expires_at = NOW() + ${ttlSeconds} * INTERVAL '1 second'
      `);
    } catch (error) {
      console.error('[Cache] PostgreSQL set error:', error);
    }
  }

  /**
   * Delete from both caches
   */
  static async del(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];
    
    // Delete from Redis
    if (redisAvailable && redisClient && keys.length > 0) {
      try {
        await redisClient.del(...keys);
      } catch (error) {
        console.warn('[Cache] Redis del error:', error);
      }
    }

    // Delete from PostgreSQL
    await initPostgres();
    try {
      for (const k of keys) {
        await db.execute(sql`DELETE FROM cache_entries WHERE key = ${k}`);
      }
    } catch (error) {
      console.error('[Cache] PostgreSQL del error:', error);
    }
  }

  /**
   * Clear all cache
   */
  static async flush(): Promise<void> {
    // Flush Redis
    if (redisAvailable && redisClient) {
      try {
        await redisClient.flushdb();
      } catch (error) {
        console.warn('[Cache] Redis flush error:', error);
      }
    }

    // Flush PostgreSQL cache
    await initPostgres();
    try {
      await db.execute(sql`DELETE FROM cache_entries`);
    } catch (error) {
      console.error('[Cache] PostgreSQL flush error:', error);
    }
  }

  /**
   * Get cache stats from both layers
   */
  static async getStats() {
    let redisStats = { status: 'disconnected', ready: false, keyCount: 0 };
    let pgStats = { status: 'unknown', ready: false, keyCount: 0 };

    // Redis stats
    if (redisAvailable && redisClient) {
      try {
        const keyCount = await redisClient.dbsize();
        redisStats = {
          status: 'connected',
          ready: true,
          keyCount
        };
      } catch (e) {
        redisStats.status = 'error';
      }
    }

    // PostgreSQL stats
    await initPostgres();
    try {
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM cache_entries WHERE expires_at > NOW()`);
      pgStats = {
        status: 'connected',
        ready: true,
        keyCount: Number(result.rows?.[0]?.count || 0)
      };
    } catch (e) {
      pgStats.status = 'error';
    }

    return {
      redis: redisStats,
      postgres: pgStats,
      strategy: redisAvailable ? 'redis-primary' : 'postgres-only'
    };
  }

  /**
   * Check if any cache layer is available
   */
  static isConnected(): boolean {
    return redisAvailable || pgInitialized;
  }

  /**
   * Health check - tests both layers
   */
  static async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; layers: { redis: boolean; postgres: boolean } }> {
    const start = Date.now();
    let redisOk = false;
    let pgOk = false;

    // Test Redis
    if (redisAvailable && redisClient) {
      try {
        await redisClient.ping();
        redisOk = true;
      } catch (e) {
        redisOk = false;
      }
    }

    // Test PostgreSQL
    try {
      await db.execute(sql`SELECT 1`);
      pgOk = true;
    } catch (e) {
      pgOk = false;
    }

    return {
      healthy: redisOk || pgOk, // Healthy if at least one layer works
      latencyMs: Date.now() - start,
      layers: { redis: redisOk, postgres: pgOk }
    };
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

// Type for cached AI response including visualization
export interface CachedAIResponse {
  response: string;
  modelUsed: string;
  visualization?: any;
  metadata?: any;
  calculationResults?: any;
  tokensUsed?: number;
  cachedAt: number;
}

/**
 * Decide whether a response is worth caching. A too-short response, an empty
 * response, or a response that looks like a placeholder/status-line almost
 * always means the upstream call was interrupted; caching those would poison
 * the cache and every later user with the same query would see the stub.
 */
function isResponseCacheWorthy(r: CachedAIResponse | null | undefined): boolean {
  if (!r || !r.response) return false;
  const text = r.response.trim();
  // A real substantive response is at least a few hundred chars. Set a
  // conservative floor to catch the obvious garbage (we saw 67-char stubs).
  if (text.length < 200) return false;
  // Well-known placeholder fragments we've seen cached when streaming broke.
  // These are never legitimate complete responses on their own.
  const BAD_STUBS = [
    /^detailed explanation of framework, priorities, and regulatory logic\s*$/i,
    /^generating response[.…\s]*$/i,
    /^analy(s|z)ing[.…\s]*$/i,
    /^\s*$/,
  ];
  if (BAD_STUBS.some(re => re.test(text))) return false;
  return true;
}

// Bumping this prefix invalidates every existing cached response — the keys
// change and stale entries are effectively dead until TTL expiry. Use when
// the response-shape contract changes or when the cache has been poisoned.
const CACHE_KEY_PREFIX = 'ai-v2';

export const AIResponseCache = {
  getCacheKey(query: string, chatMode: string, userTier: string): string {
    const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
    const hash = Buffer.from(normalized).toString('base64').substring(0, 50);
    return `${CACHE_KEY_PREFIX}:${chatMode}:${userTier}:${hash}`;
  },

  // Killswitch — when `DISABLE_AI_CACHE=1` in env, every get returns
  // miss and every set is a no-op. Flipped on while we chase down the
  // stale-hit / clarification bugs where cached content from earlier
  // buggy runs would surface on new turns. Remove the env var to
  // re-enable caching; no code change required.
  isDisabled(): boolean {
    return process.env.DISABLE_AI_CACHE === '1' || process.env.DISABLE_AI_CACHE === 'true';
  },

  // Get full cached response including visualization.
  // Self-healing: if the stored entry fails the cache-worthy check (left over
  // from a prior buggy cache-set), evict it and pretend we had a miss so the
  // orchestrator makes a fresh call.
  async getFullResponse(query: string, chatMode: string, userTier: string): Promise<CachedAIResponse | null> {
    if (this.isDisabled()) return null;
    const key = this.getCacheKey(query, chatMode, userTier);
    const cached = await CacheService.get<CachedAIResponse>(key);
    if (!cached) return null;
    if (!isResponseCacheWorthy(cached)) {
      console.warn(`[AICache] EVICT corrupted entry for "${query.substring(0, 50)}..." (mode: ${chatMode}, len=${cached?.response?.length ?? 0})`);
      await CacheService.del(key);
      return null;
    }
    console.log(`[AICache] HIT for query: "${query.substring(0, 50)}..." (mode: ${chatMode})`);
    return cached;
  },

  // Set full response with visualization — only if cache-worthy.
  async setFullResponse(
    query: string,
    chatMode: string,
    userTier: string,
    fullResponse: CachedAIResponse
  ): Promise<void> {
    if (this.isDisabled()) return;
    if (!isResponseCacheWorthy(fullResponse)) {
      console.warn(`[AICache] REFUSE to cache short/placeholder response for "${query.substring(0, 50)}..." (mode: ${chatMode}, len=${fullResponse?.response?.length ?? 0})`);
      return;
    }
    const key = this.getCacheKey(query, chatMode, userTier);
    const toCache: CachedAIResponse = {
      ...fullResponse,
      cachedAt: Date.now()
    };
    await CacheService.set(key, toCache, 1800); // 30 min TTL
    console.log(`[AICache] STORED response for query: "${query.substring(0, 50)}..." (mode: ${chatMode}, len=${fullResponse.response.length})`);
  },

  /**
   * Nuke the entire response cache. Call when the cache is known to be
   * corrupted by stale entries from before a fix landed. Best-effort — works
   * against Redis (SCAN+DEL on the prefix) and against the Postgres fallback
   * table when Redis is down.
   */
  async purgeAll(): Promise<number> {
    let removed = 0;
    if (redisAvailable && redisClient) {
      try {
        const stream = redisClient.scanStream({ match: `luca:cache:${CACHE_KEY_PREFIX}:*`, count: 200 });
        const toDelete: string[] = [];
        await new Promise<void>((resolve, reject) => {
          stream.on('data', (keys: string[]) => {
            for (const k of keys) {
              // Redis client has keyPrefix 'luca:cache:' — scanStream returns full keys;
              // del expects keys WITHOUT the prefix, so strip it.
              toDelete.push(k.replace(/^luca:cache:/, ''));
            }
          });
          stream.on('end', () => resolve());
          stream.on('error', (err) => reject(err));
        });
        if (toDelete.length > 0) {
          await redisClient.del(...toDelete);
          removed += toDelete.length;
        }
      } catch (err) {
        console.warn('[AICache] Redis purge failed:', err);
      }
    }
    try {
      const res = await db.execute(sql`DELETE FROM cache_entries WHERE cache_key LIKE ${`${CACHE_KEY_PREFIX}:%`}`);
      removed += (res.rowCount ?? 0);
    } catch {
      // cache_entries table may not exist yet — ignore
    }
    console.log(`[AICache] purgeAll removed ~${removed} entries`);
    return removed;
  },

  // Legacy methods for backward compatibility
  async get(query: string, chatMode: string, userTier: string): Promise<string | null> {
    const cached = await this.getFullResponse(query, chatMode, userTier);
    return cached?.response || null;
  },

  async set(query: string, chatMode: string, userTier: string, response: string): Promise<void> {
    await this.setFullResponse(query, chatMode, userTier, {
      response,
      modelUsed: 'cached',
      cachedAt: Date.now()
    });
  }
};

// Export Redis client for job queues
export function getRedisClient(): Redis | null {
  return redisAvailable ? redisClient : null;
}

export default CacheService;
