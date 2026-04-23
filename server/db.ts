import { Pool, PoolConfig } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Log which database we're connecting to (without credentials)
const dbUrl = new URL(process.env.DATABASE_URL);
console.log(`[DB] Connecting to: ${dbUrl.host}${dbUrl.pathname}`);

// AWS RDS / Railway / PostgreSQL connection configuration.
// Tuned for cloud Postgres where a TCP proxy (Railway / AWS RDS
// Proxy / PgBouncer) may drop idle connections without notifying
// the application layer.
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Pool sizing (tune for your instance)
  max: parseInt(process.env.DB_POOL_MAX || '10'),
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  // Timeouts
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  application_name: 'icai-cagpt',
  // SSL required for managed Postgres — rejectUnauthorized: false
  // accepts self-signed certs. Set DB_SSL=false only for local dev.
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  // Kernel TCP keepalive. Not sufficient on its own against Railway's
  // proxy (which drops based on app-layer traffic, not TCP probes),
  // so we also run a periodic SELECT 1 keepalive below.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // NOTE: `statement_timeout` is NOT a valid pg.Pool option — it's a
  // Postgres server-side GUC. Passing it here is silently ignored.
  // Apply it per-connection via the `connect` event handler below.
};

const client = new Pool(poolConfig);

// Per-connection initialisation.
// 1. `statement_timeout` — the actually-honoured way to set it. With
//    this in place, a Railway-proxy-dropped connection can't hang a
//    query for 35 seconds waiting for the kernel to give up; the
//    server bounds the query at 30s and the client sees the error
//    promptly.
// 2. `idle_in_transaction_session_timeout` — safety belt for
//    forgotten BEGIN statements.
const PER_CONNECTION_INIT = `
  SET statement_timeout = 30000;
  SET idle_in_transaction_session_timeout = 60000;
`;

// Track connection state
let isConnected = false;

// Handle pool errors gracefully - Railway proxy can reset connections
client.on('error', (err) => {
  console.error('[DB] Pool error (will auto-reconnect):', err.message);
  isConnected = false;
});

client.on('connect', async (pgClient) => {
  if (!isConnected) {
    console.log('[DB] ✓ Pool connection established');
    isConnected = true;
  }
  // Apply per-connection settings. Errors here shouldn't prevent the
  // connection from being used — log and continue.
  try {
    await pgClient.query(PER_CONNECTION_INIT);
  } catch (err: any) {
    console.warn('[DB] Per-connection init failed:', err?.message ?? err);
  }
});

// Test connection with retry logic for AWS RDS
async function testConnection(retries = 5, initialDelay = 2000): Promise<void> {
  let delay = initialDelay;
  
  for (let i = 0; i < retries; i++) {
    try {
      const connection = await client.connect();
      await connection.query('SELECT 1');
      console.log('[DB] ✓ Connected and verified successfully');
      connection.release();
      isConnected = true;
      return;
    } catch (err: any) {
      const errMsg = err.message || String(err);
      console.error(`[DB] Connection attempt ${i + 1}/${retries} failed:`, errMsg);
      
      if (i < retries - 1) {
        console.log(`[DB] Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Exponential backoff with max of 15 seconds
        delay = Math.min(delay * 1.5, 15000);
      }
    }
  }
  console.error('[DB] ✗ All connection attempts failed - queries will retry on demand');
}

// Start connection test (non-blocking)
testConnection();

// ---------------------------------------------------------------------------
// Application-layer keep-alive.
//
// Railway's TCP proxy drops idle connections based on whether
// application-layer Postgres traffic flowed recently, NOT whether
// TCP keepalive probes did. A real `SELECT 1` every ~3 minutes
// keeps at least one pooled connection warm well under the typical
// 4-5 minute proxy idle window, and exercises the full stack so
// we'd notice a broken connection pool in logs long before a user
// request does.
//
// This intentionally uses `client.query(...)` (not a drizzle call)
// so it runs on any pool connection, not a specific one. Failures
// are logged but don't retry — the next interval will try again.
// ---------------------------------------------------------------------------
const KEEPALIVE_INTERVAL_MS = parseInt(process.env.DB_KEEPALIVE_MS || '180000'); // 3 min default
let keepaliveTimer: NodeJS.Timeout | null = null;
function startKeepalive() {
  if (keepaliveTimer) clearInterval(keepaliveTimer);
  keepaliveTimer = setInterval(async () => {
    try {
      await client.query('SELECT 1');
      // Silent success — don't spam the logs every 3 minutes.
    } catch (err: any) {
      console.warn('[DB] Keepalive query failed:', err?.message ?? err);
      // Mark pool as disconnected; next request will trigger the
      // normal reconnect path through pg's pool.
      isConnected = false;
    }
  }, KEEPALIVE_INTERVAL_MS);
  // Don't keep the Node event loop alive purely for this timer.
  keepaliveTimer.unref?.();
}
startKeepalive();

// ---------------------------------------------------------------------------
// Transient-error retry wrapper.
//
// When Railway's proxy drops a pooled connection between requests,
// the next query to use that socket surfaces as an error. The pool
// evicts the dead client afterwards, so a fresh attempt on a new
// connection usually succeeds immediately. `withDbRetry` wraps a
// DB-using callback and retries ONCE on the narrow set of known-
// transient pg error codes / messages so application code doesn't
// have to care.
//
// Usage in storage methods:
//     return withDbRetry(() => db.select().from(users).where(...));
//
// The retry is bounded (`attempts: 2` = one retry) and only fires
// on errors that look like connection drops — not on application
// errors like unique-constraint violations, which we want to
// surface directly.
// ---------------------------------------------------------------------------
const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EPIPE',
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
]);
const TRANSIENT_MESSAGE_PATTERNS = [
  /Connection terminated/i,
  /Client has encountered a connection error/i,
  /terminating connection due to/i,
  /server closed the connection unexpectedly/i,
  /Connection lost/i,
  /timeout expired/i,
];

function isTransientDbError(err: any): boolean {
  if (!err) return false;
  const code = err.code ?? err.errno;
  if (code && TRANSIENT_ERROR_CODES.has(String(code))) return true;
  const msg = String(err.message ?? err);
  return TRANSIENT_MESSAGE_PATTERNS.some((re) => re.test(msg));
}

/**
 * Run `fn` once; on a transient pg error (connection dropped / pool
 * client killed), retry exactly once after a short delay. Any other
 * error propagates unchanged. Callers that require stricter retry
 * (e.g. exponential backoff, more attempts) should build it on top.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, label?: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isTransientDbError(err)) throw err;
    console.warn(
      `[DB] Transient error${label ? ` in ${label}` : ''} — retrying once: ${(err as Error).message}`,
    );
    // Small delay lets the pool evict the dead client and hand out a
    // fresh one on the retry.
    await new Promise((r) => setTimeout(r, 150));
    return await fn();
  }
}

export const db = drizzle(client, { schema });
export { client, isConnected };
