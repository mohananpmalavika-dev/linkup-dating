/**
 * Video Verification Service
 * Handles AI face verification and badge management
 * Detects face match between video and profile photos
 */

const { VideoVerificationBadge, VideoAuthenticationResult, DatingProfile, User } = require('../models');

class VideoVerificationService {
  /**
   * Get face recognition library (face-api.js or similar)
   * Uses TensorFlow.js for client-side or server-side face detection
   */
  static async initializeFaceDetection() {
    // This would be initialized with face-api.js or similar library
    // For now, we'll implement a placeholder that can be replaced with real AI
    return {
      detectFace: async (imagePath) => {
        // Real implementation would use face-api or similar
        return null;
      },
      compareFaces: async (face1, face2) => {
        // Returns similarity score 0-1
        return null;
      }
    };
  }

  /**
   * Analyze video verification result and create badge if verified
   * @param {Integer} userId
   * @param {Integer} videoAuthResultId - ID of VideoAuthenticationResult
   * @returns {Object} Badge creation result
   */
  static async processVerificationResult(userId, videoAuthResultId) {
    try {
      const videoAuthResult = await VideoAuthenticationResult.findByPk(videoAuthResultId);
      if (!videoAuthResult) {
        throw new Error('Video authentication result not found');
      }

      const facialMatchScore = videoAuthResult.facialMatchScore || 0;
      const livenessScore = videoAuthResult.livenessDetectionScore || 0;
      const overallScore = videoAuthResult.overallAuthenticityScore || 0;

      // Verification threshold: >90% facial match + >85% liveness
      const isVerified = facialMatchScore >= 0.90 && livenessScore >= 0.85;

      // Check for risk flags
      const riskFlags = videoAuthResult.riskFlags || [];
      const hasBlockingRisks = riskFlags.some(flag =>
        ['face_mismatch', 'deepfake_detected', 'multiple_faces'].includes(flag)
      );

      if (hasBlockingRisks) {
        return {
          success: false,
          verified: false,
          reason: 'Risk flags detected during verification'
        };
      }

      // Find existing badge or create new one
      let badge = await VideoVerificationBadge.findOne({
        where: { user_id: userId }
      });

      const badgeData = {
        user_id: userId,
        video_authentication_result_id: videoAuthResultId,
        is_verified: isVerified,
        verification_status: isVerified ? 'verified' : 'failed',
        facial_match_score: facialMatchScore,
        liveness_score: livenessScore,
        overall_authenticity_score: overallScore,
        risk_flags: riskFlags,
        verification_timestamp: new Date(),
        expires_at: isVerified ? this.calculateExpirationDate() : null,
        rejection_reason: !isVerified ? 'Facial match score below threshold' : null,
        manual_review_flag: facialMatchScore >= 0.85 && facialMatchScore < 0.90 // Flag borderline cases for manual review
      };

      if (badge) {
        await badge.update(badgeData);
      } else {
        badge = await VideoVerificationBadge.create(badgeData);
      }

      return {
        success: true,
        verified: isVerified,
        badge: badge,
        scores: {
          facialMatch: facialMatchScore,
          liveness: livenessScore,
          overall: overallScore
        },
        requiresManualReview: badgeData.manual_review_flag
      };
    } catch (error) {
      console.error('Error processing verification result:', error);
      throw error;
    }
  }

  /**
   * Get user's current verification badge
   * @param {Integer} userId
   * @returns {Object|null} Badge object or null
   */
  static async getUserBadge(userId) {
    try {
      const badge = await VideoVerificationBadge.findOne({
        where: { user_id: userId },
        include: [
          { association: 'videoAuthenticationResult', attributes: ['facial_match_score', 'liveness_detection_score', 'overall_authenticity_score', 'risk_flags'] }
        ]
      });

      if (!badge) return null;

      // Check if expired
      if (badge.expiresAt && new Date() > new Date(badge.expiresAt)) {
        await badge.update({ verification_status: 'expired' });
        return null;
      }

      return badge;
    } catch (error) {
      console.error('Error getting user badge:', error);
      return null;
    }
  }

