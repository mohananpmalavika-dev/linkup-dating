/**
 * Video Verification Routes
 * Handles video verification API endpoints
 */

const express = require('express');
const router = express.Router();
const VideoVerificationService = require('../services/videoVerificationService');
const { VideoVerificationBadge, VideoAuthenticationResult } = require('../models');

/**
 * POST /api/video-verification/process-result
 * Process video authentication result and create/update badge
 */
router.post('/process-result', async (req, res) => {
  try {
    const userId = req.user.id;
    const { videoAuthResultId } = req.body;

    if (!videoAuthResultId) {
      return res.status(400).json({
        success: false,
        message: 'videoAuthResultId is required'
      });
    }

    const result = await VideoVerificationService.processVerificationResult(userId, videoAuthResultId);

    res.json({
      success: result.success,
      verified: result.verified,
      scores: result.scores,
      requiresManualReview: result.requiresManualReview,
      message: result.verified ? 'Video verification successful! ✅' : 'Video verification failed',
      reason: result.reason
    });
  } catch (error) {
    console.error('Error processing verification result:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing verification result',
      error: error.message
    });
  }
});

/**
 * GET /api/video-verification/badge
 * Get current user's verification badge
 */
router.get('/badge', async (req, res) => {
  try {
    const userId = req.user.id;
    const badge = await VideoVerificationService.getUserBadge(userId);
    const display = await VideoVerificationService.getBadgeDisplay(userId);

    res.json({
      success: true,
      badge: badge ? {
        id: badge.id,
        verified: badge.is_verified,
        status: badge.verification_status,
        verifiedAt: badge.verification_timestamp,
        expiresAt: badge.expires_at,
        scores: {
          facialMatch: Math.round(badge.facial_match_score * 100),
          liveness: Math.round(badge.liveness_score * 100) || 0,
          overall: Math.round(badge.overall_authenticity_score * 100) || 0
        }
      } : null,
      display: display
    });
  } catch (error) {
    console.error('Error getting badge:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving badge',
      error: error.message
    });
  }
});

/**
 * GET /api/video-verification/badge/:userId
 * Get verification badge for a specific user (public profile view)
 */
router.get('/badge/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const display = await VideoVerificationService.getBadgeDisplay(userId);

    res.json({
      success: true,
      display: display
    });
  } catch (error) {
    console.error('Error getting badge:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving badge',
      error: error.message
    });
  }
});

/**
 * GET /api/video-verification/is-verified/:userId
 * Check if user is verified (for messaging prioritization)
 */
router.get('/is-verified/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const isVerified = await VideoVerificationBadge.isUserVerified(userId);

    res.json({
      success: true,
      verified: isVerified
    });
  } catch (error) {
    console.error('Error checking verification status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking verification status',
      error: error.message
    });
  }
});

/**
 * GET /api/video-verification/stats
 * Get verification statistics (admin)
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await VideoVerificationService.getVerificationStats();

    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/video-verification/verified-users
 * Get list of verified users (for premium user discovery)
 * Query params: limit, offset, minFacialMatch, excludeUserId
 */
router.get('/verified-users', async (req, res) => {
  try {
    const { limit, offset, minFacialMatch, excludeUserId } = req.query;

    const verifiedUsers = await VideoVerificationService.getVerifiedUsersList({
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
      minFacialMatch: minFacialMatch ? parseFloat(minFacialMatch) : 0.90,
      excludeUserId: excludeUserId ? parseInt(excludeUserId) : null
    });

    res.json({
      success: true,
      count: verifiedUsers.length,
      users: verifiedUsers
    });
  } catch (error) {
    console.error('Error getting verified users:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving verified users',
      error: error.message
    });
  }
});

/**
 * POST /api/video-verification/revoke (Admin only)
 * Revoke verification badge for a user
 */
router.post('/revoke', async (req, res) => {
  try {
    // Check if admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const success = await VideoVerificationService.revokeBadge(userId, reason || 'Admin revocation');

    res.json({
      success: success,
      message: success ? 'Badge revoked successfully' : 'Failed to revoke badge'
    });
  } catch (error) {
    console.error('Error revoking badge:', error);
    res.status(500).json({
      success: false,
      message: 'Error revoking badge',
      error: error.message
    });
  }
});

/**
 * POST /api/video-verification/flag-review (Admin only)
 * Flag badge for manual review
 */
router.post('/flag-review', async (req, res) => {
  try {
    // Check if admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { userId, notes } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const success = await VideoVerificationService.flagForManualReview(userId, notes);

    res.json({
      success: success,
      message: success ? 'Badge flagged for review' : 'Failed to flag badge'
    });
  } catch (error) {
    console.error('Error flagging badge:', error);
    res.status(500).json({
      success: false,
      message: 'Error flagging badge',
      error: error.message
    });
  }
});

/**
 * GET /api/video-verification/pending-review (Admin only)
 * Get badges pending manual review
 */
router.get('/pending-review', async (req, res) => {
  try {
    // Check if admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { limit } = req.query;
    const pendingBadges = await VideoVerificationService.getPendingReview(limit ? parseInt(limit) : 50);

    res.json({
      success: true,
      count: pendingBadges.length,
      badges: pendingBadges
    });
  } catch (error) {
    console.error('Error getting pending reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving pending reviews',
      error: error.message
    });
  }
});

module.exports = router;
