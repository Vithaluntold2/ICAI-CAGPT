-- Security Enhancement Migration
-- Adds audit logging, enterprise domains, and security tables

-- Audit logging table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security audit log for high-severity events
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id),
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enterprise domains for SSO configuration
CREATE TABLE IF NOT EXISTS enterprise_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) NOT NULL UNIQUE,
  organization_name VARCHAR(255) NOT NULL,
  sso_enabled BOOLEAN DEFAULT false,
  saml_issuer VARCHAR(500),
  saml_entry_point VARCHAR(500),
  saml_cert TEXT,
  auto_provision BOOLEAN DEFAULT true,
  default_role VARCHAR(50) DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions table for better session management
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add auth provider and external ID to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local',
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add enterprise restrictions to feature flags
ALTER TABLE feature_flags 
ADD COLUMN IF NOT EXISTS enterprise_only BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON security_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_severity ON security_audit_log(severity);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);

CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
CREATE INDEX IF NOT EXISTS idx_users_external_id ON users(external_id);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);

-- Update RLS policies to handle soft deletes
DROP POLICY IF EXISTS users_self_policy ON users;
CREATE POLICY users_self_policy ON users
  FOR ALL TO authenticated
  USING (id = current_user_id() AND deleted_at IS NULL);

-- Add enterprise domain validation function
CREATE OR REPLACE FUNCTION validate_enterprise_domain(email TEXT) 
RETURNS BOOLEAN AS $$
DECLARE
  domain TEXT;
  domain_exists BOOLEAN;
BEGIN
  domain := split_part(email, '@', 2);
  
  SELECT EXISTS(
    SELECT 1 FROM enterprise_domains 
    WHERE domain = validate_enterprise_domain.domain 
    AND sso_enabled = true
  ) INTO domain_exists;
  
  RETURN domain_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() 
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert default enterprise features
INSERT INTO feature_flags (feature_name, enabled_plans, enterprise_only, description) VALUES
('sso_saml', ARRAY['enterprise'], true, 'SAML-based Single Sign-On'),
('advanced_audit', ARRAY['professional', 'enterprise'], false, 'Comprehensive audit logging'),
('data_export', ARRAY['plus', 'professional', 'enterprise'], false, 'Bulk data export capabilities'),
('api_access', ARRAY['professional', 'enterprise'], false, 'REST API access'),
('white_labeling', ARRAY['enterprise'], true, 'Custom branding and white-label options')
ON CONFLICT (feature_name) DO NOTHING;

-- Update EasyLoans feature flag
UPDATE feature_flags 
SET description = 'Access to EasyLoans loan matching platform'
WHERE feature_name = 'easyloans';

-- Add compliance tracking
CREATE TABLE IF NOT EXISTS compliance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL, -- 'data_request', 'data_export', 'data_deletion', 'consent_given', 'consent_withdrawn'
  details JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_events_user_id ON compliance_events(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_event_type ON compliance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_compliance_events_processed ON compliance_events(processed);

-- GDPR compliance functions
CREATE OR REPLACE FUNCTION request_data_export(user_id_param UUID)
RETURNS UUID AS $$
DECLARE
  request_id UUID;
BEGIN
  INSERT INTO compliance_events (user_id, event_type, details)
  VALUES (user_id_param, 'data_request', '{"type": "export", "status": "pending"}')
  RETURNING id INTO request_id;
  
  RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION request_data_deletion(user_id_param UUID)
RETURNS UUID AS $$
DECLARE
  request_id UUID;
BEGIN
  INSERT INTO compliance_events (user_id, event_type, details)
  VALUES (user_id_param, 'data_deletion', '{"type": "deletion", "status": "pending"}')
  RETURNING id INTO request_id;
  
  RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;