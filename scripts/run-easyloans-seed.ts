/**
 * Run EasyLoans seed data migration
 * Usage: npx tsx scripts/run-easyloans-seed.ts
 */

import { readFileSync } from 'fs';
import { Pool } from 'pg';
import path from 'path';

async function runSeed() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    
    console.log('📄 Reading migration file...');
    const migrationPath = path.join(process.cwd(), 'migrations', '012_easyloans_seed_data.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    console.log('🚀 Running EasyLoans seed data migration...');
    await client.query(sql);
    
    console.log('✅ Seed data inserted successfully!');
    console.log('   - 6 lenders (HDFC, ICICI, SBI, Axis, Bajaj, Tata)');
    console.log('   - 12 loan products across categories');
    console.log('   - Eligibility criteria and rate slabs');
    
    client.release();
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) console.error('   Detail:', error.detail);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSeed();
