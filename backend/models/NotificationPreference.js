/**
 * NotificationPreference Model
 * User's notification settings and preferences
 */

module.exports = (sequelize, DataTypes) => {
  const NotificationPreference = sequelize.define(
    'NotificationPreference',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      // Notification Type Preferences
      notify_new_likes: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Allow like notifications'
      },
      notify_new_matches: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Allow match notifications'
      },
      notify_messages: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Allow new message notifications'
      },
      notify_superlike: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Allow superlike notifications'
      },
      notify_milestones: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Allow achievement/milestone notifications'
      },
      notify_events: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Allow dating event notifications'
      },
      notify_reminders: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Allow reminder notifications'
      },

      // Frequency & Timing
      max_notifications_per_day: {
        type: DataTypes.INTEGER,
        defaultValue: 5,
        comment: 'Maximum notifications per day'
      },
      min_hours_between_notifications: {
        type: DataTypes.INTEGER,
        defaultValue: 6,
        comment: 'Minimum hours between notifications'
      },
      quiet_hours_start: {
        type: DataTypes.INTEGER, // 0-23
        defaultValue: 22,
        comment: 'Quiet hours start (hour of day)'
      },
      quiet_hours_end: {
        type: DataTypes.INTEGER, // 0-23
        defaultValue: 8,
        comment: 'Quiet hours end (hour of day)'
      },
      quiet_hours_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Enable quiet hours'
      },

      // Personalization
      include_compatibility_score: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Show compatibility % in notifications'
      },
      include_photo_preview: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Include photo in notification'
      },
      use_smart_timing: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Use ML-based optimal send time'
      },

      // Metadata
      last_notification_sent_at: {
        type: DataTypes.DATE,
        comment: 'Timestamp of last notification'
      },
      notification_count_today: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Count of notifications sent today'
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'notification_preferences',
      timestamps: true,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['notify_new_likes'] },
        { fields: ['notify_messages'] }
      ]
    }
  );

  return NotificationPreference;
};
