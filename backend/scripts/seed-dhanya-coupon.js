/**
 * Seed script to add "dhanya" coupon code for 100 call credits
 * Run: node backend/scripts/seed-dhanya-coupon.js
 */

require('dotenv').config();
const db = require('../config/database');

const seedCoupon = async () => {
  let client;

  try {
    console.log('🔌 Connecting to database...');
    client = await db.pool.connect();

    // Check if coupon already exists
    const existingResult = await client.query(
      `SELECT id FROM coupons WHERE code = $1`,
      ['DHANYA']
    );

    if (existingResult.rows.length > 0) {
      const result = await client.query(
        `UPDATE coupons
         SET coupon_type = $2,
             likes_value = 0,
             superlikes_value = 0,
             call_credits_value = 100,
             max_redemptions = NULL,
             expiry_date = NULL,
             is_active = true,
             min_user_level = 0,
             target_user_ids = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, code, call_credits_value`,
        [existingResult.rows[0].id, 'callcredits']
      );

      console.log('Updated "DHANYA" coupon reusable no-expiry settings.');
      console.log('   ID:', result.rows[0].id);
      console.log('   Code:', result.rows[0].code);
      console.log('   Call Credits:', result.rows[0].call_credits_value);
      console.log('✓ Coupon "DHANYA" already exists with ID:', existingResult.rows[0].id);
      return;
    }

    // Get first admin user or create a seed admin ID
    const adminResult = await client.query(
      `SELECT id FROM users WHERE is_admin = true LIMIT 1`
    );

    let adminId = 1; // Default to 1 if no admin exists
    if (adminResult.rows.length > 0) {
      adminId = adminResult.rows[0].id;
    }

    // Insert the dhanya coupon
    const result = await client.query(
      `INSERT INTO coupons (
        code,
        coupon_type,
        likes_value,
        superlikes_value,
        call_credits_value,
        max_redemptions,
        current_redemptions,
        expiry_date,
        start_date,
        is_active,
        description,
        created_by_admin_id,
        min_user_level,
        target_user_ids,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id, code, call_credits_value, created_at`,
      [
        'DHANYA',                          // code
        'callcredits',                     // coupon_type
        0,                                 // likes_value
        0,                                 // superlikes_value
        100,                               // call_credits_value - 100 call credits
        null,                              // max_redemptions - unlimited
        0,                                 // current_redemptions
        null,                              // expiry_date - never expires
        new Date(),                        // start_date - now
        true,                              // is_active
        'Special coupon code for 100 call credits',  // description
        adminId,                           // created_by_admin_id
        0,                                 // min_user_level
        null,                              // target_user_ids - available to everyone
        new Date(),                        // created_at
        new Date()                         // updated_at
      ]
    );

    console.log('✅ Successfully created "DHANYA" coupon!');
    console.log('   ID:', result.rows[0].id);
    console.log('   Code:', result.rows[0].code);
    console.log('   Call Credits:', result.rows[0].call_credits_value);
    console.log('   Created:', result.rows[0].created_at);
  } catch (error) {
    console.error('❌ Error seeding coupon:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await db.pool.end();
  }
};

// Run the seed
seedCoupon();
