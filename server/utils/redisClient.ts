/**
 * Shared Redis client instance to avoid connection pool exhaustion
 */
import Redis from 'ioredis';

let sharedClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!sharedClient) {
    let errorLogged = false;
    sharedClient = new Redis(process.env.REDIS_URL, {
      keyPrefix: 'luca:',
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times > 10) {
          console.warn('[Redis] Unreachable after 10 retries — giving up');
          return null;
        }
        return Math.min(times * 200, 3000);
      },
      lazyConnect: false,
    });

    sharedClient.on('error', (err) => {
      if (!errorLogged) {
        console.error('[Redis] Error:', err.message);
        errorLogged = true;
      }
    });

    sharedClient.on('connect', () => {
      console.log('[Redis] ✓ Connected successfully');
    });
  }

  return sharedClient;
}

// Bull needs clients without enableReadyCheck/maxRetriesPerRequest
export function createBullRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }

  return new Redis(process.env.REDIS_URL, {
    keyPrefix: 'luca:',
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 10) return null;
      return Math.min(times * 200, 3000);
    },
  });
}

export function closeRedisClient() {
  if (sharedClient) {
    sharedClient.disconnect();
    sharedClient = null;
  }
}
