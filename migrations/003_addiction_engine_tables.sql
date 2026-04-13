-- Migration: Add engagement tracking and behavioral psychology tables
-- File: migrations/003_addiction_engine_tables.sql

-- User engagement events for behavioral analysis
CREATE TABLE IF NOT EXISTS user_engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_engagement_events_user_id ON user_engagement_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_engagement_events_type ON user_engagement_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_engagement_events_created_at ON user_engagement_events(created_at);

-- User notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  preferred_time TIME DEFAULT '19:00',
  timezone VARCHAR(50) DEFAULT 'UTC',
  notification_types JSONB DEFAULT '["daily_reminder", "streak_anxiety", "social_pressure", "achievement"]',
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User habit formation data
CREATE TABLE IF NOT EXISTS user_habit_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  habit_strength INTEGER DEFAULT 0, -- 0-100 scale
  streak_freezes_available INTEGER DEFAULT 2,
  weekly_goal INTEGER DEFAULT 5,
  completed_this_week INTEGER DEFAULT 0,
  last_week_reset DATE DEFAULT CURRENT_DATE,
  preferred_learning_time TIME DEFAULT '19:00',
  habit_triggers JSONB DEFAULT '[]', -- Array of habit stacking triggers
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily challenges
CREATE TABLE IF NOT EXISTS daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date DATE NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  questions JSONB NOT NULL, -- Array of challenge questions
  time_limit_seconds INTEGER DEFAULT 90,
  bonus_multiplier DECIMAL(3,2) DEFAULT 1.5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User daily challenge completions
CREATE TABLE IF NOT EXISTS user_daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES daily_challenges(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  time_spent_seconds INTEGER NOT NULL,
  is_perfect BOOLEAN DEFAULT false,
  points_earned INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, challenge_id)
);

