const db = require('../config/database');
const { createModerationFlag } = require('../utils/moderation');

/**
 * Spam and Fraud Detection Service
 * Monitors user behavior for suspicious patterns
 */

const SUSPICIOUS_MESSAGE_KEYWORDS = [
  'whatsapp',
  'telegram',
  'bitcoin',
  'crypto',
  'investment',
  'cashapp',
  'gift card',
  'sugar daddy',
  'onlyfans',
  'escort'
];
const MESSAGE_URL_PATTERN = /(https?:\/\/|www\.)/gi;
const REPEATED_CHARACTER_PATTERN = /(.)\1{7,}/;
const IMAGE_DATA_URL_PATTERN = /^data:image\/([a-zA-Z0-9.+-]+);base64,/;
const PHOTO_REVIEW_THRESHOLD = 45;
const toCount = (value) => Number.parseInt(value, 10) || 0;
const getMetricDate = () => new Date().toISOString().split('T')[0];
const getClientIpAddress = (value = '') =>
  String(value || '')
    .split(',')[0]
    .trim()
    .slice(0, 45) || null;

const spamFraudService = {
  /**
   * Check user for spam behavior
   */
  checkForSpam: async (userId) => {
    try {
      // Check for rapid messaging (sending >50 messages in 1 hour)
      const recentMessages = await db.query(
        `SELECT COUNT(*) as count FROM messages 
         WHERE from_user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [userId]
      );

      if (parseInt(recentMessages.rows[0].count) > 50) {
        await spamFraudService.flagAsSpam(
          userId,
          'rapid_messaging',
          'User sent >50 messages in 1 hour',
          'medium'
        );
        return { isSpam: true, reason: 'rapid_messaging' };
      }

      // Check for repeated profile views (>100 profiles in 5 minutes)
      const rapidViews = await db.query(
        `SELECT COUNT(*) as count FROM user_session_logs 
         WHERE user_id = $1 AND action = 'profile_view' 
         AND created_at > NOW() - INTERVAL '5 minutes'`,
        [userId]
      );

      if (parseInt(rapidViews.rows[0].count) > 100) {
        await spamFraudService.flagAsSpam(
          userId,
          'rapid_profile_browsing',
          'User viewed >100 profiles in 5 minutes',
          'medium'
        );
        return { isSpam: true, reason: 'rapid_profile_browsing' };
      }

      // Check for repeated likes (>100 likes in 10 minutes)
      const rapidLikes = await db.query(
        `SELECT COUNT(*) as count FROM interactions 
         WHERE from_user_id = $1 AND interaction_type = 'like'
         AND created_at > NOW() - INTERVAL '10 minutes'`,
        [userId]
      );

      if (parseInt(rapidLikes.rows[0].count) > 100) {
        await spamFraudService.flagAsSpam(
          userId,
          'rapid_liking',
          'User sent >100 likes in 10 minutes',
          'medium'
        );
        return { isSpam: true, reason: 'rapid_liking' };
      }

      // Check for many new accounts messaging same user
      const newAccountsMessageCount = await db.query(
        `SELECT COUNT(DISTINCT m.from_user_id) as count
         FROM messages m
         LEFT JOIN users u ON m.from_user_id = u.id
         WHERE m.to_user_id = $1 
         AND u.created_at > NOW() - INTERVAL '7 days'
         AND m.created_at > NOW() - INTERVAL '24 hours'`,
        [userId]
      );

      if (parseInt(newAccountsMessageCount.rows[0].count) > 10) {
        await spamFraudService.flagAsSpam(
          userId,
          'new_account_targeting',
          'New accounts are messaging this user frequently',
          'low'
        );
      }

      return { isSpam: false };
    } catch (err) {
      console.error('Spam check error:', err);
      return { isSpam: false, error: err.message };
    }
  },

  /**
   * Check user for fraud behavior
   */
  checkForFraud: async (userId) => {
    try {
      const user = await db.query(
        `SELECT u.*, dp.* FROM users u
         LEFT JOIN dating_profiles dp ON dp.user_id = u.id
         WHERE u.id = $1`,
        [userId]
      );

      if (user.rows.length === 0) {
        return { isFraud: false };
      }

      const userData = user.rows[0];
      let fraudScore = 0;
      const fraudReasons = [];

      // Check 1: Very new account (< 1 hour old) with immediate activity
      const accountAge = new Date() - new Date(userData.created_at);
      const hasActivity = await db.query(
        `SELECT COUNT(*) as count FROM user_session_logs 
         WHERE user_id = $1 AND created_at > $2`,
        [userId, userData.created_at]
      );

      if (accountAge < 3600000 && parseInt(hasActivity.rows[0].count) > 20) {
        fraudScore += 25;
        fraudReasons.push('new_account_high_activity');
      }

      // Check 2: Account with no profile photo
      const photoCount = await db.query(
        `SELECT COUNT(*) as count FROM profile_photos WHERE user_id = $1`,
        [userId]
      );

      if (parseInt(photoCount.rows[0].count) === 0 && accountAge > 86400000) {
        fraudScore += 20;
        fraudReasons.push('no_profile_photos');
      }

      // Check 3: Unusually old or young age
      if (userData.age && (userData.age < 18 || userData.age > 120)) {
        fraudScore += 30;
        fraudReasons.push('invalid_age');
      }

      // Check 4: Multiple accounts from same IP
      const sessionData = await db.query(
        `SELECT ip_address FROM user_session_logs 
         WHERE user_id = $1 LIMIT 1`,
        [userId]
      );

      if (sessionData.rows.length > 0) {
        const ipAddress = sessionData.rows[0].ip_address;
        const ipCount = await db.query(
          `SELECT COUNT(DISTINCT user_id) as count FROM user_session_logs
           WHERE ip_address = $1`,
          [ipAddress]
        );

        if (parseInt(ipCount.rows[0].count) > 5) {
          fraudScore += 20;
          fraudReasons.push('multiple_accounts_same_ip');
        }
      }

      // Check 5: Rapid account creation and profile completion
      if (userData.profile_completion_percent === 100 && accountAge < 600000) {
        fraudScore += 15;
        fraudReasons.push('rapid_completion');
      }

      // Check 6: Many reports against this user
      const reportCount = await db.query(
        `SELECT COUNT(*) as count FROM user_reports 
         WHERE reported_user_id = $1 AND status = 'pending'`,
        [userId]
      );

      if (parseInt(reportCount.rows[0].count) > 3) {
        fraudScore += 25;
        fraudReasons.push('multiple_reports');
      }

      // Flag if fraud score is high enough
      if (fraudScore >= 50) {
        await spamFraudService.flagAsFraud(
          userId,
          'behavioral_pattern',
          fraudReasons.join(', '),
          Math.min(fraudScore / 100, 0.99)
        );
        return { isFraud: true, score: fraudScore, reasons: fraudReasons };
      }

      return { isFraud: false, score: fraudScore };
    } catch (err) {
      console.error('Fraud check error:', err);
      return { isFraud: false, error: err.message };
    }
  },

  /**
   * Filter and score an outgoing message for spam
   */
  evaluateMessageForSpam: async (userId, messageText) => {
    try {
      const normalizedMessage = String(messageText || '').trim();

      if (!normalizedMessage) {
        return { blocked: false, flagged: false, score: 0, reasons: [] };
      }

      const loweredMessage = normalizedMessage.toLowerCase();
      const detectedLinks = normalizedMessage.match(MESSAGE_URL_PATTERN) || [];
      const keywordHits = SUSPICIOUS_MESSAGE_KEYWORDS.filter((keyword) =>
        loweredMessage.includes(keyword)
      );
      const duplicateMessages = await db.query(
        `SELECT COUNT(*) as count
         FROM messages
         WHERE from_user_id = $1
           AND LOWER(message) = LOWER($2)
           AND created_at > NOW() - INTERVAL '30 minutes'`,
        [userId, normalizedMessage]
      );

      let spamScore = 0;
      const reasons = [];

      if (detectedLinks.length >= 2) {
        spamScore += 45;
        reasons.push('multiple_links');
      } else if (detectedLinks.length === 1) {
        spamScore += 20;
        reasons.push('contains_link');
      }

      if (keywordHits.length >= 2) {
        spamScore += 35;
        reasons.push('high_risk_keywords');
      } else if (keywordHits.length === 1) {
        spamScore += 15;
        reasons.push('suspicious_keyword');
      }

      if (REPEATED_CHARACTER_PATTERN.test(normalizedMessage)) {
        spamScore += 15;
        reasons.push('repeated_characters');
      }

      const duplicateCount = toCount(duplicateMessages.rows[0]?.count);
      if (duplicateCount >= 3) {
        spamScore += 45;
        reasons.push('duplicate_message_burst');
      } else if (duplicateCount >= 1) {
        spamScore += 20;
        reasons.push('duplicate_message');
      }

      if (normalizedMessage.length > 500) {
        spamScore += 10;
        reasons.push('very_long_message');
      }

      if (spamScore >= 70) {
        await spamFraudService.flagAsSpam(
          userId,
          'message_spam_blocked',
          `Blocked outgoing message. Reasons: ${reasons.join(', ') || 'unspecified'}`,
          'high'
        );

        return {
          blocked: true,
          flagged: true,
          score: spamScore,
          reasons,
          message: 'Message blocked by the spam filter'
        };
      }

      if (spamScore >= 40) {
        await spamFraudService.flagAsSpam(
          userId,
          'message_spam_suspected',
          `Suspicious outgoing message. Reasons: ${reasons.join(', ') || 'unspecified'}`,
          'medium'
        );
      }

      return {
        blocked: false,
        flagged: spamScore >= 40,
        score: spamScore,
        reasons
      };
    } catch (err) {
      console.error('Message spam evaluation error:', err);
      return { blocked: false, flagged: false, score: 0, reasons: [], error: err.message };
    }
  },

  /**
   * Run lightweight heuristics and queue a photo for moderation review.
   * This does not attempt computer vision; it creates a review workflow with
   * an automated risk score so admins can prioritize high-risk items.
   */
  queuePhotoForModeration: async ({
    userId,
    photoUrl,
    profilePhotoId = null,
    sourceType = 'profile_photo'
  }) => {
    try {
      const normalizedPhotoUrl = String(photoUrl || '').trim();

      if (!userId || !normalizedPhotoUrl) {
        return null;
      }

      const automatedLabels = {};
      const automatedReasons = [];
      let automatedRiskScore = 10;

      const dataUrlMatch = normalizedPhotoUrl.match(IMAGE_DATA_URL_PATTERN);
      if (dataUrlMatch) {
        automatedLabels.mimeType = dataUrlMatch[1].toLowerCase();
        automatedLabels.transport = 'inline';

        const base64Payload = normalizedPhotoUrl.split(',')[1] || '';
        const approximateBytes = Math.ceil((base64Payload.length * 3) / 4);
        automatedLabels.approximateBytes = approximateBytes;

        if (approximateBytes > 6 * 1024 * 1024) {
          automatedRiskScore += 20;
          automatedReasons.push('very_large_inline_image');
        }

        if (automatedLabels.mimeType === 'gif') {
          automatedRiskScore += 10;
          automatedReasons.push('animated_image_requires_review');
        }
      } else if (!/^https?:\/\//i.test(normalizedPhotoUrl)) {
        automatedRiskScore += 20;
        automatedReasons.push('non_standard_image_source');
      }

      if (sourceType === 'verification_photo') {
        automatedRiskScore += 45;
        automatedLabels.reviewType = 'identity_verification';
        automatedReasons.push('verification_photo_requires_manual_review');
      }

      if (profilePhotoId) {
        const duplicatePhotoCount = await db.query(
          `SELECT COUNT(*) as count
           FROM profile_photos
           WHERE user_id = $1
             AND photo_url = $2`,
          [userId, normalizedPhotoUrl]
        );

        if (toCount(duplicatePhotoCount.rows[0]?.count) > 1) {
          automatedRiskScore += 15;
          automatedReasons.push('duplicate_photo_submission');
        }
      }

      const queueStatus =
        sourceType === 'verification_photo' || automatedRiskScore >= PHOTO_REVIEW_THRESHOLD
          ? 'pending'
          : 'approved';

      const result = await db.query(
        `INSERT INTO photo_moderation_queue (
           user_id,
           profile_photo_id,
           photo_url,
           source_type,
           status,
           automated_labels,
           automated_risk_score,
           automated_reasons
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          userId,
          profilePhotoId,
          normalizedPhotoUrl,
          sourceType,
          queueStatus,
          JSON.stringify(automatedLabels),
          automatedRiskScore,
          automatedReasons
        ]
      );

      const queueItem = result.rows[0] || null;

      if (queueItem && queueStatus === 'pending') {
        await createModerationFlag({
          userId,
          sourceType: 'photo_moderation',
          flagCategory: 'content',
          severity:
            automatedRiskScore >= 70 ? 'critical' : automatedRiskScore >= 55 ? 'high' : 'medium',
          title: sourceType === 'verification_photo' ? 'Verification photo review' : 'Profile photo review',
          reason:
            automatedReasons.join(', ') ||
            (sourceType === 'verification_photo'
              ? 'Verification photo awaiting moderation review'
              : 'Profile photo triggered moderation review'),
          metadata: {
            moderationQueueId: queueItem.id,
            profilePhotoId,
            sourceType,
            automatedRiskScore,
            automatedLabels,
            automatedReasons
          }
        });
      }

      return queueItem;
    } catch (err) {
      console.error('Queue photo moderation error:', err);
      return null;
    }
  },

  /**
   * Flag user as spam
   */
  flagAsSpam: async (userId, reason, description, severity = 'low') => {
    try {
      // Check if already flagged
      const existing = await db.query(
        `SELECT id FROM spam_flags 
         WHERE user_id = $1 AND reason = $2 AND is_resolved = FALSE`,
        [userId, reason]
      );

      if (existing.rows.length > 0) {
        return; // Already flagged
      }

      await db.query(
        `INSERT INTO spam_flags (user_id, reason, severity, description)
         VALUES ($1, $2, $3, $4)`,
        [userId, reason, severity, description]
      );

      console.log(`Spam flag added for user ${userId}: ${reason}`);
    } catch (err) {
      console.error('Flag spam error:', err);
    }
  },

  /**
   * Flag user as fraudulent
   */
  flagAsFraud: async (userId, flagType, description, confidenceScore = 0.5) => {
    try {
      // Check if already flagged with similar type
      const existing = await db.query(
        `SELECT id FROM fraud_flags 
         WHERE user_id = $1 AND flag_type = $2 AND is_resolved = FALSE`,
        [userId, flagType]
      );

      if (existing.rows.length > 0) {
        return; // Already flagged
      }

      await db.query(
        `INSERT INTO fraud_flags (user_id, flag_type, description, confidence_score)
         VALUES ($1, $2, $3, $4)`,
        [userId, flagType, description, confidenceScore]
      );

      console.log(`Fraud flag added for user ${userId}: ${flagType} (score: ${confidenceScore})`);
    } catch (err) {
      console.error('Flag fraud error:', err);
    }
  },

  /**
   * Log user session activity
   */
  logSessionActivity: async (userId, action, ipAddress, userAgent) => {
    try {
      const sessionId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      await db.query(
        `INSERT INTO user_session_logs (user_id, session_id, ip_address, user_agent, action)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, sessionId, getClientIpAddress(ipAddress), userAgent || null, action]
      );

      return sessionId;
    } catch (err) {
      console.error('Log session error:', err);
    }
  },

  /**
   * Update user analytics
   */
  updateUserAnalytics: async (userId, updates) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Check if record exists for today
      const existing = await db.query(
        `SELECT id FROM user_analytics WHERE user_id = $1 AND activity_date = $2`,
        [userId, today]
      );

      if (existing.rows.length > 0) {
        // Update existing record
        let updateQuery = `UPDATE user_analytics SET last_active = CURRENT_TIMESTAMP`;
        const params = [userId, today];
        let paramIndex = 3;

        Object.keys(updates).forEach(key => {
          if (key !== 'id' && key !== 'user_id' && key !== 'activity_date' && key !== 'created_at' && key !== 'last_active') {
            updateQuery += `, ${key} = ${key} + $${paramIndex}`;
            params.push(updates[key]);
            paramIndex++;
          }
        });

        updateQuery += ` WHERE user_id = $1 AND activity_date = $2`;

        await db.query(updateQuery, params);
      } else {
        // Insert new record
        const keys = ['user_id', 'activity_date', 'last_active', ...Object.keys(updates)];
        const values = [userId, today, new Date(), ...Object.values(updates)];
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

        await db.query(
          `INSERT INTO user_analytics (${keys.join(', ')}) VALUES (${placeholders})`,
          values
        );
      }
    } catch (err) {
      console.error('Update analytics error:', err);
    }
  },

  /**
   * Track a user action in analytics/session logs and refresh platform metrics
   */
  trackUserActivity: async ({
    userId,
    action,
    analyticsUpdates = {},
    ipAddress = null,
    userAgent = null,
    runSpamCheck = false,
    runFraudCheck = false
  }) => {
    try {
      if (!userId) {
        return;
      }

      await Promise.all([
        spamFraudService.logSessionActivity(userId, action, ipAddress, userAgent),
        spamFraudService.updateUserAnalytics(userId, analyticsUpdates)
      ]);

      if (runSpamCheck) {
        await spamFraudService.checkForSpam(userId);
      }

      if (runFraudCheck) {
        await spamFraudService.checkForFraud(userId);
      }

      await spamFraudService.refreshSystemMetrics();
    } catch (err) {
      console.error('Track user activity error:', err);
    }
  },

  /**
   * Refresh aggregate system metrics for the admin dashboard
   */
  refreshSystemMetrics: async (metricDate = getMetricDate()) => {
    try {
      const [
        dailyActiveUsersResult,
        monthlyActiveUsersResult,
        totalMessagesResult,
        totalMatchesResult,
        newUsersResult,
        reportsResult,
        spamFlagsResult,
        fraudFlagsResult,
        pendingPhotoReviewsResult,
        pendingAppealsResult,
        activeBansResult
      ] = await Promise.all([
        db.query(
          `SELECT COUNT(DISTINCT user_id) as count
           FROM user_analytics
           WHERE activity_date = $1`,
          [metricDate]
        ),
        db.query(
          `SELECT COUNT(DISTINCT user_id) as count
           FROM user_analytics
           WHERE activity_date >= $1::date - INTERVAL '29 days'`,
          [metricDate]
        ),
        db.query(
          `SELECT COUNT(*) as count
           FROM messages
           WHERE created_at::date = $1`,
          [metricDate]
        ),
        db.query(
          `SELECT COUNT(*) as count
           FROM matches
           WHERE matched_at::date = $1`,
          [metricDate]
        ),
        db.query(
          `SELECT COUNT(*) as count
           FROM users
           WHERE created_at::date = $1`,
          [metricDate]
        ),
        db.query(
          `SELECT COUNT(*) as count
           FROM user_reports
           WHERE created_at::date = $1`,
          [metricDate]
        ),
        db.query(
          `SELECT COUNT(*) as count
           FROM spam_flags
           WHERE created_at::date = $1`,
          [metricDate]
        ),
        db.query(
          `SELECT COUNT(*) as count
           FROM fraud_flags
           WHERE created_at::date = $1`,
          [metricDate]
        ),
        db.query(
          `SELECT COUNT(*) as count
           FROM photo_moderation_queue
           WHERE status = 'pending'`,
          []
        ),
        db.query(
          `SELECT COUNT(*) as count
           FROM moderation_appeals
           WHERE status = 'pending'`,
          []
        ),
        db.query(
          `SELECT COUNT(*) as count
           FROM user_bans
           WHERE status = 'active'
             AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
          []
        )
      ]);

      await db.query(
        `INSERT INTO system_metrics (
           metric_date,
           daily_active_users,
           monthly_active_users,
           total_messages,
           total_matches,
           new_users,
           reported_users,
           spam_flagged_users,
           fraud_flagged_users,
           pending_photo_reviews,
           pending_appeals,
           active_bans
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (metric_date)
         DO UPDATE SET
           daily_active_users = EXCLUDED.daily_active_users,
           monthly_active_users = EXCLUDED.monthly_active_users,
           total_messages = EXCLUDED.total_messages,
           total_matches = EXCLUDED.total_matches,
           new_users = EXCLUDED.new_users,
           reported_users = EXCLUDED.reported_users,
           spam_flagged_users = EXCLUDED.spam_flagged_users,
           fraud_flagged_users = EXCLUDED.fraud_flagged_users,
           pending_photo_reviews = EXCLUDED.pending_photo_reviews,
           pending_appeals = EXCLUDED.pending_appeals,
           active_bans = EXCLUDED.active_bans`,
        [
          metricDate,
          toCount(dailyActiveUsersResult.rows[0]?.count),
          toCount(monthlyActiveUsersResult.rows[0]?.count),
          toCount(totalMessagesResult.rows[0]?.count),
          toCount(totalMatchesResult.rows[0]?.count),
          toCount(newUsersResult.rows[0]?.count),
          toCount(reportsResult.rows[0]?.count),
          toCount(spamFlagsResult.rows[0]?.count),
          toCount(fraudFlagsResult.rows[0]?.count),
          toCount(pendingPhotoReviewsResult.rows[0]?.count),
          toCount(pendingAppealsResult.rows[0]?.count),
          toCount(activeBansResult.rows[0]?.count)
        ]
      );
    } catch (err) {
      console.error('Refresh system metrics error:', err);
    }
  }
};

module.exports = spamFraudService;
