/**
 * Boost Service
 * Manages profile visibility boosts with smart scheduling and analytics
 */

const { sequelize } = require('../config/database');
const {
  User,
  ProfileBoost,
  DatingProfile,
  ProfileView,
  UserActivityPattern,
  Subscription
} = require('../models');
const { Op } = require('sequelize');

const BOOST_CONFIG = {
  STANDARD: {
    type: 'standard',
    multiplier: 3,
    duration: 60, // minutes
    price: 2.99
  },
  PREMIUM: {
    type: 'premium',
    multiplier: 5,
    duration: 120,
    price: 5.99
  },
  ULTIMATE: {
    type: 'ultimate',
    multiplier: 10,
    duration: 180,
    price: 8.99
  },
  BULK_DISCOUNTS: {
    3: 0.1,  // 10% off
    5: 0.15, // 15% off
    10: 0.25 // 25% off
  }
};

class BoostService {
  /**
   * Get boost packages with pricing
   */
  getBoostPackages() {
    return [
      {
        type: 'standard',
        name: '1 Hour Visibility Boost',
        description: 'Your profile appears 3x more in discovery',
        multiplier: 3,
        duration: 60,
        basePrice: 2.99,
        features: [
          '3x visibility multiplier',
          '1 hour duration',
          'Basic analytics',
          'Impressions & CTR tracking'
        ]
      },
      {
        type: 'premium',
        name: '2 Hour Premium Boost',
        description: 'Your profile appears 5x more - peak hours included',
        multiplier: 5,
        duration: 120,
        basePrice: 5.99,
        features: [
          '5x visibility multiplier',
          '2 hour duration',
          'Advanced analytics',
          'Impressions, CTR, likes & messages',
          'Smart scheduling included'
        ],
        badge: 'Most Popular'
      },
      {
        type: 'ultimate',
        name: '3 Hour Ultimate Boost',
        description: 'Maximum visibility - reach your perfect match',
        multiplier: 10,
        duration: 180,
        basePrice: 8.99,
        features: [
          '10x visibility multiplier',
          '3 hour duration',
          'Premium analytics & insights',
          'ROI calculation',
          'Smart scheduling with optimization',
          'Priority placement'
        ],
        badge: 'Best Value'
      }
    ];
  }

  /**
   * Get bulk pricing
   */
  getBulkPricing() {
    return [
      { quantity: 1, discount: 0, label: '1 Boost' },
      { quantity: 3, discount: 0.1, label: '3 Boosts - Save 10%' },
      { quantity: 5, discount: 0.15, label: '5 Boosts - Save 15%' },
      { quantity: 10, discount: 0.25, label: '10 Boosts - Save 25%' }
    ];
  }

