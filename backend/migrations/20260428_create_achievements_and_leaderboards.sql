-- Achievement & Leaderboard System Migration
-- Creates tables for badges, achievements, and leaderboards

-- Create Achievement Definitions Table
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  achievement_key VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  emoji VARCHAR(10) NOT NULL,
  icon VARCHAR(100),
  category VARCHAR(50) NOT NULL,
  rarity VARCHAR(20) DEFAULT 'common',
  requirement_type VARCHAR(50) NOT NULL,
  requirement_value INTEGER NOT NULL,
  point_value INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create User Achievement Join Table
CREATE TABLE IF NOT EXISTS user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_featured BOOLEAN DEFAULT false,
  featured_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, achievement_id)
);

-- Create Leaderboard Rankings Table
CREATE TABLE IF NOT EXISTS leaderboards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  activity_type VARCHAR(50) NOT NULL, -- 'monthly_most_active', 'best_conversation_starter'
  city VARCHAR(100),
  interest VARCHAR(100),
  month VARCHAR(7), -- YYYY-MM format
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Conversation Starter Votes Table
CREATE TABLE IF NOT EXISTS conversation_starter_votes (
  id SERIAL PRIMARY KEY,
  voter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voted_for_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(voter_user_id, voted_for_user_id)
);

-- Create Indexes for Performance
CREATE INDEX idx_achievements_key ON achievements(achievement_key);
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement ON user_achievements(achievement_id);
CREATE INDEX idx_user_achievements_unlocked ON user_achievements(unlocked_at);
CREATE INDEX idx_leaderboards_user ON leaderboards(user_id);
CREATE INDEX idx_leaderboards_type ON leaderboards(activity_type);
CREATE INDEX idx_leaderboards_city ON leaderboards(city);
CREATE INDEX idx_leaderboards_interest ON leaderboards(interest);
CREATE INDEX idx_leaderboards_month ON leaderboards(month);
CREATE INDEX idx_leaderboards_current ON leaderboards(is_current);
CREATE INDEX idx_leaderboards_rank ON leaderboards(rank);
CREATE INDEX idx_votes_voter ON conversation_starter_votes(voter_user_id);
CREATE INDEX idx_votes_voted_for ON conversation_starter_votes(voted_for_user_id);
CREATE INDEX idx_votes_created ON conversation_starter_votes(created_at);

-- Insert Default Achievements
INSERT INTO achievements (achievement_key, title, description, emoji, category, rarity, requirement_type, requirement_value, point_value)
VALUES
  ('conversation_master', 'Conversation Master', '50+ message exchanges', '🎯', 'engagement', 'epic', 'message_count', 50, 100),
  ('photo_verified', 'Photo Verified', 'Complete ID verification', '📸', 'profile', 'rare', 'id_verification', 1, 75),
  ('video_confident', 'Video Confident', '5+ video calls scheduled', '🎬', 'engagement', 'epic', 'video_calls', 5, 100),
  ('hot_profile', 'Hot Profile', 'Top 10% liked profiles', '🔥', 'recognition', 'legendary', 'like_percentile', 90, 150),
  ('communicator', 'Communicator', 'Reply within 1 hour average', '💬', 'engagement', 'rare', 'reply_time', 3600, 80),
  ('interaction_king', 'Interaction King', '100+ message reactions received', '👑', 'engagement', 'epic', 'reaction_count', 100, 120),
  ('first_match', 'First Match', 'Make your first match', '💘', 'starter', 'common', 'match_count', 1, 10),
  ('social_butterfly', 'Social Butterfly', '10+ different matches', '🦋', 'engagement', 'uncommon', 'unique_matches', 10, 50),
  ('date_setter', 'Date Setter', 'Schedule 3+ dates', '📅', 'action', 'rare', 'date_count', 3, 75),
  ('relationship_ready', 'Relationship Ready', 'Set relationship goal and complete profile', '💑', 'profile', 'uncommon', 'profile_completion', 90, 60)
ON CONFLICT (achievement_key) DO NOTHING;

-- Create View for Active Achievements
CREATE OR REPLACE VIEW active_achievements AS
SELECT * FROM achievements WHERE is_active = true;

-- Create View for Current Leaderboards
CREATE OR REPLACE VIEW current_leaderboards AS
SELECT * FROM leaderboards WHERE is_current = true;

-- Add Check Constraint for Rank
ALTER TABLE leaderboards
ADD CONSTRAINT check_rank_positive CHECK (rank > 0);

-- Add Check Constraint for Score
ALTER TABLE leaderboards
ADD CONSTRAINT check_score_non_negative CHECK (score >= 0);

-- Create Trigger to Update Updated_At Timestamp
CREATE OR REPLACE FUNCTION update_achievements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER achievements_update_timestamp
BEFORE UPDATE ON achievements
FOR EACH ROW
EXECUTE FUNCTION update_achievements_updated_at();

CREATE TRIGGER leaderboards_update_timestamp
BEFORE UPDATE ON leaderboards
FOR EACH ROW
EXECUTE FUNCTION update_achievements_updated_at();
