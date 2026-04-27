/**
 * VideoFraudDetectionService
 * 
 * Performs authenticity checks on video intros:
 * - Facial recognition matching with profile photos
 * - Liveness detection (real person vs deepfake/replay)
 * - Frame consistency analysis
 * - Background/environment validation
 */

const axios = require('axios');

const AUTHENTICITY_THRESHOLD_FRAUD = 0.4;
const AUTHENTICITY_THRESHOLD_REVIEW = 0.65;

class VideoFraudDetectionService {
  /**
   * Run comprehensive fraud detection on video intro
   */
  static async analyzeVideoAuthenticity(videoUrl, profilePhotos, existingProfile = {}) {
    try {
      const results = {
        analysisType: 'comprehensive',
        overallAuthenticityScore: 0.5,
        facialMatchScore: null,
        frameConsistencyScore: null,
        livenessDetectionScore: null,
        backgroundAnalysisScore: null,
        riskFlags: [],
        status: 'completed',
        analysisMetadata: {
          framesAnalyzed: 0,
          model_version: '1.0',
          timestamp: new Date().toISOString()
        }
      };

      if (!videoUrl || !profilePhotos || profilePhotos.length === 0) {
        return {
          ...results,
          status: 'failed',
          overallAuthenticityScore: 0.0,
          analysisError: 'Invalid video URL or missing profile photos'
        };
      }

      // Run all analyses in parallel
      const [facialMatch, frameConsistency, livenessDetection, backgroundAnalysis] = 
        await Promise.allSettled([
          this.analyzeFacialMatch(videoUrl, profilePhotos),
          this.analyzeFrameConsistency(videoUrl),
          this.analyzeLivenessDetection(videoUrl),
          this.analyzeBackgroundConsistency(videoUrl)
        ]);

      // Extract results
      results.facialMatchScore = this._getSettledValue(facialMatch, 0.5);
      results.frameConsistencyScore = this._getSettledValue(frameConsistency, 0.5);
      results.livenessDetectionScore = this._getSettledValue(livenessDetection, 0.5);
      results.backgroundAnalysisScore = this._getSettledValue(backgroundAnalysis, 0.5);

      // Calculate overall score (weighted average)
      results.overallAuthenticityScore = (
        results.facialMatchScore * 0.35 +
        results.livenessDetectionScore * 0.35 +
        results.frameConsistencyScore * 0.20 +
        results.backgroundAnalysisScore * 0.10
      );

      // Determine risk flags
      results.riskFlags = this._determineRiskFlags(results);

      // Determine status based on authenticity score
      if (results.overallAuthenticityScore < AUTHENTICITY_THRESHOLD_FRAUD) {
        results.fraudFlagRecommended = 'likely_fraud';
      } else if (results.overallAuthenticityScore < AUTHENTICITY_THRESHOLD_REVIEW) {
        results.fraudFlagRecommended = 'needs_review';
      } else {
        results.fraudFlagRecommended = 'authentic';
      }

      return results;
    } catch (error) {
      console.error('Video authentication error:', error);
      return {
        analysisType: 'comprehensive',
        overallAuthenticityScore: 0.0,
        status: 'failed',
        analysisError: error.message || 'Analysis failed'
      };
    }
  }

  /**
   * Analyze if video face matches profile photos
   * In production, this would use AWS Rekognition, Azure Face API, or similar
   */
  static async analyzeFacialMatch(videoUrl, profilePhotos) {
    try {
      // Simulated facial recognition
      // In production, integrate with AWS Rekognition, Google Vision, or Azure Face API
      
      // For demo: use simple heuristics
      // - Check if faces are detected in video
      // - Compare with profile photos
      
      const videoFaceDetected = await this._detectFaceInVideo(videoUrl);
      
      if (!videoFaceDetected) {
        return 0.2; // No face detected = suspicious
      }

      // Simulate facial match scoring
      // Higher score = more similar to profile photos
      const matchScore = 0.5 + Math.random() * 0.45; // 0.5 - 0.95
      
      return Math.min(matchScore, 0.95);
    } catch (error) {
      console.error('Facial match analysis error:', error);
      throw error;
    }
  }

  /**
   * Analyze consistency of facial features throughout video
   * Detects if multiple different people appear or face changes dramatically
   */
  static async analyzeFrameConsistency(videoUrl) {
    try {
      // Sample frames from video at different timestamps
      // Check if same person appears throughout
      
      const consistencyScore = 0.6 + Math.random() * 0.35; // 0.6 - 0.95
      return consistencyScore;
    } catch (error) {
      console.error('Frame consistency analysis error:', error);
      throw error;
    }
  }

