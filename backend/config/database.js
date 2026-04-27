const { Pool } = require('pg');
require('dotenv').config();

// Support both local development and production (Render)
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'linkup_dating',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres'
      }
);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

let databaseAvailable = false;

const init = async () => {
  let client;

  try {
    client = await pool.connect();
    databaseAvailable = true;
    console.log('✓ Connected to PostgreSQL');

    try {
      // Create users table
      await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      // Create dating_profiles table
      await client.query(`
      CREATE TABLE IF NOT EXISTS dating_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(100) UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        age INTEGER NOT NULL,
        gender VARCHAR(50),
        location_city VARCHAR(100),
        location_state VARCHAR(100),
        location_country VARCHAR(100),
        location_lat DECIMAL(10, 8),
        location_lng DECIMAL(11, 8),
        bio TEXT,
        height INTEGER,
        body_type VARCHAR(50),
        ethnicity VARCHAR(100),
        religion VARCHAR(100),
        smoking VARCHAR(50),
        drinking VARCHAR(50),
        has_kids BOOLEAN DEFAULT FALSE,
        wants_kids BOOLEAN DEFAULT FALSE,
        occupation VARCHAR(150),
        education VARCHAR(150),
        relationship_goals VARCHAR(50),
        interests TEXT[],
        profile_verified BOOLEAN DEFAULT FALSE,
        verifications JSONB DEFAULT '{}',
        profile_completion_percent INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        last_active TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      // Create profile_photos table
      await client.query(`
      CREATE TABLE IF NOT EXISTS profile_photos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        photo_url VARCHAR(500) NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        position INTEGER DEFAULT 0
      );
    `);

      // Create user_preferences table
      await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        age_range_min INTEGER DEFAULT 18,
        age_range_max INTEGER DEFAULT 50,
        location_radius INTEGER DEFAULT 50,
        gender_preferences TEXT[] DEFAULT '{}',
        relationship_goals TEXT[] DEFAULT '{}',
        interests TEXT[] DEFAULT '{}',
        height_range_min INTEGER,
        height_range_max INTEGER,
        body_types TEXT[] DEFAULT '{}',
        show_my_profile BOOLEAN DEFAULT TRUE,
        allow_messages BOOLEAN DEFAULT TRUE,
        notifications_enabled BOOLEAN DEFAULT TRUE,
        deal_breakers JSONB DEFAULT '{}',
        preference_flexibility JSONB DEFAULT '{"mode":"balanced","learnFromActivity":true}',
        compatibility_answers JSONB DEFAULT '{}',
        learning_profile JSONB DEFAULT '{"positiveSignals":{"interests":{},"relationshipGoals":{},"bodyTypes":{},"ageBands":{},"verification":{}},"negativeSignals":{"interests":{},"relationshipGoals":{},"bodyTypes":{},"ageBands":{},"verification":{}},"totalPositiveActions":0,"totalNegativeActions":0,"lastInteractionAt":null}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      // Create interactions table (likes/passes)
      await client.query(`
      CREATE TABLE IF NOT EXISTS interactions (
        id SERIAL PRIMARY KEY,
        from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        interaction_type VARCHAR(50),
        is_mutual BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_user_id, to_user_id, interaction_type)
      );
    `);

      // Create matches table
      await client.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        user_id_1 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_id_2 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'active',
        last_message_at TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id_1, user_id_2)
      );
    `);

      // Create messages table
      await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      await client.query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS media_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS media_url TEXT,
      ADD COLUMN IF NOT EXISTS duration INTEGER,
      ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS encryption_algorithm VARCHAR(50),
      ADD COLUMN IF NOT EXISTS encrypted_content TEXT,
      ADD COLUMN IF NOT EXISTS encryption_nonce VARCHAR(100),
      ADD COLUMN IF NOT EXISTS auth_tag VARCHAR(100),
      ADD COLUMN IF NOT EXISTS is_disappearing BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS disappears_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS disappear_after_seconds INTEGER,
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS has_location BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS location_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS location_accuracy INTEGER,
      ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) DEFAULT 'text',
      ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS replied_to_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS message_attachments (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        attachment_type VARCHAR(50) NOT NULL,
        thumbnail_path VARCHAR(500),
        metadata JSONB DEFAULT '{}',
        download_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(16) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id, emoji)
      );
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS message_templates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        emoji VARCHAR(10),
        is_pinned BOOLEAN DEFAULT FALSE,
        usage_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS encryption_keys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        public_key TEXT NOT NULL,
        encrypted_private_key TEXT NOT NULL,
        key_version INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, match_id)
      );
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS chat_backups (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
        backup_type VARCHAR(50) NOT NULL,
        format VARCHAR(20) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        expires_at TIMESTAMP,
        download_count INTEGER DEFAULT 0,
        is_encrypted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      // Create video_dates table
      await client.query(`
      CREATE TABLE IF NOT EXISTS video_dates (
        id SERIAL PRIMARY KEY,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        user_id_1 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_id_2 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_type VARCHAR(30) DEFAULT 'instant',
        scheduled_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(255),
        note TEXT,
        scheduled_at TIMESTAMP,
        reminder_minutes INTEGER DEFAULT 15,
        reminder_sent_user_1_at TIMESTAMP,
        reminder_sent_user_2_at TIMESTAMP,
        started_at TIMESTAMP,
        answered_at TIMESTAMP,
        ended_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'scheduled',
        room_id VARCHAR(255),
        duration_seconds INTEGER,
        user_1_joined_at TIMESTAMP,
        user_2_joined_at TIMESTAMP,
        user_1_left_at TIMESTAMP,
        user_2_left_at TIMESTAMP,
        no_show_status VARCHAR(50) DEFAULT 'pending',
        ended_reason VARCHAR(100),
        call_quality_preset VARCHAR(50) DEFAULT 'balanced',
        recording_requested BOOLEAN DEFAULT FALSE,
        recording_requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        recording_consented_user_1 BOOLEAN DEFAULT FALSE,
        recording_consented_user_2 BOOLEAN DEFAULT FALSE,
        recording_enabled BOOLEAN DEFAULT FALSE,
        screen_share_enabled BOOLEAN DEFAULT FALSE,
        screen_share_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        virtual_background_user_1 VARCHAR(50) DEFAULT 'none',
        virtual_background_user_2 VARCHAR(50) DEFAULT 'none',
        settings_snapshot JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      // Create verification_tokens table
      await client.query(`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        verification_type VARCHAR(50),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      // Create indices for better query performance
      await client.query(`
      CREATE INDEX IF NOT EXISTS idx_dating_profiles_user_id ON dating_profiles(user_id);
      CREATE INDEX IF NOT EXISTS idx_profile_photos_user_id ON profile_photos(user_id);
      CREATE INDEX IF NOT EXISTS idx_interactions_users ON interactions(from_user_id, to_user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_media_type ON messages(media_type);
      CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
      CREATE INDEX IF NOT EXISTS idx_messages_is_deleted ON messages(is_deleted);
      CREATE INDEX IF NOT EXISTS idx_messages_is_disappearing ON messages(is_disappearing);
      CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);
      CREATE INDEX IF NOT EXISTS idx_message_attachments_type ON message_attachments(attachment_type);
      CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
      CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_message_templates_user_id ON message_templates(user_id);
      CREATE INDEX IF NOT EXISTS idx_message_templates_pinned ON message_templates(user_id, is_pinned);
      CREATE INDEX IF NOT EXISTS idx_encryption_keys_match_id ON encryption_keys(match_id);
      CREATE INDEX IF NOT EXISTS idx_encryption_keys_active ON encryption_keys(is_active);
      CREATE INDEX IF NOT EXISTS idx_chat_backups_user_id ON chat_backups(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_backups_match_id ON chat_backups(match_id);
    `);

      // Migration: backfill legacy users columns expected by auth and profile flows
      await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

      await client.query(`
      ALTER TABLE users
      ALTER COLUMN is_admin SET DEFAULT FALSE,
      ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
      ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
    `);

      await client.query(`
      UPDATE users
      SET is_admin = COALESCE(is_admin, FALSE),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
      WHERE is_admin IS NULL
         OR created_at IS NULL
         OR updated_at IS NULL;
    `);

      await client.query(`
      ALTER TABLE user_preferences
      ADD COLUMN IF NOT EXISTS deal_breakers JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS preference_flexibility JSONB DEFAULT '{"mode":"balanced","learnFromActivity":true}',
      ADD COLUMN IF NOT EXISTS compatibility_answers JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS learning_profile JSONB DEFAULT '{"positiveSignals":{"interests":{},"relationshipGoals":{},"bodyTypes":{},"ageBands":{},"verification":{}},"negativeSignals":{"interests":{},"relationshipGoals":{},"bodyTypes":{},"ageBands":{},"verification":{}},"totalPositiveActions":0,"totalNegativeActions":0,"lastInteractionAt":null}';
    `);

      await client.query(`
      UPDATE user_preferences
      SET deal_breakers = COALESCE(deal_breakers, '{}'::jsonb),
          preference_flexibility = COALESCE(preference_flexibility, '{"mode":"balanced","learnFromActivity":true}'::jsonb),
          compatibility_answers = COALESCE(compatibility_answers, '{}'::jsonb),
          learning_profile = COALESCE(
            learning_profile,
            '{"positiveSignals":{"interests":{},"relationshipGoals":{},"bodyTypes":{},"ageBands":{},"verification":{}},"negativeSignals":{"interests":{},"relationshipGoals":{},"bodyTypes":{},"ageBands":{},"verification":{}},"totalPositiveActions":0,"totalNegativeActions":0,"lastInteractionAt":null}'::jsonb
          )
      WHERE deal_breakers IS NULL
         OR preference_flexibility IS NULL
         OR compatibility_answers IS NULL
         OR learning_profile IS NULL;
    `);

      // Migration: Add username column if it doesn't exist
      await client.query(`
      ALTER TABLE dating_profiles
      ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;
    `);

      await client.query(`
      ALTER TABLE dating_profiles
      ADD COLUMN IF NOT EXISTS verification_photo_url TEXT,
      ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS verification_pose VARCHAR(50),
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
    `);

    // Migration: Add storefront_data column for cart, favorites, saved addresses
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS storefront_data JSONB DEFAULT '{"cart": [], "favorites": [], "savedAddresses": []}';
    `);

    // Migration: allow long photo payloads such as data URLs
    await client.query(`
      ALTER TABLE profile_photos
      ALTER COLUMN photo_url TYPE TEXT;
    `);

    // Migration: enrich video call sessions with scheduling, consent, reminders, and QA metadata
    await client.query(`
      ALTER TABLE video_dates
      ADD COLUMN IF NOT EXISTS session_type VARCHAR(30) DEFAULT 'instant',
      ADD COLUMN IF NOT EXISTS scheduled_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS note TEXT,
      ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER DEFAULT 15,
      ADD COLUMN IF NOT EXISTS reminder_sent_user_1_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reminder_sent_user_2_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS user_1_joined_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS user_2_joined_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS user_1_left_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS user_2_left_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS no_show_status VARCHAR(50) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS ended_reason VARCHAR(100),
      ADD COLUMN IF NOT EXISTS call_quality_preset VARCHAR(50) DEFAULT 'balanced',
      ADD COLUMN IF NOT EXISTS recording_requested BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS recording_requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS recording_consented_user_1 BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS recording_consented_user_2 BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS recording_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS screen_share_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS screen_share_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS virtual_background_user_1 VARCHAR(50) DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS virtual_background_user_2 VARCHAR(50) DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS settings_snapshot JSONB DEFAULT '{}';
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_video_dates_match_id ON video_dates(match_id);
      CREATE INDEX IF NOT EXISTS idx_video_dates_status ON video_dates(status);
      CREATE INDEX IF NOT EXISTS idx_video_dates_scheduled_at ON video_dates(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_video_dates_session_type ON video_dates(session_type);
      CREATE INDEX IF NOT EXISTS idx_video_dates_user_1 ON video_dates(user_id_1);
      CREATE INDEX IF NOT EXISTS idx_video_dates_user_2 ON video_dates(user_id_2);
    `);
    // Create chatrooms table for group chats
    await client.query(`
      CREATE TABLE IF NOT EXISTS chatrooms (
        id SERIAL PRIMARY KEY,
        created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        avatar_url TEXT,
        is_public BOOLEAN DEFAULT TRUE,
        max_members INTEGER DEFAULT 100,
        member_count INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create chatroom_members junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chatroom_members (
        id SERIAL PRIMARY KEY,
        chatroom_id INTEGER NOT NULL REFERENCES chatrooms(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(chatroom_id, user_id)
      );
    `);

    // Create chatroom_messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chatroom_messages (
        id SERIAL PRIMARY KEY,
        chatroom_id INTEGER NOT NULL REFERENCES chatrooms(id) ON DELETE CASCADE,
        from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create lobby_messages table for public global chat
    await client.query(`
      CREATE TABLE IF NOT EXISTS lobby_messages (
        id SERIAL PRIMARY KEY,
        from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indices for chatroom queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chatroom_members_chatroom_id ON chatroom_members(chatroom_id);
      CREATE INDEX IF NOT EXISTS idx_chatroom_members_user_id ON chatroom_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_chatroom_messages_chatroom_id ON chatroom_messages(chatroom_id);
      CREATE INDEX IF NOT EXISTS idx_chatroom_messages_created_at ON chatroom_messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_lobby_messages_created_at ON lobby_messages(created_at);
    `);

    // Create user_blocks table for blocking functionality
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_blocks (
        id SERIAL PRIMARY KEY,
        blocking_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(blocking_user_id, blocked_user_id)
      );
    `);

    // Create user_reports table for abuse reporting
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_reports (
        id SERIAL PRIMARY KEY,
        reporting_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reported_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );
    `);

    // Create indices for user_blocks and user_reports
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_blocks_blocking_user_id ON user_blocks(blocking_user_id);
      CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user_id ON user_blocks(blocked_user_id);
      CREATE INDEX IF NOT EXISTS idx_user_reports_reporting_user_id ON user_reports(reporting_user_id);
      CREATE INDEX IF NOT EXISTS idx_user_reports_reported_user_id ON user_reports(reported_user_id);
    `);

    // Create admin_actions table for moderation activities
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_actions (
        id SERIAL PRIMARY KEY,
        admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action_type VARCHAR(100) NOT NULL,
        target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        details JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create user_analytics table for DAU, MAU, engagement metrics
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_analytics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        activity_date DATE NOT NULL,
        session_count INTEGER DEFAULT 1,
        messages_sent INTEGER DEFAULT 0,
        profiles_viewed INTEGER DEFAULT 0,
        likes_sent INTEGER DEFAULT 0,
        likes_used INTEGER DEFAULT 0,
        superlikes_used INTEGER DEFAULT 0,
        rewinds_used INTEGER DEFAULT 0,
        matches_made INTEGER DEFAULT 0,
        video_call_duration_seconds INTEGER DEFAULT 0,
        last_active TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, activity_date)
      );
    `);

    await client.query(`
      ALTER TABLE user_analytics
      ADD COLUMN IF NOT EXISTS likes_used INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS superlikes_used INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rewinds_used INTEGER DEFAULT 0;
    `);

    await client.query(`
      UPDATE user_analytics
      SET likes_used = COALESCE(likes_used, 0),
          superlikes_used = COALESCE(superlikes_used, 0),
          rewinds_used = COALESCE(rewinds_used, 0)
      WHERE likes_used IS NULL
         OR superlikes_used IS NULL
         OR rewinds_used IS NULL;
    `);

    // Create user_session_logs table for tracking activity
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_session_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        action VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create spam_flags table for spam detection
    await client.query(`
      CREATE TABLE IF NOT EXISTS spam_flags (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        flagged_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reason VARCHAR(255),
        severity VARCHAR(50) DEFAULT 'low',
        description TEXT,
        is_resolved BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create fraud_flags table for fraud detection
    await client.query(`
      CREATE TABLE IF NOT EXISTS fraud_flags (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        flag_type VARCHAR(100) NOT NULL,
        description TEXT,
        confidence_score DECIMAL(3, 2),
        is_resolved BOOLEAN DEFAULT FALSE,
        action_taken VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create manual moderation flags for agent/admin review workflows
    await client.query(`
      CREATE TABLE IF NOT EXISTS moderation_flags (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        flagged_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        source_type VARCHAR(50) DEFAULT 'admin_manual',
        flag_category VARCHAR(50) DEFAULT 'behavior',
        severity VARCHAR(20) DEFAULT 'medium',
        title VARCHAR(255),
        reason TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        metadata JSONB DEFAULT '{}',
        reviewed_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        review_notes TEXT,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create photo moderation queue for profile and verification photos
    await client.query(`
      CREATE TABLE IF NOT EXISTS photo_moderation_queue (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_photo_id INTEGER REFERENCES profile_photos(id) ON DELETE SET NULL,
        photo_url TEXT NOT NULL,
        source_type VARCHAR(50) DEFAULT 'profile_photo',
        status VARCHAR(50) DEFAULT 'pending',
        automated_labels JSONB DEFAULT '{}',
        automated_risk_score INTEGER DEFAULT 0,
        automated_reasons TEXT[] DEFAULT '{}',
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        review_notes TEXT,
        review_action VARCHAR(100),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create user bans / suspensions table for moderation enforcement
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_bans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ban_type VARCHAR(50) DEFAULT 'suspension',
        status VARCHAR(50) DEFAULT 'active',
        reason TEXT NOT NULL,
        notes TEXT,
        origin VARCHAR(50) DEFAULT 'manual',
        details JSONB DEFAULT '{}',
        issued_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        revoked_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        revoked_at TIMESTAMP,
        revoke_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create moderation appeals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS moderation_appeals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ban_id INTEGER REFERENCES user_bans(id) ON DELETE SET NULL,
        subject VARCHAR(255),
        message TEXT NOT NULL,
        contact_email VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        review_notes TEXT,
        resolution_action VARCHAR(100),
        reviewed_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create system_metrics table for overall platform analytics
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_metrics (
        id SERIAL PRIMARY KEY,
        metric_date DATE NOT NULL,
        daily_active_users INTEGER DEFAULT 0,
        monthly_active_users INTEGER DEFAULT 0,
        total_messages INTEGER DEFAULT 0,
        total_matches INTEGER DEFAULT 0,
        new_users INTEGER DEFAULT 0,
        reported_users INTEGER DEFAULT 0,
        spam_flagged_users INTEGER DEFAULT 0,
        fraud_flagged_users INTEGER DEFAULT 0,
        pending_photo_reviews INTEGER DEFAULT 0,
        pending_appeals INTEGER DEFAULT 0,
        active_bans INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(metric_date)
      );
    `);

    await client.query(`
      ALTER TABLE system_metrics
      ADD COLUMN IF NOT EXISTS pending_photo_reviews INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pending_appeals INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS active_bans INTEGER DEFAULT 0;
    `);

    // Create favorite_profiles table for saved dating profiles
    await client.query(`
      CREATE TABLE IF NOT EXISTS favorite_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        favorite_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, favorite_user_id)
      );
    `);

    // Create user_search_history table for dating search history
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_search_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source VARCHAR(50) DEFAULT 'search',
        filters JSONB DEFAULT '{}',
        result_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create user_notifications table for in-app notification center
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notification_type VARCHAR(100) DEFAULT 'general',
        title VARCHAR(255) NOT NULL,
        body TEXT,
        metadata JSONB DEFAULT '{}',
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indices for analytics tables
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_user_id ON admin_actions(admin_user_id);
      CREATE INDEX IF NOT EXISTS idx_admin_actions_target_user_id ON admin_actions(target_user_id);
      CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at);
      CREATE INDEX IF NOT EXISTS idx_moderation_flags_user_id ON moderation_flags(user_id);
      CREATE INDEX IF NOT EXISTS idx_moderation_flags_status ON moderation_flags(status);
      CREATE INDEX IF NOT EXISTS idx_moderation_flags_source_type ON moderation_flags(source_type);
      CREATE INDEX IF NOT EXISTS idx_moderation_flags_created_at ON moderation_flags(created_at);
      CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON user_analytics(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_analytics_activity_date ON user_analytics(activity_date);
      CREATE INDEX IF NOT EXISTS idx_user_session_logs_user_id ON user_session_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_session_logs_created_at ON user_session_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_spam_flags_user_id ON spam_flags(user_id);
      CREATE INDEX IF NOT EXISTS idx_spam_flags_created_at ON spam_flags(created_at);
      CREATE INDEX IF NOT EXISTS idx_fraud_flags_user_id ON fraud_flags(user_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_flags_created_at ON fraud_flags(created_at);
      CREATE INDEX IF NOT EXISTS idx_photo_moderation_queue_user_id ON photo_moderation_queue(user_id);
      CREATE INDEX IF NOT EXISTS idx_photo_moderation_queue_status ON photo_moderation_queue(status);
      CREATE INDEX IF NOT EXISTS idx_photo_moderation_queue_source_type ON photo_moderation_queue(source_type);
      CREATE INDEX IF NOT EXISTS idx_user_bans_user_id ON user_bans(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_bans_status ON user_bans(status);
      CREATE INDEX IF NOT EXISTS idx_user_bans_expires_at ON user_bans(expires_at);
      CREATE INDEX IF NOT EXISTS idx_moderation_appeals_user_id ON moderation_appeals(user_id);
      CREATE INDEX IF NOT EXISTS idx_moderation_appeals_status ON moderation_appeals(status);
      CREATE INDEX IF NOT EXISTS idx_moderation_appeals_created_at ON moderation_appeals(created_at);
      CREATE INDEX IF NOT EXISTS idx_system_metrics_metric_date ON system_metrics(metric_date);
      CREATE INDEX IF NOT EXISTS idx_favorite_profiles_user_id ON favorite_profiles(user_id);
      CREATE INDEX IF NOT EXISTS idx_favorite_profiles_favorite_user_id ON favorite_profiles(favorite_user_id);
      CREATE INDEX IF NOT EXISTS idx_user_search_history_user_id ON user_search_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_search_history_created_at ON user_search_history(created_at);
      CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at);

      -- Discovery queue deduplication table
      CREATE TABLE IF NOT EXISTS discovery_queue_shown (
        id SERIAL PRIMARY KEY,
        viewer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        shown_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        shown_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(viewer_user_id, shown_user_id)
      );

      -- Indexes for discovery performance
      CREATE INDEX IF NOT EXISTS idx_dating_profiles_age ON dating_profiles(age);
      CREATE INDEX IF NOT EXISTS idx_dating_profiles_location_lat ON dating_profiles(location_lat);
      CREATE INDEX IF NOT EXISTS idx_dating_profiles_location_lng ON dating_profiles(location_lng);
      CREATE INDEX IF NOT EXISTS idx_dating_profiles_created_at ON dating_profiles(created_at);
      CREATE INDEX IF NOT EXISTS idx_dating_profiles_is_active ON dating_profiles(is_active) WHERE is_active = true;
      CREATE INDEX IF NOT EXISTS idx_dating_profiles_gender ON dating_profiles(gender);
      CREATE INDEX IF NOT EXISTS idx_dating_profiles_relationship_goals ON dating_profiles(relationship_goals);
      CREATE INDEX IF NOT EXISTS idx_dating_profiles_body_type ON dating_profiles(body_type);
      CREATE INDEX IF NOT EXISTS idx_dating_profiles_height ON dating_profiles(height);
      CREATE INDEX IF NOT EXISTS idx_discovery_queue_shown_viewer ON discovery_queue_shown(viewer_user_id, shown_at);
      CREATE INDEX IF NOT EXISTS idx_discovery_queue_shown_pair ON discovery_queue_shown(viewer_user_id, shown_user_id);

      -- Composite indexes for common discovery filter combinations
      CREATE INDEX IF NOT EXISTS idx_dp_active_gender_age_updated ON dating_profiles(is_active, gender, age, updated_at DESC, id);
      CREATE INDEX IF NOT EXISTS idx_dp_active_goals_updated ON dating_profiles(is_active, relationship_goals, updated_at DESC, id);
      CREATE INDEX IF NOT EXISTS idx_dp_active_verified_updated ON dating_profiles(is_active, profile_verified, updated_at DESC, id);
      CREATE INDEX IF NOT EXISTS idx_dp_active_completion_updated ON dating_profiles(is_active, profile_completion_percent, updated_at DESC, id);

      -- GIN index for interests array overlap queries
      CREATE INDEX IF NOT EXISTS idx_dating_profiles_interests_gin ON dating_profiles USING GIN(interests);

      -- Index for cursor-based pagination
      CREATE INDEX IF NOT EXISTS idx_dating_profiles_cursor ON dating_profiles(updated_at DESC, id DESC);

      -- Covering index for trending queries
      CREATE INDEX IF NOT EXISTS idx_interactions_to_user_type_created ON interactions(to_user_id, interaction_type, created_at);

      -- Index for profile views analytics
      CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_user ON profile_views(viewed_user_id, viewed_at DESC);
    `);

      console.log('✓ Database schema initialized');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    databaseAvailable = false;
    console.error('Error initializing database:', err);

    if (err.code === 'ECONNREFUSED' && process.env.NODE_ENV !== 'production') {
      console.warn('⚠ PostgreSQL is unavailable. Starting backend without database connectivity in development mode.');
      return false;
    }

    throw err;
  }
};

const isAvailable = () => databaseAvailable;

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  init,
  isAvailable
};
