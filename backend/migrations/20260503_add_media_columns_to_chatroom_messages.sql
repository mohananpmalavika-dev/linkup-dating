-- Add media support columns to chatroom_messages table
ALTER TABLE chatroom_messages
ADD COLUMN IF NOT EXISTS media_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Set defaults for existing rows
UPDATE chatroom_messages
SET media_type = NULL,
    media_url = NULL
WHERE media_type IS NULL AND media_url IS NULL;
