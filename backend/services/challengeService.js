/**
 * Challenge Service
 * Handles all business logic for daily challenges
 */

const { sequelize } = require('../config/database');
const {
  User,
  DailyChallenge,
  UserDailyChallenge,
  DiscoveryBoostPoints,
  ChallengeRedemption,
  UserRewardBalance
} = require('../models');
const { Op } = require('sequelize');

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

class ChallengeService {
  /**
   * Get today's challenges for a user
   */
  async getTodayChallenges(userId) {
    try {
      const today = new Date();
      const dayOfWeek = DAYS_OF_WEEK[today.getDay()];
      const challengeDate = today.toISOString().split('T')[0];

      // Get all challenges for today
      const challenges = await DailyChallenge.findAll({
        where: {
          dayOfWeek: dayOfWeek,
          isActive: true
        },
        order: [['order', 'ASC']]
      });

      // Get user's progress on today's challenges
      const userProgress = await UserDailyChallenge.findAll({
        where: {
          userId,
          challengeDate
        }
      });

      const progressMap = {};
      userProgress.forEach(p => {
        progressMap[p.dailyChallengeId] = p;
      });

      // Combine challenges with user progress
      const result = challenges.map(challenge => {
        const progress = progressMap[challenge.id];
        return {
          ...challenge.toJSON(),
          progress: progress ? progress.toJSON() : null,
          isCompleted: progress?.isCompleted || false,
          progressCount: progress?.progressCount || 0,
          pointsEarned: progress?.pointsEarned || 0
        };
      });

      return result;
    } catch (error) {
      console.error('Error getting today challenges:', error);
      throw error;
    }
  }

  /**
   * Get all weekly challenges
   */
  async getWeeklyChallenges(userId) {
    try {
      const today = new Date();
      const challengeDate = today.toISOString().split('T')[0];

      // Get all active challenges
      const challenges = await DailyChallenge.findAll({
        where: { isActive: true },
        order: [
          [sequelize.where(sequelize.fn('FIELD', sequelize.col('day_of_week'), ...DAYS_OF_WEEK), 'ASC')],
          ['order', 'ASC']
        ]
      });

      // Get user's progress for this week
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const weekStart = startOfWeek.toISOString().split('T')[0];

      const userProgress = await UserDailyChallenge.findAll({
        where: {
          userId,
          challengeDate: {
            [Op.gte]: weekStart
          }
        }
      });

      const progressMap = {};
      userProgress.forEach(p => {
        const key = `${p.dailyChallengeId}_${p.challengeDate}`;
        progressMap[key] = p;
      });

      // Group challenges by day
      const byday = {};
      DAYS_OF_WEEK.forEach(day => {
        byday[day] = [];
      });

      challenges.forEach(challenge => {
        const progress = progressMap[`${challenge.id}_${challengeDate}`];
        byday[challenge.dayOfWeek].push({
          ...challenge.toJSON(),
          progress: progress?.toJSON() || null,
          isCompleted: progress?.isCompleted || false
        });
      });

      return byday;
    } catch (error) {
      console.error('Error getting weekly challenges:', error);
      throw error;
    }
  }

  /**
   * Update challenge progress
   */
  async updateChallengeProgress(userId, dailyChallengeId, increment = 1) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const challenge = await DailyChallenge.findByPk(dailyChallengeId);
      if (!challenge) {
        throw new Error('Challenge not found');
      }

      // Find or create user challenge progress
      let userChallenge = await UserDailyChallenge.findOne({
        where: {
          userId,
          dailyChallengeId,
          challengeDate: today
        }
      });

      if (!userChallenge) {
        userChallenge = await UserDailyChallenge.create({
          userId,
          dailyChallengeId,
          challengeDate: today,
          progressCount: 0
        });
      }

      // Update progress
      userChallenge.progressCount += increment;

      // Check if completed
      const isNowCompleted = userChallenge.progressCount >= challenge.targetCount;
      if (isNowCompleted && !userChallenge.isCompleted) {
        userChallenge.isCompleted = true;
        userChallenge.completedAt = new Date();
        userChallenge.pointsEarned = challenge.rewardPoints;

        // Award points immediately
        await this.awardPoints(userId, challenge.rewardPoints, dailyChallengeId);
      }

      await userChallenge.save();

