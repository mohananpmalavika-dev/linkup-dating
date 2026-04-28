/**
 * Preferences Priority Routes
 * API endpoints for priority search placement subscriptions
 */

const express = require('express');
const router = express.Router();
const preferencesPriorityService = require('../services/preferencesPriorityService');
const { authenticateToken } = require('../middleware/auth');

/**
 * Get subscription information
 * GET /api/preferences-priority/info
 */
router.get('/info', (req, res) => {
  try {
    const info = preferencesPriorityService.getSubscriptionInfo();

    res.json({
      success: true,
      subscription: info
    });
  } catch (error) {
    console.error('Error getting subscription info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription info'
    });
  }
});

/**
 * Check user's priority status
 * GET /api/preferences-priority/status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await preferencesPriorityService.getPriorityStatus(userId);

    res.json(result);
  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check status'
    });
  }
});

/**
 * Subscribe to preferences priority
 * POST /api/preferences-priority/subscribe
 */
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { autoRenew = true } = req.body;

    // Check if user can access (has premium subscription)
    const canAccess = await preferencesPriorityService.canAccessPriority(userId);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Upgrade to premium to access preferences priority'
      });
    }

    const result = await preferencesPriorityService.subscribeToPriority(userId, autoRenew);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error subscribing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe'
    });
  }
});

/**
 * Renew subscription manually
 * POST /api/preferences-priority/renew
 */
router.post('/renew', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await preferencesPriorityService.renewSubscription(userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error renewing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to renew subscription'
    });
  }
});

/**
 * Cancel subscription
 * POST /api/preferences-priority/cancel
 */
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason = '' } = req.body;

    const result = await preferencesPriorityService.cancelSubscription(userId, reason);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error cancelling:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
});

/**
 * Get analytics
 * GET /api/preferences-priority/analytics
 */
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await preferencesPriorityService.getAnalytics(userId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics'
    });
  }
});

/**
 * Get eligibility
 * GET /api/preferences-priority/eligibility
 */
router.get('/eligibility', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const canAccess = await preferencesPriorityService.canAccessPriority(userId);

    res.json({
      success: true,
      canAccess,
      message: canAccess
        ? 'You can subscribe to preferences priority'
        : 'Upgrade to premium to access this feature'
    });
  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check eligibility'
    });
  }
});

module.exports = router;