  /**
   * Purchase a boost
   */
  async purchaseBoost(userId, boostType, smartSchedule = true, scheduledTime = null) {
    try {
      const transaction = await sequelize.transaction();

      try {
        // Validate boost type
        const config = BOOST_CONFIG[boostType.toUpperCase()];
        if (!config) {
          throw new Error('Invalid boost type');
        }

        // Check user profile exists
        const profile = await DatingProfile.findOne(
          { where: { userId } },
          { transaction }
        );

        if (!profile) {
          throw new Error('User profile not found');
        }

        // Calculate optimal start time if smart scheduling
        let startTime;
        if (smartSchedule) {
          startTime = await this.getOptimalBoostTime(userId, transaction);
        } else {
          startTime = scheduledTime || new Date();
        }

        const expireTime = new Date(startTime.getTime() + config.duration * 60000);

        // Create boost record
        const boost = await ProfileBoost.create(
          {
            user_id: userId,
            boost_type: config.type,
            visibility_multiplier: config.multiplier,
            duration_minutes: config.duration,
            price_paid: config.price,
            status: smartSchedule && startTime > new Date() ? 'scheduled' : 'scheduled',
            scheduled_start: startTime,
            expires_at: expireTime,
            smart_scheduling_enabled: smartSchedule,
            optimal_day_of_week: startTime.getDay(),
            optimal_hour: startTime.getHours()
          },
          { transaction }
        );

        await transaction.commit();

        return {
          success: true,
          boost: {
            id: boost.id,
            type: boost.boost_type,
            multiplier: boost.visibility_multiplier,
            duration: boost.duration_minutes,
            status: boost.status,
            scheduledStart: boost.scheduled_start,
            expiresAt: boost.expires_at,
            price: boost.price_paid,
            message: smartSchedule && startTime > new Date()
              ? `Boost scheduled for ${startTime.toLocaleString()} - optimal time for your audience!`
              : 'Boost activated immediately!'
          }
        };
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error purchasing boost:', error);
      return {
        success: false,
        message: error.message || 'Failed to purchase boost'
      };
    }
  }

  /**
   * Get optimal time to show boost (smart scheduling)
   */
  async getOptimalBoostTime(userId, transaction) {
    try {
      // Get user's target audience preferences
      const userPref = await DatingProfile.findOne(
        { where: { userId } },
        { transaction }
      );

      if (!userPref) {
        return new Date();
      }

      // Get activity patterns of target audience
      const targetGender = userPref.interested_in || 'all';
      const ageRange = {
        min: userPref.age_range_min || 18,
        max: userPref.age_range_max || 99
      };

      // Find when target audience is most active
      const activityData = await sequelize.query(
        `
        SELECT 
          EXTRACT(DOW FROM viewed_at) as day_of_week,
          EXTRACT(HOUR FROM viewed_at) as hour_of_day,
          COUNT(*) as activity_count
        FROM profile_views
        WHERE viewed_at > NOW() - INTERVAL '30 days'
        ORDER BY activity_count DESC
        LIMIT 1
        `,
        { transaction }
      );

      let bestDay = 5; // Friday
      let bestHour = 20; // 8 PM
      let bestTime = this.getNextOccurrence(bestDay, bestHour);

      if (activityData && activityData[0].length > 0) {
        const { day_of_week, hour_of_day } = activityData[0][0];
        bestDay = day_of_week;
        bestHour = hour_of_day;
        bestTime = this.getNextOccurrence(bestDay, bestHour);
      }

      return bestTime;
    } catch (error) {
      console.error('Error getting optimal boost time:', error);
      return new Date(); // Default to now
    }
  }

  /**
   * Get next occurrence of day + hour
   */
  getNextOccurrence(dayOfWeek, hour) {
    const now = new Date();
    const targetDate = new Date(now);

    // Set to target hour
    targetDate.setHours(hour, 0, 0, 0);

    // Find next occurrence of target day
    let daysAhead = dayOfWeek - targetDate.getDay();
    if (daysAhead <= 0) {
      daysAhead += 7;
    }

    // If it's past this hour today and same day, schedule for next week
    if (daysAhead === 0 && targetDate < now) {
      daysAhead = 7;
    }

    targetDate.setDate(targetDate.getDate() + daysAhead);
    return targetDate;
  }

  /**
   * Activate scheduled boosts that are due
   */
  async activateScheduledBoosts() {
    try {
      const now = new Date();

      const boosts = await ProfileBoost.update(
        {
          status: 'active',
          started_at: now
        },
        {
          where: {
            status: 'scheduled',
            scheduled_start: { [Op.lte]: now }
          }
        }
      );

      console.log(`Activated ${boosts[0]} boosts`);
      return boosts[0];
    } catch (error) {
      console.error('Error activating scheduled boosts:', error);
      return 0;
    }
  }

  /**
   * Complete expired boosts
   */
  async completeExpiredBoosts() {
    try {
      const now = new Date();

      const boosts = await ProfileBoost.update(
        { status: 'completed' },
        {
          where: {
            status: 'active',
            expires_at: { [Op.lte]: now }
          }
        }
      );

      console.log(`Completed ${boosts[0]} boosts`);
      return boosts[0];
    } catch (error) {
      console.error('Error completing expired boosts:', error);
      return 0;
    }
  }

  /**
   * Get user's active boosts
   */
  async getActiveBoosts(userId) {
    try {
      const now = new Date();

      const boosts = await ProfileBoost.findAll({
        where: {
          user_id: userId,
          status: 'active',
          expires_at: { [Op.gt]: now }
        },
        order: [['expires_at', 'ASC']]
      });

      return boosts.map((b) => this.formatBoost(b));
    } catch (error) {
      console.error('Error getting active boosts:', error);
      return [];
    }
  }

  /**
   * Get user's boost history
   */
  async getBoostHistory(userId, limit = 20) {
    try {
      const boosts = await ProfileBoost.findAll({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
        limit
      });

      return boosts.map((b) => this.formatBoost(b));
    } catch (error) {
      console.error('Error getting boost history:', error);
      return [];
    }
  }

  /**
   * Get boost analytics
   */
  async getBoostAnalytics(boostId, userId) {
    try {
      const boost = await ProfileBoost.findOne({
        where: {
          id: boostId,
          user_id: userId
        }
      });

      if (!boost) {
        return { success: false, message: 'Boost not found' };
      }

      // Calculate CTR
      const ctr = boost.impressions > 0
        ? ((boost.clicks / boost.impressions) * 100).toFixed(2)
        : 0;

      // Calculate ROI (likes + messages value vs cost)
      const engagementValue = (boost.likes_received * 0.5) + (boost.messages_received * 1);
      const roi = boost.price_paid > 0
        ? (((engagementValue - boost.price_paid) / boost.price_paid) * 100).toFixed(2)
        : 0;

      const analytics = {
        id: boost.id,
        type: boost.boost_type,
        status: boost.status,
        period: {
          start: boost.started_at,
          end: boost.expires_at,
          duration: boost.duration_minutes
        },
        impressions: boost.impressions,
        clicks: boost.clicks,
        ctr: parseFloat(ctr),
        likesReceived: boost.likes_received,
        messagesReceived: boost.messages_received,
        engagement: boost.likes_received + boost.messages_received,
        cost: boost.price_paid,
        roi: parseFloat(roi),
        costPerClick: boost.clicks > 0
          ? (boost.price_paid / boost.clicks).toFixed(2)
          : 'N/A',
        costPerEngagement: (boost.likes_received + boost.messages_received) > 0
          ? (boost.price_paid / (boost.likes_received + boost.messages_received)).toFixed(2)
          : 'N/A'
      };

      // Update stored analytics
      await ProfileBoost.update(
        { ctr: analytics.ctr, roi: analytics.roi },
        { where: { id: boostId } }
      );

      return { success: true, analytics };
    } catch (error) {
      console.error('Error getting boost analytics:', error);
      return { success: false, message: 'Failed to get analytics' };
    }
  }

  /**
   * Record impression during boost
   */
  async recordImpression(boostId) {
    try {
      await ProfileBoost.increment('impressions', {
        where: { id: boostId }
      });
      return true;
    } catch (error) {
      console.error('Error recording impression:', error);
      return false;
    }
  }

  /**
   * Record click during boost
   */
  async recordClick(boostId) {
    try {
      await ProfileBoost.increment('clicks', {
        where: { id: boostId }
      });
      return true;
    } catch (error) {
      console.error('Error recording click:', error);
      return false;
    }
  }

  /**
   * Record like during boost
   */
  async recordLike(boostId) {
    try {
      await ProfileBoost.increment('likes_received', {
        where: { id: boostId }
      });
      return true;
    } catch (error) {
      console.error('Error recording like:', error);
      return false;
    }
  }

  /**
   * Record message during boost
   */
  async recordMessage(boostId) {
    try {
      await ProfileBoost.increment('messages_received', {
        where: { id: boostId }
      });
      return true;
    } catch (error) {
      console.error('Error recording message:', error);
      return false;
    }
  }

  /**
   * Cancel a boost
   */
  async cancelBoost(boostId, userId) {
    try {
      const boost = await ProfileBoost.findOne({
        where: {
          id: boostId,
          user_id: userId
        }
      });

      if (!boost) {
        return { success: false, message: 'Boost not found' };
      }

      if (boost.status === 'completed') {
        return { success: false, message: 'Cannot cancel completed boost' };
      }

      // Calculate refund (pro-rata for active boosts)
      let refundAmount = 0;
      if (boost.status === 'active') {
        const now = new Date();
        const started = new Date(boost.started_at);
        const expires = new Date(boost.expires_at);
        const totalDuration = expires - started;
        const elapsedDuration = now - started;
        const remainingPercentage = Math.max(0, (totalDuration - elapsedDuration) / totalDuration);
        refundAmount = parseFloat((boost.price_paid * remainingPercentage).toFixed(2));
      }

      await ProfileBoost.update(
        {
          status: 'cancelled',
          cancelled_at: new Date()
        },
        { where: { id: boostId } }
      );

      return {
        success: true,
        message: 'Boost cancelled',
        refund: refundAmount,
        refundMessage: refundAmount > 0
          ? `You'll receive a refund of $${refundAmount.toFixed(2)}`
          : 'No refund available'
      };
    } catch (error) {
      console.error('Error cancelling boost:', error);
      return { success: false, message: 'Failed to cancel boost' };
    }
  }

  /**
   * Calculate boost discounted price
   */
  calculatePrice(boostType, quantity = 1) {
    const config = BOOST_CONFIG[boostType.toUpperCase()];
    if (!config) return null;

    let basePrice = config.price * quantity;
    const discount = BOOST_CONFIG.BULK_DISCOUNTS[quantity] || 0;
    const discountAmount = basePrice * discount;
    const finalPrice = basePrice - discountAmount;

    return {
      basePrice: parseFloat(basePrice.toFixed(2)),
      discount: parseFloat(discount * 100),
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      finalPrice: parseFloat(finalPrice.toFixed(2)),
      savings: parseFloat(discountAmount.toFixed(2))
    };
  }

  /**
   * Check if user can use boosts (premium subscriber)
   */
  async canUseBoosts(userId) {
    try {
      const subscription = await Subscription.findOne({
        where: { userId }
      });

      if (!subscription) return false;

      const isPremium = ['premium', 'gold', 'platinum'].includes(subscription.plan);
      const isActive = subscription.status === 'active';

      return isPremium && isActive;
    } catch (error) {
      console.error('Error checking boost eligibility:', error);
      return false;
    }
  }

  /**
   * Format boost for response
   */
  formatBoost(boost) {
    const now = new Date();
    const expires = new Date(boost.expires_at);
    const remaining = Math.max(0, Math.floor((expires - now) / 1000 / 60)); // minutes

    return {
      id: boost.id,
      type: boost.boost_type,
      multiplier: boost.visibility_multiplier,
      duration: boost.duration_minutes,
      status: boost.status,
      price: boost.price_paid,
      smartScheduling: boost.smart_scheduling_enabled,
      scheduledFor: boost.scheduled_start,
      startedAt: boost.started_at,
      expiresAt: boost.expires_at,
      remainingMinutes: remaining,
      impressions: boost.impressions,
      clicks: boost.clicks,
      ctr: boost.ctr,
      likesReceived: boost.likes_received,
      messagesReceived: boost.messages_received,
      roi: boost.roi,
      createdAt: boost.created_at
    };
  }
}

module.exports = new BoostService();
