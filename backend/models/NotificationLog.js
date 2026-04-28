/**
 * NotificationLog Model
 * Track all sent notifications for analytics and delivery verification
 */

module.exports = (sequelize, DataTypes) => {
  const NotificationLog = sequelize.define(
    'NotificationLog',
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
      // Notification Details
      notification_type: {
        type: DataTypes.ENUM(
          'new_like',
          'new_match',
          'new_message',
          'superlike',
          'achievement',
          'dating_event',
          'reminder',
          'milestone'
        ),
        allowNull: false,
        comment: 'Type of notification sent'
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Notification title'
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Notification message body'
      },
      related_user_id: {
        type: DataTypes.INTEGER,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: 'User who triggered notification (liker, matcher, messager)'
      },
      related_match_id: {
        type: DataTypes.INTEGER,
        comment: 'Related match ID if applicable'
      },
      related_entity_type: {
        type: DataTypes.STRING,
        comment: 'Type of related entity (match, message, achievement)'
      },
      related_entity_id: {
        type: DataTypes.INTEGER,
        comment: 'ID of related entity'
      },

      // Delivery & Engagement
      sent_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: 'When notification was sent'
      },
      delivered_at: {
        type: DataTypes.DATE,
        comment: 'When notification was delivered to device'
      },
      opened_at: {
        type: DataTypes.DATE,
        comment: 'When user opened notification'
      },
      clicked_action: {
        type: DataTypes.STRING,
        comment: 'Action user took (view_profile, open_chat, etc)'
      },
      delivery_channel: {
        type: DataTypes.ENUM('push', 'email', 'sms', 'in_app'),
        defaultValue: 'push',
        comment: 'Channel through which notification was sent'
      },
      delivery_status: {
        type: DataTypes.ENUM('pending', 'sent', 'delivered', 'failed', 'bounced'),
        defaultValue: 'pending',
        comment: 'Status of notification delivery'
      },

      // Personalization Data
      compatibility_score: {
        type: DataTypes.INTEGER,
        comment: 'Compatibility % if shown in notification'
      },
      personalization_used: {
        type: DataTypes.JSON,
        comment: 'JSON with personalization factors applied'
      },

      // Timing Data
      optimal_send_time: {
        type: DataTypes.DATE,
        comment: 'Optimal time calculated by ML model'
      },
      was_smart_timed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether smart timing was used'
      },
      was_batched: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Whether this was part of batched notifications'
      },
      batch_id: {
        type: DataTypes.STRING,
        comment: 'Batch ID if part of batch'
      },

      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'notification_logs',
      timestamps: false,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['notification_type'] },
        { fields: ['sent_at'] },
        { fields: ['opened_at'] },
        { fields: ['user_id', 'sent_at'] },
        { fields: ['delivery_status'] },
        { fields: ['was_batched'] }
      ]
    }
  );

  return NotificationLog;
};
