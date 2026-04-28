const db = require('../config/database');

/**
 * Catfish Detection Service
 * Scans messages for red flags indicating potential scams, money requests, or catfishing
 */
const catfishDetectionService = {
  /**
   * Red flag keywords and patterns organized by category
   */
  redFlagPatterns: {
    money_request: {
      keywords: [
        'send me money',
        'send money',
        'need money',
        'can you send me',
        'could you lend me',
        'lend me money',
        'wire me',
        'transfer me',
        'urgent funds',
        'emergency funds',
        'money transfer',
        'quick cash',
        'financial help',
        'can i get some money',
        'send me funds'
      ],
      patterns: [
        /\$\d+(\.\d{2})?/i,
        /send.*\$\d+/i,
        /\$.*send/i
      ],
      riskLevel: 'high'
    },
    payment_apps: {
      keywords: [
        'venmo',
        'paypal',
        'zelle',
        'cashapp',
        'cash app',
        'square cash',
        'apple pay',
        'google pay',
        'wise',
        'stripe',
        'skrill',
        'payoneer',
        'alipay',
        'wechat pay',
        'my payment app',
        'send via app'
      ],
      patterns: [
        /venmo\s*me/i,
        /cashapp\s*me/i,
        /cash\s+app\s*me/i,
        /zelle.*send/i,
        /my\s+\w+\s+is/i
      ],
      riskLevel: 'high'
    },
    crypto: {
      keywords: [
        'bitcoin',
        'ethereum',
        'cryptocurrency',
        'crypto',
        'btc',
        'eth',
        'wallet address',
        'blockchain',
        'send me crypto',
        'mining',
        'nft',
        'coin',
        'dogecoin',
        'ripple',
        'litecoin',
        'altcoin'
      ],
      patterns: [
        /0x[a-fA-F0-9]{40}/i,
        /bitcoin.*address/i,
        /wallet.*address/i,
        /1[a-z0-9]{33}/i
      ],
      riskLevel: 'critical'
    },
    suspicious_links: {
      keywords: [
        'click here',
        'verify account',
        'confirm identity',
        'update payment',
        'confirm credentials',
        'verify you are',
        'click the link',
        'urgent',
        'act now',
        'limited time',
        'only today'
      ],
      patterns: [
        /https?:\/\/[^\s]+(click|verify|confirm|login|signin)/i,
        /bit\.ly\//i,
        /tinyurl/i,
        /short\.link/i,
        /url\s*shortener/i
      ],
      riskLevel: 'high'
    },
    identity_theft: {
      keywords: [
        'verify your account',
        'confirm your identity',
        'enter your password',
        'enter your pin',
        'credit card',
        'ssn',
        'social security',
        'bank account',
        'routing number',
        'account number',
        'cvv',
        'cvv2',
        'expiration date',
        'cardholder name'
      ],
      patterns: [
        /\d{3}-\d{2}-\d{4}/,
        /\d{16}/,
        /\d{3}/
      ],
      riskLevel: 'critical'
    }
  },

  /**
   * Scan a message for red flags
   * @param {string} message - The message to scan
   * @returns {Object} Detection result with flags, type, and risk level
   */
  scanMessage(message) {
    if (!message || typeof message !== 'string') {
      return {
        hasRedFlags: false,
        redFlags: [],
        flagType: null,
        riskLevel: 'low',
        confidenceScore: 0,
        metadata: {}
      };
    }

    const normalizedMessage = message.toLowerCase().trim();
    const detectedFlags = [];
    const matchedPatterns = [];
    let highestRiskLevel = 'low';
    let flagType = null;
    const riskLevels = { low: 0, medium: 1, high: 2, critical: 3 };

    // Check each category
    for (const [category, patterns] of Object.entries(this.redFlagPatterns)) {
      let categoryMatches = [];

      // Check keywords
      for (const keyword of patterns.keywords) {
        const keywordRegex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'gi');
        if (keywordRegex.test(normalizedMessage)) {
          categoryMatches.push(keyword);
          detectedFlags.push(keyword);
        }
      }

      // Check patterns
      for (const pattern of patterns.patterns) {
        const matches = normalizedMessage.match(pattern);
        if (matches) {
          matchedPatterns.push({
            pattern: pattern.toString(),
            matches: matches[0]
          });
          categoryMatches.push(`pattern: ${pattern.source.substring(0, 20)}...`);
          detectedFlags.push(`pattern: ${pattern.source.substring(0, 20)}...`);
        }
      }

      // If this category was matched, update flag type and risk level
      if (categoryMatches.length > 0) {
        if (!flagType) {
          flagType = category;
        }

        if (riskLevels[patterns.riskLevel] > riskLevels[highestRiskLevel]) {
          highestRiskLevel = patterns.riskLevel;
        }
      }
    }

    // Calculate confidence score based on number and type of matches
    let confidenceScore = 0;
    if (detectedFlags.length === 0) {
      confidenceScore = 0;
    } else if (detectedFlags.length === 1) {
      confidenceScore = 0.5;
    } else if (detectedFlags.length === 2) {
      confidenceScore = 0.7;
    } else {
      confidenceScore = Math.min(0.99, 0.7 + detectedFlags.length * 0.05);
    }

    // Boost confidence for critical matches
    if (highestRiskLevel === 'critical') {
      confidenceScore = Math.min(1, confidenceScore + 0.2);
    }

    return {
      hasRedFlags: detectedFlags.length > 0,
      redFlags: [...new Set(detectedFlags)], // Deduplicate
      flagType: flagType || 'other',
      riskLevel: highestRiskLevel,
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      metadata: {
        flagCount: detectedFlags.length,
        matchedPatterns: matchedPatterns.length,
        messageLength: message.length
      }
    };
  },

  /**
   * Create a detection flag in the database
   */
  async createFlag(data) {
    try {
      const CatfishDetectionFlag = db.sequelize.models.CatfishDetectionFlag;

      const flag = await CatfishDetectionFlag.create({
        messageId: data.messageId || null,
        chatroomMessageId: data.chatroomMessageId || null,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        messageText: data.messageText,
        redFlags: data.redFlags,
        flagType: data.flagType,
        riskLevel: data.riskLevel,
        aiConfidenceScore: data.confidenceScore,
        metadata: data.metadata
      });

      return flag;
    } catch (error) {
      console.error('Error creating catfish detection flag:', error);
      throw error;
    }
  },

  /**
   * Get flags for a user
   */
  async getFlagsForUser(userId, options = {}) {
    try {
      const CatfishDetectionFlag = db.sequelize.models.CatfishDetectionFlag;

      const flags = await CatfishDetectionFlag.findAll({
        where: {
          toUserId: userId,
          userDismissed: options.includeDismissed ? undefined : false,
          hasBeenReported: options.onlyReported ? true : undefined
        },
        order: [['createdAt', 'DESC']],
        limit: options.limit || 50,
        offset: options.offset || 0,
        include: [
          {
            model: db.sequelize.models.User,
            as: 'sender',
            attributes: ['id', 'username', 'first_name']
          }
        ]
      });

      return flags;
    } catch (error) {
      console.error('Error getting catfish detection flags:', error);
      throw error;
    }
  },

  /**
   * Get stats on flagged users (for blocking/warning purposes)
   */
  async getUserStats(userId) {
    try {
      const result = await db.query(
        `SELECT 
          COUNT(DISTINCT cdf.id) as total_flags,
          COUNT(CASE WHEN cdf.has_been_reported = true THEN 1 END) as reported_flags,
          COUNT(CASE WHEN cdf.risk_level = 'critical' THEN 1 END) as critical_flags,
          COUNT(CASE WHEN cdf.risk_level = 'high' THEN 1 END) as high_flags,
          COALESCE(AVG(cdf.ai_confidence_score), 0) as avg_confidence,
          ARRAY_AGG(DISTINCT cdf.flag_type) as flag_types
        FROM catfish_detection_flags cdf
        WHERE cdf.from_user_id = $1
        AND cdf.created_at > NOW() - INTERVAL '30 days'`,
        [userId]
      );

      return result.rows[0] || {
        total_flags: 0,
        reported_flags: 0,
        critical_flags: 0,
        high_flags: 0,
        avg_confidence: 0,
        flag_types: []
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  },

  /**
   * Dismiss a flag
   */
  async dismissFlag(flagId, userId) {
    try {
      const CatfishDetectionFlag = db.sequelize.models.CatfishDetectionFlag;

      const flag = await CatfishDetectionFlag.findOne({
        where: { id: flagId, toUserId: userId }
      });

      if (!flag) {
        throw new Error('Flag not found or unauthorized');
      }

      await flag.update({
        userDismissed: true,
        dismissedAt: new Date()
      });

      return flag;
    } catch (error) {
      console.error('Error dismissing flag:', error);
      throw error;
    }
  },

  /**
   * Report a flagged message
   */
  async reportFlag(flagId, userId, reportReason) {
    try {
      const CatfishDetectionFlag = db.sequelize.models.CatfishDetectionFlag;

      const flag = await CatfishDetectionFlag.findOne({
        where: { id: flagId, toUserId: userId }
      });

      if (!flag) {
        throw new Error('Flag not found or unauthorized');
      }

      await flag.update({
        hasBeenReported: true,
        reportedBy: userId,
        reportReason: reportReason,
        reportedAt: new Date()
      });

      // Create a conversation safety flag for admin review
      const ConversationSafetyFlag = db.sequelize.models.ConversationSafetyFlag;

      // Try to find the match for this conversation
      if (flag.messageId) {
        const message = await db.sequelize.models.Message.findOne({
          where: { id: flag.messageId }
        });

        if (message) {
          await ConversationSafetyFlag.create({
            match_id: message.match_id,
            reporter_id: userId,
            reported_user_id: flag.fromUserId,
            reason: 'catfishing',
            description: `Catfish detection AI flagged message with red flags: ${flag.redFlags.join(', ')}. Type: ${flag.flagType}. Risk level: ${flag.riskLevel}`,
            message_ids: [flag.messageId],
            severity: flag.riskLevel === 'critical' ? 'high' : 'medium',
            is_blocking_recommended: flag.riskLevel === 'critical'
          });
        }
      }

      return flag;
    } catch (error) {
      console.error('Error reporting flag:', error);
      throw error;
    }
  },

  /**
   * Get suspicious users (multiple flags)
   */
  async getSuspiciousUsers(options = {}) {
    try {
      const limit = options.limit || 10;
      const daysBack = options.daysBack || 30;

      const result = await db.query(
        `SELECT 
          cdf.from_user_id,
          COUNT(DISTINCT cdf.id) as total_flags,
          COUNT(CASE WHEN cdf.has_been_reported = true THEN 1 END) as reported_flags,
          COUNT(CASE WHEN cdf.risk_level = 'critical' THEN 1 END) as critical_flags,
          COALESCE(AVG(cdf.ai_confidence_score), 0) as avg_confidence,
          MAX(cdf.created_at) as latest_flag_at,
          ARRAY_AGG(DISTINCT cdf.flag_type ORDER BY cdf.flag_type) as flag_types
        FROM catfish_detection_flags cdf
        WHERE cdf.created_at > NOW() - INTERVAL '${daysBack} days'
        GROUP BY cdf.from_user_id
        HAVING COUNT(DISTINCT cdf.id) >= 3
        ORDER BY reported_flags DESC, total_flags DESC
        LIMIT $1`,
        [limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting suspicious users:', error);
      throw error;
    }
  }
};

module.exports = catfishDetectionService;
