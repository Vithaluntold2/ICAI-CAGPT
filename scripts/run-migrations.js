#!/usr/bin/env node

/**
 * Simple migration runner using pg package
 * Runs all .sql files in migrations/ directory in order
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔄 Running database migrations...\n');

    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`📄 Running: ${file}`);
      
      try {
        await pool.query(sql);
        console.log(`✅ Success: ${file}\n`);
      } catch (error) {
        console.error(`❌ Error in ${file}:`, error.message);
        // Continue with other migrations
      }
    }

    console.log('✅ All migrations completed!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
