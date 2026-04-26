module.exports = (sequelize, DataTypes) => {
  const VideoDate = sequelize.define('VideoDate', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
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
    sessionType: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'instant',
      field: 'session_type',
      validate: {
        isIn: [['instant', 'scheduled']]
      }
    },
    scheduledByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'scheduled_by_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'scheduled_at'
    },
    reminderMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15,
      field: 'reminder_minutes'
    },
    reminderSentUser1At: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reminder_sent_user_1_at'
    },
    reminderSentUser2At: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reminder_sent_user_2_at'
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'started_at'
    },
    answeredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'answered_at'
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'ended_at'
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'scheduled',
      validate: {
        isIn: [['scheduled', 'ringing', 'ongoing', 'completed', 'cancelled', 'declined', 'missed']]
      }
    },
    roomId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'room_id'
    },
    durationSeconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'duration_seconds'
    },
    user1JoinedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'user_1_joined_at'
    },
    user2JoinedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'user_2_joined_at'
    },
    user1LeftAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'user_1_left_at'
    },
    user2LeftAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'user_2_left_at'
    },
    noShowStatus: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pending',
      field: 'no_show_status'
    },
    endedReason: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'ended_reason'
    },
    callQualityPreset: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'balanced',
      field: 'call_quality_preset'
    },
    recordingRequested: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'recording_requested'
    },
    recordingRequestedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'recording_requested_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    recordingConsentedUser1: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'recording_consented_user_1'
    },
    recordingConsentedUser2: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'recording_consented_user_2'
    },
    recordingEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'recording_enabled'
    },
    screenShareEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'screen_share_enabled'
    },
    screenShareUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'screen_share_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    virtualBackgroundUser1: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'none',
      field: 'virtual_background_user_1'
    },
    virtualBackgroundUser2: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'none',
      field: 'virtual_background_user_2'
    },
    settingsSnapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: 'settings_snapshot'
    }
  }, {
    tableName: 'video_dates',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['match_id'] },
      { fields: ['user_id_1'] },
      { fields: ['user_id_2'] },
      { fields: ['status'] },
      { fields: ['scheduled_at'] },
      { fields: ['session_type'] }
    ]
  });

  VideoDate.associate = (models) => {
    VideoDate.belongsTo(models.Match, { foreignKey: 'match_id', as: 'match', onDelete: 'CASCADE' });
    VideoDate.belongsTo(models.User, { foreignKey: 'user_id_1', as: 'user1', onDelete: 'CASCADE' });
    VideoDate.belongsTo(models.User, { foreignKey: 'user_id_2', as: 'user2', onDelete: 'CASCADE' });
    VideoDate.belongsTo(models.User, { foreignKey: 'scheduled_by_user_id', as: 'scheduledBy', onDelete: 'SET NULL' });
  };

  return VideoDate;
};
