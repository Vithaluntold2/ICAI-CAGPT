/**
 * Database Schema Inspector
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const envPath = join(process.cwd(), '.env');
const envContent = readFileSync(envPath, 'utf-8');
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!dbUrlMatch) {
  throw new Error('DATABASE_URL not found in .env file');
}
const DATABASE_URL = dbUrlMatch[1].trim();

const pool = new Pool({ connectionString: DATABASE_URL });

async function inspectSchema() {
  try {
    // Get users table structure
    const result = await pool.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = 'users'
       ORDER BY ordinal_position`
    );
    
    console.log('📋 Actual users table structure:');
    result.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });
    
    // Get sample data without name column
    const users = await pool.query(
      'SELECT id, email, subscription_tier, is_admin FROM users LIMIT 10'
    );
    
    console.log('\n👥 Existing users:');
    
    if (users.rows.length === 0) {
      console.log('❌ No users found');
    } else {
      users.rows.forEach(user => {
        console.log(`✅ ${user.email}`);
        console.log(`   - ID: ${user.id}`);
        console.log(`   - Tier: ${user.subscription_tier}`);
        console.log(`   - Admin: ${user.is_admin}\n`);
      });
      
      console.log('💡 Try these credentials:');
      users.rows.forEach(user => {
        console.log(`   Email: ${user.email}`);
        console.log(`   Password: password123 (or check original seed script)\n`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

inspectSchema();