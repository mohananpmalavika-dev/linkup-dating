-- Add available_call_types column to track which call types users accept
ALTER TABLE dating_profiles
ADD COLUMN IF NOT EXISTS available_call_types TEXT[] DEFAULT '{"voice","video"}';

-- Set default for existing users who have calls enabled
UPDATE dating_profiles
SET available_call_types = '{"voice","video"}'
WHERE is_available_for_calls = TRUE AND available_call_types IS NULL;

-- Set empty array for users who have calls disabled
UPDATE dating_profiles
SET available_call_types = '{}'
WHERE is_available_for_calls = FALSE AND available_call_types IS NULL;

-- For safety, ensure all rows have a value
UPDATE dating_profiles
SET available_call_types = COALESCE(available_call_types, CASE WHEN is_available_for_calls THEN '{"voice","video"}' ELSE '{}' END)
WHERE available_call_types IS NULL;
