/**
 * Achievement Service
 * Handles achievement/badge calculations and unlocking
 * Checks: messaging, verification, video calls, profile quality, responsiveness, engagement
 */

const db = require('../config/database');

class AchievementService {
  // Define all badge requirements
  static BADGE_DEFINITIONS = {
    CONVERSATION_MASTER: {
      code: 'CONVERSATION_MASTER',
      name: 'Conversation Master',
      emoji: '🎯',
      category: 'messaging',
      tier: 'gold',
      requirementType: 'message_count',
      requirementValue: 50,
      rarity: 'rare',
      points: 100,
      description: '50+ message exchanges with matches'
    },
    PHOTO_VERIFIED: {
      code: 'PHOTO_VERIFIED',
      name: 'Photo Verified',
      emoji: '📸',
      category: 'verification',
      tier: 'silver',
      requirementType: 'verification',
      requirementValue: null,
      rarity: 'uncommon',
      points: 50,
      description: 'Complete ID verification'
    },
    VIDEO_CONFIDENT: {
      code: 'VIDEO_CONFIDENT',
      name: 'Video Confident',
      emoji: '🎬',
      category: 'video',
      tier: 'silver',
      requirementType: 'video_calls',
      requirementValue: 5,
      rarity: 'uncommon',
      points: 75,
      description: '5+ video calls scheduled'
    },
    HOT_PROFILE: {
      code: 'HOT_PROFILE',
      name: 'Hot Profile',
      emoji: '🔥',
      category: 'profile_quality',
      tier: 'platinum',
      requirementType: 'profile_likes',
      requirementValue: null, // Top 10% - calculated dynamically
      rarity: 'epic',
      points: 200,
      description: 'Top 10% liked profiles'
    },
    COMMUNICATOR: {
      code: 'COMMUNICATOR',
      name: 'Communicator',
      emoji: '💬',
      category: 'responsiveness',
      tier: 'silver',
      requirementType: 'response_time',
      requirementValue: 3600, // 1 hour in seconds
      rarity: 'uncommon',
      points: 60,
      description: 'Reply within 1 hour average'
    },
    REACTION_ENTHUSIAST: {
      code: 'REACTION_ENTHUSIAST',
      name: 'Reaction Enthusiast',
      emoji: '😊',
      category: 'engagement',
      tier: 'bronze',
      requirementType: 'reaction_count',
      requirementValue: 100,
      rarity: 'common',
      points: 40,
      description: '100+ message reactions given'
    },
    STREAK_MASTER: {
      code: 'STREAK_MASTER',
      name: 'Streak Master',
      emoji: '❤️',
      category: 'engagement',
      tier: 'gold',
      requirementType: 'streak_days',
      requirementValue: 30,
      rarity: 'epic',
      points: 150,
      description: '30+ day messaging streak'
    }
  };

  /**
   * Check and unlock achievements for a user
   */
  static async checkAndUnlockAchievements(userId) {
    try {
      const unlockedAchievements = [];

      // Check Conversation Master
      const conversationMasterCheck = await this.checkConversationMaster(userId);
      if (conversationMasterCheck) {
        unlockedAchievements.push('CONVERSATION_MASTER');
      }

      // Check Photo Verified
      const photoVerifiedCheck = await this.checkPhotoVerified(userId);
      if (photoVerifiedCheck) {
        unlockedAchievements.push('PHOTO_VERIFIED');
      }

      // Check Video Confident
      const videoConfidentCheck = await this.checkVideoConfident(userId);
      if (videoConfidentCheck) {
        unlockedAchievements.push('VIDEO_CONFIDENT');
      }

      // Check Hot Profile
      const hotProfileCheck = await this.checkHotProfile(userId);
      if (hotProfileCheck) {
        unlockedAchievements.push('HOT_PROFILE');
      }

      // Check Communicator
      const communicatorCheck = await this.checkCommunicator(userId);
      if (communicatorCheck) {
        unlockedAchievements.push('COMMUNICATOR');
      }

      // Check Reaction Enthusiast
      const reactionEnthusiastCheck = await this.checkReactionEnthusiast(userId);
      if (reactionEnthusiastCheck) {
        unlockedAchievements.push('REACTION_ENTHUSIAST');
      }

      // Check Streak Master
      const streakMasterCheck = await this.checkStreakMaster(userId);
      if (streakMasterCheck) {
        unlockedAchievements.push('STREAK_MASTER');
      }

      // Award newly unlocked achievements
      const newlyUnlocked = [];
      for (const badge of unlockedAchievements) {
        const awarded = await this.awardAchievement(userId, badge);
        if (awarded) {
          newlyUnlocked.push(badge);
        }
      }

      return {
        success: true,
        unlockedAchievements,
        newlyUnlocked,
        count: newlyUnlocked.length
      };
    } catch (error) {
      console.error('Error checking achievements:', error);
      throw error;
    }
  }

