# Hybrid Cache Architecture

## Overview

ICAI CAGPT uses a **hybrid caching strategy** that combines Redis (for speed) with PostgreSQL (for persistence and fallback). This gives you the best of both worlds:

- **Redis**: Blazing fast (~1ms) response times
- **PostgreSQL**: Reliable persistence, always available

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT REQUEST                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            CACHE LAYER                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      GET (Read) Flow                             │   │
│  │                                                                  │   │
│  │   ┌──────────┐    miss/error    ┌──────────────┐                │   │
│  │   │  Redis   │ ───────────────► │  PostgreSQL  │                │   │
│  │   │  (~1ms)  │                  │   (~10-50ms) │                │   │
│  │   └──────────┘                  └──────────────┘                │   │
│  │        │                               │                         │   │
│  │        │ hit                           │ hit                     │   │
│  │        ▼                               ▼                         │   │
│  │   Return data ◄──── Warm Redis ◄──── Return data                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      SET (Write) Flow                            │   │
│  │                                                                  │   │
│  │                    ┌──────────────────────┐                      │   │
│  │                    │    WRITE TO BOTH     │                      │   │
│  │                    └──────────────────────┘                      │   │
│  │                           │       │                              │   │
│  │              ┌────────────┘       └────────────┐                 │   │
│  │              ▼                                 ▼                 │   │
│  │        ┌──────────┐                   ┌──────────────┐          │   │
│  │        │  Redis   │                   │  PostgreSQL  │          │   │
│  │        └──────────┘                   └──────────────┘          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Session Store (PostgreSQL)

**File**: `server/index.ts`

Sessions are stored in PostgreSQL for persistence across server restarts and deployments.

```typescript
import connectPgSimple from 'connect-pg-simple';

const PgStore = connectPgSimple(session);
const sessionStore = new PgStore({
  conString: process.env.DATABASE_URL,
  tableName: 'user_sessions',
  createTableIfMissing: true,
  pruneSessionInterval: 60 * 15, // Cleanup every 15 minutes
  ttl: 30 * 24 * 60 * 60, // 30 days
});
```

**Benefits**:
- Sessions survive server restarts
- Sessions persist across Railway redeploys
- No additional infrastructure needed

---

### 2. Hybrid Cache Service

**File**: `server/services/hybridCache.ts`

The main caching layer that tries Redis first, then falls back to PostgreSQL.

#### Configuration

| Environment | REDIS_URL | Behavior |
|-------------|-----------|----------|
| Production (Railway) | Set | Redis primary + PostgreSQL backup |
| Development | Not set | PostgreSQL only |

#### API

```typescript
import CacheService from './services/hybridCache';

// Get from cache (tries Redis → PostgreSQL)
const data = await CacheService.get<UserData>('user:123');

// Set in cache (writes to BOTH layers)
await CacheService.set('user:123', userData, 300); // 5 min TTL

// Delete from cache
await CacheService.del('user:123');

// Health check
const health = await CacheService.healthCheck();
// { healthy: true, latencyMs: 5, layers: { redis: true, postgres: true } }

// Get stats
const stats = await CacheService.getStats();
// { redis: { status: 'connected', keyCount: 150 }, postgres: { status: 'connected', keyCount: 200 } }
```

#### Domain-Specific Caches

```typescript
import { ConversationCache, UserCache, AIResponseCache } from './services/hybridCache';

// Conversation caching
await ConversationCache.setUserConversations(userId, conversations);
const cached = await ConversationCache.getUserConversations(userId);

// User caching
await UserCache.setUser(user);
const cachedUser = await UserCache.getUser(userId);

// AI response caching (deduplication)
await AIResponseCache.set(query, chatMode, userTier, response);
const cachedResponse = await AIResponseCache.get(query, chatMode, userTier);
```

---

### 3. Hybrid Job Queue

**File**: `server/services/hybridJobQueue.ts`

Background job processing with automatic fallback.

#### With Redis (Production)
- Uses **Bull** queue library
- Persistent jobs survive restarts
- Automatic retries with exponential backoff
- Job statistics and monitoring

#### Without Redis (Development)
- Uses in-memory queue
- Simple async processing
- Still supports retries

#### API

```typescript
import { 
  addTitleGenerationJob, 
  addAnalyticsJob, 
  addFileProcessingJob,
  getQueueStats 
} from './services/hybridJobQueue';

// Queue title generation
addTitleGenerationJob(conversationId, query);

// Queue analytics processing
addAnalyticsJob({
  messageId,
  conversationId,
  userId,
  role: 'assistant',
  content: response,
  previousMessages
});

// Queue file processing
addFileProcessingJob(fileId, filePath, userId);

// Get queue statistics
const stats = await getQueueStats();
// {
//   titleGeneration: { waiting: 2, active: 1, completed: 150, failed: 3 },
//   analytics: { waiting: 0, active: 0, completed: 500, failed: 5 },
//   backend: 'redis', // or 'memory'
//   status: 'ready'
// }
```

---

### 4. LangChain Cache

**File**: `server/services/cache/langCache.ts`

Caches LLM responses to reduce costs and improve performance.

```typescript
import { getLangCache } from './services/cache/langCache';
import { ChatOpenAI } from '@langchain/openai';

const cache = await getLangCache();
const model = new ChatOpenAI({
  modelName: 'gpt-4',
  cache, // Automatic caching!
});

// First call: hits OpenAI API (~2-5 seconds, costs money)
const response1 = await model.invoke("What is 2+2?");

// Second call: returns from cache (~5ms, FREE!)
const response2 = await model.invoke("What is 2+2?");
```

