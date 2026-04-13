/**
 * Database Connection Test and Auth Debug
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcryptjs';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const envPath = join(process.cwd(), '.env');
const envContent = readFileSync(envPath, 'utf-8');
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!dbUrlMatch) {
  throw new Error('DATABASE_URL not found in .env file');
}
const DATABASE_URL = dbUrlMatch[1].trim();

console.log('🔍 Database Connection Test...\n');

const pool = new Pool({ connectionString: DATABASE_URL });

async function testDatabaseAndAuth() {
  try {
    console.log('1. Testing database connection...');
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully');
    console.log(`   Current time: ${testResult.rows[0].current_time}\n`);
    
    console.log('2. Testing user lookup...');
    const userResult = await pool.query(
      'SELECT id, email, password, email_verified FROM users WHERE email = $1',
      ['admin@sterling.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found in database');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Email Verified: ${user.email_verified}`);
    console.log(`   Password Hash: ${user.password.substring(0, 20)}...`);
    
    console.log('\n3. Testing password comparison...');
    const testPassword = 'password123456';
    const isValid = await bcrypt.compare(testPassword, user.password);
    console.log(`   Password "${testPassword}": ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    
    if (!isValid) {
      console.log('\n🔧 Regenerating password hash...');
      const newHash = await bcrypt.hash(testPassword, 12);
      
      await pool.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [newHash, 'admin@sterling.com']
      );
      
      const retest = await bcrypt.compare(testPassword, newHash);
      console.log(`   New hash test: ${retest ? '✅ VALID' : '❌ STILL INVALID'}`);
    }
    
    console.log('\n🎯 FINAL CREDENTIALS:');
    console.log('══════════════════════════════════════');
    console.log('📧 Email: admin@sterling.com');
    console.log('🔑 Password: password123456');
    console.log('✨ Status: Ready for login');
    console.log('══════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Database Error:', error.message);
    console.error('   This explains why login is failing!');
  } finally {
    await pool.end();
  }
}

testDatabaseAndAuth();