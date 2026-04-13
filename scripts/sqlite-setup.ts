/**
 * SQLite Auth Setup
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

console.log('🔧 Setting up SQLite authentication...\n');

const sqlite = new Database('./local.db');
const db = drizzle(sqlite, { schema: { users } });

async function setupSQLiteAuth() {
  try {
    console.log('1. Creating users table...');
    
    // Create the table if it doesn't exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        country_code TEXT,
        email_verified INTEGER DEFAULT 1,
        email_verified_at DATETIME,
        email_verification_token TEXT,
        email_verification_token_expiry DATETIME,
        password_reset_token TEXT,
        password_reset_token_expiry DATETIME,
        phone_verified INTEGER DEFAULT 0,
        phone_verified_at DATETIME,
        avatar_url TEXT,
        date_of_birth DATETIME,
        national_id TEXT,
        national_id_type TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip_code TEXT,
        country TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        emergency_contact_relation TEXT,
        id_document_url TEXT,
        address_proof_url TEXT,
        kyc_status TEXT DEFAULT 'pending',
        kyc_verified_at DATETIME,
        kyc_rejection_reason TEXT,
        role_id TEXT,
        organization_id TEXT,
        default_organization_id TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Users table created/exists');
    
    console.log('2. Creating admin user...');
    const password = 'password123456';
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Insert admin user
    sqlite.exec(`
      INSERT OR REPLACE INTO users (
        id, username, email, password, first_name, last_name,
        email_verified, role_id, is_active, created_at, updated_at
      ) VALUES (
        'admin-123', 'admin', 'admin@sterling.com', 
        '${hashedPassword}', 'Admin', 'User',
        1, 'admin-role', 1, 
        datetime('now'), datetime('now')
      )
    `);
    
    console.log('✅ Admin user created');
    
    // Verify
    const testUser = sqlite.prepare('SELECT * FROM users WHERE email = ?').get('admin@sterling.com');
    const isValid = await bcrypt.compare(password, testUser.password);
    
    console.log('\n🎯 CREDENTIALS READY:');
    console.log('══════════════════════════════════════');
    console.log('📧 Email: admin@sterling.com');
    console.log(`🔑 Password: ${password}`);
    console.log(`✅ Password test: ${isValid ? 'VALID' : 'INVALID'}`);
    console.log('💾 Database: SQLite (local.db)');
    console.log('══════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    sqlite.close();
  }
}

setupSQLiteAuth();