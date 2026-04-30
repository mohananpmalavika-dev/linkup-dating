/**
 * Migration: FRND-Style Paid Calling System
 * Creates tables for credits, sessions, and earnings tracking
 */

const db = require('../config/database');

async function runMigration() {
  const client = await db.connect();
  
  try {
    console.log('🔄 Running FRND Calling migration...');

    // Enable extension for UUID
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Create call settings table (admin-controlled rates)
    await client.query(`
      CREATE TABLE IF NOT EXISTS call_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        value TEXT,
        description VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default settings
    const settingsExist = await client.query(`SELECT 1 FROM call_settings WHERE key = 'voice_rate_per_minute'`);
    if (settingsExist.rows.length === 0) {
      await client.query(`
        INSERT INTO call_settings (key, value, description) VALUES
        ('voice_rate_per_minute', '5', 'Rate per minute for voice calls (INR)'),
        ('video_rate_per_minute', '10', 'Rate per minute for video calls (INR)'),
        ('earner_payout_percent', '70', 'Percentage of revenue earned by call receiver'),
        ('min_payout_amount', '500', 'Minimum amount for payout request'),
        ('min_credits_purchase', '50', 'Minimum credits purchase amount'),
        ('calling_enabled', 'true', 'Enable/disable calling feature'),
        ('payment_gateway', 'razorpay', 'Payment gateway: razorpay, upi, or both');
      `);
      console.log('✓ Inserted default call settings');
    }

    // Create call credits wallet table
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
    console.log('✓ Created call_credits table');

    // Create call sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS call_sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(100) UNIQUE NOT NULL,
        caller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        receiver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        call_type VARCHAR(20) DEFAULT 'voice', -- 'voice' or 'video'
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        duration_seconds INTEGER DEFAULT 0,
        rate_per_minute DECIMAL(10,2) DEFAULT 0.00,
        total_cost DECIMAL(10,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'requested', -- 'requested', 'ringing', 'active', 'completed', 'declined', 'no_answer'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP
      );
    `);
    console.log('✓ Created call_sessions table');

    // Create call earnings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS call_earnings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        call_session_id INTEGER REFERENCES call_sessions(id) ON DELETE SET NULL,
        amount DECIMAL(10,2) NOT NULL,
        type VARCHAR(20) NOT NULL, -- 'earned', 'payout', 'bonus', 'refund'
        reference_id VARCHAR(100),
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'processed', 'failed'
        payment_method VARCHAR(20), -- 'upi', 'bank', 'wallet'
        payment_reference VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP
      );
    `);
    console.log('✓ Created call_earnings table');

    // Create call requests table (for real-time call request handling)
    await client.query(`
      CREATE TABLE IF NOT EXISTS call_requests (
        id SERIAL PRIMARY KEY,
        request_id VARCHAR(100) UNIQUE NOT NULL,
        caller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        call_type VARCHAR(20) DEFAULT 'voice',
        credits_required DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired', 'cancelled'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        responded_at TIMESTAMP
      );
    `);
    console.log('✓ Created call_requests table');

    // Create payout requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS call_payouts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL,
        method VARCHAR(20) NOT NULL, -- 'upi', 'bank'
        upi_id VARCHAR(100),
        bank_account VARCHAR(50),
        bank_ifsc VARCHAR(20),
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'processing', 'completed', 'failed'
        failure_reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP
      );
    `);
    console.log('✓ Created call_payouts table');

    // Add columns to dating_profiles for availability
    await client.query(`
      ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS is_available_for_calls BOOLEAN DEFAULT FALSE;
    `);
    await client.query(`
      ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS call_earnings DECIMAL(12,2) DEFAULT 0.00;
    `);
    await client.query(`
      ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS pending_payout DECIMAL(12,2) DEFAULT 0.00;
    `);
    await client.query(`
      ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS total_calls_taken INTEGER DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS total_call_minutes INTEGER DEFAULT 0;
    `);
    await client.query(`
      ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS call_rating DECIMAL(3,2) DEFAULT 0.00;
    `);
    console.log('✓ Added availability columns to dating_profiles');

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_call_sessions_caller ON call_sessions(caller_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_call_sessions_receiver ON call_sessions(receiver_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_call_requests_receiver ON call_requests(receiver_id, status);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_availability_calls ON dating_profiles(is_available_for_calls) 
      WHERE is_available_for_calls = TRUE;
    `);
    console.log('✓ Created indexes');

    console.log('✅ FRND Calling migration complete!');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runMigration;