  /**
   * Check Conversation Master (50+ message exchanges)
   */
  static async checkConversationMaster(userId) {
    try {
      const result = await db.query(
        `SELECT COUNT(DISTINCT match_id) as match_count,
                COUNT(DISTINCT m.id) as total_messages
         FROM messages m
         WHERE (from_user_id = $1 OR to_user_id = $1)
         AND created_at > NOW() - INTERVAL '6 months'`,
        [userId]
      );

      if (!result.rows[0]) return false;

      const { total_messages } = result.rows[0];
      return total_messages >= 50;
    } catch (error) {
      console.error('Error checking Conversation Master:', error);
      return false;
    }
  }

  /**
   * Check Photo Verified (ID verification complete)
   */
  static async checkPhotoVerified(userId) {
    try {
      const result = await db.query(
        `SELECT is_id_verified 
         FROM dating_profiles 
         WHERE user_id = $1`,
        [userId]
      );

      if (!result.rows[0]) return false;
      return result.rows[0].is_id_verified === true;
    } catch (error) {
      console.error('Error checking Photo Verified:', error);
      return false;
    }
  }

  /**
   * Check Video Confident (5+ video calls scheduled)
   */
  static async checkVideoConfident(userId) {
    try {
      const result = await db.query(
        `SELECT COUNT(*) as video_count 
         FROM video_dates 
         WHERE (host_user_id = $1 OR guest_user_id = $1)
         AND scheduled_at > NOW() - INTERVAL '6 months'
         AND status IN ('scheduled', 'completed')`,
        [userId]
      );

      if (!result.rows[0]) return false;
      const { video_count } = result.rows[0];
      return parseInt(video_count) >= 5;
    } catch (error) {
      console.error('Error checking Video Confident:', error);
      return false;
    }
  }

  /**
   * Check Hot Profile (Top 10% liked profiles)
   */
  static async checkHotProfile(userId) {
    try {
      // Get total profiles
      const totalResult = await db.query(
        `SELECT COUNT(*) as total FROM dating_profiles`
      );
      const total = parseInt(totalResult.rows[0].total);
      const topPercentile = Math.ceil(total * 0.1); // Top 10%

      // Get user's like rank
      const rankResult = await db.query(
        `SELECT ROW_NUMBER() OVER (ORDER BY profile_likes DESC) as rank
         FROM (
           SELECT dp.user_id, COUNT(i.id) as profile_likes
           FROM dating_profiles dp
           LEFT JOIN interactions i ON i.to_user_id = dp.user_id AND i.interaction_type = 'like'
           GROUP BY dp.user_id
         ) ranked_profiles
         WHERE user_id = $1`,
        [userId]
      );

      if (!rankResult.rows[0]) return false;
      const { rank } = rankResult.rows[0];
      return parseInt(rank) <= topPercentile;
    } catch (error) {
      console.error('Error checking Hot Profile:', error);
      return false;
    }
  }

