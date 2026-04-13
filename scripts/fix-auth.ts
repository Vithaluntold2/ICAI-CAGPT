/**
 * Fix Authentication - Reset password for existing user
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

const pool = new Pool({ connectionString: DATABASE_URL });

async function fixAuth() {
  try {
    // Hash the password
    const password = 'test123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log('🔧 Fixing authentication...\n');
    
    // Update admin@sterling.com password
    const result1 = await pool.query(
      'UPDATE users SET password = $1 WHERE email = $2 RETURNING email',
      [hashedPassword, 'admin@sterling.com']
    );
    
    // Update superadmin@accute.com password  
    const result2 = await pool.query(
      'UPDATE users SET password = $1 WHERE email = $2 RETURNING email',
      [hashedPassword, 'superadmin@accute.com']
    );
    
    console.log('✅ Fixed credentials:');
    if (result1.rows.length > 0) {
      console.log(`   📧 ${result1.rows[0].email} - Password: test123`);
    }
    if (result2.rows.length > 0) {
      console.log(`   📧 ${result2.rows[0].email} - Password: test123`);
    }
    
    // Test the hash
    console.log('\n🧪 Verifying password hash...');
    const isValid = await bcrypt.compare('test123', hashedPassword);
    console.log(`   Hash verification: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    
    console.log('\n🎯 Try logging in with:');
    console.log('   📧 Email: admin@sterling.com');
    console.log('   🔑 Password: test123');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixAuth();