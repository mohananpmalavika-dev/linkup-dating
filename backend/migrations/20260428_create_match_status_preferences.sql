-- Migration: Create match_status_preferences table
-- Purpose: Store per-match privacy settings for activity status sharing

CREATE TABLE IF NOT EXISTS match_status_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  
  -- Status visibility toggles
  show_online_status BOOLEAN DEFAULT true,
  show_last_active BOOLEAN DEFAULT true,
  show_typing_indicator BOOLEAN DEFAULT true,
  show_activity_status BOOLEAN DEFAULT true,
  show_read_receipts BOOLEAN DEFAULT true,
  share_detailed_status BOOLEAN DEFAULT true,
  
  -- Privacy level preset
  privacy_level VARCHAR(20) DEFAULT 'full' CHECK (privacy_level IN ('full', 'basic', 'minimal', 'hidden')),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(user_id, match_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_match_status_preferences_user_id ON match_status_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_match_status_preferences_match_id ON match_status_preferences(match_id);
CREATE INDEX IF NOT EXISTS idx_match_status_preferences_privacy_level ON match_status_preferences(privacy_level);
CREATE INDEX IF NOT EXISTS idx_match_status_preferences_user_match ON match_status_preferences(user_id, match_id);

-- Create a trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_match_status_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  NEW.last_modified = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_match_status_preferences_timestamp ON match_status_preferences;
CREATE TRIGGER trigger_update_match_status_preferences_timestamp
  BEFORE UPDATE ON match_status_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_match_status_preferences_timestamp();

-- Seed default preferences for existing matches (one entry per match per user)
-- This ensures users have default preferences even if they haven't customized them
INSERT INTO match_status_preferences (user_id, match_id, privacy_level, created_at, updated_at)
SELECT m.user_id_1, m.id, 'full', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM matches m
WHERE NOT EXISTS (
  SELECT 1 FROM match_status_preferences msp
  WHERE msp.user_id = m.user_id_1 AND msp.match_id = m.id
)
ON CONFLICT (user_id, match_id) DO NOTHING;

INSERT INTO match_status_preferences (user_id, match_id, privacy_level, created_at, updated_at)
SELECT m.user_id_2, m.id, 'full', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM matches m
WHERE NOT EXISTS (
  SELECT 1 FROM match_status_preferences msp
  WHERE msp.user_id = m.user_id_2 AND msp.match_id = m.id
)
ON CONFLICT (user_id, match_id) DO NOTHING;