  /**
   * Check Communicator (Reply within 1 hour average)
   */
  static async checkCommunicator(userId) {
    try {
      // Calculate average response time
      const result = await db.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at))) as avg_response_time
         FROM messages m1
         JOIN messages m2 ON m1.match_id = m2.match_id 
           AND m2.from_user_id = $1 
           AND m2.created_at > m1.created_at
           AND m2.created_at <= m1.created_at + INTERVAL '24 hours'
         WHERE m1.to_user_id = $1
         AND m1.created_at > NOW() - INTERVAL '3 months'
         GROUP BY m1.id
         LIMIT 1`,
        [userId]
      );

      if (!result.rows[0]) return false;
      const avgResponseSeconds = result.rows[0].avg_response_time;
      return avgResponseSeconds && avgResponseSeconds <= 3600; // 1 hour
    } catch (error) {
      console.error('Error checking Communicator:', error);
      return false;
    }
  }

  /**
   * Check Reaction Enthusiast (100+ message reactions)
   */
  static async checkReactionEnthusiast(userId) {
    try {
      const result = await db.query(
        `SELECT COUNT(*) as reaction_count 
         FROM message_reactions 
         WHERE user_id = $1
         AND created_at > NOW() - INTERVAL '6 months'`,
        [userId]
      );

      if (!result.rows[0]) return false;
      const { reaction_count } = result.rows[0];
      return parseInt(reaction_count) >= 100;
    } catch (error) {
      console.error('Error checking Reaction Enthusiast:', error);
      return false;
    }
  }

  /**
   * Check Streak Master (30+ day streak)
   */
  static async checkStreakMaster(userId) {
    try {
      const result = await db.query(
        `SELECT MAX(streak_days) as max_streak
         FROM message_streak_trackers
         WHERE (user_id_1 = $1 OR user_id_2 = $1)`,
        [userId]
      );

      if (!result.rows[0]) return false;
      const { max_streak } = result.rows[0];
      return max_streak && parseInt(max_streak) >= 30;
    } catch (error) {
      console.error('Error checking Streak Master:', error);
      return false;
    }
  }

  /**
   * Award achievement to user
   */
  static async awardAchievement(userId, badgeCode) {
    try {
      // Check if achievement already exists
      const existingResult = await db.query(
        `SELECT ua.id FROM user_achievements ua
         JOIN achievements a ON a.id = ua.achievement_id
         WHERE ua.user_id = $1 AND a.code = $2`,
        [userId, badgeCode]
      );

      if (existingResult.rows.length > 0) {
        return false; // Already awarded
      }

      // Get or create achievement
      let achievementId = await this.getOrCreateAchievement(badgeCode);

      // Award to user
      await db.query(
        `INSERT INTO user_achievements (user_id, achievement_id, unlocked_at, notification_sent)
         VALUES ($1, $2, NOW(), FALSE)`,
        [userId, achievementId]
      );

      return true;
    } catch (error) {
      console.error('Error awarding achievement:', error);
      return false;
    }
  }

  /**
   * Get or create achievement definition
   */
  static async getOrCreateAchievement(badgeCode) {
    try {
      const badge = this.BADGE_DEFINITIONS[badgeCode];
      if (!badge) {
        throw new Error(`Badge code not found: ${badgeCode}`);
      }

      // Check if exists
      const existingResult = await db.query(
        `SELECT id FROM achievements WHERE code = $1`,
        [badgeCode]
      );

      if (existingResult.rows.length > 0) {
        return existingResult.rows[0].id;
      }

      // Create new achievement
      const createResult = await db.query(
        `INSERT INTO achievements (
          code, name, description, emoji, category, tier,
          requirement_type, requirement_value, rarity, points, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
        RETURNING id`,
        [
          badge.code,
          badge.name,
          badge.description,
          badge.emoji,
          badge.category,
          badge.tier,
          badge.requirementType,
          badge.requirementValue,
          badge.rarity,
          badge.points
        ]
      );

      return createResult.rows[0].id;
    } catch (error) {
      console.error('Error getting/creating achievement:', error);
      throw error;
    }
  }

  /**
   * Get user's achievements with details
   */
  static async getUserAchievements(userId) {
    try {
      const result = await db.query(
        `SELECT a.id, a.code, a.name, a.emoji, a.description, 
                a.category, a.tier, a.rarity, a.points,
                ua.unlocked_at, ua.is_featured, ua.progress
         FROM user_achievements ua
         JOIN achievements a ON a.id = ua.achievement_id
         WHERE ua.user_id = $1
         ORDER BY ua.unlocked_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting user achievements:', error);
      return [];
    }
  }

  /**
   * Feature an achievement on profile
   */
  static async featureAchievement(userId, achievementId) {
    try {
      // Unfeature all others
      await db.query(
        `UPDATE user_achievements SET is_featured = FALSE 
         WHERE user_id = $1`,
        [userId]
      );

      // Feature this one
      await db.query(
        `UPDATE user_achievements SET is_featured = TRUE 
         WHERE user_id = $1 AND achievement_id = $2`,
        [userId, achievementId]
      );

      return true;
    } catch (error) {
      console.error('Error featuring achievement:', error);
      return false;
    }
  }
}

module.exports = AchievementService;
