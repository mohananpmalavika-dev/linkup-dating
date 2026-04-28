/**
 * Achievement & Leaderboard Routes
 * API endpoints for badges, achievements, and rankings
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const AchievementService = require('../services/achievementService');
const LeaderboardService = require('../services/leaderboardService');

/**
 * GET /api/achievements/check
 * Check and unlock achievements for current user
 */
router.get('/check', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await AchievementService.checkAndUnlockAchievements(userId);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error checking achievements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/achievements/user/:userId
 * Get all achievements for a user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const achievements = await AchievementService.getUserAchievements(userId);
    
    res.json({
      success: true,
      achievements,
      count: achievements.length
    });
  } catch (error) {
    console.error('Error getting user achievements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/achievements/feature/:achievementId
 * Feature an achievement on profile
 */
router.post('/feature/:achievementId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { achievementId } = req.params;
    
    const success = await AchievementService.featureAchievement(userId, achievementId);
    
    res.json({
      success,
      message: success ? 'Achievement featured' : 'Failed to feature achievement'
    });
  } catch (error) {
    console.error('Error featuring achievement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/achievements/definitions
 * Get all achievement definitions
 */
router.get('/definitions', async (req, res) => {
  try {
    const definitions = Object.values(AchievementService.BADGE_DEFINITIONS);
    
    res.json({
      success: true,
      definitions,
      count: definitions.length
    });
  } catch (error) {
    console.error('Error getting achievement definitions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// LEADERBOARD ROUTES
// ============================================================================

/**
 * GET /api/leaderboards/update
 * Force update all leaderboards (admin only)
 */
router.get('/update', protect, async (req, res) => {
  try {
    // TODO: Add admin check
    const result = await LeaderboardService.updateMonthlyLeaderboards();
    
    res.json({
      success: true,
      message: 'Leaderboards updated',
      ...result
    });
  } catch (error) {
    console.error('Error updating leaderboards:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/leaderboards/city/:city
 * Get leaderboard for a specific city
 */
router.get('/city/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { limit = 20 } = req.query;
    
    const leaderboard = await LeaderboardService.getCityLeaderboard(city, parseInt(limit));
    
    res.json({
      success: true,
      leaderboard,
      type: 'most_active_city',
      city
    });
  } catch (error) {
    console.error('Error getting city leaderboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/leaderboards/interest/:interest
 * Get leaderboard for a specific interest
 */
router.get('/interest/:interest', async (req, res) => {
  try {
    const { interest } = req.params;
    const { limit = 20 } = req.query;
    
    const leaderboard = await LeaderboardService.getInterestLeaderboard(interest, parseInt(limit));
    
    res.json({
      success: true,
      leaderboard,
      type: 'most_active_interest',
      interest
    });
  } catch (error) {
    console.error('Error getting interest leaderboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/leaderboards/conversation-starters
 * Get "Best Conversation Starters" leaderboard
 */
router.get('/conversation-starters', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const leaderboard = await LeaderboardService.getConversationStartersLeaderboard(parseInt(limit));
    
    res.json({
      success: true,
      leaderboard,
      type: 'best_conversation_starters'
    });
  } catch (error) {
    console.error('Error getting conversation starters leaderboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/leaderboards/vote-conversation-starter
 * Vote for someone as a great conversation starter
 */
router.post('/vote-conversation-starter', protect, async (req, res) => {
  try {
    const { votedForUserId, reason } = req.body;
    const votedByUserId = req.user.id;
    
    if (!votedForUserId) {
      return res.status(400).json({ success: false, error: 'votedForUserId is required' });
    }
    
    const result = await LeaderboardService.voteConversationStarter(
      votedByUserId,
      votedForUserId,
      reason
    );
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error voting for conversation starter:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/leaderboards/user/:userId/positions
 * Get user's leaderboard positions
 */
router.get('/user/:userId/positions', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const positions = await LeaderboardService.getUserLeaderboardPositions(userId);
    
    res.json({
      success: true,
      positions,
      count: positions.length
    });
  } catch (error) {
    console.error('Error getting user leaderboard positions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
