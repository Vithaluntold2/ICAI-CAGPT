/**
 * Setup Database Tables
 * Run with: npx tsx scripts/setup-database.ts
 * 
 * This creates all tables directly using SQL commands
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 30000,
});

const CREATE_TABLES_SQL = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  is_admin BOOLEAN NOT NULL DEFAULT false,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP,
  last_failed_login TIMESTAMP,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  mfa_secret TEXT,
  mfa_backup_codes TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Profile members table
CREATE TABLE IF NOT EXISTS profile_members (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id VARCHAR NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  relationship TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id VARCHAR REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  metadata TEXT,
  preview TEXT,
  pinned BOOLEAN NOT NULL DEFAULT false,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  shared_token VARCHAR UNIQUE,
  quality_score INTEGER,
  resolved BOOLEAN DEFAULT false,
  user_feedback TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model_used TEXT,
  routing_decision JSONB,
  calculation_results JSONB,
  metadata JSONB,
  tokens_used INTEGER,
  excel_filename TEXT,
  excel_buffer TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Model routing logs table
CREATE TABLE IF NOT EXISTS model_routing_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  query_classification JSONB NOT NULL,
  selected_model TEXT NOT NULL,
  routing_reason TEXT,
  confidence INTEGER,
  alternative_models JSONB,
  processing_time_ms INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  queries_used INTEGER NOT NULL DEFAULT 0,
  documents_analyzed INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User LLM config table
CREATE TABLE IF NOT EXISTS user_llm_config (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL DEFAULT 'openai',
  api_key TEXT,
  model_name TEXT,
  endpoint TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT,
  assigned_to VARCHAR REFERENCES users(id),
  resolution TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Ticket messages table
CREATE TABLE IF NOT EXISTS ticket_messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id VARCHAR,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Accounting integrations table
CREATE TABLE IF NOT EXISTS accounting_integrations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMP,
  company_id TEXT,
  company_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- GDPR consents table
CREATE TABLE IF NOT EXISTS gdpr_consents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  consented BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tax file uploads table
CREATE TABLE IF NOT EXISTS tax_file_uploads (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  encryption_nonce TEXT NOT NULL,
  encrypted_file_key TEXT NOT NULL,
  checksum TEXT NOT NULL,
  scan_status TEXT NOT NULL DEFAULT 'pending',
  scan_details JSONB,
  form_type TEXT,
  import_status TEXT NOT NULL DEFAULT 'pending',
  import_details JSONB,
  imported_at TIMESTAMP,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Conversation analytics table
CREATE TABLE IF NOT EXISTS conversation_analytics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id VARCHAR NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quality_score INTEGER,
  response_relevance_score INTEGER,
  completeness_score INTEGER,
  clarity_score INTEGER,
  total_messages INTEGER NOT NULL DEFAULT 0,
  average_response_time INTEGER,
  conversation_duration INTEGER,
  was_abandoned BOOLEAN NOT NULL DEFAULT false,
  abandonment_point INTEGER,
  follow_up_question_count INTEGER NOT NULL DEFAULT 0,
  clarification_request_count INTEGER NOT NULL DEFAULT 0,
  user_frustration_detected BOOLEAN NOT NULL DEFAULT false,
  resolution_achieved BOOLEAN,
  topics_discussed JSONB,
  domain_categories JSONB,
  complexity_level TEXT,
  provider_used TEXT,
  model_switch_count INTEGER NOT NULL DEFAULT 0,
  fallback_triggered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Message analytics table
CREATE TABLE IF NOT EXISTS message_analytics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id VARCHAR NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_sentiment TEXT,
  sentiment_score INTEGER,
  emotional_tone JSONB,
  response_quality INTEGER,
  accuracy_score INTEGER,
  helpfulness_score INTEGER,
  user_intent TEXT,
  intent_confidence INTEGER,
  response_length INTEGER,
  technical_complexity TEXT,
  contains_calculations BOOLEAN NOT NULL DEFAULT false,
  contains_citations BOOLEAN NOT NULL DEFAULT false,
  processing_time INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User behavior patterns table
CREATE TABLE IF NOT EXISTS user_behavior_patterns (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_conversations INTEGER NOT NULL DEFAULT 0,
  average_conversation_length INTEGER,
  average_session_duration INTEGER,
  preferred_time_of_day TEXT,
  peak_usage_days JSONB,
  top_topics JSONB,
  domain_expertise JSONB,
  average_quality_score INTEGER,
  satisfaction_trend TEXT,
  churn_risk TEXT,
  churn_risk_score INTEGER,
  frustration_frequency INTEGER NOT NULL DEFAULT 0,
  abandonment_rate INTEGER,
  follow_up_rate INTEGER,
  next_likely_question TEXT,
  next_likely_topic TEXT,
  predicted_return_date TIMESTAMP,
  engagement_score INTEGER,
  potential_upsell_candidate BOOLEAN NOT NULL DEFAULT false,
  last_analyzed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Sentiment trends table
CREATE TABLE IF NOT EXISTS sentiment_trends (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TIMESTAMP NOT NULL,
  average_sentiment_score INTEGER,
  positive_message_count INTEGER NOT NULL DEFAULT 0,
  neutral_message_count INTEGER NOT NULL DEFAULT 0,
  negative_message_count INTEGER NOT NULL DEFAULT 0,
  frustrated_message_count INTEGER NOT NULL DEFAULT 0,
  average_quality_score INTEGER,
  conversation_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Vector embeddings table
CREATE TABLE IF NOT EXISTS vector_embeddings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  document_type TEXT NOT NULL,
  source TEXT,
  jurisdiction TEXT,
  effective_date TIMESTAMP,
  expiry_date TIMESTAMP,
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Knowledge nodes table
CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type TEXT NOT NULL,
  label TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  source TEXT,
  confidence REAL DEFAULT 1.0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Knowledge edges table
CREATE TABLE IF NOT EXISTS knowledge_edges (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id VARCHAR NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  to_node_id VARCHAR NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Regulatory alerts table
CREATE TABLE IF NOT EXISTS regulatory_alerts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_content TEXT,
  source TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  effective_date TIMESTAMP,
  external_url TEXT,
  perplexity_query TEXT,
  is_processed BOOLEAN NOT NULL DEFAULT false,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Scenario playbooks table
CREATE TABLE IF NOT EXISTS scenario_playbooks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id VARCHAR REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  baseline_config JSONB NOT NULL,
  is_template BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Scenario variants table
CREATE TABLE IF NOT EXISTS scenario_variants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id VARCHAR NOT NULL REFERENCES scenario_playbooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_baseline BOOLEAN NOT NULL DEFAULT false,
  assumptions JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Scenario runs table
CREATE TABLE IF NOT EXISTS scenario_runs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id VARCHAR NOT NULL REFERENCES scenario_variants(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  solvers_used JSONB,
  model_used TEXT,
  provider_used TEXT,
  results_snapshot JSONB,
  error_details JSONB,
  processing_time_ms INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Scenario metrics table
CREATE TABLE IF NOT EXISTS scenario_metrics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR NOT NULL REFERENCES scenario_runs(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  metric_category TEXT,
  numeric_value INTEGER,
  percentage_value INTEGER,
  currency_value INTEGER,
  details_json JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Scenario comparisons table
CREATE TABLE IF NOT EXISTS scenario_comparisons (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id VARCHAR NOT NULL REFERENCES scenario_playbooks(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  left_run_id VARCHAR NOT NULL REFERENCES scenario_runs(id) ON DELETE CASCADE,
  right_run_id VARCHAR NOT NULL REFERENCES scenario_runs(id) ON DELETE CASCADE,
  comparison_snapshot JSONB NOT NULL,
  title TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Scenario shares table
CREATE TABLE IF NOT EXISTS scenario_shares (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id VARCHAR REFERENCES scenario_playbooks(id) ON DELETE CASCADE,
  comparison_id VARCHAR REFERENCES scenario_comparisons(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_token VARCHAR NOT NULL UNIQUE,
  expires_at TIMESTAMP,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Scenario conversation links table
CREATE TABLE IF NOT EXISTS scenario_conversation_links (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id VARCHAR NOT NULL REFERENCES scenario_playbooks(id) ON DELETE CASCADE,
  conversation_id VARCHAR NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Session table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");

-- Create important indexes
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles(user_id);
CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations(user_id);
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);

SELECT 'All tables created successfully!' as result;
`;

async function main() {
  console.log('🚀 Setting up database tables...\n');
  
  try {
    // Test connection
    const testResult = await pool.query('SELECT NOW() as time');
    console.log('✅ Connected to database at:', testResult.rows[0].time);
    
    // Create tables
    console.log('\n📦 Creating tables...');
    await pool.query(CREATE_TABLES_SQL);
    
    // Verify tables were created
    const tablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`\n✅ Created ${tablesResult.rows.length} tables:`);
    tablesResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.table_name}`);
    });
    
    console.log('\n✅ Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
