-- Migration: Add Age Verification Table
-- Date: 2026-04-28
-- Purpose: Enforce 18+ age requirement for DatingHub dating app

CREATE TABLE IF NOT EXISTS age_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  verification_method VARCHAR(50) NOT NULL CHECK (verification_method IN ('dob', 'id_verification', 'selfie_dob')),
  date_of_birth DATE,
  id_verification_id VARCHAR(255),
  selfie_photo_id VARCHAR(255),
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_age_verifications_user_id ON age_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_age_verifications_verified_at ON age_verifications(verified_at);

-- Add age column to dating_profiles if not exists (for quick reference)
ALTER TABLE dating_profiles 
ADD COLUMN IF NOT EXISTS age_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS age_verification_method VARCHAR(50);

-- Add comment for clarity
COMMENT ON TABLE age_verifications IS 'Stores age verification data for DatingHub dating app users. All users must be 18+ to use the platform.';
COMMENT ON COLUMN age_verifications.verification_method IS 'Method used for age verification: dob (date of birth), id_verification (government ID), or selfie_dob (selfie + DOB)';
COMMENT ON COLUMN age_verifications.is_verified IS 'Whether the age verification passed (confirmed user is 18+)';
