-- ADAPTIVE MOTIVATION SYSTEM
-- Tracks user engagement patterns for optimal dopamine delivery

CREATE TABLE user_engagement_profiles (
  user_id INTEGER PRIMARY KEY,
  total_sessions INTEGER DEFAULT 0,
  avg_session_length INTEGER DEFAULT 0, -- milliseconds
  last_active_date DATE DEFAULT CURRENT_DATE,
  
  -- Motivation preferences (learned from behavior)
  motivation_preference VARCHAR(10) DEFAULT 'adaptive' CHECK (motivation_preference IN ('high', 'medium', 'low', 'adaptive')),
  sounds_enabled BOOLEAN DEFAULT true,
  animations_enabled BOOLEAN DEFAULT true,
  
  -- Device performance (auto-detected)
  device_performance VARCHAR(10) DEFAULT 'high' CHECK (device_performance IN ('high', 'medium', 'low')),
  
  -- Engagement metrics
  total_correct_answers INTEGER DEFAULT 0,
  total_wrong_answers INTEGER DEFAULT 0,
  avg_response_time INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE engagement_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES user_engagement_profiles(user_id),
  
  -- Session data
  duration_ms INTEGER NOT NULL,
  lessons_completed INTEGER DEFAULT 0,
  sounds_used BOOLEAN DEFAULT false,
  animations_viewed BOOLEAN DEFAULT false,
  
  -- Performance indicators
  correct_answers INTEGER DEFAULT 0,
  wrong_answers INTEGER DEFAULT 0,
  avg_response_time INTEGER DEFAULT 0,
  
  -- Motivation effectiveness
  dopamine_triggers_shown INTEGER DEFAULT 0,
  session_completion_rate DECIMAL(3,2), -- 0.00 to 1.00
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to update engagement profile
CREATE OR REPLACE FUNCTION update_engagement_profile(
  p_user_id INTEGER,
  p_session_data JSONB
) RETURNS VOID AS $$
DECLARE
  v_profile user_engagement_profiles%ROWTYPE;
  v_new_avg_session INTEGER;
  v_new_sounds_enabled BOOLEAN;
  v_new_animations_enabled BOOLEAN;
BEGIN
  -- Get current profile
  SELECT * INTO v_profile FROM user_engagement_profiles WHERE user_id = p_user_id;
  
  -- Calculate new averages
  v_new_avg_session := (COALESCE(v_profile.avg_session_length, 0) + (p_session_data->>'duration')::INTEGER) / 2;
  
  -- Auto-adjust preferences based on behavior
  v_new_sounds_enabled := v_profile.sounds_enabled;
  v_new_animations_enabled := v_profile.animations_enabled;
  
  -- If long session without sounds, user prefers quiet
  IF (p_session_data->>'duration')::INTEGER > 300000 AND (p_session_data->>'soundsUsed')::BOOLEAN = false THEN
    v_new_sounds_enabled := false;
  END IF;
  
  -- If user consistently skips animations, disable them
  IF (p_session_data->>'animationsViewed')::BOOLEAN = false AND v_profile.total_sessions > 5 THEN
    v_new_animations_enabled := false;
  END IF;
  
  -- Insert session record
  INSERT INTO engagement_sessions (
    user_id, duration_ms, lessons_completed, sounds_used, animations_viewed,
    correct_answers, wrong_answers, avg_response_time, dopamine_triggers_shown,
    session_completion_rate
  ) VALUES (
    p_user_id,
    (p_session_data->>'duration')::INTEGER,
    COALESCE((p_session_data->>'lessonsCompleted')::INTEGER, 0),
    COALESCE((p_session_data->>'soundsUsed')::BOOLEAN, false),
    COALESCE((p_session_data->>'animationsViewed')::BOOLEAN, false),
    COALESCE((p_session_data->>'correctAnswers')::INTEGER, 0),
    COALESCE((p_session_data->>'wrongAnswers')::INTEGER, 0),
    COALESCE((p_session_data->>'avgResponseTime')::INTEGER, 0),
    COALESCE((p_session_data->>'dopamineTriggersShown')::INTEGER, 0),
    COALESCE((p_session_data->>'sessionCompletionRate')::DECIMAL, 1.0)
  );
  
  -- Update profile
  INSERT INTO user_engagement_profiles (
    user_id, total_sessions, avg_session_length, last_active_date,
    sounds_enabled, animations_enabled, total_correct_answers, total_wrong_answers,
    avg_response_time, updated_at
  ) VALUES (
    p_user_id, 1, v_new_avg_session, CURRENT_DATE,
    v_new_sounds_enabled, v_new_animations_enabled,
    COALESCE((p_session_data->>'correctAnswers')::INTEGER, 0),
    COALESCE((p_session_data->>'wrongAnswers')::INTEGER, 0),
    COALESCE((p_session_data->>'avgResponseTime')::INTEGER, 0),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_sessions = user_engagement_profiles.total_sessions + 1,
    avg_session_length = v_new_avg_session,
    last_active_date = CURRENT_DATE,
    sounds_enabled = v_new_sounds_enabled,
    animations_enabled = v_new_animations_enabled,
    total_correct_answers = user_engagement_profiles.total_correct_answers + COALESCE((p_session_data->>'correctAnswers')::INTEGER, 0),
    total_wrong_answers = user_engagement_profiles.total_wrong_answers + COALESCE((p_session_data->>'wrongAnswers')::INTEGER, 0),
    avg_response_time = (user_engagement_profiles.avg_response_time + COALESCE((p_session_data->>'avgResponseTime')::INTEGER, 0)) / 2,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get optimal motivation settings
CREATE OR REPLACE FUNCTION get_optimal_motivation(p_user_id INTEGER) 
RETURNS TABLE(
  sound_effects BOOLEAN,
  visual_celebrations BOOLEAN,
  animation_intensity TEXT,
  celebration_duration INTEGER
) AS $$
DECLARE
  v_profile user_engagement_profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM user_engagement_profiles WHERE user_id = p_user_id;
  
  -- Default for new users
  IF v_profile IS NULL OR v_profile.total_sessions < 5 THEN
    RETURN QUERY SELECT true, true, 'full'::TEXT, 2000;
    RETURN;
  END IF;
  
  -- Regular users (5-20 sessions)
  IF v_profile.total_sessions < 20 THEN
    RETURN QUERY SELECT 
      v_profile.sounds_enabled,
      true,
      'standard'::TEXT,
      1500;
    RETURN;
  END IF;
  
  -- Experienced users (20+ sessions)
  RETURN QUERY SELECT 
    false,
    v_profile.animations_enabled,
    'minimal'::TEXT,
    800;
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance
CREATE INDEX idx_engagement_profiles_user ON user_engagement_profiles(user_id);
CREATE INDEX idx_engagement_sessions_user ON engagement_sessions(user_id);
CREATE INDEX idx_engagement_sessions_created ON engagement_sessions(created_at);

COMMENT ON TABLE user_engagement_profiles IS 'Adaptive motivation system - learns user preferences';
COMMENT ON TABLE engagement_sessions IS 'Individual session tracking for motivation optimization';
COMMENT ON FUNCTION update_engagement_profile IS 'Updates user profile based on session behavior';
COMMENT ON FUNCTION get_optimal_motivation IS 'Returns personalized motivation settings';