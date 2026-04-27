/**
 * Message Streak Tracker Model
 * Tracks consecutive messaging days between users for "heart streaks"
 * Shows when users have messaged 3+ days in a row
 */

module.exports = (sequelize, DataTypes) => {
  const MessageStreakTracker = sequelize.define('MessageStreakTracker', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    userId1: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id_1',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    userId2: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id_2',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    matchId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'match_id',
      references: {
        model: 'matches',
        key: 'id'
      }
    },
    // Current streak counter
    streakDays: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      field: 'streak_days',
      comment: 'Number of consecutive days with messages'
    },
    // Milestone tracking
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
      comment: 'Is the current streak active?'
    },
    // Dates
    streakStartDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'streak_start_date',
      defaultValue: DataTypes.NOW
    },
    lastMessageDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'last_message_date',
      defaultValue: DataTypes.NOW,
      comment: 'Date of last message between users'
    },
    streakBrokenDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'streak_broken_date',
      comment: 'When the streak ended'
    },
    // Milestone achievements
    milestone3Days: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'milestone_3_days',
      comment: 'Heart emoji shown at 3+ days'
    },
    milestone7Days: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'milestone_7_days',
      comment: 'Special recognition at 7 days'
    },
    milestone30Days: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'milestone_30_days',
      comment: 'Major milestone at 30 days'
    },
    // Engagement metrics
    totalMessages: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_messages',
      comment: 'Total messages during this streak'
    },
    totalReactions: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_reactions',
      comment: 'Total reactions during this streak'
    },
    // Psychology metrics for engagement tracking
    engagementScore: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      field: 'engagement_score',
      comment: 'Calculated engagement score for psychology boost'
    },
    // Notifications
    notificationSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'notification_sent',
      comment: 'Streak milestone notification sent'
    },
    lastNotificationDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_notification_date'
    }
  }, {
    tableName: 'message_streak_trackers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id_1', 'user_id_2'], unique: true },
      { fields: ['match_id'] },
      { fields: ['user_id_1'] },
      { fields: ['user_id_2'] },
      { fields: ['is_active'] },
      { fields: ['streak_days'] },
      { fields: ['last_message_date'] }
    ]
  });

  MessageStreakTracker.associate = (models) => {
    MessageStreakTracker.belongsTo(models.User, {
      foreignKey: 'user_id_1',
      as: 'user1',
      onDelete: 'CASCADE'
    });
    MessageStreakTracker.belongsTo(models.User, {
      foreignKey: 'user_id_2',
      as: 'user2',
      onDelete: 'CASCADE'
    });
    MessageStreakTracker.belongsTo(models.Match, {
      foreignKey: 'match_id',
      as: 'match',
      onDelete: 'CASCADE'
    });
  };

  // Helper methods
  MessageStreakTracker.prototype.getStreakEmoji = function() {
    if (!this.isActive || this.streakDays < 3) return null;
    
    if (this.streakDays >= 30) return '🔥'; // Fire for long streaks
    if (this.streakDays >= 7) return '❤️'; // Heart for week+
    return '❤️'; // Heart for 3+ days
  };

  MessageStreakTracker.prototype.getMilestoneText = function() {
    if (!this.isActive) return null;
    
    if (this.streakDays >= 30) return `${this.streakDays}🔥 Day Streak! 🎉`;
    if (this.streakDays >= 7) return `${this.streakDays}❤️ Day Streak!`;
    if (this.streakDays >= 3) return `${this.streakDays}❤️ Day Streak!`;
    return null;
  };

  return MessageStreakTracker;
};
