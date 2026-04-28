/**
 * Moderation Routes
 * Endpoints for content moderation and flagging
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const contentModerationService = require('../services/contentModerationService');

/**
 * POST /moderation/scan-text
 * Scan text for inappropriate content
 */
router.post('/scan-text', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text required' });
    }

    const result = await contentModerationService.scanText(text);

    res.json({
      clean: result.clean,
      severity: result.severity,
      flags: result.flags,
      issues: result.issues.map(i => ({
        type: i.type,
        message: i.message,
        severity: i.severity
      }))
    });
  } catch (error) {
    console.error('Error scanning text:', error);
    res.status(500).json({ error: 'Scan failed' });
  }
});

/**
 * POST /moderation/scan-image
 * Scan image for NSFW content
 */
router.post('/scan-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL required' });
    }

    const result = await contentModerationService.scanImage(imageUrl);

    res.json({
      clean: result.clean,
      nsfw: result.nsfw,
      issues: result.issues.map(i => ({
        type: i.type,
        message: i.message,
        severity: i.severity
      }))
    });
  } catch (error) {
    console.error('Error scanning image:', error);
    res.status(500).json({ error: 'Scan failed' });
  }
});

/**
 * POST /moderation/scan-profile
 * Scan user profile for issues
 */
router.post('/scan-profile', async (req, res) => {
  try {
    const { profileData } = req.body;

    if (!profileData) {
      return res.status(400).json({ error: 'Profile data required' });
    }

    const result = await contentModerationService.scanProfile(profileData);

    res.json({
      clean: result.clean,
      severity: result.severity,
      flags: result.flags,
      issues: result.issues.map(i => ({
        field: i.field,
        type: i.type,
        message: i.message,
        severity: i.severity
      }))
    });
  } catch (error) {
    console.error('Error scanning profile:', error);
    res.status(500).json({ error: 'Scan failed' });
  }
});

/**
 * POST /moderation/flag
 * Flag content for manual review
 */
router.post('/flag', authenticateToken, async (req, res) => {
  try {
    const { contentType, contentId, reason } = req.body;
    const userId = req.user.id;

    if (!contentType || !contentId || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await contentModerationService.flagContent(
      userId,
      contentType,
      contentId,
      reason,
      { reportedAt: new Date().toISOString() }
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('Error flagging content:', error);
    res.status(500).json({ error: 'Failed to flag content' });
  }
});

/**
 * GET /moderation/pending-flags
 * Get pending flags for admin review
 * Requires admin authentication
 */
router.get('/pending-flags', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { limit = 50, offset = 0 } = req.query;

    const flags = await contentModerationService.getPendingFlags(
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      flags: flags.map(f => ({
        id: f.id,
        userId: f.user_id,
        contentType: f.content_type,
        contentId: f.content_id,
        reason: f.reason,
        createdAt: f.created_at
      })),
      count: flags.length
    });
  } catch (error) {
    console.error('Error getting flags:', error);
    res.status(500).json({ error: 'Failed to get flags' });
  }
});

/**
 * POST /moderation/resolve-flag
 * Approve or reject flagged content
 * Requires admin authentication
 */
router.post('/resolve-flag', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { flagId, action, reason } = req.body;

    if (!flagId || !action) {
      return res.status(400).json({ error: 'Missing flagId or action' });
    }

    const result = await contentModerationService.resolveFlagStatus(flagId, action, reason);

    res.json(result);
  } catch (error) {
    console.error('Error resolving flag:', error);
    res.status(500).json({ error: 'Failed to resolve flag' });
  }
});

/**
 * GET /moderation/stats
 * Get moderation statistics
 * Requires admin authentication
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get stats
    const pendingResult = await db.query(
      'SELECT COUNT(*) as count FROM moderation_flags WHERE status = $1',
      ['pending']
    );

    const resolvedResult = await db.query(
      'SELECT COUNT(*) as count FROM moderation_flags WHERE status != $1',
      ['pending']
    );

    const logsResult = await db.query(
      `SELECT action_type, COUNT(*) as count
       FROM moderation_logs
       WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
       GROUP BY action_type`
    );

    res.json({
      pending: parseInt(pendingResult.rows[0].count),
      resolved: parseInt(resolvedResult.rows[0].count),
      recentActions: logsResult.rows.map(r => ({
        action: r.action_type,
        count: parseInt(r.count)
      }))
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
