/**
 * Video Profile Service
 * Handles video upload, verification, fraud detection, and liveness checks
 */

const fs = require('fs');
const path = require('path');

class VideoProfileService {
  constructor(dbModels, spamFraudService, config = {}) {
    this.db = dbModels;
    this.spamFraudService = spamFraudService;
    this.config = {
      minDuration: 15, // seconds
      maxDuration: 60, // seconds
      maxFileSize: 50 * 1024 * 1024, // 50MB
      allowedMimes: ['video/mp4', 'video/quicktime', 'video/webm'],
      fraudCheckThreshold: 0.7, // 70% confidence required
      deepfakeThreshold: 0.8, // 80% for deepfake detection
      ...config
    };
  }

  /**
   * Validate video file before processing
   */
  validateVideoFile(file) {
    const errors = [];

    if (!file) {
      errors.push('No video file provided');
    }

    if (file && !this.config.allowedMimes.includes(file.mimetype)) {
      errors.push(`Invalid video format. Allowed: ${this.config.allowedMimes.join(', ')}`);
    }

    if (file && file.size > this.config.maxFileSize) {
      errors.push(`Video too large. Max: ${this.config.maxFileSize / (1024 * 1024)}MB`);
    }

    return errors;
  }

  /**
   * Extract video metadata (duration, resolution, codec)
   * In production, use ffmpeg or similar library
   */
  async extractVideoMetadata(videoPath) {
    // Simulated metadata extraction
    // In production, use: ffmpeg, fluent-ffmpeg, or MediaInfo
    return {
      duration: 30, // Will be validated against video file
      resolution: '1920x1080',
      codec: 'h264',
      fps: 30,
      bitrate: 5000000, // 5mbps
      hasAudio: true
    };
  }

  /**
   * Validate video duration (15-60 seconds)
   */
  async validateVideoDuration(videoPath) {
    const metadata = await this.extractVideoMetadata(videoPath);

    if (metadata.duration < this.config.minDuration) {
      return {
        valid: false,
        error: `Video too short. Minimum: ${this.config.minDuration}s`
      };
    }

    if (metadata.duration > this.config.maxDuration) {
      return {
        valid: false,
        error: `Video too long. Maximum: ${this.config.maxDuration}s`
      };
    }

    return {
      valid: true,
      duration: metadata.duration,
      metadata
    };
  }

  /**
   * Extract frames from video for facial recognition
   * Returns array of frame data for comparison with profile photos
   */
  async extractKeyFrames(videoPath, frameCount = 5) {
    // In production, use ffmpeg to extract frames
    // This returns simulated frame data
    const frames = [];

    for (let i = 0; i < frameCount; i++) {
      const timestamp = (i + 1) * (30 / (frameCount + 1)); // Distribute across video
      frames.push({
        timestamp,
        frameData: `frame_${i}_placeholder`,
        faceDetected: true,
        faceConfidence: 0.95
      });
    }

    return frames;
  }

