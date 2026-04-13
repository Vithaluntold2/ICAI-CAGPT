/**
 * Manual database migration script
 * Run with: npx tsx migrate-db.ts
 */

import { db, client } from './server/db';
import { sql } from 'drizzle-orm';
import * as schema from './shared/schema';

async function migrate() {
  console.log('🔄 Starting database migration...\n');

  try {
    // Test connection
    console.log('📡 Testing connection...');
    const testResult = await db.execute(sql`SELECT current_database(), current_user, version()`);
    console.log('✅ Connected to database:', testResult[0]);
    console.log('');

    // Create users table
    console.log('📋 Creating users table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT,
        subscription_tier TEXT DEFAULT 'free',
        is_admin BOOLEAN DEFAULT false,
        mfa_enabled BOOLEAN DEFAULT false,
        mfa_secret TEXT,
        mfa_backup_codes JSONB,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    // Create conversations table
    console.log('📋 Creating conversations table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT,
        chat_mode TEXT DEFAULT 'standard',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Conversations table created');

    // Create messages table
    console.log('📋 Creating messages table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        attachments JSONB,
        reasoning_trace JSONB,
        ai_provider TEXT,
        model_used TEXT,
        tokens_used INTEGER,
        quality_score REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Messages table created');

    // Create uploaded_files table
    console.log('📋 Creating uploaded_files table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        storage_path TEXT NOT NULL,
        encryption_key TEXT,
        virus_scan_status TEXT DEFAULT 'pending',
        virus_scan_result TEXT,
        extracted_text TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Uploaded files table created');

    // Create integrations table
    console.log('📋 Creating integrations table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_expiry TIMESTAMP,
        metadata JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, provider)
      )
    `);
    console.log('✅ Integrations table created');

    // Create indexes
    console.log('📋 Creating indexes...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id ON uploaded_files(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id)`);
    console.log('✅ Indexes created');

    console.log('\n✨ Migration completed successfully!\n');
    
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error);
    await client.end();
    process.exit(1);
  }
}

migrate();
