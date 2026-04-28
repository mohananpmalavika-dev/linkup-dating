const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const videoCallInsightsService = require('../services/videoCallInsightsService');

// All routes require authentication
router.use(authenticateUser);

/**
 * POST /api/video-insights/rate-call
 * Submit a post-call rating
 */
router.post('/rate-call', async (req, res) => {
  try {
    const { videoDeteId, ratedUserId, rating, comment, wouldDateAgain, communicationQuality, chemistryLevel, appearanceMatch, personalityMatch } = req.body;
    const raterUserId = req.user.id;

    if (!videoDeteId || !ratedUserId || !rating) {
      return res.status(400).json({
        error: 'videoDeteId, ratedUserId, and rating are required',
      });
    }

    const result = await videoCallInsightsService.submitCallRating(
      videoDeteId,
      raterUserId,
      ratedUserId,
      {
        rating,
        comment,
        wouldDateAgain,
        communicationQuality,
        chemistryLevel,
        appearanceMatch,
        personalityMatch,
      }
    );

    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/video-insights/analytics
 * Get user's video call analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await videoCallInsightsService.getUserAnalytics(userId);

    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/video-insights/generate-compatibility/:videoDeteId
 * Generate compatibility score for a video call
 */
router.post('/generate-compatibility/:videoDeteId', async (req, res) => {
  try {
    const { videoDeteId } = req.params;

    const result = await videoCallInsightsService.generateCompatibilityScore(videoDeteId);

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/video-insights/upcoming-calls
 * Get upcoming video calls for user
 */
router.get('/upcoming-calls', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await videoCallInsightsService.getUserUpcomingCalls(userId);

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/video-insights/call-history
 * Get video call history for user
 */
router.get('/call-history', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit } = req.query;

    const result = await videoCallInsightsService.getUserCallHistory(
      userId,
      limit ? parseInt(limit) : 10
    );

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
