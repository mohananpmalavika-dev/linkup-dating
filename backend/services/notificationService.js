/**
 * Notification Service
 * Smart notification sending with optimal timing, batching, and personalization
 */

const { NotificationPreference, NotificationLog, UserActivityPattern, User, Match } = require('../models');
const { Op } = require('sequelize');

class NotificationService {
  /**
   * Check if should send notification to user
   * Validates preferences, quiet hours, frequency limits
   */
  static async shouldSendNotification(userId, notificationType) {
    try {
      const prefs = await NotificationPreference.findOne({ where: { user_id: userId } });
      if (!prefs) return { canSend: true, reason: 'no_preference' };

      // Check notification type preference
      const typeKey = `notify_${notificationType}`;
      if (!prefs[typeKey]) {
        return { canSend: false, reason: 'disabled_type' };
      }

      // Check quiet hours
      if (prefs.quiet_hours_enabled) {
        const now = new Date();
        const currentHour = now.getHours();
        const isInQuietHours =
          prefs.quiet_hours_start > prefs.quiet_hours_end
            ? currentHour >= prefs.quiet_hours_start || currentHour < prefs.quiet_hours_end
            : currentHour >= prefs.quiet_hours_start && currentHour < prefs.quiet_hours_end;

        if (isInQuietHours) {
          return { canSend: false, reason: 'quiet_hours' };
        }
      }

      // Check frequency limits
      const recentNotifications = await NotificationLog.count({
        where: {
          user_id: userId,
          sent_at: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      if (recentNotifications >= prefs.max_notifications_per_day) {
        return { canSend: false, reason: 'daily_limit' };
      }

      // Check minimum hours between notifications
      const lastNotification = await NotificationLog.findOne({
        where: { user_id: userId },
        order: [['sent_at', 'DESC']],
        limit: 1
      });

      if (lastNotification) {
        const hoursSinceLastNotification =
          (Date.now() - lastNotification.sent_at) / (1000 * 60 * 60);
        if (hoursSinceLastNotification < prefs.min_hours_between_notifications) {
          return { canSend: false, reason: 'frequency_limit' };
        }
      }

      return { canSend: true, reason: 'ok' };
    } catch (error) {
      console.error('Error checking notification eligibility:', error);
      return { canSend: false, reason: 'error' };
    }
  }

  /**
   * Calculate optimal send time for user
   * Uses activity patterns to find best engagement time
   */
  static async calculateOptimalSendTime(userId) {
    try {
      const pattern = await UserActivityPattern.findOne({ where: { user_id: userId } });
      if (!pattern || !pattern.best_hours || pattern.best_hours.length === 0) {
        // Default to evening hours if no data
        const now = new Date();
        const optimalHour = 19; // 7 PM default
        now.setHours(optimalHour, 0, 0, 0);
        if (now < new Date()) {
          now.setDate(now.getDate() + 1); // Next day if time passed
        }
        return now;
      }

      // Get best hour from pattern
      const bestHour = pattern.best_hours[0];
      const optimalTime = new Date();
      optimalTime.setHours(bestHour, Math.floor(Math.random() * 60), 0, 0);

      if (optimalTime < new Date()) {
        optimalTime.setDate(optimalTime.getDate() + 1);
      }

      return optimalTime;
    } catch (error) {
      console.error('Error calculating optimal send time:', error);
      return new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    }
  }

  /**
   * Personalize notification message
   * Adds compatibility score, name, etc based on preferences
   */
  static async personalizeNotification(userId, baseMessage, data = {}) {
    try {
      const prefs = await NotificationPreference.findOne({ where: { user_id: userId } });

      let personalizedMessage = baseMessage;
      const personalization = {};

      if (prefs.include_compatibility_score && data.compatibilityScore) {
        personalizedMessage = personalizedMessage.replace(
          '{COMPATIBILITY}',
          ` (${data.compatibilityScore}% compatible)`
        );
        personalization.compatibility_shown = true;
      } else {
        personalizedMessage = personalizedMessage.replace(' {COMPATIBILITY}', '');
      }

      if (data.firstName) {
        personalizedMessage = personalizedMessage.replace('{NAME}', data.firstName);
        personalization.name_shown = true;
      }

      return {
        message: personalizedMessage,
        personalization
      };
    } catch (error) {
      console.error('Error personalizing notification:', error);
      return { message: baseMessage, personalization: {} };
    }
  }

  /**
   * Send notification with all smart features
   */
  static async sendSmartNotification(userId, notificationData) {
    try {
      const {
        type, // 'new_like', 'new_match', 'new_message', etc
        title,
        baseMessage,
        relatedUserId,
        relatedMatchId,
        relatedEntityType,
        relatedEntityId,
        compatibilityScore,
        useOptimalTiming = true
      } = notificationData;

      // Check if should send
      const eligibility = await this.shouldSendNotification(userId, type);
      if (!eligibility.canSend) {
        console.log(`Notification not sent to ${userId}: ${eligibility.reason}`);
        return { sent: false, reason: eligibility.reason };
      }

      // Get user preferences
      const prefs = await NotificationPreference.findOne({ where: { user_id: userId } });

      // Personalize message
      const relatedUser = relatedUserId
        ? await User.findByPk(relatedUserId, { attributes: ['id', 'first_name'] })
        : null;

      const { message, personalization } = await this.personalizeNotification(
        userId,
        baseMessage,
        {
          firstName: relatedUser?.first_name,
          compatibilityScore
        }
      );

      // Determine send time
      let sendTime = new Date();
      if (useOptimalTiming && prefs.use_smart_timing) {
        sendTime = await this.calculateOptimalSendTime(userId);
      }

      // Log notification
      const notification = await NotificationLog.create({
        user_id: userId,
        notification_type: type,
        title,
        message,
        related_user_id: relatedUserId,
        related_match_id: relatedMatchId,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        compatibility_score: compatibilityScore,
        personalization_used: personalization,
        optimal_send_time: sendTime,
        was_smart_timed: useOptimalTiming && prefs.use_smart_timing,
        delivery_status: 'pending'
      });

      // If immediate send, mark as sent
      if (sendTime <= new Date()) {
        notification.delivery_status = 'sent';
        notification.sent_at = new Date();
        await notification.save();

        // Emit socket event for real-time notification
        // This will be handled by Socket.io in the main server
      }

      return {
        sent: true,
        notificationId: notification.id,
        sendTime,
        personalized: Object.keys(personalization).length > 0
      };
    } catch (error) {
      console.error('Error sending smart notification:', error);
      return { sent: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Record notification open event
   */
  static async recordNotificationOpened(notificationId, action = null) {
    try {
      const notification = await NotificationLog.findByPk(notificationId);
      if (!notification) return false;

      notification.opened_at = new Date();
      notification.clicked_action = action;
      notification.delivery_status = 'delivered';
      await notification.save();

      // Update user activity pattern
      const now = new Date();
      const hour = now.getHours();
      await this.updateActivityPattern(notification.user_id, hour, true);

      return true;
    } catch (error) {
      console.error('Error recording notification open:', error);
      return false;
    }
  }

  /**
   * Update user's activity pattern based on new data point
   */
  static async updateActivityPattern(userId, hour, wasOpened) {
    try {
      let pattern = await UserActivityPattern.findOne({ where: { user_id: userId } });

      if (!pattern) {
        pattern = await UserActivityPattern.create({ user_id: userId });
      }

      const activityKey = `hour_${hour}_activity`;
      const openRateKey = `hour_${hour}_open_rate`;

      // Update activity count
      pattern[activityKey] = (pattern[activityKey] || 0) + 1;

      // Update open rate (simple moving average)
      const oldOpenRate = pattern[openRateKey] || 0;
      const newOpenRate = (oldOpenRate * pattern.data_points + (wasOpened ? 1 : 0)) / (pattern.data_points + 1);
      pattern[openRateKey] = newOpenRate;

      // Update metadata
      pattern.data_points = (pattern.data_points || 0) + 1;
      pattern.total_notifications_sent = (pattern.total_notifications_sent || 0) + 1;
      if (wasOpened) {
        pattern.total_notifications_opened = (pattern.total_notifications_opened || 0) + 1;
      }

      // Recalculate average
      pattern.average_open_rate =
        pattern.total_notifications_opened / Math.max(pattern.total_notifications_sent, 1);

      // Recalculate best/worst hours
      const hours = [];
      for (let h = 0; h < 24; h++) {
        hours.push({
          hour: h,
          openRate: pattern[`hour_${h}_open_rate`] || 0
        });
      }
      hours.sort((a, b) => b.openRate - a.openRate);
      pattern.best_hours = hours.slice(0, 3).map((h) => h.hour);
      pattern.worst_hours = hours.slice(-3).map((h) => h.hour);

      pattern.last_updated = new Date();
      await pattern.save();
    } catch (error) {
      console.error('Error updating activity pattern:', error);
    }
  }

  /**
   * Get user's notification preferences
   */
  static async getPreferences(userId) {
    try {
      let prefs = await NotificationPreference.findOne({ where: { user_id: userId } });

      if (!prefs) {
        prefs = await NotificationPreference.create({ user_id: userId });
      }

      return prefs;
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      return null;
    }
  }

  /**
   * Update user's notification preferences
   */
  static async updatePreferences(userId, updates) {
    try {
      let prefs = await NotificationPreference.findOne({ where: { user_id: userId } });

      if (!prefs) {
        prefs = await NotificationPreference.create({ user_id: userId });
      }

      await prefs.update(updates);
      return prefs;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      return null;
    }
  }

  /**
   * Get notification statistics for user
   */
  static async getNotificationStats(userId, days = 30) {
    try {
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const stats = await NotificationLog.findAll({
        attributes: [
          'notification_type',
          [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'sent_count'],
          [
            this.sequelize.fn('COUNT', this.sequelize.where(
              this.sequelize.col('opened_at'),
              this.sequelize.Op.not,
              null
            )),
            'opened_count'
          ]
        ],
        where: {
          user_id: userId,
          sent_at: { [Op.gte]: sinceDate }
        },
        group: ['notification_type'],
        raw: true
      });

      const pattern = await UserActivityPattern.findOne({ where: { user_id: userId } });

      return {
        stats,
        bestHours: pattern?.best_hours || [],
        averageOpenRate: pattern?.average_open_rate || 0,
        totalSent: await NotificationLog.count({
          where: { user_id: userId, sent_at: { [Op.gte]: sinceDate } }
        }),
        totalOpened: await NotificationLog.count({
          where: {
            user_id: userId,
            sent_at: { [Op.gte]: sinceDate },
            opened_at: { [Op.not]: null }
          }
        })
      };
    } catch (error) {
      console.error('Error getting notification statistics:', error);
      return null;
    }
  }
}

module.exports = NotificationService;
