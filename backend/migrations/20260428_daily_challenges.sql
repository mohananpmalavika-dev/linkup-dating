-- Daily Challenges Migration
-- Created: 2026-04-28
-- Tables: daily_challenges, user_daily_challenges, discovery_boost_points, challenge_redemptions

-- Create daily_challenges table
CREATE TABLE IF NOT EXISTS daily_challenges (
  id SERIAL PRIMARY KEY,
  challenge_code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  type ENUM('update_photo', 'answer_prompts', 'schedule_video_call', 'send_message', 'complete_profile', 'verify_identity') NOT NULL,
  day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
  target_count INT NOT NULL DEFAULT 1,
  reward_points INT NOT NULL DEFAULT 50,
  icon VARCHAR(10) NOT NULL DEFAULT '🎯',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  "order" INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_challenge_code (challenge_code),
  KEY idx_day_of_week (day_of_week),
  KEY idx_is_active (is_active)
);

-- Create user_daily_challenges table
CREATE TABLE IF NOT EXISTS user_daily_challenges (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  daily_challenge_id INT NOT NULL,
  completed_at TIMESTAMP NULL,
  progress_count INT NOT NULL DEFAULT 0,
  points_earned INT NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_reward_at TIMESTAMP NULL,
  challenge_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (daily_challenge_id) REFERENCES daily_challenges(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_challenge_date (user_id, daily_challenge_id, challenge_date),
  KEY idx_user_challenge_date (user_id, challenge_date),
  KEY idx_user_completed (user_id, is_completed),
  KEY idx_completed_at (completed_at)
);

-- Create discovery_boost_points table
CREATE TABLE IF NOT EXISTS discovery_boost_points (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  total_points INT NOT NULL DEFAULT 0,
  points_used INT NOT NULL DEFAULT 0,
  weekly_points INT NOT NULL DEFAULT 0,
  last_week_reset_at TIMESTAMP NULL,
  monthly_streak INT NOT NULL DEFAULT 0,
  last_challenge_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_id (user_id),
  KEY idx_total_points (total_points)
);

-- Create challenge_redemptions table
CREATE TABLE IF NOT EXISTS challenge_redemptions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  points_redeemed INT NOT NULL,
  reward_type ENUM('premium_week', 'premium_month', 'super_likes', 'boost', 'rewind', 'spotlight', 'custom') NOT NULL,
  reward_value VARCHAR(255) NOT NULL,
  status ENUM('pending', 'approved', 'applied', 'expired', 'cancelled') NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_user_created (user_id, created_at),
  KEY idx_status (status),
  KEY idx_reward_type (reward_type)
);

-- Seed initial challenges
INSERT INTO daily_challenges (challenge_code, name, description, type, day_of_week, target_count, reward_points, icon, "order") VALUES
  ('UPDATE_PHOTO_MON', 'Update 1 new photo', 'Add a new photo to your profile', 'update_photo', 'monday', 1, 50, '📸', 1),
  ('ANSWER_PROMPTS_WED', 'Answer 5 profile prompts', 'Complete 5 profile prompts to stand out', 'answer_prompts', 'wednesday', 5, 25, '💬', 2),
  ('SCHEDULE_CALL_FRI', 'Schedule a video call', 'Arrange a video date with a match', 'schedule_video_call', 'friday', 1, 100, '📞', 3);

-- Create view for available points
CREATE OR REPLACE VIEW user_available_points AS
SELECT 
  user_id,
  total_points,
  points_used,
  (total_points - points_used) as available_points,
  weekly_points,
  monthly_streak,
  last_challenge_date
FROM discovery_boost_points;

-- Create stored procedure to initialize challenges for new user
DELIMITER $$
CREATE PROCEDURE init_user_challenges(IN p_user_id INT)
BEGIN
  INSERT INTO discovery_boost_points (user_id, total_points, points_used, weekly_points, monthly_streak)
  VALUES (p_user_id, 0, 0, 0, 0)
  ON DUPLICATE KEY UPDATE updated_at = NOW();
END$$
DELIMITER ;

-- Add indexes for performance
CREATE INDEX idx_challenge_progress_daily ON user_daily_challenges(challenge_date, is_completed);
CREATE INDEX idx_points_available ON discovery_boost_points(total_points, points_used);
CREATE INDEX idx_redemption_user_status ON challenge_redemptions(user_id, status);
