/**
 * Streak Service
 * Manages messaging streaks between matched users
 * Tracks consecutive days, milestones, and engagement psychology
 */

const db = require('../config/database');
const { MessageStreakTracker } = require('../models');
const { Op } = require('sequelize');

const OPTIONAL_SCHEMA_ERROR_CODES = new Set(['42P01', '42703']);

const isOptionalSchemaError = (error) =>
  OPTIONAL_SCHEMA_ERROR_CODES.has(error?.code || error?.parent?.code || error?.original?.code);

const normalizeLimit = (value, fallback = 50) => {
  const parsedLimit = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    return fallback;
  }

  return Math.min(parsedLimit, 100);
};

const normalizePair = (userId1, userId2) => [
  Math.min(Number(userId1), Number(userId2)),
  Math.max(Number(userId1), Number(userId2))
];

const mapOtherUser = (row, currentUserId) => {
  if (!row || !currentUserId) {
    return null;
  }

  const isCurrentUserUser1 = Number(row.user_id_1) === Number(currentUserId);
  const prefix = isCurrentUserUser1 ? 'user2' : 'user1';

  return {
    id: row[`${prefix}_id`],
    firstName: row[`${prefix}_first_name`] || 'Your match',
    profilePhotoUrl: row[`${prefix}_photo_url`] || null
  };
};

const mapStreakRow = (row, currentUserId = null) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId1: row.user_id_1,
    userId2: row.user_id_2,
    matchId: row.match_id,
    streakDays: Number(row.streak_days || 0),
    isActive: Boolean(row.is_active),
    streakStartDate: row.streak_start_date,
    lastMessageDate: row.last_message_date,
    streakBrokenDate: row.streak_broken_date,
    milestone3Days: Boolean(row.milestone_3_days),
    milestone7Days: Boolean(row.milestone_7_days),
    milestone30Days: Boolean(row.milestone_30_days),
    totalMessages: Number(row.total_messages || 0),
    totalReactions: Number(row.total_reactions || 0),
    engagementScore: Number(row.engagement_score || 0),
    notificationSent: Boolean(row.notification_sent),
    lastNotificationDate: row.last_notification_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    otherUser: mapOtherUser(row, currentUserId)
  };
};

const MILESTONES = {
  FIRST_BADGE: 3,      // Badge appears at 3 days
  SEVEN_DAY: 7,        // First major milestone
  THIRTY_DAY: 30,      // Extended engagement
  HUNDRED_DAY: 100     // Extreme dedication
};

const FLAME_LEVELS = {
  0: '🔥',              // 1-2 days
  1: '🔥🔥',            // 3-6 days
  2: '🔥🔥🔥',          // 7-29 days
  3: '🔥🔥🔥🔥',        // 30-99 days
  4: '🔥🔥🔥🔥🔥'      // 100+ days
};

class StreakService {
  /**
   * Get flame level based on streak days
   */
  getFlameLevel(streakDays) {
    if (streakDays >= MILESTONES.HUNDRED_DAY) return 4;
    if (streakDays >= MILESTONES.THIRTY_DAY) return 3;
    if (streakDays >= MILESTONES.SEVEN_DAY) return 2;
    if (streakDays >= MILESTONES.FIRST_BADGE) return 1;
    return 0;
  }

  /**
   * Get flame emoji string
   */
  getFlameEmoji(streakDays) {
    const level = this.getFlameLevel(streakDays);
    return FLAME_LEVELS[level];
  }

  /**
   * Check if streak should be maintained or broken
   */
  shouldContinueStreak(lastMessageDate) {
    if (!lastMessageDate) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastDate = new Date(lastMessageDate);
    lastDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

    // Streak continues if message within last 24 hours (same or previous day)
    return daysDiff <= 1;
  }

