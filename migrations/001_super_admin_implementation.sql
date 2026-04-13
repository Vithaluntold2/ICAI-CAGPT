-- Super Admin Implementation - Manual Migration Script
-- Run this if automated db:push fails or for manual deployment
-- Date: 2026-01-05
-- Version: 2.0 - Added audit logs and improved alerts table

BEGIN;

-- ===================================================================
-- 1. Add isSuperAdmin column to users table
-- ===================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'isSuperAdmin'
  ) THEN
    ALTER TABLE users ADD COLUMN "isSuperAdmin" BOOLEAN DEFAULT false NOT NULL;
    RAISE NOTICE 'Added isSuperAdmin column to users table';
  ELSE
    RAISE NOTICE 'isSuperAdmin column already exists';
  END IF;
END $$;

-- ===================================================================
-- 2. Add cost tracking fields to model_routing_logs
-- ===================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'model_routing_logs' AND column_name = 'tokens_used'
  ) THEN
    ALTER TABLE model_routing_logs ADD COLUMN tokens_used INTEGER;
    RAISE NOTICE 'Added tokens_used column to model_routing_logs';
  ELSE
    RAISE NOTICE 'tokens_used column already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'model_routing_logs' AND column_name = 'cost_usd'
  ) THEN
    ALTER TABLE model_routing_logs ADD COLUMN cost_usd INTEGER;
    RAISE NOTICE 'Added cost_usd column to model_routing_logs';
  ELSE
    RAISE NOTICE 'cost_usd column already exists';
  END IF;
END $$;

-- ===================================================================
-- 3. Create system_alerts table
-- ===================================================================
CREATE TABLE IF NOT EXISTS system_alerts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  type TEXT NOT NULL, -- info|warning|error|critical
  severity TEXT NOT NULL, -- low|medium|high|critical
  source TEXT NOT NULL, -- ai|database|system|security|integration
  source_id TEXT, -- Optional identifier for deduplication
  message TEXT NOT NULL,
  details JSONB,
  acknowledged BOOLEAN DEFAULT false NOT NULL,
  acknowledged_by VARCHAR REFERENCES users(id),
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for system_alerts
CREATE INDEX IF NOT EXISTS idx_system_alerts_acknowledged ON system_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_source ON system_alerts(source);
CREATE INDEX IF NOT EXISTS idx_system_alerts_unique ON system_alerts(source, source_id, message);

RAISE NOTICE 'Created system_alerts table with indexes';

-- ===================================================================
-- 4. Create maintenance_tasks table
-- ===================================================================
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  name TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL, -- backup|cleanup|optimization|update|manual
  schedule TEXT, -- cron expression
  status TEXT NOT NULL, -- scheduled|running|completed|failed|cancelled
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  duration INTEGER, -- seconds
  result JSONB,
  error TEXT,
  created_by VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for maintenance_tasks
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_status ON maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_next_run ON maintenance_tasks(next_run_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_type ON maintenance_tasks(task_type);

RAISE NOTICE 'Created maintenance_tasks table with indexes';

-- ===================================================================
-- 5. Create ai_provider_costs table
-- ===================================================================
CREATE TABLE IF NOT EXISTS ai_provider_costs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  date TIMESTAMP NOT NULL,
  provider TEXT NOT NULL, -- openai|anthropic|azure|google
  model TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  cost_usd INTEGER NOT NULL, -- in cents
  request_count INTEGER DEFAULT 1 NOT NULL,
  user_id VARCHAR REFERENCES users(id),
  subscription_tier TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for ai_provider_costs
CREATE INDEX IF NOT EXISTS idx_ai_provider_costs_date ON ai_provider_costs(date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_provider_costs_provider ON ai_provider_costs(provider);
CREATE INDEX IF NOT EXISTS idx_ai_provider_costs_user ON ai_provider_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_costs_tier ON ai_provider_costs(subscription_tier);

RAISE NOTICE 'Created ai_provider_costs table with indexes';

-- ===================================================================
-- 6. Create audit_logs table (compliance requirement)
-- ===================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  action TEXT NOT NULL, -- action performed
  resource_type TEXT NOT NULL, -- alert|maintenance_task|user|system
  resource_id TEXT, -- ID of affected resource
  details JSONB, -- Action-specific details
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

RAISE NOTICE 'Created audit_logs table with indexes';

-- ===================================================================
-- 7. Set initial super admin user (CUSTOMIZE THIS!)
-- ===================================================================
-- IMPORTANT: Change the email to your actual admin email
DO $$
DECLARE
  admin_email TEXT := 'admin@yourcompany.com'; -- ⚠️ CHANGE THIS!
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count 
  FROM users 
  WHERE email = admin_email;
  
  IF user_count > 0 THEN
    UPDATE users 
    SET "isSuperAdmin" = true 
    WHERE email = admin_email;
    RAISE NOTICE 'Set % as super admin', admin_email;
  ELSE
    RAISE WARNING 'User with email % not found. Please update the script with correct email.', admin_email;
  END IF;
END $$;

-- ===================================================================
-- 8. Verify migration
-- ===================================================================
DO $$
DECLARE
  tables_created INTEGER;
  columns_added INTEGER;
  super_admins INTEGER;
BEGIN
  -- Count new tables
  SELECT COUNT(*) INTO tables_created
  FROM information_schema.tables
  WHERE table_name IN ('system_alerts', 'maintenance_tasks', 'ai_provider_costs', 'audit_logs');
  
  -- Count new columns
  SELECT COUNT(*) INTO columns_added
  FROM information_schema.columns
  WHERE (table_name = 'users' AND column_name = 'isSuperAdmin')
     OR (table_name = 'model_routing_logs' AND column_name IN ('tokens_used', 'cost_usd'))
     OR (table_name = 'system_alerts' AND column_name = 'source_id');
  
  -- Count super admins
  SELECT COUNT(*) INTO super_admins FROM users WHERE "isSuperAdmin" = true;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Migration Complete!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'New tables created: % / 4', tables_created;
  RAISE NOTICE 'New columns added: % / 4', columns_added;
  RAISE NOTICE 'Super admin users: %', super_admins;
  RAISE NOTICE '============================================';
  
  IF tables_created < 4 OR columns_added < 4 THEN
    RAISE WARNING 'Some migrations may have failed. Check logs above.';
  END IF;
  
  IF super_admins = 0 THEN
    RAISE WARNING 'No super admin users set! Update the script with correct email.';
  END IF;
END $$;

COMMIT;

-- ===================================================================
-- Verification Queries (run after migration)
-- ===================================================================
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%alert%' OR table_name LIKE '%maintenance%' OR table_name LIKE '%provider_cost%';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'isSuperAdmin';
-- SELECT id, email, "isAdmin", "isSuperAdmin" FROM users WHERE "isSuperAdmin" = true;
