/**
 * Preferences Priority Service
 * Manages premium subscription for top search placement with weekly rotation
 */

const { sequelize } = require('../config/database');
const {
  User,
  PreferencesPriority,
  DatingProfile,
  UserPreference,
  Subscription
} = require('../models');
const { Op } = require('sequelize');

const PRIORITY_CONFIG = {
  MONTHLY_PRICE: 9.99,
  WEEKLY_ROTATION_ENABLED: true,
  ROTATION_DAY: 0, // Monday
  ROTATION_HOUR: 0,
  MAX_ACTIVE_PER_WEEK: 10, // Number of profiles with priority each week
  RANKING_BOOST: 100.0, // Multiplier for search ranking
  LOYALTY_TIERS: {
    3: 0.05,   // 3 months: 5% discount
    6: 0.10,   // 6 months: 10% discount
    12: 0.20,  // 12 months: 20% discount
    24: 0.25   // 24+ months: 25% discount
  }
};

class PreferencesPriorityService {
  /**
   * Subscribe user to preferences priority
   */
  async subscribeToPriority(userId, autoRenew = true) {
    const transaction = await sequelize.transaction();

    try {
      // Check if user already has active subscription
      const existing = await PreferencesPriority.findOne(
        { where: { user_id: userId, status: 'active' } },
        { transaction }
      );

      if (existing) {
        await transaction.rollback();
        return { success: false, message: 'Already have active priority subscription' };
      }

      // Calculate billing cycle
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

      // Create subscription
      const subscription = await PreferencesPriority.create(
        {
          user_id: userId,
          status: 'active',
          price_per_month: PRIORITY_CONFIG.MONTHLY_PRICE,
          auto_renew: autoRenew,
          billing_cycle_start: now,
          billing_cycle_end: nextMonth,
          next_renewal: nextMonth,
          rotation_week_position: 0,
          weekly_rotation_enabled: PRIORITY_CONFIG.WEEKLY_ROTATION_ENABLED,
          current_week_active: false,
          priority_ranking_boost: PRIORITY_CONFIG.RANKING_BOOST
        },
        { transaction }
      );

      await transaction.commit();

      return {
        success: true,
        subscription: {
          id: subscription.id,
          userId,
          status: 'active',
          price: PRIORITY_CONFIG.MONTHLY_PRICE,
          billingStart: subscription.billing_cycle_start,
          billingEnd: subscription.billing_cycle_end,
          autoRenew,
          message: `Welcome to Preferences Priority! You're now in the rotation pool. Check back next week to see if you're selected for top placement.`
        }
      };
    } catch (error) {
      await transaction.rollback();
      console.error('Error subscribing to priority:', error);
      return { success: false, message: 'Failed to subscribe' };
    }
  }

  /**
   * Calculate weekly rotation - fairly distribute priority slots
   */
  async calculateWeeklyRotation() {
    try {
      const now = new Date();
      const weekStart = this.getWeekStart(now);

      // Get all active subscriptions
      const activeSubscriptions = await PreferencesPriority.findAll({
        where: {
          status: 'active',
          weekly_rotation_enabled: true
        },
        order: [
          ['total_months_active', 'DESC'], // Loyalty bias
          ['last_rotation_date', 'ASC'],    // Haven't appeared recently
          ['user_id', 'ASC']                 // Consistent tiebreaker
        ]
      });

      if (activeSubscriptions.length === 0) {
        return { success: true, message: 'No active subscriptions' };
      }

      // Reset all to inactive
      await PreferencesPriority.update(
        { current_week_active: false },
        { where: { weekly_rotation_enabled: true } }
      );

      // Select top profiles for this week
      const selectedCount = Math.min(
        PRIORITY_CONFIG.MAX_ACTIVE_PER_WEEK,
        activeSubscriptions.length
      );

      const selectedIds = [];
      for (let i = 0; i < selectedCount; i++) {
        selectedIds.push(activeSubscriptions[i].id);
      }

      // Update selected profiles
      if (selectedIds.length > 0) {
        await PreferencesPriority.update(
          {
            current_week_active: true,
            last_rotation_date: now,
            rotation_week_position: sequelize.literal(`rotation_week_position + 1`)
          },
          {
            where: { id: selectedIds }
          }
        );
      }

      return {
        success: true,
        message: `Rotation completed. ${selectedCount} profiles selected for priority placement.`,
        selectedCount,
        nextRotation: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
      };
    } catch (error) {
      console.error('Error calculating rotation:', error);
      return { success: false, message: 'Failed to calculate rotation' };
    }
  }

