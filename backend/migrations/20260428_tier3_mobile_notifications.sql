-- Tier 3: Mobile Experience - Notifications & Quick View
-- Notification Intelligence & Activity Pattern Tracking

-- Create Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification Type Preferences
  notify_new_likes BOOLEAN DEFAULT true,
  notify_new_matches BOOLEAN DEFAULT true,
  notify_messages BOOLEAN DEFAULT true,
  notify_superlike BOOLEAN DEFAULT true,
  notify_milestones BOOLEAN DEFAULT true,
  notify_events BOOLEAN DEFAULT true,
  notify_reminders BOOLEAN DEFAULT false,
  
  -- Frequency & Timing
  max_notifications_per_day INTEGER DEFAULT 5,
  min_hours_between_notifications INTEGER DEFAULT 6,
  quiet_hours_start INTEGER DEFAULT 22,
  quiet_hours_end INTEGER DEFAULT 8,
  quiet_hours_enabled BOOLEAN DEFAULT true,
  
  -- Personalization
  include_compatibility_score BOOLEAN DEFAULT true,
  include_photo_preview BOOLEAN DEFAULT true,
  use_smart_timing BOOLEAN DEFAULT true,
  
  -- Metadata
  last_notification_sent_at TIMESTAMP,
  notification_count_today INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Notification Log Table
CREATE TABLE IF NOT EXISTS notification_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification Details
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  related_match_id INTEGER,
  related_entity_type VARCHAR(50),
  related_entity_id INTEGER,
  
  -- Delivery & Engagement
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_action VARCHAR(100),
  delivery_channel VARCHAR(50) DEFAULT 'push',
  delivery_status VARCHAR(50) DEFAULT 'pending',
  
  -- Personalization Data
  compatibility_score INTEGER,
  personalization_used JSONB,
  
  -- Timing Data
  optimal_send_time TIMESTAMP,
  was_smart_timed BOOLEAN DEFAULT false,
  was_batched BOOLEAN DEFAULT false,
  batch_id VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create User Activity Pattern Table
CREATE TABLE IF NOT EXISTS user_activity_patterns (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Hourly Activity (0-23 hours)
  hour_0_activity INTEGER DEFAULT 0,
  hour_1_activity INTEGER DEFAULT 0,
  hour_2_activity INTEGER DEFAULT 0,
  hour_3_activity INTEGER DEFAULT 0,
  hour_4_activity INTEGER DEFAULT 0,
  hour_5_activity INTEGER DEFAULT 0,
  hour_6_activity INTEGER DEFAULT 0,
  hour_7_activity INTEGER DEFAULT 0,
  hour_8_activity INTEGER DEFAULT 0,
  hour_9_activity INTEGER DEFAULT 0,
  hour_10_activity INTEGER DEFAULT 0,
  hour_11_activity INTEGER DEFAULT 0,
  hour_12_activity INTEGER DEFAULT 0,
  hour_13_activity INTEGER DEFAULT 0,
  hour_14_activity INTEGER DEFAULT 0,
  hour_15_activity INTEGER DEFAULT 0,
  hour_16_activity INTEGER DEFAULT 0,
  hour_17_activity INTEGER DEFAULT 0,
  hour_18_activity INTEGER DEFAULT 0,
  hour_19_activity INTEGER DEFAULT 0,
  hour_20_activity INTEGER DEFAULT 0,
  hour_21_activity INTEGER DEFAULT 0,
  hour_22_activity INTEGER DEFAULT 0,
  hour_23_activity INTEGER DEFAULT 0,
  
  -- Notification Open Rate by Hour
  hour_0_open_rate FLOAT DEFAULT 0,
  hour_1_open_rate FLOAT DEFAULT 0,
  hour_2_open_rate FLOAT DEFAULT 0,
  hour_3_open_rate FLOAT DEFAULT 0,
  hour_4_open_rate FLOAT DEFAULT 0,
  hour_5_open_rate FLOAT DEFAULT 0,
  hour_6_open_rate FLOAT DEFAULT 0,
  hour_7_open_rate FLOAT DEFAULT 0,
  hour_8_open_rate FLOAT DEFAULT 0,
  hour_9_open_rate FLOAT DEFAULT 0,
  hour_10_open_rate FLOAT DEFAULT 0,
  hour_11_open_rate FLOAT DEFAULT 0,
  hour_12_open_rate FLOAT DEFAULT 0,
  hour_13_open_rate FLOAT DEFAULT 0,
  hour_14_open_rate FLOAT DEFAULT 0,
  hour_15_open_rate FLOAT DEFAULT 0,
  hour_16_open_rate FLOAT DEFAULT 0,
  hour_17_open_rate FLOAT DEFAULT 0,
  hour_18_open_rate FLOAT DEFAULT 0,
  hour_19_open_rate FLOAT DEFAULT 0,
  hour_20_open_rate FLOAT DEFAULT 0,
  hour_21_open_rate FLOAT DEFAULT 0,
  hour_22_open_rate FLOAT DEFAULT 0,
  hour_23_open_rate FLOAT DEFAULT 0,
  
  -- Peak Hours
  best_hours INTEGER[] DEFAULT '{19,20,21}',
  worst_hours INTEGER[] DEFAULT '{2,3,4}',
  
  -- Metadata
  total_notifications_sent INTEGER DEFAULT 0,
  total_notifications_opened INTEGER DEFAULT 0,
  average_open_rate FLOAT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_points INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for Performance
CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);
CREATE INDEX idx_notification_logs_user ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX idx_notification_logs_sent ON notification_logs(sent_at);
CREATE INDEX idx_notification_logs_opened ON notification_logs(opened_at);
CREATE INDEX idx_notification_logs_status ON notification_logs(delivery_status);
CREATE INDEX idx_notification_logs_smart ON notification_logs(was_smart_timed);
CREATE INDEX idx_notification_logs_batched ON notification_logs(was_batched);
CREATE INDEX idx_activity_pattern_user ON user_activity_patterns(user_id);
CREATE INDEX idx_activity_pattern_updated ON user_activity_patterns(last_updated);
CREATE INDEX idx_activity_pattern_open_rate ON user_activity_patterns(average_open_rate);

