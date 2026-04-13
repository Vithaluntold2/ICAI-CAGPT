/**
 * Quick Check Users Script
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

async function checkUsers() {
  try {
    const result = await pool.query(
      'SELECT id, email, name, subscription_tier, is_admin FROM users LIMIT 10'
    );
    
    console.log('📋 Existing users in database:\n');
    
    if (result.rows.length === 0) {
      console.log('❌ No users found in database');
    } else {
      result.rows.forEach(user => {
        console.log(`✅ ${user.name} (${user.email})`);
        console.log(`   - Tier: ${user.subscription_tier}`);
        console.log(`   - Admin: ${user.is_admin}`);
        console.log('   - Password: [Check original seed or use password123]\n');
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
  } finally {
    await pool.end();
  }
}

checkUsers();