/**
 * Profile Reset Service
 * Manages profile resets with monthly limits for free users, unlimited for premium
 */

const { sequelize } = require('../config/database');
const {
  User,
  ProfileReset,
  DatingProfile,
  Subscription,
  UserSwipe
} = require('../models');
const { Op } = require('sequelize');

const RESET_CONFIG = {
  FREE_RESETS_PER_MONTH: 1,
  PREMIUM_UNLIMITED: true,
  RESET_COOLDOWN_HOURS: 0, // Can reset anytime
  SWIPE_HISTORY_RESET_DAYS: 30, // Clear swipes from last 30 days
  ANALYTICS_WINDOW_DAYS: 7, // Track impressions for 7 days post-reset
  FEATURE_DESCRIPTION: 'Start fresh in your local dating scene'
};

class ProfileResetService {
  /**
   * Initiate profile reset
   */
  async initiateReset(userId, resetReason = '') {
    const transaction = await sequelize.transaction();

    try {
      // Get user and check premium status
      const user = await User.findByPk(userId, { transaction });
      if (!user) {
        await transaction.rollback();
        return { success: false, message: 'User not found' };
      }

      // Check premium status
      const subscription = await Subscription.findOne(
        { where: { user_id: userId, status: 'active' } },
        { transaction }
      );

      const isPremium = !!subscription;
      const resetType = isPremium ? 'premium' : 'free';

      // Check if free user has available resets
      if (!isPremium) {
        const thisMonth = this.getMonthYear();
        const thisMonthResets = await ProfileReset.count(
          {
            where: {
              user_id: userId,
              month_year: thisMonth,
              reset_type: 'free'
            }
          },
          { transaction }
        );

        if (thisMonthResets >= RESET_CONFIG.FREE_RESETS_PER_MONTH) {
          await transaction.rollback();
          return {
            success: false,
            message: 'Free reset limit reached this month',
            nextResetDate: this.getNextMonthDate()
          };
        }
      }

      // Get current profile stats
      const profile = await DatingProfile.findOne(
        { where: { user_id: userId } },
        { transaction }
      );

      const impressionsBefore = profile?.impression_count || 0;

      // Clear swipe history (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - RESET_CONFIG.SWIPE_HISTORY_RESET_DAYS);

      const swipesClearedCount = await UserSwipe.count(
        {
          where: {
            user_id: userId,
            created_at: { [Op.gte]: thirtyDaysAgo }
          }
        },
        { transaction }
      );

      // Actually clear swipes
      await UserSwipe.destroy(
        {
          where: {
            user_id: userId,
            created_at: { [Op.gte]: thirtyDaysAgo }
          }
        },
        { transaction }
      );

      // Reset profile visibility
      if (profile) {
        await profile.update(
          {
            impression_count: 0,
            last_profile_update: new Date(),
            is_visible: true,
            profile_rotation_count: (profile.profile_rotation_count || 0) + 1
          },
          { transaction }
        );
      }

      // Create reset record
      const nextFreeReset = isPremium ? null : this.getNextMonthDate();

      const resetRecord = await ProfileReset.create(
        {
          user_id: userId,
          reset_type: resetType,
          photos_rotated: true,
          bio_updated: false,
          swipes_cleared: true,
          impressions_before: impressionsBefore,
          impressions_after_reset: 0,
          matches_preserved: true,
          reset_reason: resetReason,
          next_free_reset: nextFreeReset,
          total_resets_lifetime: (user.total_profile_resets || 0) + 1,
          reset_count_this_month: 1,
          month_year: this.getMonthYear(),
          reset_impact: {
            swipes_cleared: swipesClearedCount,
            profile_visibility_reset: true,
            impression_count_reset: true,
            timestamp: new Date().toISOString()
          }
        },
        { transaction }
      );

      // Update user stats
      await user.increment('total_profile_resets', { transaction });

      await transaction.commit();

      return {
        success: true,
        reset: {
          id: resetRecord.id,
          userId,
          resetType,
          swipesClearedCount,
          impressionReset: impressionsBefore,
          nextFreeReset,
          message: `Profile reset successfully! ${swipesClearedCount} swipes cleared. Your profile now appears fresh to new matches.`
        }
      };
    } catch (error) {
      await transaction.rollback();
      console.error('Error initiating profile reset:', error);
      return { success: false, message: 'Failed to reset profile' };
    }
  }