-- Create Views
CREATE OR REPLACE VIEW notification_open_rates_today AS
SELECT 
  user_id,
  COUNT(*) as sent_today,
  COUNT(opened_at) as opened_today,
  ROUND(100.0 * COUNT(opened_at) / NULLIF(COUNT(*), 0), 2) as open_rate_today
FROM notification_logs
WHERE DATE(sent_at) = CURRENT_DATE
GROUP BY user_id;

CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
  user_id,
  COALESCE(average_open_rate, 0) as open_rate,
  COALESCE(best_hours[1], 19) as best_hour,
  data_points,
  last_updated
FROM user_activity_patterns
WHERE data_points > 0;

-- Add Check Constraint for Hours
ALTER TABLE notification_preferences
ADD CONSTRAINT check_quiet_hours_valid 
CHECK (quiet_hours_start >= 0 AND quiet_hours_start <= 23 AND quiet_hours_end >= 0 AND quiet_hours_end <= 23);

ALTER TABLE user_activity_patterns
ADD CONSTRAINT check_open_rates_valid
CHECK (average_open_rate >= 0 AND average_open_rate <= 1);

-- Create Trigger to Update Updated_At Timestamp
CREATE OR REPLACE FUNCTION update_notification_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_prefs_update_timestamp
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_notification_prefs_updated_at();

CREATE TRIGGER activity_pattern_update_timestamp
BEFORE UPDATE ON user_activity_patterns
FOR EACH ROW
EXECUTE FUNCTION update_notification_prefs_updated_at();

-- Batch Create Default Notification Preferences for Existing Users
-- This ensures all existing users have notification preferences
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM notification_preferences)
ON CONFLICT DO NOTHING;

-- Initialize Activity Patterns for Users with Recent Activity
-- This seeding can be expanded based on historical data
INSERT INTO user_activity_patterns (user_id, best_hours)
SELECT id, '{19,20,21}'::integer[] FROM users
WHERE id NOT IN (SELECT user_id FROM user_activity_patterns)
ON CONFLICT (user_id) DO NOTHING;