  /**
   * Get week start (Monday)
   */
  getWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  /**
   * Get priority status for user
   */
  async getPriorityStatus(userId) {
    try {
      const priority = await PreferencesPriority.findOne({
        where: { user_id: userId }
      });

      if (!priority) {
        return { success: true, hasSubscription: false };
      }

      const now = new Date();
      const isActive = priority.status === 'active' && priority.billing_cycle_end > now;
      const weekStart = this.getWeekStart();
      const nextWeekStart = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      return {
        success: true,
        hasSubscription: true,
        subscription: {
          id: priority.id,
          status: priority.status,
          isActive,
          currentWeekActive: priority.current_week_active,
          billingStart: priority.billing_cycle_start,
          billingEnd: priority.billing_cycle_end,
          nextRenewal: priority.next_renewal,
          autoRenew: priority.auto_renew,
          monthlyPrice: priority.price_per_month,
          loyaltyDiscount: priority.loyalty_discount_percent,
          effectivePrice: priority.price_per_month * (1 - priority.loyalty_discount_percent / 100),
          rotationPosition: priority.rotation_week_position,
          totalMonthsActive: priority.total_months_active,
          impressionsThisMonth: priority.impressions_this_month,
          matchesThisMonth: priority.matches_this_month,
          message: priority.current_week_active
            ? '🌟 Your profile has top placement this week!'
            : `📅 You\'re in the rotation pool. Next rotation: ${nextWeekStart.toLocaleDateString()}`
        }
      };
    } catch (error) {
      console.error('Error getting priority status:', error);
      return { success: false, message: 'Failed to fetch status' };
    }
  }

