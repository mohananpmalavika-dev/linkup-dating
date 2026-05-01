/**
 * Fix script to ensure DHANYA coupon has call_credits_value set to 100
 * Run: node backend/scripts/fix-dhanya-coupon.js
 */

require('dotenv').config();
const db = require('../config/database');

const fixCoupon = async () => {
  let client;

  try {
    console.log('🔌 Connecting to database...');
    client = await db.pool.connect();

    // Check if DHANYA coupon exists
    const checkResult = await client.query(
      `SELECT id, code, coupon_type, call_credits_value FROM coupons WHERE code = $1`,
      ['DHANYA']
    );

    if (checkResult.rows.length === 0) {
      console.log('❌ DHANYA coupon not found. Creating it...');
      
      // Create the coupon
      const adminResult = await client.query(
        `SELECT id FROM users WHERE is_admin = true LIMIT 1`
      );

      let adminId = 1;
      if (adminResult.rows.length > 0) {
        adminId = adminResult.rows[0].id;
      }

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
    } else {
      const coupon = checkResult.rows[0];
      const reusableSettingsResult = await client.query(
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
         RETURNING id, code, coupon_type, call_credits_value`,
        [coupon.id, 'callcredits']
      );

      console.log('Configured DHANYA as reusable with no expiry.');
      console.log('   Type:', reusableSettingsResult.rows[0].coupon_type);
      console.log('   Call Credits:', reusableSettingsResult.rows[0].call_credits_value);
      return;
      coupon.call_credits_value = reusableSettingsResult.rows[0].call_credits_value;
      console.log(`✓ Found DHANYA coupon (ID: ${coupon.id})`);
      
      if (!coupon.call_credits_value || coupon.call_credits_value === 0) {
        console.log('⚠️  call_credits_value is 0 or null. Updating to 100...');
        
        const updateResult = await client.query(
          `UPDATE coupons 
           SET call_credits_value = 100, updated_at = NOW()
           WHERE id = $1
           RETURNING id, code, coupon_type, call_credits_value`,
          [coupon.id]
        );

        console.log('✅ Successfully updated DHANYA coupon!');
        console.log('   ID:', updateResult.rows[0].id);
        console.log('   Code:', updateResult.rows[0].code);
        console.log('   Type:', updateResult.rows[0].coupon_type);
        console.log('   Call Credits:', updateResult.rows[0].call_credits_value);
      } else {
        console.log(`✅ DHANYA coupon is already configured correctly!`);
        console.log(`   Call Credits Value: ${coupon.call_credits_value}`);
      }
    }
  } catch (error) {
    console.error('❌ Error fixing coupon:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await db.pool.end();
  }
};

// Run the fix
fixCoupon();
