const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VideoCallRating = sequelize.define('VideoCallRating', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    video_date_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'VideoDates', key: 'id' },
      comment: 'Reference to the video call',
    },
    rater_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
      comment: 'User who rated the call',
    },
    rated_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
      comment: 'User being rated',
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 },
      comment: 'Rating from 1-5 stars',
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Optional comment about the call',
    },
    would_date_again: {
      type: DataTypes.BOOLEAN,
      defaultValue: null,
      comment: 'Would they want to date again?',
    },
    communication_quality: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 },
      comment: 'How well did they communicate (1-5)',
    },
    chemistry_level: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 },
      comment: 'Chemistry/connection level (1-5)',
    },
    appearance_match: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 },
      comment: 'How well appearance matched profile (1-5)',
    },
    personality_match: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 },
      comment: 'How well personality matched expectations (1-5)',
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
    tableName: 'video_call_ratings',
    timestamps: true,
    underscored: true,
  });

  VideoCallRating.associate = (models) => {
    VideoCallRating.belongsTo(models.VideoDate, {
      foreignKey: 'video_date_id',
      as: 'videoCall',
    });
    VideoCallRating.belongsTo(models.User, {
      foreignKey: 'rater_user_id',
      as: 'rater',
    });
    VideoCallRating.belongsTo(models.User, {
      foreignKey: 'rated_user_id',
      as: 'ratedUser',
    });
  };

  // Note: Indexes are handled by migrations or database setup scripts

  return VideoCallRating;
};
