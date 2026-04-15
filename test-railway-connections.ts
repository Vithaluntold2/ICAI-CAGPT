#!/usr/bin/env tsx
/**
 * Railway Connection Test Script
 * Tests connections to PostgreSQL, Redis, and validates environment variables
 */

import postgres from 'postgres';
import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.railway' });

interface TestResult {
  service: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function addResult(service: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any) {
  results.push({ service, status, message, details });
  const color = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
  log(`[${status}] ${service}: ${message}`, color);
}

// Test Environment Variables
async function testEnvironmentVariables() {
  log('\n🔍 Testing Environment Variables...', 'cyan');
  
  const requiredVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'AZURE_OPENAI_API_KEY',
    'ENCRYPTION_KEY',
    'SESSION_SECRET',
    'PORT',
    'NODE_ENV',
  ];

  const optionalVars = [
    'AZURE_EMBEDDING_API_KEY',
    'AZURE_SEARCH_API_KEY',
    'MICROSOFT_CLIENT_ID',
  ];

  let allPresent = true;

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      addResult('Environment', 'FAIL', `Missing required variable: ${varName}`);
      allPresent = false;
    } else {
      const preview = process.env[varName]!.length > 50 
        ? process.env[varName]!.substring(0, 30) + '...' 
        : process.env[varName]!;
      addResult('Environment', 'PASS', `${varName} = ${preview}`);
    }
  }

  for (const varName of optionalVars) {
    if (!process.env[varName]) {
      addResult('Environment', 'WARN', `Optional variable not set: ${varName}`);
    } else {
      addResult('Environment', 'PASS', `${varName} configured`);
    }
  }

  return allPresent;
}

// Test PostgreSQL Connection
async function testPostgreSQL() {
  log('\n🐘 Testing PostgreSQL Connection...', 'cyan');
  
  if (!process.env.DATABASE_URL) {
    addResult('PostgreSQL', 'FAIL', 'DATABASE_URL not set');
    return false;
  }

  const sql = postgres(process.env.DATABASE_URL, {
    ssl: process.env.DB_SSL === 'true' ? 'require' : false,
  });

  try {
    // Test basic connection
    const versionResult = await sql`SELECT version()`;
    const version = versionResult[0].version.split(' ')[1];
    addResult('PostgreSQL', 'PASS', 'Connection established');
    addResult('PostgreSQL', 'PASS', `Version: ${version}`);

    // Test database name
    const dbNameResult = await sql`SELECT current_database()`;
    const dbName = dbNameResult[0].current_database;
    addResult('PostgreSQL', 'PASS', `Database: ${dbName}`);

    // Test connection count
    const connResult = await sql`
      SELECT count(*) as connections 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;
    const connections = connResult[0].connections;
    addResult('PostgreSQL', 'PASS', `Active connections: ${connections}`);

    // List tables
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    const tables = tablesResult.map(r => r.table_name);
    addResult('PostgreSQL', 'PASS', `Tables found: ${tables.length}`, { tables });

    await sql.end();
    return true;
  } catch (error: any) {
    addResult('PostgreSQL', 'FAIL', error.message, { error: error.stack });
    await sql.end({ timeout: 1 });
    return false;
  }
}

// Test Redis Connection
async function testRedis() {
  log('\n🔴 Testing Redis Connection...', 'cyan');
  
  if (!process.env.REDIS_URL) {
    addResult('Redis', 'FAIL', 'REDIS_URL not set');
    return false;
  }

  const client = new Redis(process.env.REDIS_URL);

  try {
    // Test PING
    const pong = await client.ping();
    addResult('Redis', 'PASS', 'Connection established');
    addResult('Redis', 'PASS', `PING response: ${pong}`);

    // Get server info
    const info = await client.info('server');
    const versionMatch = info.match(/redis_version:([^\r\n]+)/);
    if (versionMatch) {
      addResult('Redis', 'PASS', `Version: ${versionMatch[1]}`);
    }

    // Test SET/GET
    const testKey = 'railway:test:connection';
    await client.set(testKey, 'Connected at ' + new Date().toISOString(), 'EX', 60);
    const testValue = await client.get(testKey);
    addResult('Redis', 'PASS', `Write/Read test: ${testValue}`);

    // Get key count
    const dbSize = await client.dbsize();
    addResult('Redis', 'PASS', `Keys in database: ${dbSize}`);

    await client.quit();
    return true;
  } catch (error: any) {
    addResult('Redis', 'FAIL', error.message, { error: error.stack });
    try {
      await client.quit();
    } catch (e) {
      // Ignore disconnect errors
    }
    return false;
  }
}

// Test Railway metadata
async function testRailwayMetadata() {
  log('\n🚂 Testing Railway Metadata...', 'cyan');
  
  const railwayVars = {
    'Project': process.env.RAILWAY_PROJECT_NAME,
    'Project ID': process.env.RAILWAY_PROJECT_ID,
    'Environment': process.env.RAILWAY_ENVIRONMENT_NAME,
    'Service': process.env.RAILWAY_SERVICE_NAME,
    'Public Domain': process.env.RAILWAY_PUBLIC_DOMAIN,
    'Private Domain': process.env.RAILWAY_PRIVATE_DOMAIN,
  };

  for (const [key, value] of Object.entries(railwayVars)) {
    if (value) {
      addResult('Railway Meta', 'PASS', `${key}: ${value}`);
    } else {
      addResult('Railway Meta', 'WARN', `${key} not set`);
    }
  }
}

// Main test runner
async function runTests() {
  log('╔═══════════════════════════════════════════════════════╗', 'blue');
  log('║     Railway Connection Test - ICAI-CAGPT             ║', 'blue');
  log('╚═══════════════════════════════════════════════════════╝', 'blue');
  
  const startTime = Date.now();

  // Run all tests
  await testEnvironmentVariables();
  await testRailwayMetadata();
  await testPostgreSQL();
  await testRedis();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Summary
  log('\n' + '═'.repeat(60), 'blue');
  log('📊 Test Summary', 'cyan');
  log('═'.repeat(60), 'blue');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;

  log(`✅ Passed:   ${passed}`, 'green');
  log(`❌ Failed:   ${failed}`, 'red');
  log(`⚠️  Warnings: ${warnings}`, 'yellow');
  log(`⏱️  Duration: ${duration}s`, 'blue');

  // Save detailed results to file
  const reportPath = './railway-connection-test-results.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    duration: duration + 's',
    summary: { passed, failed, warnings },
    results,
  }, null, 2));
  
  log(`\n📄 Detailed results saved to: ${reportPath}`, 'cyan');

  // Exit with appropriate code
  if (failed > 0) {
    log('\n❌ Some tests failed!', 'red');
    process.exit(1);
  } else if (warnings > 0) {
    log('\n⚠️  All critical tests passed with warnings', 'yellow');
    process.exit(0);
  } else {
    log('\n✅ All tests passed!', 'green');
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  log('\n💥 Fatal error running tests:', 'red');
  console.error(error);
  process.exit(1);
});
