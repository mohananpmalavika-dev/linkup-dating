/**
 * Status Preferences Routes
 * API endpoints for managing activity status sharing preferences per match
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const db = require('../config/database');
const ActivityStatusFormatterService = require('../services/activityStatusFormatterService');

/**
 * GET /dating/status-preferences
 * Get all status preferences for authenticated user
 */
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT msp.*, m.user_id_1, m.user_id_2, u.display_name, u.photos
       FROM match_status_preferences msp
       JOIN matches m ON msp.match_id = m.id
       LEFT JOIN users u ON (CASE 
         WHEN m.user_id_1 = $1 THEN m.user_id_2 
         ELSE m.user_id_1 
       END) = u.id
       WHERE msp.user_id = $1
       ORDER BY msp.updated_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      preferences: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching status preferences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /dating/status-preferences/:matchId
 * Get status preference for specific match
 */
router.get('/:matchId', protect, async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM match_status_preferences
       WHERE user_id = $1 AND match_id = $2`,
      [userId, matchId]
    );

    if (result.rows.length === 0) {
      // Return defaults
      return res.json({
        success: true,
        preference: {
          userId,
          matchId,
          showOnlineStatus: true,
          showLastActive: true,
          showTypingIndicator: true,
          showActivityStatus: true,
          showReadReceipts: true,
          shareDetailedStatus: true,
          privacyLevel: 'full'
        }
      });
    }

    res.json({ success: true, preference: result.rows[0] });
  } catch (error) {
    console.error('Error fetching status preference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /dating/status-preferences
 * Create or update status preference for a match
 */
router.post('/', protect, validateRequest(['matchId']), async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      matchId,
      showOnlineStatus = true,
      showLastActive = true,
      showTypingIndicator = true,
      showActivityStatus = true,
      showReadReceipts = true,
      shareDetailedStatus = true,
      privacyLevel = 'full'
    } = req.body;

    // Verify user is part of this match
    const matchVerify = await db.query(
      `SELECT id FROM matches WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)`,
      [matchId, userId]
    );

    if (matchVerify.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized for this match' });
    }

    // Upsert preference
    const result = await db.query(
      `INSERT INTO match_status_preferences (
        user_id, match_id, show_online_status, show_last_active,
        show_typing_indicator, show_activity_status, show_read_receipts,
        share_detailed_status, privacy_level, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (user_id, match_id) DO UPDATE SET
        show_online_status = $3,
        show_last_active = $4,
        show_typing_indicator = $5,
        show_activity_status = $6,
        show_read_receipts = $7,
        share_detailed_status = $8,
        privacy_level = $9,
        updated_at = NOW()
      RETURNING *`,
      [userId, matchId, showOnlineStatus, showLastActive, showTypingIndicator,
       showActivityStatus, showReadReceipts, shareDetailedStatus, privacyLevel]
    );

    res.json({
      success: true,
      preference: result.rows[0],
      message: 'Status preference updated'
    });
  } catch (error) {
    console.error('Error saving status preference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /dating/status-preferences/:matchId
 * Update status preference for specific match
 */
router.put('/:matchId', protect, async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    // Verify user is part of this match
    const matchVerify = await db.query(
      `SELECT id FROM matches WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)`,
      [matchId, userId]
    );

    if (matchVerify.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized for this match' });
    }

    // Build update query dynamically
    const allowedFields = [
      'showOnlineStatus', 'showLastActive', 'showTypingIndicator',
      'showActivityStatus', 'showReadReceipts', 'shareDetailedStatus', 'privacyLevel'
    ];

    const setClause = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        setClause.push(`${dbField} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (setClause.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    values.push(new Date());
    values.push(userId);
    values.push(matchId);

    const result = await db.query(
      `UPDATE match_status_preferences
       SET ${setClause.join(', ')}, updated_at = $${paramCount}
       WHERE user_id = $${paramCount + 1} AND match_id = $${paramCount + 2}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Preference not found' });
    }

    res.json({
      success: true,
      preference: result.rows[0],
      message: 'Status preference updated'
    });
  } catch (error) {
    console.error('Error updating status preference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /dating/status-preferences/:matchId/quick-set
 * Quickly set privacy level preset (full, basic, minimal, hidden)
 */
router.post('/:matchId/quick-set', protect, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { privacyLevel } = req.body;
    const userId = req.user.id;

    const validLevels = ['full', 'basic', 'minimal', 'hidden'];
    if (!validLevels.includes(privacyLevel)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid privacy level. Must be: ' + validLevels.join(', ')
      });
    }

    // Verify user is part of this match
    const matchVerify = await db.query(
      `SELECT id FROM matches WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)`,
      [matchId, userId]
    );

    if (matchVerify.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized for this match' });
    }

    // Apply preset
    const presets = {
      full: {
        show_online_status: true,
        show_last_active: true,
        show_typing_indicator: true,
        show_activity_status: true,
        show_read_receipts: true,
        share_detailed_status: true
      },
      basic: {
        show_online_status: true,
        show_last_active: false,
        show_typing_indicator: false,
        show_activity_status: false,
        show_read_receipts: false,
        share_detailed_status: false
      },
      minimal: {
        show_online_status: false,
        show_last_active: true,
        show_typing_indicator: false,
        show_activity_status: false,
        show_read_receipts: false,
        share_detailed_status: false
      },
      hidden: {
        show_online_status: false,
        show_last_active: false,
        show_typing_indicator: false,
        show_activity_status: false,
        show_read_receipts: false,
        share_detailed_status: false
      }
    };

    const preset = presets[privacyLevel];

    const result = await db.query(
      `INSERT INTO match_status_preferences (
        user_id, match_id, show_online_status, show_last_active,
        show_typing_indicator, show_activity_status, show_read_receipts,
        share_detailed_status, privacy_level, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (user_id, match_id) DO UPDATE SET
        show_online_status = $3,
        show_last_active = $4,
        show_typing_indicator = $5,
        show_activity_status = $6,
        show_read_receipts = $7,
        share_detailed_status = $8,
        privacy_level = $9,
        updated_at = NOW()
      RETURNING *`,
      [userId, matchId, preset.show_online_status, preset.show_last_active,
       preset.show_typing_indicator, preset.show_activity_status,
       preset.show_read_receipts, preset.share_detailed_status, privacyLevel]
    );

    res.json({
      success: true,
      preference: result.rows[0],
      privacyLevel,
      message: `Privacy level set to ${privacyLevel}`
    });
  } catch (error) {
    console.error('Error setting privacy level:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /dating/activity-status/:matchId/:userId
 * Get formatted activity status for a user in a match (respects privacy)
 */
router.get('/activity-status/:matchId/:userId', protect, async (req, res) => {
  try {
    const { matchId, userId } = req.params;
    const requesterId = req.user.id;

    // Get match to verify requester is part of it
    const match = await db.query(
      `SELECT id FROM matches WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)`,
      [matchId, requesterId]
    );

    if (match.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not authorized for this match' });
    }

    // Get status with privacy filtering
    const status = await ActivityStatusFormatterService.buildStatusForMatch(userId, matchId, true);
    const formatted = ActivityStatusFormatterService.formatStatusForDisplay(status);

    res.json({
      success: true,
      status,
      formatted,
      privacy: status.privacy
    });
  } catch (error) {
    console.error('Error getting activity status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /dating/status-preferences/:matchId
 * Delete status preference for a match (revert to defaults)
 */
router.delete('/:matchId', protect, async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `DELETE FROM match_status_preferences
       WHERE user_id = $1 AND match_id = $2
       RETURNING id`,
      [userId, matchId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Preference not found' });
    }

    res.json({
      success: true,
      message: 'Status preference deleted, reverted to defaults'
    });
  } catch (error) {
    console.error('Error deleting status preference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
