/**
 * Content Moderation Service
 * Detects inappropriate content (text, images)
 * Supports multiple moderation methods: profanity, NSFW detection, spam
 */

const db = require('../config/database');
const axios = require('axios');

// Simple profanity filter word list
const PROFANITY_WORDS = [
  // Common English profanities (abbreviated to avoid offense)
  'f***', 's***', 'd***', 'b***', 'a**', 'c***',
  // Common Indian English slang
  'bc', 'mc', 'bh**', 'ch***',
  // Hate speech terms (common indicators)
  'ca***', 'n****', 's*ck', 'b***h',
  // Add more as needed
];

// Spam patterns
const SPAM_PATTERNS = [
  /(?:click|visit|go\s+to)\s+[\w\-\.]+\.\w{2,}/gi, // URLs
  /(?:win|earn|make)\s+(?:money|cash|₹|rupees?)\s+(?:fast|quick|now)/gi, // Money making spam
  /(?:buy|invest|cryptocurrency|bitcoin|nft|crypto)/gi, // Investment spam
  /(?:dm|message|contact)\s+(?:me|us|now)/gi, // DM spam
  /follow\s+(?:me|us)\s+on/gi, // Follow spam
  /(?:\d{10}|\d{3}-\d{3}-\d{4})/g, // Phone numbers (suspicious)
];

class ContentModerationService {
  constructor() {
    this.googleVisionEnabled = Boolean(process.env.GOOGLE_CLOUD_VISION_API_KEY);
    if (!this.googleVisionEnabled) {
      console.warn('⚠️ Google Cloud Vision API not configured. NSFW detection disabled.');
    }
  }

  /**
   * Scan text for inappropriate content
   */
  async scanText(text) {
    const issues = [];

    // Check for profanity
    const profanityCheck = this.checkProfanity(text);
    if (profanityCheck.found) {
      issues.push({
        type: 'profanity',
        severity: 'high',
        message: 'Text contains inappropriate language',
        words: profanityCheck.words
      });
    }

    // Check for spam
    const spamCheck = this.checkSpam(text);
    if (spamCheck.found) {
      issues.push({
        type: 'spam',
        severity: 'medium',
        message: 'Text contains spam patterns',
        patterns: spamCheck.patterns
      });
    }

    // Check for harassment patterns
    const harassmentCheck = this.checkHarassment(text);
    if (harassmentCheck.found) {
      issues.push({
        type: 'harassment',
        severity: 'high',
        message: 'Text contains harassment or threats'
      });
    }

    return {
      clean: issues.length === 0,
      issues,
      flags: issues.map(i => i.type),
      severity: this.calculateSeverity(issues)
    };
  }