      return userChallenge.toJSON();
    } catch (error) {
      console.error('Error updating challenge progress:', error);
      throw error;
    }
  }

  /**
   * Award points to user
   */
  async awardPoints(userId, points, dailyChallengeId) {
    try {
      // Update or create discovery boost points record
      let boostPoints = await DiscoveryBoostPoints.findOne({
        where: { userId }
      });

      if (!boostPoints) {
        boostPoints = await DiscoveryBoostPoints.create({
          userId,
          totalPoints: 0
        });
      }

      boostPoints.totalPoints += points;
      boostPoints.weeklyPoints += points;

      // Reset weekly points if needed
      const now = new Date();
      if (!boostPoints.lastWeekResetAt || this.isNewWeek(boostPoints.lastWeekResetAt)) {
        boostPoints.lastWeekResetAt = now;
        boostPoints.weeklyPoints = points;
        boostPoints.monthlyStreak = (boostPoints.monthlyStreak || 0) + 1;
      }

      boostPoints.lastChallengeDate = now.toISOString().split('T')[0];

      await boostPoints.save();

      return boostPoints.toJSON();
    } catch (error) {
      console.error('Error awarding points:', error);
      throw error;
    }
  }

  /**
   * Get user's current points balance
   */
  async getUserPointsBalance(userId) {
    try {
      const boostPoints = await DiscoveryBoostPoints.findOne({
        where: { userId }
      });

      if (!boostPoints) {
        // Create default record
        const newRecord = await DiscoveryBoostPoints.create({ userId });
        return newRecord.toJSON();
      }

      return boostPoints.toJSON();
    } catch (error) {
      console.error('Error getting points balance:', error);
      throw error;
    }
  }

  /**
   * Redeem points for premium feature
   */
  async redeemPoints(userId, pointsToRedeem, rewardType, rewardValue) {
    try {
      const boostPoints = await DiscoveryBoostPoints.findOne({
        where: { userId }
      });

      if (!boostPoints || boostPoints.totalPoints - boostPoints.pointsUsed < pointsToRedeem) {
        throw new Error('Insufficient points');
      }

      // Create redemption record
      const redemption = await ChallengeRedemption.create({
        userId,
        pointsRedeemed: pointsToRedeem,
        rewardType,
        rewardValue,
        status: 'pending'
      });

      // Update points used
      boostPoints.pointsUsed += pointsToRedeem;
      await boostPoints.save();

      return redemption.toJSON();
    } catch (error) {
      console.error('Error redeeming points:', error);
      throw error;
    }
  }

  /**
   * Apply redemption to user account
   */
  async applyRedemption(redemptionId) {
    try {
      const redemption = await ChallengeRedemption.findByPk(redemptionId);
      if (!redemption) {
        throw new Error('Redemption not found');
      }

      if (redemption.status !== 'pending') {
        throw new Error('Redemption already processed');
      }

      redemption.status = 'approved';
      redemption.appliedAt = new Date();

      // Handle different reward types
      switch (redemption.rewardType) {
        case 'premium_week':
          await this.grantPremiumDays(redemption.userId, 7);
          break;
        case 'premium_month':
          await this.grantPremiumDays(redemption.userId, 30);
          break;
        case 'super_likes':
          await this.grantSuperLikes(redemption.userId, 5);
          break;
        case 'boost':
          await this.grantBoosts(redemption.userId, 1);
          break;
        case 'rewind':
          await this.grantRewinds(redemption.userId, 1);
          break;
      }

      redemption.status = 'applied';
      await redemption.save();

      return redemption.toJSON();
    } catch (error) {
      console.error('Error applying redemption:', error);
      throw error;
    }
  }

  /**
   * Grant premium days to user
   */
  async grantPremiumDays(userId, days) {
    try {
      let rewardBalance = await UserRewardBalance.findOne({
        where: { userId }
      });

      if (!rewardBalance) {
        rewardBalance = await UserRewardBalance.create({ userId });
      }

      rewardBalance.premiumDaysAwarded = (rewardBalance.premiumDaysAwarded || 0) + days;
      rewardBalance.lastRewardedAt = new Date();

      await rewardBalance.save();
      return rewardBalance;
    } catch (error) {
      console.error('Error granting premium days:', error);
      throw error;
    }
  }

  /**
   * Grant super likes to user
   */
  async grantSuperLikes(userId, count) {
    try {
      let rewardBalance = await UserRewardBalance.findOne({
        where: { userId }
      });

      if (!rewardBalance) {
        rewardBalance = await UserRewardBalance.create({ userId });
      }

      rewardBalance.superlikeCredits = (rewardBalance.superlikeCredits || 0) + count;
      rewardBalance.lastRewardedAt = new Date();

      await rewardBalance.save();
      return rewardBalance;
    } catch (error) {
      console.error('Error granting super likes:', error);
      throw error;
    }
  }

  /**
   * Grant boosts to user
   */
  async grantBoosts(userId, count) {
    try {
      let rewardBalance = await UserRewardBalance.findOne({
        where: { userId }
      });

      if (!rewardBalance) {
        rewardBalance = await UserRewardBalance.create({ userId });
      }

      rewardBalance.boostCredits = (rewardBalance.boostCredits || 0) + count;
      rewardBalance.lastRewardedAt = new Date();

      await rewardBalance.save();
      return rewardBalance;
    } catch (error) {
      console.error('Error granting boosts:', error);
      throw error;
    }
  }

  /**
   * Grant rewinds to user
   */
  async grantRewinds(userId, count) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.rewindQuota = (user.rewindQuota || 0) + count;
      await user.save();

      return user;
    } catch (error) {
      console.error('Error granting rewinds:', error);
      throw error;
    }
  }

  /**
   * Get user's redemption history
   */
  async getRedemptionHistory(userId, limit = 20) {
    try {
      const redemptions = await ChallengeRedemption.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit
      });

      return redemptions.map(r => r.toJSON());
    } catch (error) {
      console.error('Error getting redemption history:', error);
      throw error;
    }
  }

  /**
   * Check if a new week has started
   */
  isNewWeek(lastResetDate) {
    const lastReset = new Date(lastResetDate);
    const now = new Date();
    
    const lastResetWeek = Math.floor(lastReset.getTime() / (7 * 24 * 60 * 60 * 1000));
    const currentWeek = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
    
    return currentWeek > lastResetWeek;
  }

  /**
   * Get leaderboard for top point earners this week
   */
  async getWeeklyLeaderboard(limit = 20) {
    try {
      const leaderboard = await DiscoveryBoostPoints.findAll({
        order: [['weeklyPoints', 'DESC']],
        limit,
        include: [
          {
            model: User,
            attributes: ['id', 'firstName', 'profilePhotoUrl']
          }
        ]
      });

      return leaderboard.map((entry, index) => ({
        rank: index + 1,
        ...entry.toJSON()
      }));
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  /**
   * Initialize challenges for new user
   */
  async initializeChallengesForUser(userId) {
    try {
      // Create discovery boost points record
      await DiscoveryBoostPoints.create({ userId });

      console.log(`Initialized challenges for user ${userId}`);
    } catch (error) {
      console.error('Error initializing challenges:', error);
      throw error;
    }
  }
}

module.exports = new ChallengeService();