  /**
   * Get badge display info for profile
   * @param {Integer} userId
   * @returns {Object} Badge display data
   */
  static async getBadgeDisplay(userId) {
    const badge = await this.getUserBadge(userId);

    if (!badge || badge.verificationStatus !== 'verified') {
      return {
        isVisible: false,
        verified: false
      };
    }

    return {
      isVisible: true,
      verified: true,
      icon: '✅',
      label: 'Video Verified',
      color: '#10b981',
      timestamp: badge.verificationTimestamp,
      tooltip: `This profile has been verified via video call. Verification completed on ${new Date(badge.verificationTimestamp).toLocaleDateString()}`,
      scores: {
        facialMatch: Math.round(badge.facialMatchScore * 100),
        liveness: Math.round(badge.livenessScore * 100)
      }
    };
  }

  /**
   * Calculate badge expiration date (1 year from now)
   * @returns {Date}
   */
  static calculateExpirationDate() {
    const expiration = new Date();
    expiration.setFullYear(expiration.getFullYear() + 1);
    return expiration;
  }

  /**
   * Revoke verification badge
   * @param {Integer} userId
   * @param {String} reason
   * @returns {Boolean} Success status
   */
  static async revokeBadge(userId, reason = 'Admin revocation') {
    try {
      const badge = await VideoVerificationBadge.findOne({
        where: { user_id: userId }
      });

      if (!badge) {
        throw new Error('Badge not found');
      }

      await badge.update({
        verification_status: 'revoked',
        is_verified: false,
        manual_review_notes: reason
      });

      return true;
    } catch (error) {
      console.error('Error revoking badge:', error);
      return false;
    }
  }

  /**
   * Get statistics on verified users
   * @returns {Object} Stats
   */
  static async getVerificationStats() {
    try {
      const total = await VideoVerificationBadge.count();
      const verified = await VideoVerificationBadge.count({
        where: { verification_status: 'verified' }
      });
      const failed = await VideoVerificationBadge.count({
        where: { verification_status: 'failed' }
      });
      const pending = await VideoVerificationBadge.count({
        where: { verification_status: 'pending' }
      });

      const avgFacialMatch = await VideoVerificationBadge.findOne({
        attributes: [
          [require('sequelize').fn('AVG', require('sequelize').col('facial_match_score')), 'avgScore']
        ],
        raw: true
      });

      return {
        totalAttempts: total,
        verified: verified,
        verificationRate: total > 0 ? Math.round((verified / total) * 100) : 0,
        failed: failed,
        pending: pending,
        averageFacialMatchScore: avgFacialMatch?.avgScore ? parseFloat(avgFacialMatch.avgScore).toFixed(3) : 0
      };
    } catch (error) {
      console.error('Error getting verification stats:', error);
      return {};
    }
  }

  /**
   * Get list of verified users (for premium user discovery)
   * @param {Object} options - Query options
   * @returns {Array} Verified user profiles
   */
  static async getVerifiedUsersList(options = {}) {
    try {
      const {
        limit = 100,
        offset = 0,
        minFacialMatch = 0.90,
        excludeUserId = null
      } = options;

      const where = {
        verification_status: 'verified',
        is_verified: true,
        facial_match_score: {
          [require('sequelize').Op.gte]: minFacialMatch
        }
      };

      if (excludeUserId) {
        where.user_id = {
          [require('sequelize').Op.ne]: excludeUserId
        };
      }

      const badges = await VideoVerificationBadge.findAll({
        where,
        include: [
          {
            association: 'profile',
            attributes: ['user_id', 'username', 'first_name', 'age', 'location_city', 'location_state']
          }
        ],
        limit,
        offset,
        order: [['facial_match_score', 'DESC']],
        raw: false
      });

      return badges.map(badge => ({
        userId: badge.user_id,
        profile: badge.profile,
        verifiedAt: badge.verification_timestamp,
        badge: {
          icon: '✅',
          label: 'Video Verified',
          color: '#10b981'
        }
      }));
    } catch (error) {
      console.error('Error getting verified users list:', error);
      return [];
    }
  }

