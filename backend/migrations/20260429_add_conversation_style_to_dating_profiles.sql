-- Migration: Add conversation_style column to dating_profiles
-- Date: 2026-04-29
-- Purpose: Support conversation style preference storage in dating profiles

ALTER TABLE dating_profiles
ADD COLUMN IF NOT EXISTS conversation_style VARCHAR(50) DEFAULT NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_dating_profiles_conversation_style 
ON dating_profiles(conversation_style);
