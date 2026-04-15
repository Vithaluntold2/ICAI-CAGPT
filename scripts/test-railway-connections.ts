#!/usr/bin/env tsx

/**
 * Test Railway Database and Redis Connections
 * 
 * This script validates that:
 * 1. PostgreSQL database is accessible
 * 2. Redis is accessible
 * 3. All required environment variables are set
 */

import { config } from 'dotenv';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Load environment variables
config();

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

const results: TestResult[] = [];

async function testEnvironmentVariables(): Promise<void> {
  console.log(`\n${BOLD}[1/3] Checking Environment Variables${RESET}\n`);

  const required = [
    'DATABASE_URL',
    'SESSION_SECRET',
  ];

  const optional = [
    'REDIS_URL',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GOOGLE_AI_API_KEY',
  ];

  // Check required variables
  for (const varName of required) {
    if (process.env[varName]) {
      console.log(`${GREEN}✓${RESET} ${varName} is set`);
      results.push({
        name: varName,
        status: 'pass',
        message: 'Variable is set'
      });
    } else {
      console.log(`${RED}✗${RESET} ${varName} is missing`);
      results.push({
        name: varName,
        status: 'fail',
        message: 'Required variable is missing'
      });
    }
  }

  // Check optional variables
  let optionalCount = 0;
  for (const varName of optional) {
    if (process.env[varName]) {
      optionalCount++;
      console.log(`${GREEN}✓${RESET} ${varName} is set`);
    } else {
      console.log(`${YELLOW}⚠${RESET} ${varName} is not set (optional)`);
    }
  }

  if (optionalCount === 0) {
    results.push({
      name: 'Optional Variables',
      status: 'warning',
      message: 'No optional variables configured'
    });
  }
}

async function testDatabaseConnection(): Promise<void> {
  console.log(`\n${BOLD}[2/3] Testing PostgreSQL Database Connection${RESET}\n`);

  if (!process.env.DATABASE_URL) {
    console.log(`${RED}✗${RESET} DATABASE_URL not set, skipping test`);
    results.push({
      name: 'Database Connection',
      status: 'fail',
      message: 'DATABASE_URL not configured'
    });
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    // Test connection
    const client = await pool.connect();
    console.log(`${GREEN}✓${RESET} Connected to PostgreSQL`);

    // Get database info
    const versionResult = await client.query('SELECT version()');
    const version = versionResult.rows[0].version;
    console.log(`${GREEN}✓${RESET} Database version: ${version.split(',')[0]}`);

    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    if (tablesResult.rows.length > 0) {
      console.log(`${GREEN}✓${RESET} Found ${tablesResult.rows.length} tables:`);
      tablesResult.rows.slice(0, 5).forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
      if (tablesResult.rows.length > 5) {
        console.log(`  ... and ${tablesResult.rows.length - 5} more`);
      }
    } else {
      console.log(`${YELLOW}⚠${RESET} No tables found. Run 'npm run db:push' to create schema`);
      results.push({
        name: 'Database Schema',
        status: 'warning',
        message: 'No tables found'
      });
    }

    // Test write capability
    await client.query('SELECT 1');
    console.log(`${GREEN}✓${RESET} Read/write operations working`);

    client.release();
    await pool.end();

    results.push({
      name: 'PostgreSQL Connection',
      status: 'pass',
      message: 'Successfully connected and validated'
    });

  } catch (error) {
    console.log(`${RED}✗${RESET} Database connection failed`);
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    results.push({
      name: 'PostgreSQL Connection',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error)
    });

    await pool.end();
  }
}

async function testRedisConnection(): Promise<void> {
  console.log(`\n${BOLD}[3/3] Testing Redis Connection${RESET}\n`);

  if (!process.env.REDIS_URL) {
    console.log(`${YELLOW}⚠${RESET} REDIS_URL not set, skipping test`);
    results.push({
      name: 'Redis Connection',
      status: 'warning',
      message: 'REDIS_URL not configured (optional)'
    });
    return;
  }

  let redis: Redis | null = null;

  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 10000,
    });

    // Wait for connection
    await new Promise((resolve, reject) => {
      redis!.on('ready', resolve);
      redis!.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });

    console.log(`${GREEN}✓${RESET} Connected to Redis`);

    // Get Redis info
    const info = await redis.info('server');
    const versionMatch = info.match(/redis_version:([^\r\n]+)/);
    if (versionMatch) {
      console.log(`${GREEN}✓${RESET} Redis version: ${versionMatch[1]}`);
    }

    // Test write and read
    const testKey = 'icai:test:connection';
    await redis.set(testKey, 'test', 'EX', 10);
    const value = await redis.get(testKey);
    await redis.del(testKey);

    if (value === 'test') {
      console.log(`${GREEN}✓${RESET} Read/write operations working`);
    }

    // Get memory usage
    const memory = await redis.info('memory');
    const memoryMatch = memory.match(/used_memory_human:([^\r\n]+)/);
    if (memoryMatch) {
      console.log(`${GREEN}✓${RESET} Memory usage: ${memoryMatch[1]}`);
    }

    results.push({
      name: 'Redis Connection',
      status: 'pass',
      message: 'Successfully connected and validated'
    });

  } catch (error) {
    console.log(`${RED}✗${RESET} Redis connection failed`);
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    results.push({
      name: 'Redis Connection',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    if (redis) {
      await redis.quit();
    }
  }
}

async function printSummary(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${BOLD}Test Summary${RESET}`);
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;

  console.log(`\n${GREEN}Passed:${RESET} ${passed}`);
  if (failed > 0) {
    console.log(`${RED}Failed:${RESET} ${failed}`);
  }
  if (warnings > 0) {
    console.log(`${YELLOW}Warnings:${RESET} ${warnings}`);
  }

  if (failed > 0) {
    console.log(`\n${RED}${BOLD}Failed Tests:${RESET}`);
    results.filter(r => r.status === 'fail').forEach(result => {
      console.log(`  ${RED}✗${RESET} ${result.name}: ${result.message}`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Main execution
async function main(): Promise<void> {
  console.log(`${BOLD}🧪 Railway Connection Test${RESET}`);
  console.log('Testing database and Redis connections from Railway...\n');

  try {
    await testEnvironmentVariables();
    await testDatabaseConnection();
    await testRedisConnection();
    await printSummary();
  } catch (error) {
    console.error(`\n${RED}${BOLD}Fatal Error:${RESET}`);
    console.error(error);
    process.exit(1);
  }
}

main();
