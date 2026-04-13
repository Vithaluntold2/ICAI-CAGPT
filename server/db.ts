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

// AWS RDS / PostgreSQL connection configuration
// Tuned for AWS RDS with SSL and connection pooling
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Pool sizing (tune for your RDS instance)
  max: parseInt(process.env.DB_POOL_MAX || '10'),
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  // Timeouts suitable for RDS
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Application identifier
  application_name: 'icai-cagpt',
  // SSL required for AWS RDS — rejectUnauthorized: false accepts RDS self-signed certs
  // Set DB_SSL=false only for local development
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  // Keep-alive for long-lived RDS connections
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Statement timeout to prevent hanging queries
  statement_timeout: 30000,
};

const client = new Pool(poolConfig);

// Track connection state
let isConnected = false;

// Handle pool errors gracefully - Railway proxy can reset connections
client.on('error', (err) => {
  console.error('[DB] Pool error (will auto-reconnect):', err.message);
  isConnected = false;
});

client.on('connect', () => {
  if (!isConnected) {
    console.log('[DB] ✓ Pool connection established');
    isConnected = true;
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

export const db = drizzle(client, { schema });
export { client, isConnected };
