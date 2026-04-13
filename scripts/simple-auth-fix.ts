/**
 * Simple Auth Fix - Just reset password
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

async function simpleAuthFix() {
  try {
    console.log('🔧 Simple Authentication Fix...\n');
    
    // Check actual table structure first
    const columns = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'users' ORDER BY ordinal_position`
    );
    
    console.log('📋 Available columns:', columns.rows.map(r => r.column_name).join(', '));
    
    // Use a longer password
    const newPassword = 'password123456';
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    console.log(`🔒 New password: ${newPassword} (${newPassword.length} characters)\n`);
    
    // Simple update - just password and email_verified
    const result = await pool.query(`
      UPDATE users 
      SET 
        password = $1,
        email_verified = true,
        updated_at = NOW()
      WHERE email = $2 
      RETURNING email, username, email_verified
    `, [hashedPassword, 'admin@sterling.com']);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ SUCCESS! Updated user:');
      console.log(`   👤 Username: ${user.username}`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   ✔️ Verified: ${user.email_verified}`);
      console.log(`   🔑 Password: ${newPassword}`);
    }
    
    // Verify password works
    const isValid = await bcrypt.compare(newPassword, hashedPassword);
    console.log(`\n🧪 Password verification: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    
    console.log('\n🎯 LOGIN CREDENTIALS:');
    console.log('══════════════════════════════════════');
    console.log('📧 Email: admin@sterling.com');
    console.log(`🔑 Password: ${newPassword}`);
    console.log('══════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

simpleAuthFix();