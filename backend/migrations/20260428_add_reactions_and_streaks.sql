-- Migration: Add custom reactions support and message streak tracking
-- Date: April 28, 2026
-- Purpose: Enable rich reactions with profile photos and streak tracking

-- ============================================================================
-- 1. Enhance message_reactions table with custom reaction support
-- ============================================================================

ALTER TABLE message_reactions
ADD COLUMN IF NOT EXISTS custom_reaction_type VARCHAR(20) DEFAULT 'emoji',
ADD COLUMN IF NOT EXISTS custom_photo_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS custom_photo_id INTEGER REFERENCES profile_photos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS custom_display_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update unique index to be on message_id and user_id only (allows multiple reaction types per user)
DROP INDEX IF EXISTS message_reactions_message_id_user_id_emoji_key CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reactions_user_per_message 
ON message_reactions(message_id, user_id);

-- Add custom type index
CREATE INDEX IF NOT EXISTS idx_message_reactions_custom_type ON message_reactions(custom_reaction_type);

-- ============================================================================
-- 2. Create message_streak_trackers table
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_streak_trackers (
  id SERIAL PRIMARY KEY,
  user_id_1 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id_2 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  
  -- Streak tracking
  streak_days INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  streak_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  streak_broken_date TIMESTAMP,
  
  -- Milestones
  milestone_3_days BOOLEAN DEFAULT false,
  milestone_7_days BOOLEAN DEFAULT false,
  milestone_30_days BOOLEAN DEFAULT false,
  
  -- Engagement metrics
  total_messages INTEGER DEFAULT 0,
  total_reactions INTEGER DEFAULT 0,
  engagement_score FLOAT DEFAULT 0,
  
  -- Notifications
  notification_sent BOOLEAN DEFAULT false,
  last_notification_date TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one streak per pair per match
  UNIQUE(user_id_1, user_id_2, match_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_streak_trackers_match ON message_streak_trackers(match_id);
CREATE INDEX IF NOT EXISTS idx_streak_trackers_user1 ON message_streak_trackers(user_id_1);
CREATE INDEX IF NOT EXISTS idx_streak_trackers_user2 ON message_streak_trackers(user_id_2);
CREATE INDEX IF NOT EXISTS idx_streak_trackers_active ON message_streak_trackers(is_active);
CREATE INDEX IF NOT EXISTS idx_streak_trackers_days ON message_streak_trackers(streak_days DESC);
CREATE INDEX IF NOT EXISTS idx_streak_trackers_last_msg ON message_streak_trackers(last_message_date DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_message_streak_trackers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_message_streak_trackers_timestamp ON message_streak_trackers;
CREATE TRIGGER trigger_update_message_streak_trackers_timestamp
  BEFORE UPDATE ON message_streak_trackers
  FOR EACH ROW
  EXECUTE FUNCTION update_message_streak_trackers_timestamp();

-- Update message reactions timestamp trigger
CREATE OR REPLACE FUNCTION update_message_reactions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_message_reactions_timestamp ON message_reactions;
CREATE TRIGGER trigger_update_message_reactions_timestamp
  BEFORE UPDATE ON message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_message_reactions_timestamp();

-- ============================================================================
-- 3. Add enum type for reaction types (if not exists)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE reaction_type_enum AS ENUM ('emoji', 'photo');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 4. Verify indexes are created
-- ============================================================================

-- Verify critical performance indexes
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_user 
ON message_reactions(message_id, user_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_created 
ON message_reactions(created_at DESC);

-- ============================================================================
-- 5. Create view for active streaks with engagement scores
-- ============================================================================

CREATE OR REPLACE VIEW active_message_streaks AS
SELECT 
  mst.id,
  mst.user_id_1,
  mst.user_id_2,
  mst.match_id,
  mst.streak_days,
  mst.is_active,
  mst.engagement_score,
  mst.total_messages,
  mst.total_reactions,
  CASE 
    WHEN mst.streak_days >= 30 THEN '🔥'
    WHEN mst.streak_days >= 7 THEN '❤️'
    WHEN mst.streak_days >= 3 THEN '❤️'
    ELSE NULL
  END as streak_emoji,
  CASE 
    WHEN mst.streak_days >= 30 THEN mst.streak_days || '🔥 Day Streak!'
    WHEN mst.streak_days >= 7 THEN mst.streak_days || '❤️ Day Streak!'
    WHEN mst.streak_days >= 3 THEN mst.streak_days || '❤️ Day Streak!'
    ELSE NULL
  END as streak_text,
  mst.last_message_date,
  mst.created_at,
  mst.updated_at
FROM message_streak_trackers mst
WHERE mst.is_active = true
ORDER BY mst.streak_days DESC;

-- ============================================================================
-- 6. Create view for reaction analytics
-- ============================================================================

CREATE OR REPLACE VIEW reaction_analytics AS
SELECT 
  m.match_id,
  mr.emoji,
  COUNT(*) as reaction_count,
  COUNT(DISTINCT mr.user_id) as unique_users,
  MAX(mr.created_at) as last_used_at
FROM message_reactions mr
JOIN messages m ON mr.message_id = m.id
WHERE mr.custom_reaction_type = 'emoji'
GROUP BY m.match_id, mr.emoji
ORDER BY m.match_id, reaction_count DESC;

-- ============================================================================
-- 7. Seed example data (optional)
-- ============================================================================

-- Create some default emoji reactions if needed
-- This is already handled by the application
