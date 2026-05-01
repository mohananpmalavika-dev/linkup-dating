const { Pool } = require('pg');
require('dotenv').config();

// Support both local development and production (Render)
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'linkup_dating',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        ssl: { rejectUnauthorized: false }
      }
);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

let databaseAvailable = false;
let ormBridge = null;

const getOrmBridge = () => {
  if (!ormBridge) {
    ormBridge = require('../models');
  }

  return ormBridge;
};

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
        phone VARCHAR(32) UNIQUE,
        password VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS age_verifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        verification_method VARCHAR(50) NOT NULL,
        date_of_birth DATE,
        is_verified BOOLEAN DEFAULT FALSE,
        verified_at TIMESTAMP,
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
        location_district VARCHAR(100),
        location_locality VARCHAR(150),
        location_pincode VARCHAR(6),
        kerala_region VARCHAR(50),
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

      await client.query(`
      ALTER TABLE dating_profiles
      ADD COLUMN IF NOT EXISTS is_available_for_calls BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS call_earnings DECIMAL(12,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS pending_payout DECIMAL(12,2) DEFAULT 0.00,
      ADD COLUMN IF NOT EXISTS total_calls_taken INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_call_minutes INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS call_rating DECIMAL(3,2) DEFAULT 0.00;
    `);

      await client.query(`
      UPDATE dating_profiles
      SET is_available_for_calls = COALESCE(is_available_for_calls, FALSE),
          call_earnings = COALESCE(call_earnings, 0.00),
          pending_payout = COALESCE(pending_payout, 0.00),
          total_calls_taken = COALESCE(total_calls_taken, 0),
          total_call_minutes = COALESCE(total_call_minutes, 0),
          call_rating = COALESCE(call_rating, 0.00)
      WHERE is_available_for_calls IS NULL
         OR call_earnings IS NULL
         OR pending_payout IS NULL
         OR total_calls_taken IS NULL
         OR total_call_minutes IS NULL
         OR call_rating IS NULL;
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
        match_management JSONB DEFAULT '{"archivedMatches":{},"snoozedMatches":{}}',
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
        CONSTRAINT unique_interactions_user_pair_type UNIQUE(from_user_id, to_user_id, interaction_type)
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

      await client.query(`
      ALTER TABLE matches
      ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

      await client.query(`
      UPDATE matches
      SET message_count = COALESCE(message_count, 0)
      WHERE message_count IS NULL;
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
      CREATE TABLE IF NOT EXISTS message_streak_trackers (
        id SERIAL PRIMARY KEY,
        user_id_1 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_id_2 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        streak_days INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        streak_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_message_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        streak_broken_date TIMESTAMP,
        milestone_3_days BOOLEAN DEFAULT FALSE,
        milestone_7_days BOOLEAN DEFAULT FALSE,
        milestone_30_days BOOLEAN DEFAULT FALSE,
        total_messages INTEGER DEFAULT 0,
        total_reactions INTEGER DEFAULT 0,
        engagement_score FLOAT DEFAULT 0,
        notification_sent BOOLEAN DEFAULT FALSE,
        last_notification_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id_1, user_id_2, match_id)
      );
    `);

      await client.query(`
      ALTER TABLE message_streak_trackers
      ADD COLUMN IF NOT EXISTS user_id_1 INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS user_id_2 INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS streak_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_message_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS streak_broken_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS milestone_3_days BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS milestone_7_days BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS milestone_30_days BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS total_messages INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_reactions INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS engagement_score FLOAT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS last_notification_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
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

      await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan VARCHAR(50) DEFAULT 'free',
        status VARCHAR(20) DEFAULT 'active',
        started_at TIMESTAMP,
        expires_at TIMESTAMP,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        payment_method VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS user_reward_balances (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        boost_credits INTEGER DEFAULT 0,
        superlike_credits INTEGER DEFAULT 0,
        premium_days_awarded INTEGER DEFAULT 0,
        last_rewarded_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referral_code VARCHAR(20) UNIQUE NOT NULL,
        referral_link VARCHAR(500),
        referred_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'pending',
        reward JSONB DEFAULT '{}'::jsonb,
        expires_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      await client.query(`
      ALTER TABLE referrals
      ADD COLUMN IF NOT EXISTS referral_link VARCHAR(500),
      ADD COLUMN IF NOT EXISTS referred_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS reward JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS friend_relationships (
        id SERIAL PRIMARY KEY,
        user_id_1 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_id_2 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        request_sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        accepted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id_1, user_id_2)
      );
    `);

      await client.query(`
      ALTER TABLE friend_relationships
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS request_sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS friend_referrals (
        id SERIAL PRIMARY KEY,
        referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referral_type VARCHAR(40) DEFAULT 'romantic_setup',
        referral_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        accepted_at TIMESTAMP,
        match_result VARCHAR(30) DEFAULT 'pending'
      );
    `);

      await client.query(`
      ALTER TABLE friend_referrals
      ADD COLUMN IF NOT EXISTS referral_type VARCHAR(40) DEFAULT 'romantic_setup',
      ADD COLUMN IF NOT EXISTS referral_message TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS match_result VARCHAR(30) DEFAULT 'pending';
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS social_integrations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform VARCHAR(30) NOT NULL,
        username VARCHAR(255) NOT NULL,
        external_id VARCHAR(255),
        access_token TEXT,
        is_public BOOLEAN DEFAULT FALSE,
        synced_at TIMESTAMP,
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, platform)
      );
    `);

      await client.query(`
      ALTER TABLE social_integrations
      ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS access_token TEXT,
      ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS message_requests (
        id SERIAL PRIMARY KEY,
        from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        request_type VARCHAR(30) DEFAULT 'intent',
        is_priority BOOLEAN DEFAULT FALSE,
        delivery_band VARCHAR(30) DEFAULT 'standard',
        status VARCHAR(20) DEFAULT 'pending',
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_user_id, to_user_id)
      );
    `);

      await client.query(`
      ALTER TABLE message_requests
      ADD COLUMN IF NOT EXISTS request_type VARCHAR(30) DEFAULT 'intent',
      ADD COLUMN IF NOT EXISTS is_priority BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS delivery_band VARCHAR(30) DEFAULT 'standard',
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS group_chats (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        group_type VARCHAR(40) DEFAULT 'custom',
        match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL,
        profile_photo_url VARCHAR(500),
        max_members INTEGER DEFAULT 100,
        is_active BOOLEAN DEFAULT TRUE,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      await client.query(`
      ALTER TABLE group_chats
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS group_type VARCHAR(40) DEFAULT 'custom',
      ADD COLUMN IF NOT EXISTS match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS profile_photo_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS group_chat_members (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(30) DEFAULT 'member',
        status VARCHAR(30) DEFAULT 'active',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        left_at TIMESTAMP,
        last_read_message_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(group_id, user_id)
      );
    `);

      await client.query(`
      ALTER TABLE group_chat_members
      ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'member',
      ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS left_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_read_message_id INTEGER,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS group_chat_messages (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
        from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT,
        media_type VARCHAR(30),
        media_url VARCHAR(500),
        message_type VARCHAR(30) DEFAULT 'text',
        is_edited BOOLEAN DEFAULT FALSE,
        edited_at TIMESTAMP,
        reactions JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      await client.query(`
      ALTER TABLE group_chat_messages
      ADD COLUMN IF NOT EXISTS message TEXT,
      ADD COLUMN IF NOT EXISTS media_type VARCHAR(30),
      ADD COLUMN IF NOT EXISTS media_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS message_type VARCHAR(30) DEFAULT 'text',
      ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

      await client.query(`
      UPDATE referrals
      SET status = COALESCE(status, 'pending'),
          reward = COALESCE(reward, '{}'::jsonb),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
      WHERE status IS NULL
         OR reward IS NULL
         OR created_at IS NULL
         OR updated_at IS NULL;

      UPDATE friend_relationships
      SET status = COALESCE(status, 'pending'),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
      WHERE status IS NULL
         OR created_at IS NULL
         OR updated_at IS NULL;

      UPDATE friend_referrals
      SET referral_type = COALESCE(referral_type, 'romantic_setup'),
          match_result = COALESCE(match_result, 'pending'),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
      WHERE referral_type IS NULL
         OR match_result IS NULL
         OR created_at IS NULL;

      UPDATE social_integrations
      SET is_public = COALESCE(is_public, FALSE),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
      WHERE is_public IS NULL
         OR created_at IS NULL
         OR updated_at IS NULL;

      UPDATE message_requests
      SET request_type = COALESCE(request_type, 'intent'),
          is_priority = COALESCE(is_priority, FALSE),
          delivery_band = COALESCE(delivery_band, 'standard'),
          status = COALESCE(status, 'pending'),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
      WHERE request_type IS NULL
         OR is_priority IS NULL
         OR delivery_band IS NULL
         OR status IS NULL
         OR created_at IS NULL
         OR updated_at IS NULL;

      UPDATE group_chats
      SET group_type = COALESCE(group_type, 'custom'),
          max_members = COALESCE(max_members, 100),
          is_active = COALESCE(is_active, TRUE),
          settings = COALESCE(settings, '{}'::jsonb),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
      WHERE group_type IS NULL
         OR max_members IS NULL
         OR is_active IS NULL
         OR settings IS NULL
         OR created_at IS NULL
         OR updated_at IS NULL;

      UPDATE group_chat_members
      SET role = COALESCE(role, 'member'),
          status = COALESCE(status, 'active'),
          joined_at = COALESCE(joined_at, CURRENT_TIMESTAMP),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
      WHERE role IS NULL
         OR status IS NULL
         OR joined_at IS NULL
         OR created_at IS NULL
         OR updated_at IS NULL;

      UPDATE group_chat_messages
      SET message_type = COALESCE(message_type, 'text'),
          is_edited = COALESCE(is_edited, FALSE),
          reactions = COALESCE(reactions, '[]'::jsonb),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
      WHERE message_type IS NULL
         OR is_edited IS NULL
         OR reactions IS NULL
         OR created_at IS NULL
         OR updated_at IS NULL;
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS profile_boosts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        boost_expires_at TIMESTAMP NOT NULL,
        visibility_multiplier INTEGER DEFAULT 5,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS date_proposals (
        id SERIAL PRIMARY KEY,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        proposer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        proposed_date DATE NOT NULL,
        proposed_time TIME NOT NULL,
        suggested_activity VARCHAR(100) NOT NULL DEFAULT 'Coffee',
        location_id INTEGER,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        notes TEXT,
        response_deadline_at TIMESTAMP,
        responded_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      await client.query(`
      CREATE TABLE IF NOT EXISTS date_completion_feedback (
        id SERIAL PRIMARY KEY,
        date_proposal_id INTEGER NOT NULL REFERENCES date_proposals(id) ON DELETE CASCADE,
        rater_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        counterparty_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL,
        feedback_text TEXT,
        would_date_again BOOLEAN,
        match_quality_rating INTEGER,
        location_rating INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      await client.query(`
      ALTER TABLE date_proposals
      ADD COLUMN IF NOT EXISTS proposer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS suggested_activity VARCHAR(100),
      ADD COLUMN IF NOT EXISTS location_id INTEGER,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS response_deadline_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP;
    `);

      await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'date_proposals'
            AND column_name = 'initiator_user_id'
        ) THEN
          UPDATE date_proposals
          SET proposer_id = COALESCE(proposer_id, initiator_user_id),
              recipient_id = COALESCE(recipient_id, recipient_user_id),
              suggested_activity = COALESCE(
                suggested_activity,
                NULLIF(INITCAP(REPLACE(activity_type, '_', ' ')), ''),
                'Coffee'
              ),
              notes = COALESCE(notes, initiator_notes),
              response_deadline_at = COALESCE(response_deadline_at, responded_at),
              status = CASE
                WHEN status = 'proposed' THEN 'pending'
                ELSE COALESCE(status, 'pending')
              END
          WHERE proposer_id IS NULL
             OR recipient_id IS NULL
             OR suggested_activity IS NULL
             OR notes IS NULL
             OR response_deadline_at IS NULL
             OR status IS NULL
             OR status = 'proposed';
        ELSE
          UPDATE date_proposals
          SET suggested_activity = COALESCE(suggested_activity, 'Coffee'),
              status = CASE
                WHEN status = 'proposed' THEN 'pending'
                ELSE COALESCE(status, 'pending')
              END
          WHERE suggested_activity IS NULL
             OR status IS NULL
             OR status = 'proposed';
        END IF;
      END $$;
    `);

      await client.query(`
      ALTER TABLE date_completion_feedback
      ADD COLUMN IF NOT EXISTS rater_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS counterparty_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS rating INTEGER,
      ADD COLUMN IF NOT EXISTS feedback_text TEXT,
      ADD COLUMN IF NOT EXISTS would_date_again BOOLEAN,
      ADD COLUMN IF NOT EXISTS match_quality_rating INTEGER,
      ADD COLUMN IF NOT EXISTS location_rating INTEGER;
    `);

      await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'date_completion_feedback'
            AND column_name = 'overall_rating'
        ) THEN
          UPDATE date_completion_feedback
          SET rating = COALESCE(rating, overall_rating, conversation_quality, 4),
              feedback_text = COALESCE(feedback_text, notes),
              would_date_again = COALESCE(would_date_again, would_see_again),
              match_quality_rating = COALESCE(match_quality_rating, conversation_quality, overall_rating),
              location_rating = COALESCE(location_rating, overall_rating)
          WHERE rating IS NULL
             OR feedback_text IS NULL
             OR would_date_again IS NULL
             OR match_quality_rating IS NULL
             OR location_rating IS NULL;
        ELSE
          UPDATE date_completion_feedback
          SET rating = COALESCE(rating, 4)
          WHERE rating IS NULL;
        END IF;
      END $$;
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

      // Create call_settings table (admin-controlled rates)
      await client.query(`
      CREATE TABLE IF NOT EXISTS call_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        value TEXT,
        description VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      // Insert default call settings if not exist
      await client.query(`
      INSERT INTO call_settings (key, value, description) VALUES
      ('voice_rate_per_minute', '5', 'Rate per minute for voice calls (INR)'),
      ('video_rate_per_minute', '10', 'Rate per minute for video calls (INR)'),
      ('earner_payout_percent', '70', 'Percentage of revenue earned by call receiver'),
      ('min_payout_amount', '500', 'Minimum amount for payout request'),
      ('min_credits_purchase', '50', 'Minimum credits purchase amount'),
      ('calling_enabled', 'true', 'Enable/disable calling feature'),
      ('payment_gateway', 'razorpay', 'Payment gateway: razorpay, upi, or both')
      ON CONFLICT (key) DO NOTHING;
    `);

      // Create call_sessions table
      await client.query(`
      CREATE TABLE IF NOT EXISTS call_sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(100) UNIQUE NOT NULL,
        caller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        receiver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        call_type VARCHAR(20) DEFAULT 'voice',
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        duration_seconds INTEGER DEFAULT 0,
        rate_per_minute DECIMAL(10,2) DEFAULT 0.00,
        total_cost DECIMAL(10,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'requested',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP
      );
    `);

      // Create call_requests table
      await client.query(`
      CREATE TABLE IF NOT EXISTS call_requests (
        id SERIAL PRIMARY KEY,
        request_id VARCHAR(100) UNIQUE NOT NULL,
        session_id VARCHAR(100),
        caller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        call_type VARCHAR(20) DEFAULT 'voice',
        credits_required DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        responded_at TIMESTAMP
      );
    `);

      // Create call_credits table for calling feature
      await client.query(`
      CREATE TABLE IF NOT EXISTS call_credits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        credits_balance DECIMAL(12,2) DEFAULT 0.00,
        total_spent DECIMAL(12,2) DEFAULT 0.00,
        total_purchased DECIMAL(12,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_credits UNIQUE (user_id)
      );
    `);

      // Create call_earnings table
      await client.query(`
      CREATE TABLE IF NOT EXISTS call_earnings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        call_session_id INTEGER,
        amount DECIMAL(10,2) NOT NULL,
        type VARCHAR(20) NOT NULL,
        reference_id VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending',
        payment_method VARCHAR(20),
        payment_reference VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP
      );
    `);

      // Create call_payouts table
      await client.query(`
      CREATE TABLE IF NOT EXISTS call_payouts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL,
        method VARCHAR(20) NOT NULL,
        upi_id VARCHAR(100),
        bank_account VARCHAR(50),
        bank_ifsc VARCHAR(20),
        status VARCHAR(20) DEFAULT 'pending',
        failure_reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP
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
      CREATE INDEX IF NOT EXISTS idx_message_streak_trackers_pair_match ON message_streak_trackers(user_id_1, user_id_2, match_id);
      CREATE INDEX IF NOT EXISTS idx_message_streak_trackers_match_id ON message_streak_trackers(match_id);
      CREATE INDEX IF NOT EXISTS idx_message_streak_trackers_user_1 ON message_streak_trackers(user_id_1);
      CREATE INDEX IF NOT EXISTS idx_message_streak_trackers_user_2 ON message_streak_trackers(user_id_2);
      CREATE INDEX IF NOT EXISTS idx_message_streak_trackers_active ON message_streak_trackers(is_active);
      CREATE INDEX IF NOT EXISTS idx_message_streak_trackers_days ON message_streak_trackers(streak_days DESC);
      CREATE INDEX IF NOT EXISTS idx_message_templates_user_id ON message_templates(user_id);
      CREATE INDEX IF NOT EXISTS idx_message_templates_pinned ON message_templates(user_id, is_pinned);
      CREATE INDEX IF NOT EXISTS idx_encryption_keys_match_id ON encryption_keys(match_id);
      CREATE INDEX IF NOT EXISTS idx_encryption_keys_active ON encryption_keys(is_active);
      CREATE INDEX IF NOT EXISTS idx_chat_backups_user_id ON chat_backups(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_backups_match_id ON chat_backups(match_id);
      CREATE INDEX IF NOT EXISTS idx_call_credits_user_id ON call_credits(user_id);
      CREATE INDEX IF NOT EXISTS idx_call_earnings_user_id ON call_earnings(user_id);
      CREATE INDEX IF NOT EXISTS idx_call_payouts_user_id ON call_payouts(user_id);
      CREATE INDEX IF NOT EXISTS idx_call_sessions_caller_id ON call_sessions(caller_id);
      CREATE INDEX IF NOT EXISTS idx_call_sessions_receiver_id ON call_sessions(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_call_requests_caller_id ON call_requests(caller_id);
      CREATE INDEX IF NOT EXISTS idx_call_requests_receiver_id ON call_requests(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_call_requests_status ON call_requests(status);
      CREATE INDEX IF NOT EXISTS idx_availability_calls ON dating_profiles(is_available_for_calls)
        WHERE is_available_for_calls = TRUE;
      CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON referrals(referrer_user_id);
      CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON referrals(referral_code);
      CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
      CREATE INDEX IF NOT EXISTS idx_friend_relationships_user_1_status ON friend_relationships(user_id_1, status);
      CREATE INDEX IF NOT EXISTS idx_friend_relationships_user_2_status ON friend_relationships(user_id_2, status);
      CREATE INDEX IF NOT EXISTS idx_friend_referrals_recipient_id ON friend_referrals(recipient_user_id);
      CREATE INDEX IF NOT EXISTS idx_social_integrations_user_id ON social_integrations(user_id);
      CREATE INDEX IF NOT EXISTS idx_message_requests_from_user_id ON message_requests(from_user_id);
      CREATE INDEX IF NOT EXISTS idx_message_requests_to_user_id ON message_requests(to_user_id);
      CREATE INDEX IF NOT EXISTS idx_group_chats_created_by_user_id ON group_chats(created_by_user_id);
      CREATE INDEX IF NOT EXISTS idx_group_chat_members_group_id ON group_chat_members(group_id);
      CREATE INDEX IF NOT EXISTS idx_group_chat_members_user_id ON group_chat_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_group_chat_messages_group_id ON group_chat_messages(group_id);
    `);

      // Migration: backfill legacy users columns expected by auth and profile flows
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS phone VARCHAR(32),
      ADD COLUMN IF NOT EXISTS mpin_hash VARCHAR(255),
      ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
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
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique
      ON users(phone)
      WHERE phone IS NOT NULL;
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
      ADD COLUMN IF NOT EXISTS learning_profile JSONB DEFAULT '{"positiveSignals":{"interests":{},"relationshipGoals":{},"bodyTypes":{},"ageBands":{},"verification":{}},"negativeSignals":{"interests":{},"relationshipGoals":{},"bodyTypes":{},"ageBands":{},"verification":{}},"totalPositiveActions":0,"totalNegativeActions":0,"lastInteractionAt":null}',
      ADD COLUMN IF NOT EXISTS match_management JSONB DEFAULT '{"archivedMatches":{},"snoozedMatches":{}}';
    `);

      await client.query(`
      UPDATE user_preferences
      SET deal_breakers = COALESCE(deal_breakers, '{}'::jsonb),
          preference_flexibility = COALESCE(preference_flexibility, '{"mode":"balanced","learnFromActivity":true}'::jsonb),
          compatibility_answers = COALESCE(compatibility_answers, '{}'::jsonb),
          learning_profile = COALESCE(
            learning_profile,
            '{"positiveSignals":{"interests":{},"relationshipGoals":{},"bodyTypes":{},"ageBands":{},"verification":{}},"negativeSignals":{"interests":{},"relationshipGoals":{},"bodyTypes":{},"ageBands":{},"verification":{}},"totalPositiveActions":0,"totalNegativeActions":0,"lastInteractionAt":null}'::jsonb
          ),
          match_management = COALESCE(
            match_management,
            '{"archivedMatches":{},"snoozedMatches":{}}'::jsonb
          )
      WHERE deal_breakers IS NULL
         OR preference_flexibility IS NULL
         OR compatibility_answers IS NULL
         OR learning_profile IS NULL
         OR match_management IS NULL;
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

      await client.query(`
      ALTER TABLE dating_profiles
      ADD COLUMN IF NOT EXISTS voice_intro_url TEXT,
      ADD COLUMN IF NOT EXISTS voice_intro_duration_seconds INTEGER,
      ADD COLUMN IF NOT EXISTS video_intro_url TEXT;
    `);

      await client.query(`
      ALTER TABLE dating_profiles
      ALTER COLUMN voice_intro_url TYPE TEXT,
      ALTER COLUMN video_intro_url TYPE TEXT;
    `);

      await client.query(`
      ALTER TABLE dating_profiles
      ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS community_preference VARCHAR(100),
      ADD COLUMN IF NOT EXISTS conversation_style VARCHAR(50);
    `);

      await client.query(`
      UPDATE dating_profiles
      SET languages = COALESCE(languages, '{}'::text[])
      WHERE languages IS NULL;
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
      ADD COLUMN IF NOT EXISTS match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS user_id_1 INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS user_id_2 INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS session_type VARCHAR(30) DEFAULT 'instant',
      ADD COLUMN IF NOT EXISTS scheduled_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS note TEXT,
      ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER DEFAULT 15,
      ADD COLUMN IF NOT EXISTS reminder_sent_user_1_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reminder_sent_user_2_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'scheduled',
      ADD COLUMN IF NOT EXISTS room_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
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
      ADD COLUMN IF NOT EXISTS settings_snapshot JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'video_dates' AND column_name = 'settings_snapshot'
            AND udt_name <> 'jsonb'
        ) THEN
          ALTER TABLE video_dates
          ALTER COLUMN settings_snapshot TYPE JSONB
          USING COALESCE(settings_snapshot::jsonb, '{}'::jsonb);
        END IF;
      END $$;
    `);

    await client.query(`
      ALTER TABLE video_dates
      ALTER COLUMN session_type SET DEFAULT 'instant',
      ALTER COLUMN reminder_minutes SET DEFAULT 15,
      ALTER COLUMN status SET DEFAULT 'scheduled',
      ALTER COLUMN no_show_status SET DEFAULT 'pending',
      ALTER COLUMN call_quality_preset SET DEFAULT 'balanced',
      ALTER COLUMN recording_requested SET DEFAULT FALSE,
      ALTER COLUMN recording_consented_user_1 SET DEFAULT FALSE,
      ALTER COLUMN recording_consented_user_2 SET DEFAULT FALSE,
      ALTER COLUMN recording_enabled SET DEFAULT FALSE,
      ALTER COLUMN screen_share_enabled SET DEFAULT FALSE,
      ALTER COLUMN virtual_background_user_1 SET DEFAULT 'none',
      ALTER COLUMN virtual_background_user_2 SET DEFAULT 'none',
      ALTER COLUMN settings_snapshot SET DEFAULT '{}',
      ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
      ALTER COLUMN scheduled_by_user_id DROP NOT NULL,
      ALTER COLUMN title DROP NOT NULL,
      ALTER COLUMN note DROP NOT NULL,
      ALTER COLUMN scheduled_at DROP NOT NULL,
      ALTER COLUMN started_at DROP NOT NULL,
      ALTER COLUMN answered_at DROP NOT NULL,
      ALTER COLUMN ended_at DROP NOT NULL,
      ALTER COLUMN room_id DROP NOT NULL,
      ALTER COLUMN duration_seconds DROP NOT NULL,
      ALTER COLUMN recording_requested_by DROP NOT NULL,
      ALTER COLUMN screen_share_user_id DROP NOT NULL;
    `);

    await client.query(`
      UPDATE video_dates
      SET session_type = COALESCE(session_type, 'instant'),
          reminder_minutes = COALESCE(reminder_minutes, 15),
          status = COALESCE(status, 'scheduled'),
          no_show_status = COALESCE(no_show_status, 'pending'),
          call_quality_preset = COALESCE(call_quality_preset, 'balanced'),
          recording_requested = COALESCE(recording_requested, FALSE),
          recording_consented_user_1 = COALESCE(recording_consented_user_1, FALSE),
          recording_consented_user_2 = COALESCE(recording_consented_user_2, FALSE),
          recording_enabled = COALESCE(recording_enabled, FALSE),
          screen_share_enabled = COALESCE(screen_share_enabled, FALSE),
          virtual_background_user_1 = COALESCE(virtual_background_user_1, 'none'),
          virtual_background_user_2 = COALESCE(virtual_background_user_2, 'none'),
          settings_snapshot = COALESCE(settings_snapshot, '{}'::jsonb),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
      WHERE session_type IS NULL
         OR reminder_minutes IS NULL
         OR status IS NULL
         OR no_show_status IS NULL
         OR call_quality_preset IS NULL
         OR recording_requested IS NULL
         OR recording_consented_user_1 IS NULL
         OR recording_consented_user_2 IS NULL
         OR recording_enabled IS NULL
         OR screen_share_enabled IS NULL
         OR virtual_background_user_1 IS NULL
         OR virtual_background_user_2 IS NULL
         OR settings_snapshot IS NULL
         OR created_at IS NULL;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'video_dates' AND column_name = 'initiator_id'
        ) THEN
          UPDATE video_dates
          SET scheduled_by_user_id = COALESCE(scheduled_by_user_id, initiator_id)
          WHERE scheduled_by_user_id IS NULL;

          ALTER TABLE video_dates ALTER COLUMN initiator_id DROP NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'video_dates' AND column_name = 'start_time'
        ) THEN
          UPDATE video_dates
          SET scheduled_at = COALESCE(scheduled_at, start_time)
          WHERE scheduled_at IS NULL;

          ALTER TABLE video_dates ALTER COLUMN start_time DROP NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'video_dates' AND column_name = 'proposed_time'
        ) THEN
          UPDATE video_dates
          SET scheduled_at = COALESCE(scheduled_at, proposed_time)
          WHERE scheduled_at IS NULL;

          ALTER TABLE video_dates ALTER COLUMN proposed_time DROP NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'video_dates' AND column_name = 'duration_minutes'
        ) THEN
          UPDATE video_dates
          SET duration_seconds = COALESCE(duration_seconds, duration_minutes * 60)
          WHERE duration_seconds IS NULL;

          ALTER TABLE video_dates ALTER COLUMN duration_minutes DROP NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'video_dates' AND column_name = 'actual_duration_minutes'
        ) THEN
          ALTER TABLE video_dates ALTER COLUMN actual_duration_minutes DROP NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'video_dates' AND column_name = 'quality_rating'
        ) THEN
          ALTER TABLE video_dates ALTER COLUMN quality_rating DROP NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'video_dates' AND column_name = 'would_meet_in_person'
        ) THEN
          ALTER TABLE video_dates ALTER COLUMN would_meet_in_person DROP NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'video_dates' AND column_name = 'feedback'
        ) THEN
          ALTER TABLE video_dates ALTER COLUMN feedback DROP NOT NULL;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_video_dates_match_id ON video_dates(match_id);
      CREATE INDEX IF NOT EXISTS idx_video_dates_status ON video_dates(status);
      CREATE INDEX IF NOT EXISTS idx_video_dates_scheduled_at ON video_dates(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_video_dates_session_type ON video_dates(session_type);
      CREATE INDEX IF NOT EXISTS idx_video_dates_user_1 ON video_dates(user_id_1);
      CREATE INDEX IF NOT EXISTS idx_video_dates_user_2 ON video_dates(user_id_2);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
      CREATE INDEX IF NOT EXISTS idx_user_reward_balances_user_id ON user_reward_balances(user_id);
      CREATE INDEX IF NOT EXISTS idx_profile_boosts_user_id ON profile_boosts(user_id);
      CREATE INDEX IF NOT EXISTS idx_profile_boosts_expires_at ON profile_boosts(boost_expires_at);
      CREATE INDEX IF NOT EXISTS idx_date_proposals_match_id ON date_proposals(match_id);
      CREATE INDEX IF NOT EXISTS idx_date_proposals_proposer_id ON date_proposals(proposer_id);
      CREATE INDEX IF NOT EXISTS idx_date_proposals_recipient_id ON date_proposals(recipient_id);
      CREATE INDEX IF NOT EXISTS idx_date_proposals_status ON date_proposals(status);
      CREATE INDEX IF NOT EXISTS idx_date_completion_feedback_proposal_id ON date_completion_feedback(date_proposal_id);
      CREATE INDEX IF NOT EXISTS idx_date_completion_feedback_rater_id ON date_completion_feedback(rater_user_id);
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

    await client.query(`
      ALTER TABLE chatrooms
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await client.query(`
      UPDATE chatrooms
      SET is_public = COALESCE(is_public, TRUE),
          max_members = COALESCE(max_members, 100),
          member_count = COALESCE(member_count, 1),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
          updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
      WHERE is_public IS NULL
         OR max_members IS NULL
         OR member_count IS NULL
         OR created_at IS NULL
         OR updated_at IS NULL;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS filter_presets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        preset_name VARCHAR(100) NOT NULL,
        filters JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, preset_name)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_filter_presets_user_id ON filter_presets(user_id);
      CREATE INDEX IF NOT EXISTS idx_filter_presets_updated_at ON filter_presets(updated_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_presence_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(255),
        is_online BOOLEAN DEFAULT FALSE,
        last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        device_type VARCHAR(50) DEFAULT 'web',
        status_message VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_presence_sessions_online ON user_presence_sessions(is_online);
      CREATE INDEX IF NOT EXISTS idx_user_presence_sessions_last_activity ON user_presence_sessions(last_activity_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS matchmaker_explanations (
        id SERIAL PRIMARY KEY,
        viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        candidate_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        compatibility_score INTEGER DEFAULT 0,
        factors_json JSONB DEFAULT '[]'::jsonb,
        recommendations_json JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(viewer_id, candidate_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_matchmaker_explanations_viewer_id ON matchmaker_explanations(viewer_id);
      CREATE INDEX IF NOT EXISTS idx_matchmaker_explanations_candidate_id ON matchmaker_explanations(candidate_id);
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

    await client.query(`
      ALTER TABLE chatroom_members
      ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'member',
      ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS left_at TIMESTAMP;
    `);

    await client.query(`
      UPDATE chatroom_members
      SET joined_at = COALESCE(joined_at, CURRENT_TIMESTAMP),
          role = COALESCE(role, 'member'),
          status = COALESCE(status, 'active')
      WHERE joined_at IS NULL
         OR role IS NULL
         OR status IS NULL;
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

    await client.query(`
      ALTER TABLE chatroom_messages
      ADD COLUMN IF NOT EXISTS chatroom_id INTEGER REFERENCES chatrooms(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS message TEXT,
      ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) DEFAULT 'text',
      ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'chatroom_messages' AND column_name = 'user_id'
        ) THEN
          UPDATE chatroom_messages
          SET from_user_id = COALESCE(from_user_id, user_id)
          WHERE from_user_id IS NULL;

          ALTER TABLE chatroom_messages ALTER COLUMN user_id DROP NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'chatroom_messages' AND column_name = 'content'
        ) THEN
          UPDATE chatroom_messages
          SET message = COALESCE(message, content)
          WHERE message IS NULL;

          ALTER TABLE chatroom_messages ALTER COLUMN content DROP NOT NULL;
        END IF;
      END $$;
    `);

    await client.query(`
      ALTER TABLE chatroom_messages
      ALTER COLUMN message_type SET DEFAULT 'text',
      ALTER COLUMN reactions SET DEFAULT '[]',
      ALTER COLUMN is_edited SET DEFAULT FALSE,
      ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
    `);

    await client.query(`
      UPDATE chatroom_messages
      SET message_type = COALESCE(message_type, 'text'),
          reactions = COALESCE(reactions, '[]'),
          is_edited = COALESCE(is_edited, FALSE),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
      WHERE message_type IS NULL
         OR reactions IS NULL
         OR is_edited IS NULL
         OR created_at IS NULL;
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

    await client.query(`
      ALTER TABLE lobby_messages
      ADD COLUMN IF NOT EXISTS from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS message TEXT,
      ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) DEFAULT 'text',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lobby_messages' AND column_name = 'user_id'
        ) THEN
          UPDATE lobby_messages
          SET from_user_id = COALESCE(from_user_id, user_id)
          WHERE from_user_id IS NULL;

          ALTER TABLE lobby_messages ALTER COLUMN user_id DROP NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lobby_messages' AND column_name = 'content'
        ) THEN
          UPDATE lobby_messages
          SET message = COALESCE(message, content)
          WHERE message IS NULL;

          ALTER TABLE lobby_messages ALTER COLUMN content DROP NOT NULL;
        END IF;
      END $$;
    `);

    await client.query(`
      ALTER TABLE lobby_messages
      ALTER COLUMN message_type SET DEFAULT 'text',
      ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
    `);

    await client.query(`
      UPDATE lobby_messages
      SET message_type = COALESCE(message_type, 'text'),
          created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
      WHERE message_type IS NULL
         OR created_at IS NULL;
    `);

    // Create indices for chatroom queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chatroom_members_chatroom_id ON chatroom_members(chatroom_id);
      CREATE INDEX IF NOT EXISTS idx_chatroom_members_user_id ON chatroom_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_chatroom_messages_chatroom_id ON chatroom_messages(chatroom_id);
      CREATE INDEX IF NOT EXISTS idx_chatroom_messages_created_at ON chatroom_messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_chatroom_messages_message_type ON chatroom_messages(message_type);
      CREATE INDEX IF NOT EXISTS idx_lobby_messages_created_at ON lobby_messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_lobby_messages_message_type ON lobby_messages(message_type);
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
        superlikes_sent INTEGER DEFAULT 0,
        rewinds_sent INTEGER DEFAULT 0,
        boosts_used INTEGER DEFAULT 0,
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
      ADD COLUMN IF NOT EXISTS likes_sent INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS superlikes_sent INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rewinds_sent INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS boosts_used INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS likes_used INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS superlikes_used INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rewinds_used INTEGER DEFAULT 0;
    `);

    await client.query(`
      UPDATE user_analytics
      SET likes_sent = COALESCE(likes_sent, 0),
          superlikes_sent = COALESCE(superlikes_sent, superlikes_used, 0),
          rewinds_sent = COALESCE(rewinds_sent, rewinds_used, 0),
          boosts_used = COALESCE(boosts_used, 0),
          likes_used = COALESCE(likes_used, 0),
          superlikes_used = COALESCE(superlikes_used, 0),
          rewinds_used = COALESCE(rewinds_used, 0)
      WHERE likes_sent IS NULL
         OR superlikes_sent IS NULL
         OR rewinds_sent IS NULL
         OR boosts_used IS NULL
         OR likes_used IS NULL
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS dating_funnel_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_name VARCHAR(100) NOT NULL,
        match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL,
        context JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_dating_funnel_events_user_id
      ON dating_funnel_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_dating_funnel_events_event_name
      ON dating_funnel_events(event_name);
      CREATE INDEX IF NOT EXISTS idx_dating_funnel_events_match_id
      ON dating_funnel_events(match_id);
      CREATE INDEX IF NOT EXISTS idx_dating_funnel_events_created_at
      ON dating_funnel_events(created_at DESC);
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

    // Create moments table for ephemeral 24-hour stories
    await client.query(`
      CREATE TABLE IF NOT EXISTS moments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        photo_url TEXT NOT NULL,
        photo_key VARCHAR(500),
        caption TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        view_count INTEGER DEFAULT 0,
        is_deleted BOOLEAN DEFAULT FALSE
      );
    `);

    // Create moment_views table to track who viewed each moment
    await client.query(`
      CREATE TABLE IF NOT EXISTS moment_views (
        id SERIAL PRIMARY KEY,
        moment_id INTEGER NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
        viewer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(moment_id, viewer_user_id)
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
      CREATE INDEX IF NOT EXISTS idx_moments_user_id ON moments(user_id);
      CREATE INDEX IF NOT EXISTS idx_moments_expires_at ON moments(expires_at);
      CREATE INDEX IF NOT EXISTS idx_moments_created_at_user_id ON moments(created_at, user_id);
      CREATE INDEX IF NOT EXISTS idx_moment_views_moment_id ON moment_views(moment_id);
      CREATE INDEX IF NOT EXISTS idx_moment_views_viewer_user_id ON moment_views(viewer_user_id);
      CREATE INDEX IF NOT EXISTS idx_user_search_history_user_id ON user_search_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_search_history_created_at ON user_search_history(created_at);
      CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at);
      CREATE INDEX IF NOT EXISTS idx_age_verifications_verified_at ON age_verifications(verified_at);

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

      -- Create profile_views table for analytics
      CREATE TABLE IF NOT EXISTS profile_views (
        id SERIAL PRIMARY KEY,
        viewer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        viewed_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(viewer_user_id, viewed_user_id)
      );

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

const database = {
  pool,
  query: (text, params) => pool.query(text, params),
  init,
  isAvailable
};

Object.defineProperties(database, {
  sequelize: {
    enumerable: true,
    get() {
      return getOrmBridge().sequelize;
    }
  },
  Sequelize: {
    enumerable: true,
    get() {
      return getOrmBridge().Sequelize;
    }
  },
  models: {
    enumerable: true,
    get() {
      return getOrmBridge().sequelize.models;
    }
  }
});

module.exports = database;
