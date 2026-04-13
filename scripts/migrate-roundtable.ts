import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS roundtable_sessions (
        id VARCHAR PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        query TEXT NOT NULL,
        workflow_id VARCHAR NOT NULL DEFAULT 'default-roundtable',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        progress INTEGER NOT NULL DEFAULT 0,
        current_agent VARCHAR(100),
        agent_outputs JSONB DEFAULT '{}',
        final_result JSONB,
        error TEXT,
        error_code VARCHAR(50),
        error_details JSONB,
        successful_agents JSONB DEFAULT '[]',
        failed_agents JSONB DEFAULT '[]',
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP,
        conversation_id VARCHAR
      )
    `);
    console.log('✅ Table roundtable_sessions created');
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS roundtable_sessions_user_id_idx ON roundtable_sessions(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS roundtable_sessions_status_idx ON roundtable_sessions(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS roundtable_sessions_started_at_idx ON roundtable_sessions(started_at)`);
    console.log('✅ Indexes created');
    
    console.log('Migration complete!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
