-- BEHAVIOR-BASED FINANCE TRACKER
-- Rewards real financial actions, not app usage

CREATE TABLE real_financial_actions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
    'emergency_fund_created',
    'investment_started', 
    'debt_payment_made',
    'budget_created',
    'credit_score_improved',
    'insurance_purchased'
  )),
  
  -- Verification data
  amount DECIMAL(12,2),
  proof_method VARCHAR(20) CHECK (proof_method IN ('bank_connect', 'receipt_upload', 'self_report')),
  verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  
  -- Context
  lesson_id INTEGER REFERENCES finance_lessons(id), -- Which lesson inspired this
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE TABLE behavior_milestones (
  id VARCHAR(30) PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  
  -- Real-world criteria
  required_action VARCHAR(50) NOT NULL,
  minimum_amount DECIMAL(12,2),
  verification_required BOOLEAN DEFAULT true,
  
  -- Meaningful rewards
  reward_type VARCHAR(20) CHECK (reward_type IN ('recognition', 'content_unlock', 'expert_session')),
  reward_value TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to check behavior-based milestones
CREATE OR REPLACE FUNCTION check_behavior_milestones(p_user_id INTEGER) RETURNS VOID AS $$
DECLARE
  v_milestone behavior_milestones%ROWTYPE;
  v_action_count INTEGER;
  v_total_amount DECIMAL(12,2);
BEGIN
  FOR v_milestone IN SELECT * FROM behavior_milestones LOOP
    -- Check if user has completed required actions
    SELECT COUNT(*), COALESCE(SUM(amount), 0)
    INTO v_action_count, v_total_amount
    FROM real_financial_actions 
    WHERE user_id = p_user_id 
      AND action_type = v_milestone.required_action
      AND verification_status = 'verified';
    
    -- Award milestone if criteria met
    IF v_action_count > 0 AND 
       (v_milestone.minimum_amount IS NULL OR v_total_amount >= v_milestone.minimum_amount) THEN
      
      INSERT INTO user_achievements (user_id, achievement_id)
      VALUES (p_user_id, v_milestone.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Insert meaningful milestones
INSERT INTO behavior_milestones (id, title, description, required_action, minimum_amount, reward_type, reward_value) VALUES
('first_emergency_fund', 'Emergency Fund Started', 'Created your first emergency fund', 'emergency_fund_created', 1000, 'recognition', 'Financial Security Badge'),
('investment_beginner', 'Investment Journey Begun', 'Made your first investment', 'investment_started', 100, 'content_unlock', 'Advanced Investment Lessons'),
('debt_warrior', 'Debt Fighter', 'Made extra debt payments totaling ₹10,000', 'debt_payment_made', 10000, 'expert_session', '30-min call with financial advisor');