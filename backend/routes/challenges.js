/**
 * Daily Challenges Routes
 * API endpoints for managing daily challenges
 */

const express = require('express');
const router = express.Router();
const challengeService = require('../services/challengeService');
const { authenticateToken } = require('../middleware/auth');

/**
 * Get today's challenges for user
 * GET /api/challenges/today
 */
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const challenges = await challengeService.getTodayChallenges(req.user.id);
    res.json({
      success: true,
      challenges,
      message: "Today's challenges retrieved"
    });
  } catch (error) {
    console.error('Error getting today challenges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve today challenges'
    });
  }
});

/**
 * Get all weekly challenges
 * GET /api/challenges/weekly
 */
router.get('/weekly', authenticateToken, async (req, res) => {
  try {
    const challenges = await challengeService.getWeeklyChallenges(req.user.id);
    res.json({
      success: true,
      challenges,
      message: 'Weekly challenges retrieved'
    });
  } catch (error) {
    console.error('Error getting weekly challenges:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve weekly challenges'
    });
  }
});

/**
 * Update challenge progress
 * POST /api/challenges/:challengeId/progress
 */
router.post('/:challengeId/progress', authenticateToken, async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { increment = 1 } = req.body;

    const progress = await challengeService.updateChallengeProgress(
      req.user.id,
      challengeId,
      increment
    );

    res.json({
      success: true,
      progress,
      message: 'Challenge progress updated',
      completed: progress.isCompleted,
      pointsEarned: progress.pointsEarned
    });
  } catch (error) {
    console.error('Error updating challenge progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update challenge progress'
    });
  }
});

/**
 * Get user's points balance
 * GET /api/challenges/points/balance
 */
router.get('/points/balance', authenticateToken, async (req, res) => {
  try {
    const balance = await challengeService.getUserPointsBalance(req.user.id);
    res.json({
      success: true,
      balance,
      totalPoints: balance.totalPoints,
      availablePoints: balance.totalPoints - balance.pointsUsed,
      weeklyPoints: balance.weeklyPoints,
      monthlyStreak: balance.monthlyStreak
    });
  } catch (error) {
    console.error('Error getting points balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve points balance'
    });
  }
});

/**
 * Redeem points for premium feature
 * POST /api/challenges/points/redeem
 */
router.post('/points/redeem', authenticateToken, async (req, res) => {
  try {
    const { pointsToRedeem, rewardType, rewardValue } = req.body;

    if (!pointsToRedeem || !rewardType || !rewardValue) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const redemption = await challengeService.redeemPoints(
      req.user.id,
      pointsToRedeem,
      rewardType,
      rewardValue
    );

    res.json({
      success: true,
      redemption,
      message: 'Points redeemed successfully'
    });
  } catch (error) {
    console.error('Error redeeming points:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to redeem points'
    });
  }
});

/**
 * Apply redemption to user account
 * POST /api/challenges/redemptions/:redemptionId/apply
 */
router.post('/redemptions/:redemptionId/apply', authenticateToken, async (req, res) => {
  try {
    const { redemptionId } = req.params;

    const redemption = await challengeService.applyRedemption(redemptionId);

    res.json({
      success: true,
      redemption,
      message: 'Reward applied to your account'
    });
  } catch (error) {
    console.error('Error applying redemption:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to apply redemption'
    });
  }
});

/**
 * Get user's redemption history
 * GET /api/challenges/redemptions/history
 */
router.get('/redemptions/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = await challengeService.getRedemptionHistory(req.user.id, limit);

    res.json({
      success: true,
      history,
      message: 'Redemption history retrieved'
    });
  } catch (error) {
    console.error('Error getting redemption history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve redemption history'
    });
  }
});

/**
 * Get weekly leaderboard
 * GET /api/challenges/leaderboard/weekly
 */
router.get('/leaderboard/weekly', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const leaderboard = await challengeService.getWeeklyLeaderboard(limit);

    res.json({
      success: true,
      leaderboard,
      message: 'Weekly leaderboard retrieved'
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leaderboard'
    });
  }
});

module.exports = router;
