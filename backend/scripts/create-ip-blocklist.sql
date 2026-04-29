-- Create ip_blocklist table if it doesn't exist
-- This is a backup SQL script in case the Sequelize sync fails

CREATE TABLE IF NOT EXISTS "ip_blocklist" (
  "id" SERIAL PRIMARY KEY,
  "ip_address" VARCHAR(45) NOT NULL UNIQUE,
  "reason" VARCHAR(255) DEFAULT 'underage_attempt',
  "block_duration_hours" INTEGER DEFAULT 2,
  "blocked_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP NOT NULL,
  "attempted_email" VARCHAR(255),
  "attempted_age" INTEGER,
  "attempt_count" INTEGER DEFAULT 1,
  "is_active" BOOLEAN DEFAULT true,
  "removed_at" TIMESTAMP,
  "removed_by_admin_id" INTEGER,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "ip_blocklist_ip_address_is_active" 
  ON "ip_blocklist" ("ip_address", "is_active", "expires_at");

CREATE INDEX IF NOT EXISTS "ip_blocklist_expires_at" 
  ON "ip_blocklist" ("expires_at");

CREATE INDEX IF NOT EXISTS "ip_blocklist_user_id" 
  ON "ip_blocklist" ("removed_by_admin_id");

-- Add comment
COMMENT ON TABLE "ip_blocklist" IS 'Stores blocked IP addresses with expiration times';