  /**
   * Scan image for NSFW content
   */
  async scanImage(imageUrl) {
    const result = {
      clean: true,
      nsfw: false,
      confidence: 0,
      method: 'none',
      issues: []
    };

    if (!this.googleVisionEnabled) {
      return result;
    }

    try {
      const response = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_CLOUD_VISION_API_KEY}`,
        {
          requests: [
            {
              image: { source: { imageUri: imageUrl } },
              features: [
                { type: 'SAFE_SEARCH_DETECTION', maxResults: 1 }
              ]
            }
          ]
        }
      );

      if (response.data?.responses?.[0]?.safeSearchAnnotation) {
        const safeSearch = response.data.responses[0].safeSearchAnnotation;

        // Check for NSFW content
        const nsfwLikelihood = this.getLikelihoodScore(safeSearch.adult || 'UNKNOWN');
        if (nsfwLikelihood >= 0.6) {
          result.nsfw = true;
          result.clean = false;
          result.confidence = nsfwLikelihood;
          result.issues.push({
            type: 'nsfw',
            severity: 'high',
            message: 'Image contains adult content'
          });
        }

        // Check for violence
        const violenceLikelihood = this.getLikelihoodScore(safeSearch.violence || 'UNKNOWN');
        if (violenceLikelihood >= 0.6) {
          result.clean = false;
          result.issues.push({
            type: 'violence',
            severity: 'high',
            message: 'Image contains violent content'
          });
        }

        // Check for spoof (fake/edited images)
        const spoofLikelihood = this.getLikelihoodScore(safeSearch.spoof || 'UNKNOWN');
        if (spoofLikelihood >= 0.8) {
          result.issues.push({
            type: 'spoof',
            severity: 'medium',
            message: 'Image may be edited or fake'
          });
        }

        result.method = 'google_vision';
      }
    } catch (error) {
      console.error('Error scanning image with Google Vision:', error.message);
      // Continue without image scanning
    }

    return result;
  }

  /**
   * Scan user profile for issues
   */
  async scanProfile(profileData) {
    const issues = [];

    // Scan bio
    if (profileData.bio) {
      const bioScan = await this.scanText(profileData.bio);
      if (!bioScan.clean) {
        issues.push({
          field: 'bio',
          ...bioScan.issues[0]
        });
      }
    }

    // Scan username
    if (profileData.username) {
      const usernameScan = await this.scanText(profileData.username);
      if (!usernameScan.clean) {
        issues.push({
          field: 'username',
          type: 'inappropriate_username',
          severity: 'medium',
          message: 'Username contains inappropriate content'
        });
      }
    }

    // Scan photos for NSFW
    if (profileData.photos && Array.isArray(profileData.photos)) {
      for (let i = 0; i < profileData.photos.length; i++) {
        const photo = profileData.photos[i];
        const imageScan = await this.scanImage(photo.url);
        if (!imageScan.clean) {
          issues.push({
            field: `photo_${i + 1}`,
            ...imageScan.issues[0]
          });
        }
      }
    }

    return {
      clean: issues.length === 0,
      issues,
      flags: issues.map(i => i.type),
      severity: this.calculateSeverity(issues)
    };
  }

  /**
   * Flag content for manual review
   */
  async flagContent(userId, contentType, contentId, reason, evidence = {}) {
    try {
      const result = await db.query(
        `INSERT INTO moderation_flags (user_id, content_type, content_id, reason, evidence, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_TIMESTAMP)
         RETURNING id, created_at`,
        [userId, contentType, contentId, reason, JSON.stringify(evidence)]
      );

      return {
        success: true,
        flagId: result.rows[0].id,
        message: 'Content flagged for review'
      };
    } catch (error) {
      console.error('Error flagging content:', error);
      throw error;
    }
  }

  /**
   * Get flags for admin review
   */
  async getPendingFlags(limit = 50, offset = 0) {
    try {
      const result = await db.query(
        `SELECT id, user_id, content_type, content_id, reason, evidence, created_at
         FROM moderation_flags
         WHERE status = 'pending'
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting pending flags:', error);
      throw error;
    }
  }

  /**
   * Approve or reject flagged content
   */
  async resolveFlagStatus(flagId, action, reason = '') {
    if (!['approved', 'rejected'].includes(action)) {
      throw new Error('Invalid action. Use "approved" or "rejected"');
    }

    try {
      const result = await db.query(
        `UPDATE moderation_flags
         SET status = $1, resolution_reason = $2, resolved_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, user_id, content_type, status`,
        [action, reason, flagId]
      );

      if (result.rows.length === 0) {
        throw new Error('Flag not found');
      }

      const flag = result.rows[0];

      // If content approved, it stays. If rejected, it can be removed by admin
      if (action === 'rejected') {
        // Log for potential user suspension if repeat offender
        await this.logModeration(flag.user_id, 'content_removed', flag.content_type);
      }

      return {
        success: true,
        flag: flag,
        message: `Content ${action}`
      };
    } catch (error) {
      console.error('Error resolving flag:', error);
      throw error;
    }
  }

  /**
   * Log moderation action
   */
  async logModeration(userId, actionType, contentType, details = {}) {
    try {
      await db.query(
        `INSERT INTO moderation_logs (user_id, action_type, content_type, details, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [userId, actionType, contentType, JSON.stringify(details)]
      );
    } catch (error) {
      console.error('Error logging moderation:', error);
    }
  }

  /**
   * Check for profanity
   */
  checkProfanity(text) {
    const lowerText = text.toLowerCase();
    const found = [];

    for (const word of PROFANITY_WORDS) {
      if (lowerText.includes(word)) {
        found.push(word);
      }
    }

    return {
      found: found.length > 0,
      words: found
    };
  }

  /**
   * Check for spam patterns
   */
  checkSpam(text) {
    const patterns = [];

    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(text)) {
        patterns.push(pattern.source);
      }
    }

    return {
      found: patterns.length > 0,
      patterns
    };
  }

  /**
   * Check for harassment/threats
   */
  checkHarassment(text) {
    const harassmentPatterns = [
      /(?:i'll|i will|gonna|going to)\s+(?:kill|hurt|attack|rape|beat|punch)/gi,
      /(?:you're|you are)\s+(?:ugly|stupid|fat|worthless|deserve\s+to|should)\s+(?:die|kill)/gi,
      /(?:i know where you\s+live|i'll find you|i know your address)/gi,
      /(?:send me nudes|sexual favors|sex\s+tape)/gi,
    ];

    for (const pattern of harassmentPatterns) {
      if (pattern.test(text)) {
        return { found: true };
      }
    }

    return { found: false };
  }

  /**
   * Convert likelihood string to score (0-1)
   */
  getLikelihoodScore(likelihood) {
    const scores = {
      'UNKNOWN': 0.3,
      'VERY_UNLIKELY': 0.1,
      'UNLIKELY': 0.2,
      'POSSIBLE': 0.5,
      'LIKELY': 0.7,
      'VERY_LIKELY': 0.9
    };
    return scores[likelihood] || 0;
  }

  /**
   * Calculate overall severity
   */
  calculateSeverity(issues) {
    if (issues.length === 0) return 'none';
    const maxSeverity = Math.max(
      ...issues.map(i => {
        const severities = { low: 1, medium: 2, high: 3 };
        return severities[i.severity] || 1;
      })
    );
    return ['none', 'low', 'medium', 'high'][maxSeverity];
  }
}

module.exports = new ContentModerationService();
