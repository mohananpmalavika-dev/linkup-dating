const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VideoCompatibilityScore = sequelize.define('VideoCompatibilityScore', {
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
    user_id_1: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
      comment: 'First user in the call',
    },
    user_id_2: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
      comment: 'Second user in the call',
    },
    overall_compatibility_score: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: { min: 0, max: 100 },
      comment: 'Overall compatibility prediction (0-100)',
    },
    will_date_probability_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      comment: 'Predicted probability they will date (0-100)',
    },
    chemistry_score: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      comment: 'Chemistry indicator score (0-100)',
    },
    communication_compatibility: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      comment: 'How well they communicated (0-100)',
    },
    personality_alignment: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      comment: 'Personality alignment score (0-100)',
    },
    attraction_match: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      comment: 'Mutual attraction indicator (0-100)',
    },
    conversation_flow_score: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      comment: 'How naturally conversation flowed (0-100)',
    },
    engagement_level: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      comment: 'Overall engagement during call (0-100)',
    },
    user1_engagement: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      comment: 'User 1 engagement level (0-100)',
    },
    user2_engagement: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      comment: 'User 2 engagement level (0-100)',
    },
    smile_frequency_user1: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      comment: 'Approximate smile frequency user 1 (%)',
    },
    smile_frequency_user2: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      comment: 'Approximate smile frequency user 2 (%)',
    },
    eye_contact_quality: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      comment: 'Quality of eye contact (0-100)',
    },
    compatibility_category: {
      type: DataTypes.ENUM('unlikely', 'possible', 'likely', 'very_likely', 'perfect_match'),
      defaultValue: 'possible',
      comment: 'Categorical compatibility prediction',
    },
    recommendation: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'AI recommendation text',
    },
    confidence_level: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      validate: { min: 0, max: 100 },
      comment: 'Confidence in the prediction (0-100)',
    },
    actual_date_occurred: {
      type: DataTypes.BOOLEAN,
      defaultValue: null,
      comment: 'Did they actually go on a date?',
    },
    prediction_accuracy: {
      type: DataTypes.BOOLEAN,
      defaultValue: null,
      comment: 'Was the prediction accurate? (null if not yet determined)',
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
    tableName: 'video_compatibility_scores',
    timestamps: true,
    underscored: true,
  });

  VideoCompatibilityScore.associate = (models) => {
    VideoCompatibilityScore.belongsTo(models.VideoDate, {
      foreignKey: 'video_date_id',
      as: 'videoCall',
    });
    VideoCompatibilityScore.belongsTo(models.User, {
      foreignKey: 'user_id_1',
      as: 'user1',
    });
    VideoCompatibilityScore.belongsTo(models.User, {
      foreignKey: 'user_id_2',
      as: 'user2',
    });
  };

  // Indexes
  // Note: Syncing is handled by utils/syncModels.js in controlled order
  // VideoCompatibilityScore.sync({ alter: false }).then(() => {
  //   sequelize.query(`
  //     CREATE INDEX IF NOT EXISTS idx_video_compat_video_date 
  //     ON video_compatibility_scores(video_date_id);
      
      CREATE INDEX IF NOT EXISTS idx_video_compatibility_users 
      ON video_compatibility_scores(user_id_1, user_id_2);
      
      CREATE INDEX IF NOT EXISTS idx_video_compatibility_score 
      ON video_compatibility_scores(overall_compatibility_score DESC);
      
      CREATE INDEX IF NOT EXISTS idx_video_compatibility_probability 
      ON video_compatibility_scores(will_date_probability_percent DESC);
    `).catch(() => {});
  });

  return VideoCompatibilityScore;
};
