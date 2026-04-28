const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const momentService = require('../services/momentService');

// All routes require authentication
router.use(authenticateUser);

/**
 * POST /api/moments/upload
 * Upload a new moment (with photo URL and optional caption)
 */
router.post('/upload', async (req, res) => {
  try {
    const { photoUrl, photoKey, caption } = req.body;
    const userId = req.user.id;

    if (!photoUrl) {
      return res.status(400).json({ error: 'photoUrl is required' });
    }

    const result = await momentService.uploadMoment(
      userId,
      photoUrl,
      photoKey,
      caption
    );

    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/moments/feed
 * Get moments from current matches (non-expired only)
 * Builds FOMO by showing matches' ephemeral moments
 */
router.get('/feed', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await momentService.getMatchesMoments(userId);

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/moments/:momentId/view
 * Record that current user viewed a moment
 */
router.post('/:momentId/view', async (req, res) => {
  try {
    const { momentId } = req.params;
    const viewerUserId = req.user.id;

    const result = await momentService.recordMomentView(momentId, viewerUserId);

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/moments/:momentId/viewers
 * Get who viewed a moment (only owner can see)
 */
router.get('/:momentId/viewers', async (req, res) => {
  try {
    const { momentId } = req.params;
    const userId = req.user.id;

    const result = await momentService.getMomentViewers(momentId, userId);

    return res.status(result.success ? 200 : 403).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/moments/my-moments
 * Get user's own active moments (24hr window)
 */
router.get('/my-moments', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await momentService.getUserMoments(userId);

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/moments/stats
 * Get moments feed statistics (FOMO metrics)
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await momentService.getMomentsStats(userId);

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
