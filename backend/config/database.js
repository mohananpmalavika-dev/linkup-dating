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
      CREATE TABLE IF NOT EXISTS message_reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(16) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id, emoji)
      );
    `);

      // Create video_dates table
      await client.query(`
      CREATE TABLE IF NOT EXISTS video_dates (
        id SERIAL PRIMARY KEY,
        match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        user_id_1 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_id_2 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scheduled_at TIMESTAMP,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'scheduled',
        room_id VARCHAR(255),
        duration_seconds INTEGER,
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
      CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
      CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);
    `);

      // Migration: Add username column if it doesn't exist
      await client.query(`
      ALTER TABLE dating_profiles
      ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;
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
        matches_made INTEGER DEFAULT 0,
        video_call_duration_seconds INTEGER DEFAULT 0,
        last_active TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, activity_date)
      );
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(metric_date)
      );
    `);

    // Create indices for analytics tables
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_user_id ON admin_actions(admin_user_id);
      CREATE INDEX IF NOT EXISTS idx_admin_actions_target_user_id ON admin_actions(target_user_id);
      CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at);
      CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON user_analytics(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_analytics_activity_date ON user_analytics(activity_date);
      CREATE INDEX IF NOT EXISTS idx_user_session_logs_user_id ON user_session_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_session_logs_created_at ON user_session_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_spam_flags_user_id ON spam_flags(user_id);
      CREATE INDEX IF NOT EXISTS idx_spam_flags_created_at ON spam_flags(created_at);
      CREATE INDEX IF NOT EXISTS idx_fraud_flags_user_id ON fraud_flags(user_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_flags_created_at ON fraud_flags(created_at);
      CREATE INDEX IF NOT EXISTS idx_system_metrics_metric_date ON system_metrics(metric_date);
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
