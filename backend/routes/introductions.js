/**
 * Introductions Routes (Concierge Light)
 * API endpoints for AI-suggested match introductions
 */

const express = require('express');
const router = express.Router();
const introductionsService = require('../services/introductionsService');
const { authenticateToken } = require('../middleware/auth');

/**
 * Generate introductions for premium user
 * POST /api/introductions/generate
 */
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { count = 3 } = req.body;

    // Validate input
    if (count < 1 || count > 5) {
      return res.status(400).json({
        success: false,
        message: 'Count must be between 1 and 5'
      });
    }

    // Check if should generate new intros
    const shouldGenerate = await introductionsService.shouldGenerateNewIntros(userId);

    if (!shouldGenerate) {
      return res.status(429).json({
        success: false,
        message: 'Introductions already generated this week. Try again later.'
      });
    }

    const result = await introductionsService.generateIntroductions(userId, count);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      count: result.count,
      introductions: result.introductions,
      message: result.message
    });
  } catch (error) {
    console.error('Error generating introductions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate introductions'
    });
  }
});

/**
 * Get pending introductions for user
 * GET /api/introductions?status=pending&limit=10
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status = 'pending', limit = 10 } = req.query;

    const introductions = await introductionsService.getIntroductions(
      userId,
      status,
      parseInt(limit, 10) || 10
    );

    res.json({
      success: true,
      count: introductions.length,
      introductions
    });
  } catch (error) {
    console.error('Error fetching introductions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch introductions'
    });
  }
});

/**
 * Get introduction by ID
 * GET /api/introductions/:introId
 */
router.get('/:introId', authenticateToken, async (req, res) => {
  try {
    const { introId } = req.params;
    const userId = req.user.id;

    const introductions = await introductionsService.getIntroductions(userId, 'all', 1);
    const intro = introductions.find((i) => i.id === parseInt(introId, 10));

    if (!intro) {
      return res.status(404).json({
        success: false,
        message: 'Introduction not found'
      });
    }

    res.json({
      success: true,
      introduction: intro
    });
  } catch (error) {
    console.error('Error fetching introduction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch introduction'
    });
  }
});

/**
 * Respond to introduction (like/pass)
 * POST /api/introductions/:introId/respond
 * Body: { response: 'liked' | 'passed', feedback?: string }
 */
router.post('/:introId/respond', authenticateToken, async (req, res) => {
  try {
    const { introId } = req.params;
    const { response, feedback } = req.body;
    const userId = req.user.id;

    if (!['liked', 'passed'].includes(response)) {
      return res.status(400).json({
        success: false,
        message: 'Response must be "liked" or "passed"'
      });
    }

    const result = await introductionsService.respondToIntro(
      userId,
      parseInt(introId, 10),
      response,
      feedback
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error responding to introduction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to introduction'
    });
  }
});

/**
 * Rate introduction quality
 * POST /api/introductions/:introId/rate
 * Body: { rating: 1-5, feedback?: string }
 */
router.post('/:introId/rate', authenticateToken, async (req, res) => {
  try {
    const { introId } = req.params;
    const { rating, feedback } = req.body;
    const userId = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const result = await introductionsService.rateIntroduction(
      userId,
      parseInt(introId, 10),
      rating,
      feedback
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error rating introduction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to rate introduction'
    });
  }
});

/**
 * Get introduction statistics for user
 * GET /api/introductions/stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await introductionsService.getIntroStats(userId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching intro stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

/**
 * Check eligibility and readiness for introductions
 * GET /api/introductions/eligibility
 */
router.get('/eligibility', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const isEligible = await introductionsService.isEligibleForIntros(userId);
    const shouldGenerate = await introductionsService.shouldGenerateNewIntros(userId);

    res.json({
      success: true,
      eligible: isEligible,
      readyForNewIntros: shouldGenerate,
      message: isEligible
        ? 'You are eligible for introductions'
        : 'Complete your profile or upgrade to premium to get introductions'
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
