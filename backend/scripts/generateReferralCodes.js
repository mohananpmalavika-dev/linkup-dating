/**
 * Bulk Generate Referral Codes for All Users
 * Run: node scripts/generateReferralCodes.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const models = require('../models');
const { Sequelize } = require('sequelize');
const crypto = require('crypto');

/**
 * Generate unique referral code
 */
function generateReferralCode(userId) {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `LINK${userId}${random}`;
}

/**
 * Generate referral link
 */
function generateReferralLink(code) {
  const baseUrl = process.env.FRONTEND_URL || 'https://linkup.dating';
  return `${baseUrl}/?referral=${code}`;
}

/**
 * Main function to generate codes for all users
 */
async function generateCodesForAllUsers() {
  try {
    console.log('🔄 Syncing database...');
    await models.sequelize.sync();
    console.log('✓ Database synced');

    console.log('\n📊 Fetching all users...');
    const users = await models.User.findAll({
      attributes: ['id', 'email'],
      order: [['id', 'ASC']]
    });

    console.log(`✓ Found ${users.length} users\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      try {
        // Check if user already has an active referral code
        const existingReferral = await models.Referral.findOne({
          where: {
            referrer_user_id: user.id,
            status: {
              [Sequelize.Op.ne]: 'expired'
            }
          }
        });

        if (existingReferral) {
          console.log(`⏭️  User ${user.id} (${user.email}) already has referral code: ${existingReferral.referral_code}`);
          skipped++;
          continue;
        }

        // Generate new referral code
        const code = generateReferralCode(user.id);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 365); // Valid for 1 year
        const referralLink = generateReferralLink(code);

        const referral = await models.Referral.create({
          referrer_user_id: user.id,
          referral_code: code,
          referral_link: referralLink,
          status: 'pending',
          expires_at: expiresAt
        });

        console.log(`✅ Created referral code for user ${user.id} (${user.email}): ${code}`);
        created++;
      } catch (userError) {
        console.error(`❌ Error creating referral for user ${user.id}: ${userError.message}`);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Referral codes created: ${created}`);
    console.log(`⏭️  Already existing: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📊 Total users processed: ${users.length}`);
    console.log('='.repeat(60) + '\n');

    if (errors === 0 && created + skipped === users.length) {
      console.log('🎉 All users now have referral codes!');
      process.exit(0);
    } else {
      console.log('⚠️  Some errors occurred. Please review the log above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
  }
}

// Run the function
generateCodesForAllUsers();