  /**
   * Get reset eligibility and status
   */
  async getResetStatus(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Check premium status
      const subscription = await Subscription.findOne({
        where: { user_id: userId, status: 'active' }
      });

      const isPremium = !!subscription;
      const thisMonth = this.getMonthYear();

      // Get this month's resets
      const thisMonthResets = await ProfileReset.count({
        where: {
          user_id: userId,
          month_year: thisMonth,
          reset_type: isPremium ? 'premium' : 'free'
        }
      });

      const freeResetsRemaining = isPremium
        ? null
        : Math.max(0, RESET_CONFIG.FREE_RESETS_PER_MONTH - thisMonthResets);

      // Get last reset
      const lastReset = await ProfileReset.findOne({
        where: { user_id: userId },
        order: [['created_at', 'DESC']]
      });

      const nextResetDate = isPremium
        ? new Date() // Premium can reset anytime
        : lastReset?.next_free_reset || new Date();

      const canResetNow = isPremium || (freeResetsRemaining || 0) > 0;

      return {
        success: true,
        status: {
          isPremium,
          canResetNow,
          resetsThisMonth: thisMonthResets,
          freeResetsRemaining,
          nextResetAvailable: nextResetDate,
          lastResetDate: lastReset?.created_at,
          totalResetsLifetime: user.total_profile_resets || 0,
          message: isPremium
            ? 'Premium members can reset unlimited times'
            : `You have ${freeResetsRemaining} free reset(s) remaining this month`
        }
      };
    } catch (error) {
      console.error('Error getting reset status:', error);
      return { success: false, message: 'Failed to fetch reset status' };
    }
  }

  /**
   * Get reset history
   */
  async getResetHistory(userId, limit = 10) {
    try {
      const resets = await ProfileReset.findAll({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
        limit,
        attributes: [
          'id',
          'reset_type',
          'swipes_cleared',
          'impressions_before',
          'impressions_after_reset',
          'reset_reason',
          'reset_impact',
          'created_at'
        ]
      });

      return {
        success: true,
        history: resets.map(reset => ({
          id: reset.id,
          date: reset.created_at,
          type: reset.reset_type,
          swipesCleared: reset.swipes_cleared,
          impressionsBefore: reset.impressions_before,
          impressionsAfter: reset.impressions_after_reset,
          reason: reset.reset_reason,
          impact: reset.reset_impact
        }))
      };
    } catch (error) {
      console.error('Error getting reset history:', error);
      return { success: false, message: 'Failed to fetch reset history' };
    }
  }

  /**
   * Get reset feature info
   */
  getResetFeatureInfo() {
    return {
      description: RESET_CONFIG.FEATURE_DESCRIPTION,
      freeLimit: RESET_CONFIG.FREE_RESETS_PER_MONTH,
      premiumLimit: 'Unlimited',
      whatItDoes: [
        'Clears your recent swipe history',
        'Resets impression count',
        'Makes your profile appear fresh to potential matches',
        'Preserves all existing matches and conversations'
      ],
      whatItDoesntDo: [
        'Delete your profile photos or bio',
        'Remove you from other users\' favorites',
        'Change your basic information'
      ],
      useCase: 'Feeling burnt out by your local dating scene? Reset to see new people and get another chance',
      cooldownMinutes: RESET_CONFIG.RESET_COOLDOWN_HOURS * 60,
      swipeHistoryReset: `Clears swipes from the last ${RESET_CONFIG.SWIPE_HISTORY_RESET_DAYS} days`
    };
  }

  /**
   * Get reset analytics
   */
  async getResetImpact(userId) {
    try {
      const lastReset = await ProfileReset.findOne({
        where: { user_id: userId },
        order: [['created_at', 'DESC']]
      });

      if (!lastReset) {
        return { success: true, hasReset: false };
      }

      // Calculate impressions gained since reset
      const profile = await DatingProfile.findOne({
        where: { user_id: userId }
      });

      const impressionsSinceReset = (profile?.impression_count || 0) - lastReset.impressions_before;

      // Get new matches since reset (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - RESET_CONFIG.ANALYTICS_WINDOW_DAYS);

      const newMatches = await sequelize.query(
        `SELECT COUNT(*) as count FROM matches 
         WHERE (user_id_1 = :userId OR user_id_2 = :userId)
         AND created_at >= :sevenDaysAgo`,
        {
          replacements: { userId, sevenDaysAgo },
          type: sequelize.QueryTypes.SELECT
        }
      );

      return {
        success: true,
        hasReset: true,
        impact: {
          resetDate: lastReset.created_at,
          daysSinceReset: Math.floor((new Date() - lastReset.created_at) / (1000 * 60 * 60 * 24)),
          impressionsBefore: lastReset.impressions_before,
          impressionsSinceReset,
          newMatchesSinceReset: newMatches[0]?.count || 0,
          isSuccessful: impressionsSinceReset > lastReset.impressions_before * 0.2,
          message: impressionsSinceReset > 0
            ? `Your profile reset is working! You've gotten ${impressionsSinceReset} new views since reset.`
            : 'Reset applied. Visibility will increase with profile interactions.'
        }
      };
    } catch (error) {
      console.error('Error getting reset impact:', error);
      return { success: false, message: 'Failed to get reset impact' };
    }
  }

  /**
   * Get month-year string (MM-YYYY)
   */
  getMonthYear() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${month}-${year}`;
  }

  /**
   * Get next month's first day
   */
  getNextMonthDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  /**
   * Check if user qualifies for premium reset feature
   */
  async canAccessPremiumReset(userId) {
    try {
      const subscription = await Subscription.findOne({
        where: { user_id: userId, status: 'active' }
      });

      return !!subscription;
    } catch (error) {
      console.error('Error checking premium access:', error);
      return false;
    }
  }

  /**
   * Record reset reason for analytics
   */
  async recordResetReason(resetId, reason) {
    try {
      await ProfileReset.update(
        { reset_reason: reason },
        { where: { id: resetId } }
      );

      return { success: true };
    } catch (error) {
      console.error('Error recording reset reason:', error);
      return { success: false };
    }
  }

  /**
   * Get reset statistics for dashboard
   */
  async getResetStats(userId) {
    try {
      const user = await User.findByPk(userId);
      const resets = await ProfileReset.findAll({
        where: { user_id: userId }
      });

      if (resets.length === 0) {
        return {
          success: true,
          stats: {
            totalResets: 0,
            message: 'No resets yet. Start fresh whenever you feel ready!'
          }
        };
      }

      // Calculate averages
      const totalSwipesCleared = resets.reduce((sum, r) => sum + (r.reset_impact?.swipes_cleared || 0), 0);
      const avgImpressionsBefore = Math.round(
        resets.reduce((sum, r) => sum + r.impressions_before, 0) / resets.length
      );

      // Get most recent reset impact
      const lastReset = resets[resets.length - 1];

      return {
        success: true,
        stats: {
          totalResets: resets.length,
          totalSwipesCleared,
          averageImpressionsBefore: avgImpressionsBefore,
          lastResetDate: lastReset.created_at,
          isPremium: user.is_premium || false,
          message: `You've reset your profile ${resets.length} time(s)`
        }
      };
    } catch (error) {
      console.error('Error getting reset stats:', error);
      return { success: false, message: 'Failed to get reset stats' };
    }
  }
}

module.exports = new ProfileResetService();