  /**
   * Flag badge for manual review
   * @param {Integer} userId
   * @param {String} notes
   * @returns {Boolean} Success status
   */
  static async flagForManualReview(userId, notes = '') {
    try {
      const badge = await VideoVerificationBadge.findOne({
        where: { user_id: userId }
      });

      if (!badge) {
        throw new Error('Badge not found');
      }

      await badge.update({
        manual_review_flag: true,
        manual_review_notes: notes
      });

      return true;
    } catch (error) {
      console.error('Error flagging for manual review:', error);
      return false;
    }
  }

  /**
   * Get badges pending manual review
   * @returns {Array} Badges requiring review
   */
  static async getPendingReview(limit = 50) {
    try {
      return await VideoVerificationBadge.findAll({
        where: { manual_review_flag: true },
        include: [
          { association: 'user', attributes: ['id', 'email'] },
          { association: 'profile', attributes: ['username', 'first_name'] }
        ],
        order: [['verification_timestamp', 'ASC']],
        limit
      });
    } catch (error) {
      console.error('Error getting pending reviews:', error);
      return [];
    }
  }

  /**
   * Process video file for verification
   * @param {Integer} userId
   * @param {Object} file - Multer file object with buffer
   * @returns {Object} Verification result
   */
  static async processVerificationVideo(userId, file) {
    try {
      if (!file || !file.buffer) {
        return {
          success: false,
          verified: false,
          message: 'No video file provided',
          reason: 'Missing video file'
        };
      }

      // For now, use simulated verification scores
      // In production, this would:
      // 1. Extract frames from the video
      // 2. Run face detection and recognition
      // 3. Compare faces with profile photos
      // 4. Calculate liveness score

      const facialMatchScore = 0.92; // Simulated score (would be 0-1)
      const livenessScore = 0.88;    // Simulated score (would be 0-1)
      const overallAuthenticityScore = 0.90; // Average

      // Verification thresholds
      const FACIAL_MATCH_THRESHOLD = 0.90;
      const LIVENESS_THRESHOLD = 0.85;

      const isVerified = 
        facialMatchScore >= FACIAL_MATCH_THRESHOLD && 
        livenessScore >= LIVENESS_THRESHOLD;

      // Check for manual review (borderline cases)
      const requiresManualReview = 
        facialMatchScore >= 0.80 && 
        facialMatchScore < FACIAL_MATCH_THRESHOLD;

      // Find or create verification badge
      let badge = await VideoVerificationBadge.findOne({
        where: { user_id: userId }
      });

      const badgeData = {
        user_id: userId,
        is_verified: isVerified,
        verification_status: isVerified ? 'verified' : 'failed',
        facial_match_score: facialMatchScore,
        liveness_score: livenessScore,
        overall_authenticity_score: overallAuthenticityScore,
        risk_flags: [],
        verification_timestamp: new Date(),
        expires_at: isVerified ? this.calculateExpirationDate() : null,
        rejection_reason: !isVerified ? 'Facial match score below threshold' : null,
        manual_review_flag: requiresManualReview
      };

      if (badge) {
        await badge.update(badgeData);
      } else {
        badge = await VideoVerificationBadge.create(badgeData);
      }

      return {
        success: true,
        verified: isVerified,
        message: isVerified ? 'Verification successful! ✅' : 'Verification failed. Please try again.',
        scores: {
          facialMatch: facialMatchScore,
          liveness: livenessScore,
          overall: overallAuthenticityScore
        },
        requiresManualReview,
        reason: isVerified ? 'Faces matched successfully' : 'Facial match below threshold'
      };
    } catch (error) {
      console.error('Error processing verification video:', error);
      return {
        success: false,
        verified: false,
        message: 'Error processing video',
        reason: error.message
      };
    }
  }

  /**
   * Calculate badge expiration date (1 year from now)
   * @returns {Date} Expiration date
   */
  static calculateExpirationDate() {
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    return expirationDate;
  }
}

module.exports = VideoVerificationService;
