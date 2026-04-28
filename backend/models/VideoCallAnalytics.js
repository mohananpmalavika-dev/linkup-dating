const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VideoCallAnalytics = sequelize.define('VideoCallAnalytics', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
      comment: 'User whose analytics we are tracking',
    },
    total_calls: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total number of video calls',
    },
    total_duration_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total cumulative call duration in minutes',
    },
    average_call_duration_minutes: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      comment: 'Average call duration in minutes',
    },
    longest_call_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Longest call duration',
    },
    shortest_call_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Shortest completed call duration',
    },
    calls_this_month: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of calls this month',
    },
    calls_this_week: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of calls this week',
    },
    average_rating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0,
      validate: { min: 0, max: 5 },
      comment: 'Average rating received (1-5)',
    },
    total_ratings_received: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total number of ratings received',
    },
    five_star_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    four_star_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    three_star_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    two_star_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    one_star_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    conversion_to_date_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of video calls that led to real dates',
    },
    conversion_rate_percent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      comment: 'Percentage of calls that converted to dates',
    },
    average_chemistry_score: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0,
      comment: 'Average chemistry rating (1-5)',
    },
    average_communication_score: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0,
      comment: 'Average communication rating (1-5)',
    },
    would_date_again_percent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      comment: 'Percentage of people who would date again',
    },
    no_show_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of times user was no-show',
    },
    call_decline_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of calls they declined',
    },
    industry_comparison_percentile: {
      type: DataTypes.INTEGER,
      defaultValue: 50,
      comment: 'Percentile vs other users (0-100)',
    },
    last_call_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date of most recent video call',
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'video_call_analytics',
    timestamps: true,
    underscored: true,
  });

  VideoCallAnalytics.associate = (models) => {
    VideoCallAnalytics.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  // Note: Indexes are handled by migrations or database setup scripts

  return VideoCallAnalytics;
};