  /**
   * Compare video face with profile photos for authenticity
   * Returns fraud detection score
   */
  async compareFacesWithPhotos(userId, videoPath) {
    try {
      // Get user's profile photos
      const photos = await this.db.ProfilePhoto.findAll({
        where: { user_id: userId },
        limit: 5
      });

      if (!photos.length) {
        return {
          score: 0,
          status: 'no_photos',
          message: 'No profile photos found for comparison',
          matches: []
        };
      }

      // Extract frames from video
      const videoFrames = await this.extractKeyFrames(videoPath);

      // Compare each video frame against profile photos
      const matches = [];
      let totalConfidence = 0;

      for (const frame of videoFrames) {
        for (const photo of photos) {
          const comparison = await this._compareFaces(frame, photo);
          if (comparison.confidence > 0.6) {
            matches.push({
              photoId: photo.id,
              frameTimestamp: frame.timestamp,
              confidence: comparison.confidence,
              matchType: comparison.matchType // 'high', 'medium', 'low'
            });
            totalConfidence += comparison.confidence;
          }
        }
      }

      // Calculate overall authenticity score
      const avgConfidence = matches.length > 0 ? totalConfidence / matches.length : 0;
      const authScore = Math.min(100, avgConfidence * 100);

      // Determine risk level
      let riskLevel = 'low';
      let redFlags = [];

      if (authScore < 50) {
        riskLevel = 'high';
        redFlags.push('video_face_mismatch');
      } else if (authScore < 70) {
        riskLevel = 'medium';
        redFlags.push('video_face_inconsistent');
      }

      if (matches.length === 0) {
        redFlags.push('no_face_match');
        riskLevel = 'high';
      }

      return {
        score: authScore,
        status: 'complete',
        riskLevel,
        redFlags,
        matchCount: matches.length,
        matches
      };
    } catch (error) {
      console.error('Face comparison error:', error);
      return {
        score: 0,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Internal: Compare two faces using facial recognition
   * In production, use: face-api, Azure Computer Vision, AWS Rekognition, or similar
   */
  async _compareFaces(videoFrame, photoRecord) {
    // Simulated face comparison
    // In production, use ML model for facial recognition

    // Random confidence for demo (in production: actual comparison)
    const confidence = 0.75 + Math.random() * 0.2;

    return {
      confidence,
      matchType: confidence > 0.85 ? 'high' : confidence > 0.7 ? 'medium' : 'low'
    };
  }

  /**
   * Deepfake detection using ML model
   * Detects synthetic/manipulated video
   */
  async detectDeepfake(videoPath) {
    try {
      // In production, use: MesoNet, FaceForensics++, or similar
      // This is simulated detection

      const frames = await this.extractKeyFrames(videoPath, 10);
      let deepfakeIndicators = 0;
      let blinkingPatterns = [];
      let facialExpressionStability = [];

      for (let i = 0; i < frames.length; i++) {
        // Simulate deepfake detection markers
        const isArtefact = Math.random() > 0.85; // 15% chance of artefact
        if (isArtefact) deepfakeIndicators++;

        // Check blinking patterns (natural = 0.2-0.5 per second)
        const hasNaturalBlink = Math.random() > 0.3;
        blinkingPatterns.push(hasNaturalBlink);

        // Check facial expression continuity
        const expressionSmooth = Math.random() > 0.1;
        facialExpressionStability.push(expressionSmooth);
      }

      const deepfakeScore = Math.min(100, (deepfakeIndicators / frames.length) * 100);
      const blinkingScore = (blinkingPatterns.filter(b => b).length / blinkingPatterns.length) * 100;
      const expressionScore =
        (facialExpressionStability.filter(e => e).length / facialExpressionStability.length) * 100;

      const isDeepfake = deepfakeScore > 40;
      const isLive =
        blinkingScore > 50 && expressionScore > 70 && deepfakeScore < 40;

      return {
        isDeepfake,
        isLive,
        deepfakeScore,
        blinkingScore,
        expressionScore,
        redFlags: isDeepfake
          ? ['possible_deepfake', 'unnatural_artifacts']
          : isLive
            ? []
            : ['low_natural_characteristics']
      };
    } catch (error) {
      console.error('Deepfake detection error:', error);
      return {
        isDeepfake: false,
        isLive: false,
        error: error.message
      };
    }
  }

  /**
   * Perform liveness check - verify user is alive and not a photo/video replay
   * Premium feature only
   */
  async livenessCheck(videoPath, challenge) {
    // Challenge: User must perform action (blink, turn head, speak phrase)
    try {
      const frames = await this.extractKeyFrames(videoPath, 15);

      let challengeCompleted = false;
      let livenessScore = 0;

      // Check for challenge action
      switch (challenge.type) {
        case 'blink':
          // Detect blink pattern in frames
          challengeCompleted = this._detectBlink(frames);
          livenessScore = challengeCompleted ? 95 : 40;
          break;

        case 'turn_head':
          // Detect head movement
          challengeCompleted = this._detectHeadMovement(frames);
          livenessScore = challengeCompleted ? 90 : 35;
          break;

        case 'smile':
          // Detect smile expression
          challengeCompleted = this._detectSmile(frames);
          livenessScore = challengeCompleted ? 92 : 38;
          break;

        default:
          livenessScore = 50; // Neutral
      }

      return {
        isLive: livenessScore > 75,
        livenessScore,
        challengeCompleted,
        challenge: challenge.type,
        redFlags: livenessScore < 75 ? ['failed_liveness_check'] : []
      };
    } catch (error) {
      console.error('Liveness check error:', error);
      return {
        isLive: false,
        livenessScore: 0,
        error: error.message
      };
    }
  }

  /**
   * Internal: Detect if frames contain blinking
   */
  _detectBlink(frames) {
    // Simulated blink detection
    return frames.length > 5 && Math.random() > 0.3;
  }

  /**
   * Internal: Detect if frames contain head movement
   */
  _detectHeadMovement(frames) {
    // Simulated head movement detection
    return frames.length > 8 && Math.random() > 0.2;
  }

  /**
   * Internal: Detect if frames contain smile
   */
  _detectSmile(frames) {
    // Simulated smile detection
    return frames.length > 5 && Math.random() > 0.25;
  }

  /**
   * Upload and process video profile
   */
  async uploadVideoProfile(userId, videoUrl, durationSeconds) {
    try {
      // Validate duration
      if (durationSeconds < this.config.minDuration || durationSeconds > this.config.maxDuration) {
        return {
          success: false,
          error: `Duration must be between ${this.config.minDuration}-${this.config.maxDuration} seconds`
        };
      }

      // Update DatingProfile with video URL
      const profile = await this.db.DatingProfile.update(
        {
          videoIntroUrl: videoUrl,
          videoIntroDurationSeconds: durationSeconds,
          videoUploadedAt: new Date()
        },
        { where: { userId } }
      );

      // Start async fraud detection in background
      // In production, use job queue (Bull, RabbitMQ, etc.)
      this._performFraudDetection(userId, videoUrl).catch(err => {
        console.error('Background fraud detection error:', err);
      });

      return {
        success: true,
        message: 'Video uploaded successfully. Verification in progress...',
        profileId: userId
      };
    } catch (error) {
      console.error('Video upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Internal: Run fraud detection and update verification scores
   */
  async _performFraudDetection(userId, videoUrl) {
    try {
      // Run all fraud checks in parallel
      const [faceComparison, deepfakeResult] = await Promise.all([
        this.compareFacesWithPhotos(userId, videoUrl),
        this.detectDeepfake(videoUrl)
      ]);

      // Calculate video verification score
      let videoVerificationScore = 0;
      let redFlags = [];

      // Face matching component (60% weight)
      const faceScore = (faceComparison.score / 100) * 60;
      videoVerificationScore += faceScore;

      if (faceComparison.redFlags) {
        redFlags.push(...faceComparison.redFlags);
      }

      // Deepfake detection component (40% weight)
      const deepfakeScore = (deepfakeResult.isLive ? 100 : 20) * 0.4;
      videoVerificationScore += deepfakeScore;

      if (deepfakeResult.redFlags) {
        redFlags.push(...deepfakeResult.redFlags);
      }

      // Determine fraud risk level
      let fraudRiskLevel = 'low';
      if (videoVerificationScore < 50) {
        fraudRiskLevel = 'high';
      } else if (videoVerificationScore < 70) {
        fraudRiskLevel = 'medium';
      }

      // Update ProfileVerificationScore
      await this.db.ProfileVerificationScore.update(
        {
          video_authenticity_score: Math.round(videoVerificationScore),
          fraud_risk_level: fraudRiskLevel,
          red_flags: JSON.stringify(redFlags),
          ai_check_last_run: new Date(),
          overall_trust_score: this._calculateOverallTrustScore(userId, videoVerificationScore)
        },
        { where: { user_id: userId } }
      );

      return {
        videoVerificationScore: Math.round(videoVerificationScore),
        fraudRiskLevel,
        redFlags
      };
    } catch (error) {
      console.error('Fraud detection error:', error);
      return { error: error.message };
    }
  }

  /**
   * Calculate overall trust score combining all verification data
   */
  async _calculateOverallTrustScore(userId, videoScore) {
    try {
      const verification = await this.db.ProfileVerificationScore.findOne({
        where: { user_id: userId }
      });

      if (!verification) return videoScore;

      // Weighted average of all scores
      const photoScore = verification.photo_authenticity_score || 0;
      const bioScore = verification.bio_consistency_score || 0;
      const activityScore = verification.activity_pattern_score || 0;

      // Video gets 35% weight, other factors split 65%
      const overallScore =
        videoScore * 0.35 +
        photoScore * 0.25 +
        bioScore * 0.2 +
        activityScore * 0.2;

      return Math.round(overallScore);
    } catch (error) {
      console.error('Trust score calculation error:', error);
      return videoScore; // Fallback to video score
    }
  }

  /**
   * Get video verification status with badge info
   */
  async getVideoVerificationStatus(userId) {
    try {
      const verification = await this.db.ProfileVerificationScore.findOne({
        where: { user_id: userId }
      });

      if (!verification) {
        return {
          hasVideo: false,
          verified: false,
          badge: null
        };
      }

      const profile = await this.db.DatingProfile.findOne({
        where: { userId }
      });

      if (!profile || !profile.videoIntroUrl) {
        return {
          hasVideo: false,
          verified: false,
          badge: null
        };
      }

      const videoScore = verification.video_authenticity_score || 0;
      const fraudRiskLevel = verification.fraud_risk_level || 'low';

      // Badge: Verified if score >= 70 and no fraud risk
      const badge =
        videoScore >= 70 && fraudRiskLevel === 'low'
          ? {
              type: 'verified_video',
              label: 'Video Verified',
              color: 'green',
              tooltip: 'This profile has passed video authenticity verification'
            }
          : videoScore >= 50 && fraudRiskLevel === 'medium'
            ? {
                type: 'video_pending',
                label: 'Video Review',
                color: 'orange',
                tooltip: 'Video under review for authenticity'
              }
            : {
                type: 'video_unverified',
                label: 'Video Unverified',
                color: 'gray',
                tooltip: 'Video failed verification'
              };

      return {
        hasVideo: true,
        verified: videoScore >= 70 && fraudRiskLevel === 'low',
        score: videoScore,
        riskLevel: fraudRiskLevel,
        badge,
        duration: profile.videoIntroDurationSeconds,
        uploadedAt: profile.videoUploadedAt
      };
    } catch (error) {
      console.error('Get verification status error:', error);
      return {
        hasVideo: false,
        verified: false,
        error: error.message
      };
    }
  }

  /**
   * Delete video profile
   */
  async deleteVideoProfile(userId) {
    try {
      await this.db.DatingProfile.update(
        {
          videoIntroUrl: null,
          videoIntroDurationSeconds: null,
          videoUploadedAt: null
        },
        { where: { userId } }
      );

      // Reset video verification scores
      await this.db.ProfileVerificationScore.update(
        {
          video_authenticity_score: 0,
          red_flags: JSON.stringify([])
        },
        { where: { user_id: userId } }
      );

      return { success: true, message: 'Video deleted successfully' };
    } catch (error) {
      console.error('Delete video error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = VideoProfileService;
