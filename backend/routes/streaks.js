/**
 * Streak Routes
 * API endpoints for messaging streak tracking
 */

const express = require('express');
const router = express.Router();
const streakService = require('../services/streakService');
const db = require('../config/database');
const MessageReactionService = require('../services/messageReactionService');
const { authenticateToken } = require('../middleware/auth');

const getMatchForUser = async (matchId, userId) => {
  const result = await db.query(
    `SELECT user_id_1, user_id_2
     FROM matches
     WHERE id = $1
       AND (user_id_1 = $2 OR user_id_2 = $2)
     LIMIT 1`,
    [matchId, userId]
  );

  return result.rows[0] || null;
};

/**
 * Get streak info for a specific match
 * GET /api/streaks/match/:matchId
 */
router.get('/match/:matchId', authenticateToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const streakInfo = await streakService.getStreakInfo(matchId, req.user.id);

    if (!streakInfo) {
      return res.json({
        success: true,
        streak: null,
        message: 'No active streak for this match'
      });
    }

    res.json({
      success: true,
      streak: streakInfo,
      message: 'Streak info retrieved'
    });
  } catch (error) {
    console.error('Error getting streak info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve streak info'
    });
  }
});

/**
 * Get all user streaks
 * GET /api/streaks/user/active
 */
router.get('/user/active', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const streaks = await streakService.getUserStreaks(req.user.id, limit);

    res.json({
      success: true,
      streaks,
      count: streaks.length,
      message: 'User streaks retrieved'
    });
  } catch (error) {
    console.error('Error getting user streaks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user streaks'
    });
  }
});

/**
 * Get streak statistics for user
 * GET /api/streaks/user/stats
 */
router.get('/user/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await streakService.getUserStreakStats(req.user.id);

    res.json({
      success: true,
      stats,
      message: 'User streak statistics retrieved'
    });
  } catch (error) {
    console.error('Error getting streak stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve streak statistics'
    });
  }
});

/**
 * Get streak leaderboard
 * GET /api/streaks/leaderboard
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const leaderboard = await streakService.getStreakLeaderboard(limit);

    res.json({
      success: true,
      leaderboard,
      message: 'Streak leaderboard retrieved'
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leaderboard'
    });
  }
});

/**
 * Get milestones for a streak length
 * GET /api/streaks/milestones/:days
 */
router.get('/milestones/:days', async (req, res) => {
  try {
    const { days } = req.params;
    const streakDays = parseInt(days) || 0;

    const milestones = streakService.getMilestones(streakDays);

    res.json({
      success: true,
      streakDays,
      milestones,
      message: 'Milestones retrieved'
    });
  } catch (error) {
    console.error('Error getting milestones:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve milestones'
    });
  }
});

/**
 * Legacy compatibility: GET /api/matches/:matchId/streak
 */
router.get('/:matchId/streak', authenticateToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const match = await getMatchForUser(matchId, req.user.id);

    if (!match) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }

    const streak = await streakService.getStreakInfo(matchId, req.user.id);

    res.json({
      success: true,
      streak: streak || {
        active: false,
        streakDays: 0,
        isActive: false,
        engagementScore: 0,
        totalMessages: 0,
        totalReactions: 0
      }
    });
  } catch (error) {
    console.error('Error getting legacy match streak:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve streak info'
    });
  }
});

/**
 * Legacy compatibility: GET /api/matches/:matchId/engagement-score
 */
router.get('/:matchId/engagement-score', authenticateToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const match = await getMatchForUser(matchId, req.user.id);

    if (!match) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }

    const engagementScore = await MessageReactionService.calculateEngagementScore(
      matchId,
      match.user_id_1,
      match.user_id_2
    );
    const streak = await streakService.getStreakInfo(matchId, req.user.id);

    res.json({
      success: true,
      engagementScore,
      totalReactions: streak?.totalReactions || 0,
      totalMessages: streak?.totalMessages || 0
    });
  } catch (error) {
    console.error('Error getting legacy engagement score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve engagement score'
    });
  }
});

module.exports = router;