  /**
   * Detect liveness - is this a real person or deepfake/video replay?
   * Uses eye movement, micro-expressions, skin tone variation
   */
  static async analyzeLivenessDetection(videoUrl) {
    try {
      // In production: use specialized liveness detection API
      // - Check for eye movements and blinks
      // - Analyze micro-expressions
      // - Check for skin color variation
      // - Detect unnatural movements (deepfake signatures)
      
      const livenessScore = 0.65 + Math.random() * 0.30; // 0.65 - 0.95
      return Math.min(livenessScore, 0.95);
    } catch (error) {
      console.error('Liveness detection error:', error);
      throw error;
    }
  }

  /**
   * Analyze background consistency and environment
   * Detects if video appears authentic or heavily edited
   */
  static async analyzeBackgroundConsistency(videoUrl) {
    try {
      // Check for:
      // - Lighting consistency
      // - Background stability
      // - Video quality (signs of heavy compression/editing)
      
      const backgroundScore = 0.55 + Math.random() * 0.40; // 0.55 - 0.95
      return backgroundScore;
    } catch (error) {
      console.error('Background analysis error:', error);
      throw error;
    }
  }

  /**
   * Detect if face is present in video
   */
  static async _detectFaceInVideo(videoUrl) {
    try {
      // Simulated face detection
      // In production: use AWS Rekognition, Azure Face API, etc.
      return Math.random() > 0.1; // 90% have face
    } catch (error) {
      return false;
    }
  }

  /**
   * Determine risk flags based on analysis scores
   */
  static _determineRiskFlags(results) {
    const flags = [];

    if (results.facialMatchScore < 0.4) {
      flags.push('face_mismatch');
    }

    if (results.livenessDetectionScore < 0.5) {
      flags.push('deepfake_detected');
    }

    if (results.frameConsistencyScore < 0.4) {
      flags.push('multiple_faces_or_face_swap');
    }

    if (results.backgroundAnalysisScore < 0.4) {
      flags.push('suspicious_background_editing');
    }

    return flags;
  }

  /**
   * Get value from settled promise
   */
  static _getSettledValue(settledPromise, defaultValue = 0.5) {
    if (settledPromise.status === 'fulfilled') {
      return settledPromise.value;
    }
    console.error('Settled promise error:', settledPromise.reason);
    return defaultValue;
  }

  /**
   * Generate fraud flag based on analysis results
   */
  static generateFraudFlag(userId, analysisResults) {
    if (analysisResults.overallAuthenticityScore < AUTHENTICITY_THRESHOLD_FRAUD) {
      return {
        userId,
        flagType: 'fake_profile',
        description: `Video intro analysis detected fraud indicators. Authenticity score: ${analysisResults.overallAuthenticityScore.toFixed(2)}. Risk flags: ${analysisResults.riskFlags.join(', ')}`,
        confidenceScore: Math.min(1 - analysisResults.overallAuthenticityScore, 0.99)
      };
    }
    
    if (analysisResults.overallAuthenticityScore < AUTHENTICITY_THRESHOLD_REVIEW) {
      return {
        userId,
        flagType: 'other',
        description: `Video intro requires manual review. Authenticity score: ${analysisResults.overallAuthenticityScore.toFixed(2)}. Risk flags: ${analysisResults.riskFlags.join(', ')}`,
        confidenceScore: 0.5
      };
    }

    return null;
  }

  /**
   * Format results for API response
   */
  static formatAnalysisResponse(analysisResults, videoAuthResult = null) {
    return {
      overallScore: analysisResults.overallAuthenticityScore,
      isAuthentic: analysisResults.overallAuthenticityScore >= AUTHENTICITY_THRESHOLD_REVIEW,
      needsReview: analysisResults.overallAuthenticityScore >= AUTHENTICITY_THRESHOLD_FRAUD 
        && analysisResults.overallAuthenticityScore < AUTHENTICITY_THRESHOLD_REVIEW,
      isFraud: analysisResults.overallAuthenticityScore < AUTHENTICITY_THRESHOLD_FRAUD,
      scores: {
        facial: analysisResults.facialMatchScore,
        liveness: analysisResults.livenessDetectionScore,
        frameConsistency: analysisResults.frameConsistencyScore,
        background: analysisResults.backgroundAnalysisScore
      },
      riskFlags: analysisResults.riskFlags,
      status: analysisResults.status,
      message: this._generateMessage(analysisResults),
      resultId: videoAuthResult?.id || null
    };
  }

  /**
   * Generate user-facing message
   */
  static _generateMessage(analysisResults) {
    if (analysisResults.status === 'failed') {
      return 'Video analysis failed. Please try uploading again.';
    }

    if (analysisResults.overallAuthenticityScore >= AUTHENTICITY_THRESHOLD_REVIEW) {
      return '✅ Video verified! Your profile is looking authentic.';
    }

    if (analysisResults.overallAuthenticityScore >= AUTHENTICITY_THRESHOLD_FRAUD) {
      return '⚠️ Video needs review. Our team will check it within 24 hours.';
    }

    return '❌ Video failed authenticity check. Please upload a different video.';
  }
}

module.exports = VideoFraudDetectionService;
