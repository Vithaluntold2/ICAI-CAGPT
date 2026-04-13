/**
 * Comprehensive Auth Fix - Reset everything for clean login
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

async function comprehensiveFix() {
  try {
    console.log('🔧 Comprehensive Authentication Fix...\n');
    
    // Use a longer, stronger password
    const newPassword = 'password123456';
    const hashedPassword = await bcrypt.hash(newPassword, 12); // Higher salt rounds
    
    console.log('🔒 Creating strong password hash...');
    console.log(`   New password: ${newPassword} (${newPassword.length} characters)`);
    
    // Fix multiple users with comprehensive reset
    const emails = ['admin@sterling.com', 'superadmin@accute.com', 'employee@sterling.com'];
    
    for (const email of emails) {
      console.log(`\n👤 Fixing user: ${email}`);
      
      // Reset password, email verification, failed attempts, and unlock account
      const result = await pool.query(`
        UPDATE users 
        SET 
          password = $1,
          email_verified = true,
          failed_login_attempts = 0,
          locked_until = NULL,
          updated_at = NOW()
        WHERE email = $2 
        RETURNING email, username, email_verified, failed_login_attempts
      `, [hashedPassword, email]);
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        console.log(`   ✅ Updated: ${user.username} (${user.email})`);
        console.log(`   📧 Email verified: ${user.email_verified}`);
        console.log(`   🔓 Failed attempts: ${user.failed_login_attempts}`);
        console.log(`   🔑 Password: ${newPassword}`);
      } else {
        console.log(`   ❌ User not found: ${email}`);
      }
    }
    
    // Verify the password hash works
    console.log('\n🧪 Testing password verification...');
    const testVerify = await bcrypt.compare(newPassword, hashedPassword);
    console.log(`   Hash test: ${testVerify ? '✅ VALID' : '❌ INVALID'}`);
    
    // Show final credentials
    console.log('\n🎯 READY TO LOGIN:');
    console.log('══════════════════════════════════════');
    console.log('📧 Email: admin@sterling.com');
    console.log(`🔑 Password: ${newPassword}`);
    console.log('✨ Status: Email verified, account unlocked');
    console.log('══════════════════════════════════════');
    
    console.log('\n💡 Alternative options:');
    console.log('📧 superadmin@accute.com');
    console.log('📧 employee@sterling.com');
    console.log(`🔑 Same password: ${newPassword}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

comprehensiveFix();