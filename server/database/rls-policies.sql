-- Row-Level Security Policies for Data Tenancy Isolation

-- Enable RLS on all user-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_quotas ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user ID from session
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
DECLARE
  user_id_text TEXT;
  user_id_uuid UUID;
BEGIN
  -- Get the setting value
  user_id_text := current_setting('app.current_user_id', true);
  
  -- Validate it's not empty and is a valid UUID
  IF user_id_text IS NULL OR user_id_text = '' THEN
    RETURN '00000000-0000-0000-0000-000000000000'::UUID;
  END IF;
  
  -- Validate UUID format to prevent injection
  BEGIN
    user_id_uuid := user_id_text::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid user ID format: %', user_id_text;
  END;
  
  RETURN user_id_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users table - users can only see their own record
CREATE POLICY users_self_policy ON users
  FOR ALL TO authenticated
  USING (id = current_user_id());

-- Profiles table - users can see profiles they own or are members of
CREATE POLICY profiles_access_policy ON profiles
  FOR ALL TO authenticated
  USING (
    user_id = current_user_id() OR
    id IN (
      SELECT profile_id FROM profile_members 
      WHERE user_id = current_user_id()
    )
  );

-- Profile members - users can see memberships for profiles they have access to
CREATE POLICY profile_members_access_policy ON profile_members
  FOR ALL TO authenticated
  USING (
    user_id = current_user_id() OR
    profile_id IN (
      SELECT id FROM profiles 
      WHERE user_id = current_user_id() OR
      id IN (SELECT profile_id FROM profile_members WHERE user_id = current_user_id())
    )
  );

-- Conversations - users can only see their own conversations
CREATE POLICY conversations_user_policy ON conversations
  FOR ALL TO authenticated
  USING (user_id = current_user_id());

-- Documents - users can only see their own documents
CREATE POLICY documents_user_policy ON documents
  FOR ALL TO authenticated
  USING (user_id = current_user_id());

-- Usage quotas - users can only see their own quotas
CREATE POLICY usage_quotas_policy ON usage_quotas
  FOR ALL TO authenticated
  USING (user_id = current_user_id());

-- Admin bypass policies (for admin operations)
CREATE POLICY admin_bypass_users ON users
  FOR ALL TO authenticated
  USING (
    current_user_id() IN (
      SELECT id FROM users WHERE is_admin = true OR is_super_admin = true
    )
  );

CREATE POLICY admin_bypass_profiles ON profiles
  FOR ALL TO authenticated
  USING (
    current_user_id() IN (
      SELECT id FROM users WHERE is_admin = true OR is_super_admin = true
    )
  );