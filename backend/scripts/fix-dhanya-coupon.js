/**
 * Ensure the DHANYA coupon grants 100 call credits, never expires, and has no
 * global redemption limit.
 *
 * Run: node backend/scripts/fix-dhanya-coupon.js
 */

require('dotenv').config();
const db = require('../config/database');

const DHANYA_COUPON_CODE = 'DHANYA';
const DHANYA_CALL_CREDITS = 100;

const getCreatorUserId = async (client) => {
  const adminResult = await client.query(
    'SELECT id FROM users WHERE is_admin = true ORDER BY id LIMIT 1'
  );

  if (adminResult.rows.length > 0) {
    return adminResult.rows[0].id;
  }

  const userResult = await client.query('SELECT id FROM users ORDER BY id LIMIT 1');
  return userResult.rows[0]?.id || 1;
};

const fixCoupon = async () => {
  let client;

  try {
    console.log('Connecting to database...');
    client = await db.pool.connect();

    const creatorUserId = await getCreatorUserId(client);
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
      ) VALUES ($1, $2, 0, 0, $3, NULL, 0, NULL, NOW(), true, $4, $5, 0, NULL, NOW(), NOW())
      ON CONFLICT (code) DO UPDATE
      SET coupon_type = EXCLUDED.coupon_type,
          likes_value = 0,
          superlikes_value = 0,
          call_credits_value = EXCLUDED.call_credits_value,
          max_redemptions = NULL,
          expiry_date = NULL,
          is_active = true,
          min_user_level = 0,
          target_user_ids = NULL,
          updated_at = NOW()
      RETURNING id, code, coupon_type, call_credits_value, max_redemptions, expiry_date, is_active`,
      [
        DHANYA_COUPON_CODE,
        'callcredits',
        DHANYA_CALL_CREDITS,
        'Special reusable coupon code for 100 call credits',
        creatorUserId
      ]
    );

    const coupon = result.rows[0];
    console.log('DHANYA coupon configured successfully.');
    console.log('   ID:', coupon.id);
    console.log('   Code:', coupon.code);
    console.log('   Type:', coupon.coupon_type);
    console.log('   Call Credits:', coupon.call_credits_value);
    console.log('   Max Redemptions:', coupon.max_redemptions || 'Unlimited');
    console.log('   Expiry:', coupon.expiry_date || 'Never');
    console.log('   Active:', coupon.is_active);
  } catch (error) {
    console.error('Error fixing DHANYA coupon:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await db.pool.end();
  }
};

fixCoupon();
