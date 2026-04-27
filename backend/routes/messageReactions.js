/**
 * Message Reactions & Streaks API Routes
 * Endpoints for managing reactions, custom reactions, and streak tracking
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const db = require('../config/database');
const MessageReactionService = require('../services/messageReactionService');

/**
 * POST /messages/:messageId/reactions
 * Add emoji reaction to message
 */
router.post('/:messageId/reactions', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    if (!emoji) {
      return res.status(400).json({ success: false, error: 'emoji is required' });
    }

    const result = await MessageReactionService.addEmojiReaction(messageId, userId, emoji);

    res.json({
      success: true,
      reaction: result.reaction,
      action: result.action,
      message: `Reaction ${result.action}`
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /messages/:messageId/custom-reactions
 * Add custom reaction (profile photo)
 */
router.post('/:messageId/custom-reactions', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { photoUrl, photoId, displayName } = req.body;
    const userId = req.user.id;

    if (!photoUrl && !photoId) {
      return res.status(400).json({ success: false, error: 'photoUrl or photoId is required' });
    }

    const result = await MessageReactionService.addCustomReaction(messageId, userId, {
      photoUrl,
      photoId,
      displayName
    });

    res.json({
      success: true,
      reaction: result.reaction,
      type: result.type,
      action: result.action
    });
  } catch (error) {
    console.error('Error adding custom reaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /messages/:messageId/reactions/:emoji
 * Remove reaction from message
 */
router.delete('/:messageId/reactions/:emoji', protect, async (req, res) => {
  try {
    const { messageId, emoji } = req.params;
    const userId = req.user.id;

    const result = await MessageReactionService.removeReaction(messageId, userId, emoji);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      message: 'Reaction removed'
    });
  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /messages/:messageId/reactions
 * Get all reactions for a message
 */
router.get('/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;

    const reactions = await MessageReactionService.getMessageReactions(messageId);

    res.json({
      success: true,
      reactions: reactions.summary,
      total: reactions.total,
      grouped: reactions.grouped
    });
  } catch (error) {
    console.error('Error getting reactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /messages/:messageId/reactions/counts
 * Get reaction count summary
 */
router.get('/:messageId/reactions/counts', async (req, res) => {
  try {
    const { messageId } = req.params;

    const counts = await MessageReactionService.getReactionCounts(messageId);

    res.json({
      success: true,
      counts
    });
  } catch (error) {
    console.error('Error getting reaction counts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /matches/:matchId/streak
 * Get streak info for a match
 */
router.get('/streak/:matchId', protect, async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    // Get match to find the other user
    const matchResult = await db.query(
      `SELECT user_id_1, user_id_2 FROM matches WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)`,
      [matchId, userId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }

    const { user_id_1, user_id_2 } = matchResult.rows[0];

    const streak = await MessageReactionService.getStreak(user_id_1, user_id_2, matchId);

    res.json({
      success: true,
      streak
    });
  } catch (error) {
    console.error('Error getting streak:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /matches/:matchId/engagement-score
 * Get engagement score for a match
 */
router.get('/engagement-score/:matchId', protect, async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    // Get match to find both users
    const matchResult = await db.query(
      `SELECT user_id_1, user_id_2 FROM matches WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)`,
      [matchId, userId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }

    const { user_id_1, user_id_2 } = matchResult.rows[0];

    const score = await MessageReactionService.calculateEngagementScore(matchId, user_id_1, user_id_2);

    res.json({
      success: true,
      engagementScore: score,
      message: `You and your match have an engagement score of ${Math.round(score / 10)}%`
    });
  } catch (error) {
    console.error('Error getting engagement score:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /matches/:matchId/top-reactions
 * Get top reactions in a conversation
 */
router.get('/top-reactions/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const topReactions = await MessageReactionService.getTopReactions(matchId, limit);

    res.json({
      success: true,
      reactions: topReactions
    });
  } catch (error) {
    console.error('Error getting top reactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /reactions/suggested
 * Get suggested reactions for user
 */
router.get('/suggested/:matchId', protect, async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const suggestions = await MessageReactionService.getSuggestedReactions(matchId, userId);

    res.json({
      success: true,
      reactions: suggestions,
      default: MessageReactionService.REACTION_CATEGORIES.positive
    });
  } catch (error) {
    console.error('Error getting suggested reactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /reactions/emoji-list
 * Get list of available emojis for reactions
 */
router.get('/emoji-list', (req, res) => {
  try {
    res.json({
      success: true,
      emojis: MessageReactionService.EMOJI_REACTIONS,
      categories: MessageReactionService.REACTION_CATEGORIES,
      default: MessageReactionService.REACTION_CATEGORIES.positive
    });
  } catch (error) {
    console.error('Error getting emoji list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /streaks/active
 * Get all active streaks for user
 */
router.get('/active-streaks', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT mst.*, 
              CASE WHEN mst.user_id_1 = $1 THEN u.display_name ELSE u2.display_name END as match_user_name,
              CASE WHEN mst.user_id_1 = $1 THEN mst.user_id_2 ELSE mst.user_id_1 END as match_user_id
       FROM message_streak_trackers mst
       LEFT JOIN users u ON mst.user_id_2 = u.id
       LEFT JOIN users u2 ON mst.user_id_1 = u2.id
       WHERE (mst.user_id_1 = $1 OR mst.user_id_2 = $1) 
       AND mst.is_active = true
       ORDER BY mst.streak_days DESC`,
      [userId]
    );

    const streaks = result.rows.map(row => ({
      matchId: row.match_id,
      matchUserId: row.match_user_id,
      matchUserName: row.match_user_name,
      streakDays: row.streak_days,
      emoji: row.streak_days >= 30 ? '🔥' : row.streak_days >= 7 ? '❤️' : row.streak_days >= 3 ? '❤️' : null,
      text: row.streak_days >= 30 ? `${row.streak_days}🔥 Day Streak!` : 
            row.streak_days >= 7 ? `${row.streak_days}❤️ Day Streak!` :
            row.streak_days >= 3 ? `${row.streak_days}❤️ Day Streak!` : null,
      engagementScore: row.engagement_score,
      totalMessages: row.total_messages,
      totalReactions: row.total_reactions,
      startDate: row.streak_start_date,
      lastMessageDate: row.last_message_date
    }));

    res.json({
      success: true,
      streaks,
      count: streaks.length,
      totalEngagementScore: streaks.reduce((sum, s) => sum + s.engagementScore, 0)
    });
  } catch (error) {
    console.error('Error getting active streaks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /streaks/history
 * Get streak history (including broken streaks)
 */
router.get('/history', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT mst.*, 
              CASE WHEN mst.user_id_1 = $1 THEN u.display_name ELSE u2.display_name END as match_user_name,
              CASE WHEN mst.user_id_1 = $1 THEN mst.user_id_2 ELSE mst.user_id_1 END as match_user_id
       FROM message_streak_trackers mst
       LEFT JOIN users u ON mst.user_id_2 = u.id
       LEFT JOIN users u2 ON mst.user_id_1 = u2.id
       WHERE (mst.user_id_1 = $1 OR mst.user_id_2 = $1)
       ORDER BY mst.updated_at DESC
       LIMIT 100`,
      [userId]
    );

    const streaks = result.rows.map(row => ({
      matchId: row.match_id,
      matchUserId: row.match_user_id,
      matchUserName: row.match_user_name,
      streakDays: row.streak_days,
      isActive: row.is_active,
      emoji: row.is_active ? 
        (row.streak_days >= 30 ? '🔥' : row.streak_days >= 7 ? '❤️' : row.streak_days >= 3 ? '❤️' : null) : 
        null,
      text: row.is_active ? 
        (row.streak_days >= 30 ? `${row.streak_days}🔥 Day Streak!` : 
         row.streak_days >= 7 ? `${row.streak_days}❤️ Day Streak!` :
         row.streak_days >= 3 ? `${row.streak_days}❤️ Day Streak!` : null) : 
        `Previous streak: ${row.streak_days} days`,
      engagementScore: row.engagement_score,
      startDate: row.streak_start_date,
      endDate: row.streak_broken_date
    }));

    res.json({
      success: true,
      streaks,
      count: streaks.length
    });
  } catch (error) {
    console.error('Error getting streak history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
