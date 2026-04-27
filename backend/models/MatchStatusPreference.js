/**
 * MatchStatusPreference Model
 * Tracks status sharing preferences per match
 * Allows users to control what activity information they share with specific matches
 */

module.exports = (sequelize, DataTypes) => {
  const MatchStatusPreference = sequelize.define('MatchStatusPreference', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
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
    // Status visibility settings for this match
    showOnlineStatus: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'show_online_status',
      comment: 'Show if user is currently online'
    },
    showLastActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'show_last_active',
      comment: 'Show when user was last active (e.g., 2 minutes ago)'
    },
    showTypingIndicator: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'show_typing_indicator',
      comment: 'Show when user is typing'
    },
    showActivityStatus: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'show_activity_status',
      comment: 'Show current activity (viewing profile, video call, etc.)'
    },
    showReadReceipts: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'show_read_receipts',
      comment: 'Show when user has read messages'
    },
    shareDetailedStatus: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'share_detailed_status',
      comment: 'Share all detailed status info (online, activity, etc.)'
    },
    // Privacy level: 'full' | 'basic' | 'minimal' | 'hidden'
    privacyLevel: {
      type: DataTypes.ENUM('full', 'basic', 'minimal', 'hidden'),
      defaultValue: 'full',
      field: 'privacy_level',
      comment: 'full: all info, basic: online/offline only, minimal: last active only, hidden: no status'
    },
    // Custom settings
    lastModified: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'last_modified'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  }, {
    tableName: 'match_status_preferences',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id', 'match_id'], unique: true },
      { fields: ['user_id'] },
      { fields: ['match_id'] },
      { fields: ['privacy_level'] }
    ]
  });

  MatchStatusPreference.associate = (models) => {
    MatchStatusPreference.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE'
    });
    MatchStatusPreference.belongsTo(models.Match, {
      foreignKey: 'match_id',
      as: 'match',
      onDelete: 'CASCADE'
    });
  };

  // Method to apply privacy level settings
  MatchStatusPreference.applyPrivacyLevel = (privacyLevel) => {
    const presets = {
      'full': {
        showOnlineStatus: true,
        showLastActive: true,
        showTypingIndicator: true,
        showActivityStatus: true,
        showReadReceipts: true,
        shareDetailedStatus: true
      },
      'basic': {
        showOnlineStatus: true,
        showLastActive: false,
        showTypingIndicator: false,
        showActivityStatus: false,
        showReadReceipts: false,
        shareDetailedStatus: false
      },
      'minimal': {
        showOnlineStatus: false,
        showLastActive: true,
        showTypingIndicator: false,
        showActivityStatus: false,
        showReadReceipts: false,
        shareDetailedStatus: false
      },
      'hidden': {
        showOnlineStatus: false,
        showLastActive: false,
        showTypingIndicator: false,
        showActivityStatus: false,
        showReadReceipts: false,
        shareDetailedStatus: false
      }
    };
    
    return presets[privacyLevel] || presets['full'];
  };

  return MatchStatusPreference;
};
