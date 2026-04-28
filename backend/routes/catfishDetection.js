const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const catfishDetectionService = require('../services/catfishDetectionService');
const db = require('../config/database');

/**
 * POST /api/catfish-detection/scan
 * Scan a message for red flags
 */
router.post('/scan', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text required' });
    }

    const scanResult = catfishDetectionService.scanMessage(message);

    res.json({
      success: true,
      message: 'Message scanned',
      scan: {
        hasRedFlags: scanResult.hasRedFlags,
        redFlags: scanResult.redFlags,
        flagType: scanResult.flagType,
        riskLevel: scanResult.riskLevel,
        confidenceScore: scanResult.confidenceScore,
        warning: scanResult.hasRedFlags 
          ? `⚠️ This message might be suspicious (${scanResult.riskLevel} risk)`
          : null
      }
    });
  } catch (error) {
    console.error('Error scanning message:', error);
    res.status(500).json({ error: 'Failed to scan message' });
  }
});

/**
 * GET /api/catfish-detection/flags
 * Get all flags for current user
 */
router.get('/flags', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const includeDismissed = req.query.includeDismissed === 'true';

    const flags = await catfishDetectionService.getFlagsForUser(userId, {
      limit,
      offset,
      includeDismissed
    });

    res.json({
      success: true,
      flags,
      count: flags.length
    });
  } catch (error) {
    console.error('Error getting flags:', error);
    res.status(500).json({ error: 'Failed to get flags' });
  }
});

/**
 * GET /api/catfish-detection/stats
 * Get suspicious activity stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await catfishDetectionService.getUserStats(userId);

    res.json({
      success: true,
      stats: {
        totalFlags: stats.total_flags,
        reportedFlags: stats.reported_flags,
        criticalFlags: stats.critical_flags,
        highRiskFlags: stats.high_flags,
        averageConfidence: Math.round(stats.avg_confidence * 100) / 100,
        flagTypes: stats.flag_types || []
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * POST /api/catfish-detection/flags/:flagId/dismiss
 * Dismiss a warning
 */
router.post('/flags/:flagId/dismiss', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { flagId } = req.params;

    const flag = await catfishDetectionService.dismissFlag(flagId, userId);

    res.json({
      success: true,
      message: 'Flag dismissed',
      flag
    });
  } catch (error) {
    console.error('Error dismissing flag:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message || 'Failed to dismiss flag' });
  }
});

/**
 * POST /api/catfish-detection/flags/:flagId/report
 * Report a message as suspicious
 */
router.post('/flags/:flagId/report', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { flagId } = req.params;
    const { reason } = req.body;

    if (!reason || !['scam', 'money_request', 'catfishing', 'harassment', 'other'].includes(reason)) {
      return res.status(400).json({ error: 'Valid report reason required' });
    }

    const flag = await catfishDetectionService.reportFlag(flagId, userId, reason);

    res.json({
      success: true,
      message: 'Message reported successfully. Our team will review it.',
      flag
    });
  } catch (error) {
    console.error('Error reporting flag:', error);
    res.status(error.message.includes('not found') ? 404 : 500)
      .json({ error: error.message || 'Failed to report flag' });
  }
});

/**
 * POST /api/catfish-detection/check-user
 * Check if a user has suspicious patterns
 */
router.post('/check-user', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const stats = await catfishDetectionService.getUserStats(userId);

    const riskAssessment = {
      userId,
      flagCount: stats.total_flags,
      reportedCount: stats.reported_flags,
      isSuspicious: stats.total_flags >= 3,
      riskLevel: stats.total_flags === 0 ? 'safe' : stats.total_flags >= 5 ? 'high' : 'low',
      recommendation: stats.total_flags >= 3 ? 'Consider blocking this user or proceeding with caution' : 'No suspicious activity detected',
      flagTypes: stats.flag_types || []
    };

    res.json({
      success: true,
      assessment: riskAssessment
    });
  } catch (error) {
    console.error('Error checking user:', error);
    res.status(500).json({ error: 'Failed to check user' });
  }
});

/**
 * GET /api/catfish-detection/suspicious-users
 * Get list of suspicious users (admin/internal)
 */
router.get('/suspicious-users', authenticateToken, async (req, res) => {
  try {
    // In production, add role-based access control
    // if (req.user.role !== 'admin') { return res.status(403).json({ error: 'Forbidden' }); }

    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const daysBack = parseInt(req.query.daysBack) || 30;

    const suspiciousUsers = await catfishDetectionService.getSuspiciousUsers({
      limit,
      daysBack
    });

    res.json({
      success: true,
      suspiciousUsers,
      count: suspiciousUsers.length
    });
  } catch (error) {
    console.error('Error getting suspicious users:', error);
    res.status(500).json({ error: 'Failed to get suspicious users' });
  }
});

module.exports = router;
