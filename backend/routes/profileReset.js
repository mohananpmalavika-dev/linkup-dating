/**
 * Profile Reset Routes
 * API endpoints for profile reset functionality
 */

const express = require('express');
const router = express.Router();
const profileResetService = require('../services/profileResetService');
const { authenticateToken } = require('../middleware/auth');

/**
 * Get feature info
 * GET /api/profile-reset/info
 */
router.get('/info', (req, res) => {
  try {
    const info = profileResetService.getResetFeatureInfo();

    res.json({
      success: true,
      feature: info
    });
  } catch (error) {
    console.error('Error getting feature info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get feature info'
    });
  }
});

/**
 * Get reset status
 * GET /api/profile-reset/status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await profileResetService.getResetStatus(userId);

    res.json(result);
  } catch (error) {
    console.error('Error getting reset status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reset status'
    });
  }
});

/**
 * Initiate profile reset
 * POST /api/profile-reset/reset
 */
router.post('/reset', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason = '' } = req.body;

    const result = await profileResetService.initiateReset(userId, reason);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error initiating reset:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset profile'
    });
  }
});

/**
 * Get reset history
 * GET /api/profile-reset/history
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const result = await profileResetService.getResetHistory(userId, limit);

    res.json(result);
  } catch (error) {
    console.error('Error getting reset history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reset history'
    });
  }
});

/**
 * Get reset impact analytics
 * GET /api/profile-reset/impact
 */
router.get('/impact', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await profileResetService.getResetImpact(userId);

    res.json(result);
  } catch (error) {
    console.error('Error getting reset impact:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reset impact'
    });
  }
});

/**
 * Get reset statistics
 * GET /api/profile-reset/stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await profileResetService.getResetStats(userId);

    res.json(result);
  } catch (error) {
    console.error('Error getting reset stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reset stats'
    });
  }
});

/**
 * Check premium access
 * GET /api/profile-reset/premium-access
 */
router.get('/premium-access', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const canAccess = await profileResetService.canAccessPremiumReset(userId);

    res.json({
      success: true,
      canAccess,
      message: canAccess
        ? 'You have access to unlimited profile resets'
        : 'Upgrade to premium for unlimited resets'
    });
  } catch (error) {
    console.error('Error checking premium access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check access'
    });
  }
});

module.exports = router;
