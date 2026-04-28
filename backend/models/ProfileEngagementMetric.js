module.exports = (sequelize, DataTypes) => {
  const ProfileEngagementMetric = sequelize.define('ProfileEngagementMetric', {
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
    metricDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'metric_date'
    },
    profileViews: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'profile_views'
    },
    likesReceived: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'likes_received'
    },
    superlikesReceived: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'superlikes_received'
    },
    messageRequestsReceived: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'message_requests_received'
    },
    matchesFormed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'matches_formed'
    },
    avgLikeReceivedPerView: {
      type: DataTypes.DECIMAL(5, 3),
      defaultValue: 0,
      field: 'avg_like_received_per_view'
    },
    engagementScore: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'engagement_score'
    }
  }, {
    tableName: 'profile_engagement_metrics',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'metric_date'], unique: true },
      { fields: ['user_id'] },
      { fields: ['metric_date'] }
    ]
  });

  ProfileEngagementMetric.associate = (models) => {
    ProfileEngagementMetric.belongsTo(models.User, { 
      foreignKey: 'user_id', 
      as: 'user', 
      onDelete: 'CASCADE' 
    });
  };

  return ProfileEngagementMetric;
};
