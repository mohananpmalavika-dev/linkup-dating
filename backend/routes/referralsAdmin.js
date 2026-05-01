/**
 * Admin routes for referral management
 * Protected with admin authentication
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { Sequelize } = require('sequelize');
const crypto = require('crypto');
const { Referral, User } = require('../models');

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
  const baseUrl = process.env.FRONTEND_URL || 'https://datinghub.app';
  return `${baseUrl}/?referral=${code}`;
}

/**
 * Check if user is admin
 */
const isAdmin = (req, res, next) => {
  if (!req.user || (!req.user.is_admin && !req.user.isAdmin)) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

/**
 * POST /api/admin/referrals/generate-all
 * Generate referral codes for all users who don't have one
 * Admin only
 */
router.post('/generate-all', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('🔄 Starting bulk referral code generation...');

    // Get all users
    const users = await User.findAll({
      attributes: ['id', 'email'],
      order: [['id', 'ASC']]
    });

    console.log(`✓ Found ${users.length} users`);

    let created = 0;
    let skipped = 0;
    let errors = 0;
    const results = [];

    for (const user of users) {
      try {
        // Check if user already has an active referral code
        const existingReferral = await Referral.findOne({
          where: {
            referrer_user_id: user.id,
            status: {
              [Sequelize.Op.ne]: 'expired'
            }
          }
        });

        if (existingReferral) {
          results.push({
            userId: user.id,
            email: user.email,
            status: 'skipped',
            code: existingReferral.referral_code,
            message: 'Already has referral code'
          });
          skipped++;
          continue;
        }

        // Generate new referral code
        const code = generateReferralCode(user.id);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 365); // Valid for 1 year
        const referralLink = generateReferralLink(code);

        const referral = await Referral.create({
          referrer_user_id: user.id,
          referral_code: code,
          referral_link: referralLink,
          status: 'pending',
          expires_at: expiresAt
        });

        results.push({
          userId: user.id,
          email: user.email,
          status: 'created',
          code: code,
          link: referralLink,
          message: 'Referral code created'
        });
        created++;
      } catch (userError) {
        results.push({
          userId: user.id,
          email: user.email,
          status: 'error',
          message: userError.message
        });
        errors++;
      }
    }

    console.log(`\n✅ Created: ${created}, ⏭️ Skipped: ${skipped}, ❌ Errors: ${errors}`);

    return res.json({
      success: true,
      message: `Referral code generation completed. Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`,
      summary: {
        totalUsers: users.length,
        codesCreated: created,
        codesSkipped: skipped,
        errors: errors
      },
      details: results
    });
  } catch (error) {
    console.error('Error generating referral codes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating referral codes',
      error: error.message
    });
  }
});

/**
 * GET /api/admin/referrals/stats
 * Get overall referral statistics
 * Admin only
 */
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.count();
    const usersWithReferrals = await Referral.count({
      distinct: true,
      col: 'referrer_user_id'
    });

    const stats = await Referral.findAll({
      attributes: [
        'status',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    const statusCount = {};
    stats.forEach(stat => {
      statusCount[stat.status] = parseInt(stat.count);
    });

    return res.json({
      success: true,
      stats: {
        totalUsers,
        usersWithReferralCodes: usersWithReferrals,
        coveragePercentage: ((usersWithReferrals / totalUsers) * 100).toFixed(2) + '%',
        referralsByStatus: statusCount
      }
    });
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

/**
 * POST /api/admin/referrals/regenerate/:userId
 * Regenerate referral code for a specific user
 * Admin only
 */
router.post('/regenerate/:userId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find existing referral
    const existingReferral = await Referral.findOne({
      where: { referrer_user_id: userId }
    });

    if (existingReferral) {
      // Mark as expired
      await existingReferral.update({ status: 'expired' });
    }

    // Create new referral code
    const code = generateReferralCode(userId);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);
    const referralLink = generateReferralLink(code);

    const newReferral = await Referral.create({
      referrer_user_id: userId,
      referral_code: code,
      referral_link: referralLink,
      status: 'pending',
      expires_at: expiresAt
    });

    return res.json({
      success: true,
      message: 'New referral code generated',
      code: newReferral.referral_code,
      link: newReferral.referral_link
    });
  } catch (error) {
    console.error('Error regenerating referral code:', error);
    return res.status(500).json({
      success: false,
      message: 'Error regenerating referral code',
      error: error.message
    });
  }
});

module.exports = router;
