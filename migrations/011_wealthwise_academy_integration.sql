-- STACK FEATURE INTEGRATION
-- File: migrations/011_stack_integration.sql

-- Add Stack to subscription features
UPDATE usage_quotas 
SET 
  stack_lessons_limit = CASE 
    WHEN plan = 'free' THEN 5
    WHEN plan = 'plus' THEN -1  -- unlimited
    WHEN plan = 'professional' THEN -1  -- unlimited
    WHEN plan = 'enterprise' THEN -1  -- unlimited
    ELSE 0
  END,
  stack_lessons_used = 0
WHERE stack_lessons_limit IS NULL;

-- Add column if it doesn't exist
ALTER TABLE usage_quotas 
ADD COLUMN IF NOT EXISTS stack_lessons_limit INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stack_lessons_used INTEGER DEFAULT 0;

-- Update feature flags for Stack
INSERT INTO feature_flags (feature_name, is_enabled, allowed_plans, description) 
VALUES (
  'stack',
  true,
  '["free", "plus", "professional", "enterprise"]',
  'AI-powered adaptive finance learning - Get addicted to stacking wealth'
) ON CONFLICT (feature_name) DO UPDATE SET
  is_enabled = true,
  allowed_plans = '["free", "plus", "professional", "enterprise"]';

-- Add Stack permissions
INSERT INTO permissions (name, description, resource, action) VALUES
('stack.access', 'Access Stack', 'stack', 'read'),
('stack.progress', 'Track learning progress', 'stack', 'write'),
('stack.achievements', 'Earn achievements and badges', 'stack', 'write')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions to all subscription tiers
INSERT INTO role_permissions (role_name, permission_name) VALUES
('free_user', 'stack.access'),
('free_user', 'stack.progress'),
('free_user', 'stack.achievements'),
('plus_user', 'stack.access'),
('plus_user', 'stack.progress'),
('plus_user', 'stack.achievements'),
('professional_user', 'stack.access'),
('professional_user', 'stack.progress'),
('professional_user', 'stack.achievements'),
('enterprise_user', 'stack.access'),
('enterprise_user', 'stack.progress'),
('enterprise_user', 'stack.achievements')
ON CONFLICT (role_name, permission_name) DO NOTHING;

COMMENT ON COLUMN usage_quotas.stack_lessons_limit IS 'Stack lesson limit per month (-1 = unlimited)';
COMMENT ON COLUMN usage_quotas.stack_lessons_used IS 'Stack lessons completed this month';