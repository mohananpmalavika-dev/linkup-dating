/**
 * Streak Service
 * Manages messaging streaks between matched users
 * Tracks consecutive days, milestones, and engagement psychology
 */

const { sequelize } = require('../config/database');
const {
  User,
  Match,
  Message,
  MessageStreakTracker,
  UserAchievement,
  Achievement
} = require('../models');
const { Op } = require('sequelize');

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
      const streak = await MessageStreakTracker.findOne({
        where: { matchId },
        include: [
          {
            model: User,
            as: 'user1',
            attributes: ['id', 'firstName', 'profilePhotoUrl']
          },
          {
            model: User,
            as: 'user2',
            attributes: ['id', 'firstName', 'profilePhotoUrl']
          }
        ]
      });

      if (!streak) {
        return null;
      }

      const isCurrentUserUser1 = streak.userId1 === userId;
      const otherUser = isCurrentUserUser1 ? streak.user2 : streak.user1;

      return {
        ...streak.toJSON(),
        flameEmoji: this.getFlameEmoji(streak.streakDays),
        flameLevel: this.getFlameLevel(streak.streakDays),
        otherUser,
        daysSinceMessage: this.getDaysSinceLastMessage(streak.lastMessageDate),
        isBadgeEarned: streak.streakDays >= MILESTONES.FIRST_BADGE
      };
    } catch (error) {
      console.error('Error getting streak info:', error);
      throw error;
    }
  }

  /**
   * Get all active streaks for a user
   */
  async getUserStreaks(userId, limit = 50) {
    try {
      const streaks = await MessageStreakTracker.findAll({
        where: {
          isActive: true,
          [Op.or]: [
            { userId1: userId },
            { userId2: userId }
          ]
        },
        include: [
          {
            model: User,
            as: 'user1',
            attributes: ['id', 'firstName', 'profilePhotoUrl']
          },
          {
            model: User,
            as: 'user2',
            attributes: ['id', 'firstName', 'profilePhotoUrl']
          }
        ],
        order: [['streakDays', 'DESC']],
        limit
      });

      return streaks.map(streak => {
        const isCurrentUserUser1 = streak.userId1 === userId;
        const otherUser = isCurrentUserUser1 ? streak.user2 : streak.user1;

        return {
          ...streak.toJSON(),
          flameEmoji: this.getFlameEmoji(streak.streakDays),
          flameLevel: this.getFlameLevel(streak.streakDays),
          otherUser,
          isBadgeEarned: streak.streakDays >= MILESTONES.FIRST_BADGE,
          daysUntilBroken: this.getDaysUntilStreakBreaks(streak.lastMessageDate)
        };
      });
    } catch (error) {
      console.error('Error getting user streaks:', error);
      throw error;
    }
  }

  /**
   * Get streak leaderboard (top streaks)
   */
  async getStreakLeaderboard(limit = 20) {
    try {
      const leaderboard = await MessageStreakTracker.findAll({
        where: { isActive: true },
        order: [['streakDays', 'DESC']],
        limit,
        include: [
          {
            model: User,
            as: 'user1',
            attributes: ['id', 'firstName', 'profilePhotoUrl']
          },
          {
            model: User,
            as: 'user2',
            attributes: ['id', 'firstName', 'profilePhotoUrl']
          }
        ]
      });

      return leaderboard.map((streak, index) => ({
        rank: index + 1,
        ...streak.toJSON(),
        flameEmoji: this.getFlameEmoji(streak.streakDays),
        matchNames: `${streak.user1.firstName} & ${streak.user2.firstName}`
      }));
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get streak statistics for user
   */
  async getUserStreakStats(userId) {
    try {
      const streaks = await MessageStreakTracker.findAll({
        where: {
          [Op.or]: [
            { userId1: userId },
            { userId2: userId }
          ]
        }
      });

      const activeStreaks = streaks.filter(s => s.isActive);
      const longestStreak = Math.max(...streaks.map(s => s.streakDays), 0);
      const totalStreaks = streaks.length;
      const totalEngagementScore = streaks.reduce((sum, s) => sum + (s.engagementScore || 0), 0);

      const milestoneCount = {
        badge3Day: streaks.filter(s => s.milestone3Days).length,
        milestone7Day: streaks.filter(s => s.milestone7Days).length,
        milestone30Day: streaks.filter(s => s.milestone30Days).length
      };

      return {
        activeStreakCount: activeStreaks.length,
        longestStreak,
        totalStreaks,
        totalEngagementScore,
        milestoneCount,
        averageStreakLength: Math.round(streaks.reduce((sum, s) => sum + s.streakDays, 0) / Math.max(totalStreaks, 1))
      };
    } catch (error) {
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
