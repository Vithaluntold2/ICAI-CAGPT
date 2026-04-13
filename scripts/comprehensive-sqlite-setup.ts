/**
 * Comprehensive SQLite Setup with Proper Schema
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

console.log('🔧 Comprehensive SQLite Setup...\n');

const sqlite = new Database('./local.db');
sqlite.exec('PRAGMA foreign_keys = ON;');

async function setupCompleteDatabase() {
  try {
    console.log('1. Dropping existing tables...');
    sqlite.exec('DROP TABLE IF EXISTS users');
    
    console.log('2. Creating users table with proper schema...');
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        subscription_tier TEXT NOT NULL DEFAULT 'free',
        is_admin INTEGER NOT NULL DEFAULT 0,
        email_verified INTEGER NOT NULL DEFAULT 1,
        email_verified_at TEXT,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        last_failed_login TEXT,
        mfa_enabled INTEGER NOT NULL DEFAULT 0,
        mfa_secret TEXT,
        mfa_backup_codes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('3. Creating admin user...');
    const password = 'password123456';
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const stmt = sqlite.prepare(`
      INSERT INTO users (
        id, email, password, name, subscription_tier, 
        is_admin, email_verified, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      'admin-123-456',
      'admin@sterling.com',
      hashedPassword,
      'Admin User',
      'professional',
      1,
      1,
      new Date().toISOString(),
      new Date().toISOString()
    );
    
    console.log('4. Verifying setup...');
    const user = sqlite.prepare('SELECT * FROM users WHERE email = ?').get('admin@sterling.com');
    const isValid = await bcrypt.compare(password, user.password);
    
    console.log('\n✅ SETUP COMPLETE:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`👤 User: ${user.name}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`⭐ Tier: ${user.subscription_tier}`);
    console.log(`🔐 Admin: ${user.is_admin ? 'Yes' : 'No'}`);
    console.log(`✅ Verified: ${user.email_verified ? 'Yes' : 'No'}`);
    console.log(`🧪 Password Test: ${isValid ? 'VALID' : 'INVALID'}`);
    console.log('═══════════════════════════════════════════════════════');
    
    console.log('\n🎯 Ready to login at http://localhost:3000');
    
  } catch (error) {
    console.error('❌ Setup Error:', error);
  } finally {
    sqlite.close();
  }
}

setupCompleteDatabase();