  /**
   * Renew subscription
   */
  async renewSubscription(userId) {
    try {
      const priority = await PreferencesPriority.findOne({
        where: { user_id: userId, status: 'active' }
      });

      if (!priority) {
        return { success: false, message: 'No active subscription to renew' };
      }

      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

      // Calculate loyalty discount
      const newMonthsActive = priority.total_months_active + 1;
      let discount = 0;
      Object.entries(PRIORITY_CONFIG.LOYALTY_TIERS).forEach(([months, discountRate]) => {
        if (newMonthsActive >= parseInt(months, 10)) {
          discount = Math.floor(discountRate * 100); // Convert to percentage
        }
      });

      await PreferencesPriority.update(
        {
          billing_cycle_start: now,
          billing_cycle_end: nextMonth,
          next_renewal: nextMonth,
          total_months_active: newMonthsActive,
          loyalty_discount_percent: discount,
          impressions_this_month: 0,
          matches_this_month: 0
        },
        { where: { id: priority.id } }
      );

      return {
        success: true,
        message: 'Subscription renewed',
        renewal: {
          monthlyPrice: priority.price_per_month,
          loyaltyDiscount: discount,
          effectivePrice: priority.price_per_month * (1 - discount / 100),
          billingStart: now,
          billingEnd: nextMonth,
          totalMonthsActive: newMonthsActive
        }
      };
    } catch (error) {
      console.error('Error renewing subscription:', error);
      return { success: false, message: 'Failed to renew' };
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId, reason = '') {
    try {
      const priority = await PreferencesPriority.findOne({
        where: { user_id: userId, status: 'active' }
      });

      if (!priority) {
        return { success: false, message: 'No active subscription' };
      }

      await PreferencesPriority.update(
        {
          status: 'cancelled',
          cancelled_at: new Date(),
          cancellation_reason: reason,
          current_week_active: false,
          auto_renew: false
        },
        { where: { id: priority.id } }
      );

      return {
        success: true,
        message: 'Subscription cancelled',
        totalSpent: priority.total_spent,
        monthsActive: priority.total_months_active
      };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return { success: false, message: 'Failed to cancel' };
    }
  }

  /**
   * Get search ranking multiplier for user (for discovery algorithm)
   */
  async getSearchRankingMultiplier(userId) {
    try {
      const priority = await PreferencesPriority.findOne({
        where: {
          user_id: userId,
          status: 'active',
          current_week_active: true,
          billing_cycle_end: { [Op.gt]: new Date() }
        }
      });

      // Return multiplier (100.0 = move to top, <100 = normal ranking)
      return priority ? priority.priority_ranking_boost : 1.0;
    } catch (error) {
      console.error('Error getting ranking multiplier:', error);
      return 1.0;
    }
  }

  /**
   * Record impression during priority week
   */
  async recordImpression(userId) {
    try {
      await PreferencesPriority.increment('impressions_this_month', {
        where: { user_id: userId, status: 'active' }
      });
      return true;
    } catch (error) {
      console.error('Error recording impression:', error);
      return false;
    }
  }

  /**
   * Record match during priority week
   */
  async recordMatch(userId) {
    try {
      await PreferencesPriority.increment('matches_this_month', {
        where: { user_id: userId, status: 'active' }
      });
      return true;
    } catch (error) {
      console.error('Error recording match:', error);
      return false;
    }
  }

  /**
   * Get subscription pricing
   */
  getSubscriptionInfo() {
    return {
      monthlyPrice: PRIORITY_CONFIG.MONTHLY_PRICE,
      billingCycle: 'monthly',
      autoRenewal: true,
      cancelAnytime: true,
      features: [
        'Top placement in filtered searches',
        'Weekly rotation for fairness',
        'Monthly analytics dashboard',
        'Loyalty discounts up to 25%',
        'Priority support'
      ],
      loyaltyTiers: [
        { months: 3, discount: 5, price: '$9.49/month' },
        { months: 6, discount: 10, price: '$8.99/month' },
        { months: 12, discount: 20, price: '$7.99/month' },
        { months: 24, discount: 25, price: '$7.49/month' }
      ]
    };
  }

  /**
   * Check if user can view priority features
   */
  async canAccessPriority(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) return false;

      // Check if premium subscription exists
      const subscription = await Subscription.findOne({
        where: { userId, status: 'active' }
      });

      return !!subscription;
    } catch (error) {
      console.error('Error checking priority access:', error);
      return false;
    }
  }

  /**
   * Get analytics for priority subscriber
   */
  async getAnalytics(userId) {
    try {
      const priority = await PreferencesPriority.findOne({
        where: { user_id: userId, status: 'active' }
      });

      if (!priority) {
        return { success: false, message: 'No active subscription' };
      }

      const now = new Date();
      const billingStart = new Date(priority.billing_cycle_start);
      const daysRemaining = Math.ceil((priority.billing_cycle_end - now) / (1000 * 60 * 60 * 24));
      const cycleProgress = ((now - billingStart) / (priority.billing_cycle_end - billingStart)) * 100;

      return {
        success: true,
        analytics: {
          billingCycle: {
            start: priority.billing_cycle_start,
            end: priority.billing_cycle_end,
            daysRemaining,
            cycleProgress: Math.round(cycleProgress)
          },
          currentWeek: {
            isActive: priority.current_week_active,
            rotationPosition: priority.rotation_week_position,
            message: priority.current_week_active
              ? 'Your profile has top placement this week!'
              : 'You\'re in the rotation pool for next week.'
          },
          thisMonth: {
            impressions: priority.impressions_this_month,
            matches: priority.matches_this_month,
            engagementRate: priority.impressions_this_month > 0
              ? ((priority.matches_this_month / priority.impressions_this_month) * 100).toFixed(2)
              : 0
          },
          lifetime: {
            totalMonthsActive: priority.total_months_active,
            totalSpent: priority.total_spent,
            loyaltyDiscount: priority.loyalty_discount_percent,
            effectivePrice: (priority.price_per_month * (1 - priority.loyalty_discount_percent / 100)).toFixed(2)
          }
        }
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      return { success: false, message: 'Failed to fetch analytics' };
    }
  }

  /**
   * Force renewal check (cron job)
   */
  async processRenewals() {
    try {
      const now = new Date();

      // Find subscriptions that need renewal
      const toRenew = await PreferencesPriority.findAll({
        where: {
          status: 'active',
          auto_renew: true,
          next_renewal: { [Op.lte]: now }
        }
      });

      let renewedCount = 0;
      for (const subscription of toRenew) {
        const result = await this.renewSubscription(subscription.user_id);
        if (result.success) renewedCount++;
      }

      return { success: true, renewedCount, total: toRenew.length };
    } catch (error) {
      console.error('Error processing renewals:', error);
      return { success: false, message: 'Failed to process renewals' };
    }
  }
}

module.exports = new PreferencesPriorityService();
