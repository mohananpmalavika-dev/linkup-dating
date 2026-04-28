/**
 * Boost Routes
 * API endpoints for profile visibility boosts
 */

const express = require('express');
const router = express.Router();
const boostService = require('../services/boostService');
const { authenticateToken } = require('../middleware/auth');

/**
 * Get boost packages
 * GET /api/boosts/packages
 */
router.get('/packages', (req, res) => {
  try {
    const packages = boostService.getBoostPackages();
    const pricing = boostService.getBulkPricing();

    res.json({
      success: true,
      packages,
      bulkPricing: pricing
    });
  } catch (error) {
    console.error('Error getting packages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get boost packages'
    });
  }
});

/**
 * Get pricing info
 * GET /api/boosts/pricing?type=standard&quantity=1
 */
router.get('/pricing', (req, res) => {
  try {
    const { type = 'standard', quantity = 1 } = req.query;

    const pricing = boostService.calculatePrice(type, parseInt(quantity, 10));

    if (!pricing) {
      return res.status(400).json({
        success: false,
        message: 'Invalid boost type'
      });
    }

    res.json({
      success: true,
      pricing
    });
  } catch (error) {
    console.error('Error calculating pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate pricing'
    });
  }
});

/**
 * Purchase a boost
 * POST /api/boosts/purchase
 * Body: { type: 'standard'|'premium'|'ultimate', smartSchedule?: boolean, scheduledTime?: ISO8601 }
 */
router.post('/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, smartSchedule = true, scheduledTime } = req.body;

    // Check if user can use boosts
    const canUse = await boostService.canUseBoosts(userId);
    if (!canUse) {
      return res.status(403).json({
        success: false,
        message: 'Upgrade to premium to use boosts'
      });
    }

    const result = await boostService.purchaseBoost(
      userId,
      type,
      smartSchedule,
      scheduledTime ? new Date(scheduledTime) : null
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error purchasing boost:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to purchase boost'
    });
  }
});

/**
 * Get user's active boosts
 * GET /api/boosts/active
 */
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const boosts = await boostService.getActiveBoosts(userId);

    res.json({
      success: true,
      count: boosts.length,
      boosts
    });
  } catch (error) {
    console.error('Error fetching active boosts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active boosts'
    });
  }
});

/**
 * Get user's boost history
 * GET /api/boosts/history?limit=20
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    const boosts = await boostService.getBoostHistory(userId, parseInt(limit, 10));

    res.json({
      success: true,
      count: boosts.length,
      boosts
    });
  } catch (error) {
    console.error('Error fetching boost history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch boost history'
    });
  }
});

/**
 * Get boost analytics
 * GET /api/boosts/:boostId/analytics
 */
router.get('/:boostId/analytics', authenticateToken, async (req, res) => {
  try {
    const { boostId } = req.params;
    const userId = req.user.id;

    const result = await boostService.getBoostAnalytics(
      parseInt(boostId, 10),
      userId
    );

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting boost analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics'
    });
  }
});

/**
 * Cancel a boost
 * POST /api/boosts/:boostId/cancel
 */
router.post('/:boostId/cancel', authenticateToken, async (req, res) => {
  try {
    const { boostId } = req.params;
    const userId = req.user.id;

    const result = await boostService.cancelBoost(
      parseInt(boostId, 10),
      userId
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error cancelling boost:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel boost'
    });
  }
});

/**
 * Check if user can use boosts
 * GET /api/boosts/eligibility
 */
router.get('/eligibility', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const canUse = await boostService.canUseBoosts(userId);

    res.json({
      success: true,
      canUseBoosts: canUse,
      message: canUse
        ? 'You can purchase boosts'
        : 'Upgrade to premium to use boosts'
    });
  } catch (error) {
    console.error('Error checking boost eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check eligibility'
    });
  }
});

module.exports = router;
