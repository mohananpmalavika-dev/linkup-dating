-- Migration: Add Content Moderation Tables
-- Date: 2026-04-28
-- Purpose: Support content moderation and user flagging system

-- Moderation Flags (user reports)
CREATE TABLE IF NOT EXISTS moderation_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(50) NOT NULL, -- profile, bio, photo, message, etc
  content_id VARCHAR(255) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  evidence JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, investigating
  resolution_reason TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  reviewed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Moderation Logs (admin actions)
CREATE TABLE IF NOT EXISTS moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- warning, suspension, ban, content_removed, etc
  content_type VARCHAR(50),
  details JSONB DEFAULT '{}'::jsonb,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Banned Users/Content
CREATE TABLE IF NOT EXISTS bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(255) NOT NULL,
  ban_type VARCHAR(50) NOT NULL, -- temporary, permanent
  duration_days INTEGER, -- NULL for permanent
  start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Warnings (before ban)
CREATE TABLE IF NOT EXISTS user_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(255) NOT NULL,
  severity VARCHAR(50) DEFAULT 'medium', -- low, medium, high
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP WITH TIME ZONE
);

-- Blocked Users
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(blocker_id, blocked_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_moderation_flags_user_id ON moderation_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_status ON moderation_flags(status);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_content_type ON moderation_flags(content_type);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_created_at ON moderation_flags(created_at);

CREATE INDEX IF NOT EXISTS idx_moderation_logs_user_id ON moderation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_action_type ON moderation_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON moderation_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_bans_user_id ON bans(user_id);
CREATE INDEX IF NOT EXISTS idx_bans_active ON bans(active);
CREATE INDEX IF NOT EXISTS idx_bans_end_date ON bans(end_date);

CREATE INDEX IF NOT EXISTS idx_user_warnings_user_id ON user_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_warnings_issued_at ON user_warnings(issued_at);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON user_blocks(blocked_id);

-- Add comments
COMMENT ON TABLE moderation_flags IS 'User reports of inappropriate content for manual review';
COMMENT ON TABLE moderation_logs IS 'Log of all moderation actions taken by admins';
COMMENT ON TABLE bans IS 'User account bans (temporary or permanent)';
COMMENT ON TABLE user_warnings IS 'Warnings issued to users before potential bans';
COMMENT ON TABLE user_blocks IS 'Users blocked by other users';
COMMENT ON COLUMN bans.ban_type IS 'Type of ban: temporary (with duration) or permanent';
COMMENT ON COLUMN bans.duration_days IS 'For temporary bans, number of days. NULL for permanent';
