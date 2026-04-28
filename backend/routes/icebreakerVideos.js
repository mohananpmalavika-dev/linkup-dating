const express = require('express');
const router = express.Router();
const { authenticateToken, requirePremium } = require('../middleware/auth');
const {
  uploadIcebreakerVideo,
  getUserActiveVideo,
  getUserVideos,
  getMatchVideoForViewing,
  rateIcebreakerVideo,
  deleteIcebreakerVideo,
  getVideoViewStats,
  getFeaturedVideos,
  getTrendingVideos,
} = require('../services/icebreakerVideoService');
const { logger } = require('../utils/logger');

// ============================================================
// UPLOAD & MANAGE
// ============================================================

/**
 * POST /api/icebreaker-videos/upload
 * Upload a new icebreaker video (Premium feature)
 */
router.post('/upload', authenticateToken, requirePremium, async (req, res) => {
  try {
    const { videoUrl, videoKey, durationSeconds, thumbnailUrl, title } =
      req.body;

    if (!videoUrl || !durationSeconds) {
      return res.status(400).json({
        error: 'videoUrl and durationSeconds are required',
      });
    }

    const video = await uploadIcebreakerVideo(
      req.user.id,
      videoUrl,
      videoKey,
      durationSeconds,
      thumbnailUrl,
      title
    );

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      video,
    });
  } catch (error) {
    logger.error('[IcebreakerVideo Routes] Upload error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/icebreaker-videos/my-videos
 * Get user's icebreaker video gallery
 */
router.get('/my-videos', authenticateToken, requirePremium, async (req, res) => {
  try {
    const videos = await getUserVideos(req.user.id);

    res.json({
      success: true,
      videos,
      count: videos.length,
    });
  } catch (error) {
    logger.error('[IcebreakerVideo Routes] Get user videos error:', error);
    res.status(500).json({ error: 'Failed to retrieve videos' });
  }
});

/**
 * GET /api/icebreaker-videos/my-active
 * Get user's currently active (intro) video
 */
router.get('/my-active', authenticateToken, async (req, res) => {
  try {
    const video = await getUserActiveVideo(req.user.id);

    if (!video) {
      return res.json({
        success: true,
        video: null,
        message: 'No active video',
      });
    }

    // Don't include full URL for listing (privacy)
    const videoData = {
      id: video.id,
      title: video.title,
      duration_seconds: video.duration_seconds,
      thumbnail_url: video.thumbnail_url,
      average_rating: video.average_rating,
      view_count: video.view_count,
      authenticity_score: video.authenticity_score,
      created_at: video.created_at,
    };

    res.json({
      success: true,
      video: videoData,
    });
  } catch (error) {
    logger.error('[IcebreakerVideo Routes] Get active video error:', error);
    res.status(500).json({ error: 'Failed to retrieve video' });
  }
});

/**
 * DELETE /api/icebreaker-videos/:videoId
 * Delete an icebreaker video
 */
router.delete('/:videoId', authenticateToken, requirePremium, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { videoKey } = req.body;

    await deleteIcebreakerVideo(videoId, req.user.id, videoKey);

    res.json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error) {
    logger.error('[IcebreakerVideo Routes] Delete error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// VIEW & RATE
// ============================================================

/**
 * GET /api/icebreaker-videos/match/:userId
 * Get a matched user's active icebreaker video
 */
router.get('/match/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const video = await getMatchVideoForViewing(userId, req.user.id);

    if (!video) {
      return res.status(404).json({
        error: 'Video not found or not accessible',
      });
    }

    res.json({
      success: true,
      video,
    });
  } catch (error) {
    logger.error('[IcebreakerVideo Routes] Get match video error:', error);
    res.status(500).json({ error: 'Failed to retrieve video' });
  }
});

/**
 * POST /api/icebreaker-videos/:videoId/rate
 * Rate an icebreaker video
 */
router.post('/:videoId/rate', authenticateToken, async (req, res) => {
  try {
    const { videoId } = req.params;
    const {
      rating,
      authenticity_rating,
      reaction,
      is_helpful,
      would_match,
      comment,
    } = req.body;

    const videoRating = await rateIcebreakerVideo(videoId, req.user.id, {
      rating,
      authenticity_rating,
      reaction,
      is_helpful,
      would_match,
      comment,
    });

    res.json({
      success: true,
      message: 'Rating recorded successfully',
      rating: videoRating,
    });
  } catch (error) {
    logger.error('[IcebreakerVideo Routes] Rate error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/icebreaker-videos/:videoId/stats
 * Get video view statistics (owner only)
 */
router.get('/:videoId/stats', authenticateToken, requirePremium, async (req, res) => {
  try {
    const { videoId } = req.params;

    const stats = await getVideoViewStats(videoId, req.user.id);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('[IcebreakerVideo Routes] Stats error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================
// DISCOVERY
// ============================================================

/**
 * GET /api/icebreaker-videos/featured
 * Get featured icebreaker videos for discovery
 */
router.get('/featured', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 12;

    const videos = await getFeaturedVideos(limit);

    res.json({
      success: true,
      videos,
      count: videos.length,
    });
  } catch (error) {
    logger.error('[IcebreakerVideo Routes] Featured videos error:', error);
    res.status(500).json({ error: 'Failed to retrieve featured videos' });
  }
});

/**
 * GET /api/icebreaker-videos/trending
 * Get trending icebreaker videos
 */
router.get('/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const daysBack = parseInt(req.query.daysBack) || 7;

    const videos = await getTrendingVideos(limit, daysBack);

    res.json({
      success: true,
      videos,
      count: videos.length,
    });
  } catch (error) {
    logger.error('[IcebreakerVideo Routes] Trending videos error:', error);
    res.status(500).json({ error: 'Failed to retrieve trending videos' });
  }
});

module.exports = router;
