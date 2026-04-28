/**
 * Referral API Routes
 * Endpoints for managing referrals and rewards
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const referralService = require('../services/referralService');

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/referrals/my-code
 * Get or create referral code for current user
 */
router.get('/my-code', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await referralService.getOrCreateReferralCode(userId);
    res.json(result);
  } catch (error) {
    console.error('Error getting referral code:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/referrals/accept
 * Accept a referral code (called when new user signs up with code)
 * Body: { referralCode: string }
 */
router.post('/accept', async (req, res) => {
  try {
    const userId = req.user.id;
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({ success: false, message: 'Referral code required' });
    }

    const result = await referralService.acceptReferral(userId, referralCode);
    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    console.error('Error accepting referral:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/referrals/stats
 * Get referral statistics for current user
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await referralService.getReferralStats(userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/referrals/rewards/pending
 * Get pending rewards for current user
 */
router.get('/rewards/pending', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await referralService.getPendingRewards(userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching pending rewards:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/referrals/rewards/claim
 * Claim all pending referral rewards
 */
router.post('/rewards/claim', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await referralService.claimRewards(userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error claiming rewards:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/referrals/history
 * Get current user's referral history (who referred them)
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await referralService.getUserReferralHistory(userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching referral history:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/referrals/leaderboard
 * Get top referrers leaderboard
 * Query params: ?limit=10
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const result = await referralService.getTopReferrers(limit);
    res.json(result);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
