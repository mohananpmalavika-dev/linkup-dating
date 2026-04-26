const db = require('../config/database');

/**
 * Spam and Fraud Detection Service
 * Monitors user behavior for suspicious patterns
 */

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
        [userId, sessionId, ipAddress, userAgent, action]
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
  }
};

module.exports = spamFraudService;