---

## Database Tables

### Session Table (Auto-created)

```sql
CREATE TABLE user_sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IDX_session_expire ON user_sessions (expire);
```

### Cache Table (Auto-created)

```sql
CREATE TABLE cache_entries (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_cache_expires ON cache_entries (expires_at);
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `REDIS_URL` | ❌ Optional | Redis connection string (enables fast caching) |
| `SESSION_SECRET` | ✅ Yes | Secret for signing session cookies |

---

## Railway Deployment

### Without Redis (Simple)

Just deploy with `DATABASE_URL` - everything works with PostgreSQL only.

### With Redis (Recommended for Production)

1. **Add Redis Plugin**:
   - Go to your Railway project
   - Click "New" → "Database" → "Redis"
   - Wait for provisioning

2. **Link Redis**:
   - Click on your service
   - Go to "Variables"
   - Add: `REDIS_URL` = `${{Redis.REDIS_URL}}`

3. **Redeploy**:
   - The app will automatically detect Redis and use it

---

## Performance Comparison

| Operation | Redis | PostgreSQL Only |
|-----------|-------|-----------------|
| Cache GET | ~1-5ms | ~10-50ms |
| Cache SET | ~1-5ms | ~15-60ms |
| Session Read | ~1-5ms | ~10-30ms |
| Job Queue | Persistent, distributed | In-memory |

---

## Monitoring

### Health Endpoint

```bash
GET /api/health
```

Response includes cache layer status:

```json
{
  "status": "healthy",
  "components": {
    "database": { "status": "healthy", "latencyMs": 15 },
    "cache": {
      "status": "healthy",
      "message": "Cache ready [Redis + PostgreSQL] (3ms)",
      "layers": { "redis": true, "postgres": true }
    },
    "jobQueues": {
      "backend": "redis",
      "titleGeneration": { "waiting": 0, "active": 0 }
    }
  }
}
```

### System Monitor

The `SystemMonitor` service provides real-time health metrics:

```typescript
import { systemMonitor } from './services/systemMonitor';

const metrics = await systemMonitor.getSystemMetrics();
console.log(metrics.health.components.redis);
// { status: 'healthy', message: 'Cache ready [Redis + PostgreSQL] (3ms)' }
```

---

## Graceful Degradation

The system is designed to work even when components fail:

| Scenario | Behavior |
|----------|----------|
| Redis down | Falls back to PostgreSQL cache |
| Redis slow | Timeout and use PostgreSQL |
| PostgreSQL down | Service unavailable (critical) |
| Both Redis & PG healthy | Optimal performance |

---

## Best Practices

### 1. Cache Keys

Use consistent, hierarchical key naming:

```typescript
// Good
`user:${userId}:conversations`
`conversation:${convId}:messages`
`ai:${chatMode}:${userTier}:${queryHash}`

// Bad
`userConvos_${userId}`
`c${convId}m`
```

### 2. TTL Guidelines

| Data Type | Recommended TTL | Reason |
|-----------|-----------------|--------|
| User profile | 30 minutes | Rarely changes |
| Conversations list | 5 minutes | Updates frequently |
| Single conversation | 10 minutes | Moderate updates |
| AI responses | 30 minutes | Expensive to regenerate |
| Session | 30 days | User convenience |

### 3. Cache Invalidation

Always invalidate cache when data changes:

```typescript
// After updating user
await storage.updateUser(userId, data);
await UserCache.invalidateUser(userId);

// After adding message to conversation
await storage.createMessage(message);
await ConversationCache.invalidateConversation(conversationId);
```

---

## Troubleshooting

### Redis Connection Issues

```
[Cache] Redis error: ECONNREFUSED
```

**Solution**: Check `REDIS_URL` is correct. System will automatically fall back to PostgreSQL.

### Cache Table Not Created

```
[PgCache] Error creating cache table: relation does not exist
```

**Solution**: Ensure `DATABASE_URL` has proper permissions. The table is auto-created on first use.

### High Cache Miss Rate

Check cache stats:

```typescript
const stats = await CacheService.getStats();
console.log(stats);
```

If PostgreSQL has more keys than Redis, Redis might be evicting entries. Consider:
- Increasing Redis memory
- Reducing TTL values
- Reviewing what's being cached

---

## Files Reference

| File | Purpose |
|------|---------|
| `server/index.ts` | Session store configuration |
| `server/services/hybridCache.ts` | Main hybrid cache service |
| `server/services/hybridJobQueue.ts` | Background job processing |
| `server/services/cache/langCache.ts` | LangChain LLM response cache |
| `server/services/systemMonitor.ts` | Health monitoring |
| `server/services/pgCache.ts` | PostgreSQL-only cache (legacy) |
| `server/services/pgJobQueue.ts` | In-memory queue (legacy) |

---

## Migration Notes

### From Redis-only to Hybrid

The hybrid system is backward compatible. Existing Redis data will continue to work.

### From Memory to PostgreSQL Sessions

Sessions stored in memory will be lost on first restart. Users will need to log in again once.

---

## Summary

| Component | Primary | Fallback | Persistence |
|-----------|---------|----------|-------------|
| **Sessions** | PostgreSQL | - | ✅ Survives restarts |
| **Cache** | Redis | PostgreSQL | ✅ Dual-write |
| **Job Queues** | Bull (Redis) | In-memory | ⚠️ Only with Redis |
| **LangChain Cache** | Hybrid | PostgreSQL | ✅ Always |

This architecture ensures your application is **fast when Redis is available** and **reliable when it's not**.