  /**
   * Update streak on new message
   */
  async updateStreakOnMessage(matchId, userId1, userId2) {
    try {
      let streak = await MessageStreakTracker.findOne({
        where: {
          matchId,
          [Op.or]: [
            { userId1, userId2 },
            { userId1: userId2, userId2: userId1 }
          ]
        }
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (!streak) {
        // Create new streak
        streak = await MessageStreakTracker.create({
          userId1: Math.min(userId1, userId2),
          userId2: Math.max(userId1, userId2),
          matchId,
          streakDays: 1,
          streakStartDate: today,
          lastMessageDate: new Date(),
          isActive: true,
          totalMessages: 1,
          milestone3Days: false,
          milestone7Days: false,
          milestone30Days: false
        });

        return {
          isNew: true,
          streak: streak.toJSON()
        };
      }

      // Update existing streak
      const lastMessageDate = new Date(streak.lastMessageDate);
      lastMessageDate.setHours(0, 0, 0, 0);

      const daysSinceLastMessage = Math.floor((today - lastMessageDate) / (1000 * 60 * 60 * 24));

      let milestoneTrigger = null;

      if (daysSinceLastMessage === 0) {
        // Same day message - don't increment streak
        streak.totalMessages += 1;
      } else if (daysSinceLastMessage === 1) {
        // Next day message - continue streak
        streak.streakDays += 1;
        streak.totalMessages += 1;
        streak.lastMessageDate = new Date();

        // Check for milestone achievements
        if (streak.streakDays === MILESTONES.FIRST_BADGE && !streak.milestone3Days) {
          streak.milestone3Days = true;
          milestoneTrigger = {
            milestone: '3_day',
            days: MILESTONES.FIRST_BADGE,
            description: '3-Day Messaging Streak! 🔥'
          };
        } else if (streak.streakDays === MILESTONES.SEVEN_DAY && !streak.milestone7Days) {
          streak.milestone7Days = true;
          milestoneTrigger = {
            milestone: '7_day',
            days: MILESTONES.SEVEN_DAY,
            description: '7-Day Messaging Streak! 🔥🔥'
          };
        } else if (streak.streakDays === MILESTONES.THIRTY_DAY && !streak.milestone30Days) {
          streak.milestone30Days = true;
          milestoneTrigger = {
            milestone: '30_day',
            days: MILESTONES.THIRTY_DAY,
            description: '30-Day Messaging Streak! 🔥🔥🔥'
          };
        }

        // Calculate engagement score for psychology boost
        const messageDensity = streak.totalMessages / streak.streakDays;
        streak.engagementScore = (streak.streakDays * 10) + (messageDensity * 5);
      } else {
        // Streak broken (> 1 day gap)
        if (streak.isActive) {
          await this.recordBrokenStreak(streak);
        }

        // Start new streak
        streak.streakDays = 1;
        streak.streakStartDate = today;
        streak.lastMessageDate = new Date();
        streak.isActive = true;
        streak.milestone3Days = false;
        streak.milestone7Days = false;
        streak.milestone30Days = false;
        streak.totalMessages = 1;
        streak.engagementScore = 0;
        streak.streakBrokenDate = null;

        milestoneTrigger = {
          milestone: 'streak_reset',
          description: 'Streak reset. Keep messaging to build a new one! 📱'
        };
      }

      await streak.save();

      return {
        isNew: false,
        streak: streak.toJSON(),
        milestoneTrigger
      };
    } catch (error) {
      console.error('Error updating streak:', error);
      throw error;
    }
  }

  /**
   * Record broken streak
   */
  async recordBrokenStreak(streak) {
    try {
      streak.isActive = false;
      streak.streakBrokenDate = new Date();
      await streak.save();

      // Could trigger notifications or achievements here
      return streak;
    } catch (error) {
      console.error('Error recording broken streak:', error);
      throw error;
    }
  }

  /**
   * Get streak info for a specific match
   */
  async getStreakInfo(matchId, userId) {
    try {
      const result = await db.query(
        `SELECT mst.*,
                u1.id AS user1_id,
                COALESCE(dp1.first_name, u1.email, 'Your match') AS user1_first_name,
                pp1.photo_url AS user1_photo_url,
                u2.id AS user2_id,
                COALESCE(dp2.first_name, u2.email, 'Your match') AS user2_first_name,
                pp2.photo_url AS user2_photo_url
         FROM message_streak_trackers mst
         INNER JOIN matches m
           ON m.id = mst.match_id
          AND (m.user_id_1 = $2 OR m.user_id_2 = $2)
         LEFT JOIN users u1 ON u1.id = mst.user_id_1
         LEFT JOIN users u2 ON u2.id = mst.user_id_2
         LEFT JOIN dating_profiles dp1 ON dp1.user_id = mst.user_id_1
         LEFT JOIN dating_profiles dp2 ON dp2.user_id = mst.user_id_2
         LEFT JOIN LATERAL (
           SELECT photo_url
           FROM profile_photos
           WHERE user_id = mst.user_id_1
           ORDER BY is_primary DESC, position ASC, uploaded_at DESC
           LIMIT 1
         ) pp1 ON TRUE
         LEFT JOIN LATERAL (
           SELECT photo_url
           FROM profile_photos
           WHERE user_id = mst.user_id_2
           ORDER BY is_primary DESC, position ASC, uploaded_at DESC
           LIMIT 1
         ) pp2 ON TRUE
         WHERE mst.match_id = $1
         LIMIT 1`,
        [matchId, userId]
      );

      const streak = mapStreakRow(result.rows[0], userId);
      if (!streak) {
        return null;
      }

      return {
        ...streak,
        flameEmoji: this.getFlameEmoji(streak.streakDays),
        flameLevel: this.getFlameLevel(streak.streakDays),
        daysSinceMessage: this.getDaysSinceLastMessage(streak.lastMessageDate),
        isBadgeEarned: streak.streakDays >= MILESTONES.FIRST_BADGE
      };
    } catch (error) {
      if (isOptionalSchemaError(error)) {
        return null;
      }

      console.error('Error getting streak info:', error);
      throw error;
    }
  }

  /**
   * Get all active streaks for a user
   */
  async getUserStreaks(userId, limit = 50) {
    try {
      const result = await db.query(
        `SELECT mst.*,
                u1.id AS user1_id,
                COALESCE(dp1.first_name, u1.email, 'Your match') AS user1_first_name,
                pp1.photo_url AS user1_photo_url,
                u2.id AS user2_id,
                COALESCE(dp2.first_name, u2.email, 'Your match') AS user2_first_name,
                pp2.photo_url AS user2_photo_url
         FROM message_streak_trackers mst
         LEFT JOIN users u1 ON u1.id = mst.user_id_1
         LEFT JOIN users u2 ON u2.id = mst.user_id_2
         LEFT JOIN dating_profiles dp1 ON dp1.user_id = mst.user_id_1
         LEFT JOIN dating_profiles dp2 ON dp2.user_id = mst.user_id_2
         LEFT JOIN LATERAL (
           SELECT photo_url
           FROM profile_photos
           WHERE user_id = mst.user_id_1
           ORDER BY is_primary DESC, position ASC, uploaded_at DESC
           LIMIT 1
         ) pp1 ON TRUE
         LEFT JOIN LATERAL (
           SELECT photo_url
           FROM profile_photos
           WHERE user_id = mst.user_id_2
           ORDER BY is_primary DESC, position ASC, uploaded_at DESC
           LIMIT 1
         ) pp2 ON TRUE
         WHERE mst.is_active = TRUE
           AND (mst.user_id_1 = $1 OR mst.user_id_2 = $1)
         ORDER BY mst.streak_days DESC, mst.last_message_date DESC
         LIMIT $2`,
        [userId, normalizeLimit(limit)]
      );

      return result.rows.map((row) => {
        const streak = mapStreakRow(row, userId);
        return {
          ...streak,
          flameEmoji: this.getFlameEmoji(streak.streakDays),
          flameLevel: this.getFlameLevel(streak.streakDays),
          isBadgeEarned: streak.streakDays >= MILESTONES.FIRST_BADGE,
          daysUntilBroken: this.getDaysUntilStreakBreaks(streak.lastMessageDate)
        };
      });
    } catch (error) {
      if (isOptionalSchemaError(error)) {
        return [];
      }

      console.error('Error getting user streaks:', error);
      throw error;
    }
  }

  /**
   * Get streak leaderboard (top streaks)
   */
  async getStreakLeaderboard(limit = 20) {
    try {
      const result = await db.query(
        `SELECT mst.*,
                COALESCE(dp1.first_name, u1.email, 'User ' || mst.user_id_1) AS user1_first_name,
                COALESCE(dp2.first_name, u2.email, 'User ' || mst.user_id_2) AS user2_first_name
         FROM message_streak_trackers mst
         LEFT JOIN users u1 ON u1.id = mst.user_id_1
         LEFT JOIN users u2 ON u2.id = mst.user_id_2
         LEFT JOIN dating_profiles dp1 ON dp1.user_id = mst.user_id_1
         LEFT JOIN dating_profiles dp2 ON dp2.user_id = mst.user_id_2
         WHERE mst.is_active = TRUE
         ORDER BY mst.streak_days DESC, mst.last_message_date DESC
         LIMIT $1`,
        [normalizeLimit(limit, 20)]
      );

      return result.rows.map((row, index) => {
        const streak = mapStreakRow(row);
        return {
          rank: index + 1,
          ...streak,
          flameEmoji: this.getFlameEmoji(streak.streakDays),
          matchNames: `${row.user1_first_name} & ${row.user2_first_name}`
        };
      });
    } catch (error) {
      if (isOptionalSchemaError(error)) {
        return [];
      }

      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get streak statistics for user
   */
  async getUserStreakStats(userId) {
    try {
      const result = await db.query(
        `SELECT
           COUNT(*)::int AS total_streaks,
           COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active_streak_count,
           COALESCE(MAX(streak_days), 0)::int AS longest_streak,
           COALESCE(SUM(engagement_score), 0)::float AS total_engagement_score,
           COUNT(*) FILTER (WHERE milestone_3_days = TRUE)::int AS badge_3_day,
           COUNT(*) FILTER (WHERE milestone_7_days = TRUE)::int AS milestone_7_day,
           COUNT(*) FILTER (WHERE milestone_30_days = TRUE)::int AS milestone_30_day,
           COALESCE(AVG(streak_days), 0)::float AS average_streak_length
         FROM message_streak_trackers
         WHERE user_id_1 = $1 OR user_id_2 = $1`,
        [userId]
      );

      const stats = result.rows[0] || {};
      const milestoneCount = {
        badge3Day: Number(stats.badge_3_day || 0),
        milestone7Day: Number(stats.milestone_7_day || 0),
        milestone30Day: Number(stats.milestone_30_day || 0)
      };

      return {
        activeStreakCount: Number(stats.active_streak_count || 0),
        longestStreak: Number(stats.longest_streak || 0),
        totalStreaks: Number(stats.total_streaks || 0),
        totalEngagementScore: Number(stats.total_engagement_score || 0),
        milestoneCount,
        averageStreakLength: Math.round(Number(stats.average_streak_length || 0))
      };
    } catch (error) {
      if (isOptionalSchemaError(error)) {
        return {
          activeStreakCount: 0,
          longestStreak: 0,
          totalStreaks: 0,
          totalEngagementScore: 0,
          milestoneCount: {
            badge3Day: 0,
            milestone7Day: 0,
            milestone30Day: 0
          },
          averageStreakLength: 0
        };
      }

      console.error('Error getting streak stats:', error);
      throw error;
    }
  }

  /**
   * Get days since last message
   */
  getDaysSinceLastMessage(lastMessageDate) {
    if (!lastMessageDate) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastDate = new Date(lastMessageDate);
    lastDate.setHours(0, 0, 0, 0);

    return Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
  }

  /**
   * Get days until streak breaks
   */
  getDaysUntilStreakBreaks(lastMessageDate) {
    const daysSince = this.getDaysSinceLastMessage(lastMessageDate);
    if (daysSince === null) return null;

    // Streak breaks if we don't message by end of today (1 day after last message)
    return Math.max(0, 1 - daysSince);
  }

  /**
   * Get milestones for streak
   */
  getMilestones(streakDays) {
    const milestones = [];

    if (streakDays >= MILESTONES.FIRST_BADGE) {
      milestones.push({
        level: '3_day',
        name: '🔥 First Flame',
        description: 'Messaged 3 days in a row',
        achieved: true
      });
    }

    if (streakDays >= MILESTONES.SEVEN_DAY) {
      milestones.push({
        level: '7_day',
        name: '🔥🔥 Week Warrior',
        description: 'Maintained a 7-day streak',
        achieved: true
      });
    }

    if (streakDays >= MILESTONES.THIRTY_DAY) {
      milestones.push({
        level: '30_day',
        name: '🔥🔥🔥 Month Crusher',
        description: 'Maintained a 30-day streak',
        achieved: true
      });
    }

    if (streakDays >= MILESTONES.HUNDRED_DAY) {
      milestones.push({
        level: '100_day',
        name: '🔥🔥🔥🔥🔥 Century Legend',
        description: 'Maintained a 100-day streak',
        achieved: true
      });
    }

    // Show next milestone target
    if (streakDays < MILESTONES.FIRST_BADGE) {
      milestones.push({
        level: '3_day',
        name: '🔥 First Flame',
        description: `Message ${MILESTONES.FIRST_BADGE - streakDays} more day(s)`,
        achieved: false
      });
    } else if (streakDays < MILESTONES.SEVEN_DAY) {
      milestones.push({
        level: '7_day',
        name: '🔥🔥 Week Warrior',
        description: `Message ${MILESTONES.SEVEN_DAY - streakDays} more day(s)`,
        achieved: false
      });
    } else if (streakDays < MILESTONES.THIRTY_DAY) {
      milestones.push({
        level: '30_day',
        name: '🔥🔥🔥 Month Crusher',
        description: `Message ${MILESTONES.THIRTY_DAY - streakDays} more day(s)`,
        achieved: false
      });
    } else if (streakDays < MILESTONES.HUNDRED_DAY) {
      milestones.push({
        level: '100_day',
        name: '🔥🔥🔥🔥🔥 Century Legend',
        description: `Message ${MILESTONES.HUNDRED_DAY - streakDays} more day(s)`,
        achieved: false
      });
    }

    return milestones;
  }
}

module.exports = new StreakService();
