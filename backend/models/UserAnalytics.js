module.exports = (sequelize, DataTypes) => {
  const UserAnalytics = sequelize.define('UserAnalytics', {
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
    activityDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'activity_date'
    },
    sessionCount: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      field: 'session_count'
    },
    messagesSent: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'messages_sent'
    },
    profilesViewed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'profiles_viewed'
    },
    likesSent: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'likes_sent'
    },
    matchesMade: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'matches_made'
    },
    videoCallDurationSeconds: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'video_call_duration_seconds'
    },
    lastActive: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_active'
    }
  }, {
    tableName: 'user_analytics',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'activity_date'], unique: true },
      { fields: ['user_id'] },
      { fields: ['activity_date'] }
    ]
  });

  UserAnalytics.associate = (models) => {
    UserAnalytics.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return UserAnalytics;
};