-- Achievement definitions (static data)
CREATE TABLE IF NOT EXISTS achievement_definitions (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(10) NOT NULL,
  rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  points INTEGER NOT NULL,
  criteria JSONB NOT NULL, -- Conditions for unlocking
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default achievements
INSERT INTO achievement_definitions (id, title, description, icon, rarity, points, criteria) VALUES
('first_lesson', 'Getting Started', 'Complete your first lesson', '🎓', 'common', 50, '{"type": "lesson_count", "value": 1}'),
('perfect_quiz', 'Quiz Master', 'Get 100% on a quiz', '🎯', 'common', 75, '{"type": "perfect_score", "value": 100}'),
('week_streak', 'Consistency King', 'Maintain a 7-day learning streak', '🔥', 'rare', 200, '{"type": "streak", "value": 7}'),
('speed_demon', 'Speed Demon', 'Complete daily challenge in under 60 seconds', '⚡', 'rare', 150, '{"type": "challenge_time", "value": 60}'),
('knowledge_seeker', 'Knowledge Seeker', 'Complete 10 lessons', '📚', 'rare', 300, '{"type": "lesson_count", "value": 10}'),
('finance_guru', 'Finance Guru', 'Complete all modules in Personal Finance track', '💰', 'epic', 500, '{"type": "category_complete", "value": "personal_finance"}'),
('streak_legend', 'Streak Legend', 'Maintain a 30-day learning streak', '👑', 'legendary', 1000, '{"type": "streak", "value": 30}'),
('perfect_month', 'Perfect Month', 'Complete daily challenges for 30 days straight', '🏆', 'legendary', 1500, '{"type": "challenge_streak", "value": 30}')
ON CONFLICT (id) DO NOTHING;

-- Update user_achievements to reference achievement_definitions
ALTER TABLE user_achievements 
ADD COLUMN IF NOT EXISTS achievement_id VARCHAR(50) REFERENCES achievement_definitions(id);

-- Migrate existing achievements
UPDATE user_achievements 
SET achievement_id = achievement_type 
WHERE achievement_id IS NULL AND achievement_type IN (
  SELECT id FROM achievement_definitions
);

-- User leaderboard view for performance
CREATE OR REPLACE VIEW user_leaderboard AS
SELECT 
  u.id as user_id,
  u.username,
  COALESCE(s.total_points, 0) as total_points,
  COALESCE(s.current_streak, 0) as current_streak,
  COALESCE(s.longest_streak, 0) as longest_streak,
  -- Calculate level from points
  CASE 
    WHEN COALESCE(s.total_points, 0) < 100 THEN 1
    WHEN COALESCE(s.total_points, 0) < 250 THEN 2
    WHEN COALESCE(s.total_points, 0) < 450 THEN 3
    WHEN COALESCE(s.total_points, 0) < 700 THEN 4
    ELSE FLOOR(SQRT(COALESCE(s.total_points, 0) / 100)) + 1
  END as level,
  ROW_NUMBER() OVER (ORDER BY COALESCE(s.total_points, 0) DESC) as rank
FROM users u
LEFT JOIN user_streaks s ON u.id = s.user_id
WHERE u.is_active = true;

-- Function to calculate habit strength
CREATE OR REPLACE FUNCTION calculate_habit_strength(
  p_user_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_streak INTEGER;
  v_consistency DECIMAL;
  v_completed_this_week INTEGER;
  v_weekly_goal INTEGER;
  v_habit_strength INTEGER;
BEGIN
  -- Get user data
  SELECT 
    COALESCE(s.current_streak, 0),
    COALESCE(h.completed_this_week, 0),
    COALESCE(h.weekly_goal, 5)
  INTO v_streak, v_completed_this_week, v_weekly_goal
  FROM users u
  LEFT JOIN user_streaks s ON u.id = s.user_id
  LEFT JOIN user_habit_data h ON u.id = h.user_id
  WHERE u.id = p_user_id;
  
  -- Calculate consistency (0-1)
  v_consistency := LEAST(v_completed_this_week::DECIMAL / v_weekly_goal, 1.0);
  
  -- Habit strength formula: (streak * 2) + (consistency * 30) capped at 100
  v_habit_strength := LEAST(
    (v_streak * 2) + (v_consistency * 30)::INTEGER,
    100
  );
  
  -- Update habit data
  INSERT INTO user_habit_data (user_id, habit_strength)
  VALUES (p_user_id, v_habit_strength)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    habit_strength = v_habit_strength,
    updated_at = NOW();
  
  RETURN v_habit_strength;
END;
$$ LANGUAGE plpgsql;

-- Function to generate daily challenge
CREATE OR REPLACE FUNCTION generate_daily_challenge(
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS UUID AS $$
DECLARE
  v_challenge_id UUID;
  v_questions JSONB;
BEGIN
  -- Check if challenge already exists for date
  SELECT id INTO v_challenge_id
  FROM daily_challenges
  WHERE challenge_date = p_date;
  
  IF v_challenge_id IS NOT NULL THEN
    RETURN v_challenge_id;
  END IF;
  
  -- Generate challenge questions (simplified - would use more sophisticated logic)
  v_questions := '[
    {
      "text": "What is the #1 mistake people make with emergency funds?",
      "options": ["Not having one at all", "Keeping it in checking", "Having too much", "Using for vacations"],
      "correct": 0,
      "points": 25
    },
    {
      "text": "Which credit card payoff strategy saves the most money?",
      "options": ["Pay minimums", "Avalanche method", "Snowball method", "Balance transfer"],
      "correct": 1,
      "points": 30
    },
    {
      "text": "Fastest way to boost credit score by 50+ points?",
      "options": ["Pay off all cards", "Get new card", "Under 10% utilization", "Dispute accounts"],
      "correct": 2,
      "points": 35
    }
  ]'::jsonb;
  
  -- Insert new challenge
  INSERT INTO daily_challenges (challenge_date, title, description, questions, time_limit_seconds, bonus_multiplier)
  VALUES (
    p_date,
    '💰 Quick Cash Quiz',
    '3 questions about saving money - beat the clock!',
    v_questions,
    90,
    1.5
  )
  RETURNING id INTO v_challenge_id;
  
  RETURN v_challenge_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to reset weekly goals
CREATE OR REPLACE FUNCTION reset_weekly_goals() RETURNS TRIGGER AS $$
BEGIN
  -- Reset weekly completion count if it's a new week
  IF NEW.last_week_reset < DATE_TRUNC('week', CURRENT_DATE) THEN
    NEW.completed_this_week := 0;
    NEW.last_week_reset := CURRENT_DATE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reset_weekly_goals
  BEFORE UPDATE ON user_habit_data
  FOR EACH ROW
  EXECUTE FUNCTION reset_weekly_goals();

-- Generate today's challenge
SELECT generate_daily_challenge();

COMMENT ON TABLE user_engagement_events IS 'Tracks all user interactions for behavioral analysis and ML optimization';
COMMENT ON TABLE user_notification_preferences IS 'Stores user preferences for push notifications and optimal timing';
COMMENT ON TABLE user_habit_data IS 'Tracks habit formation metrics and streak recovery data';
COMMENT ON TABLE daily_challenges IS 'Daily timed challenges with bonus multipliers';
COMMENT ON TABLE achievement_definitions IS 'Static achievement definitions with unlock criteria';
COMMENT ON FUNCTION calculate_habit_strength IS 'Calculates habit strength score (0-100) based on streak and consistency';
COMMENT ON FUNCTION generate_daily_challenge IS 'Generates daily challenge with randomized questions';