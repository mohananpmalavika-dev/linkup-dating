const { DataTypes } = require('sequelize');
const db = require('../config/sequelize');

const IcebreakerVideoRating = db.define('IcebreakerVideoRating', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  video_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'IcebreakerVideos',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  viewer_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5,
    },
    comment: '1-5 star rating',
  },
  authenticity_rating: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 5,
    },
    comment: 'How authentic did this person seem? (1=fake, 5=very authentic)',
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Optional comment on the video',
  },
  reaction: {
    type: DataTypes.ENUM('like', 'love', 'funny', 'wow', 'inspiring'),
    allowNull: true,
    comment: 'Quick reaction type',
  },
  is_helpful: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Was this video helpful in understanding the person?',
  },
  would_match: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Would they be more likely to match after seeing this?',
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'icebreaker_video_ratings',
  timestamps: false,
  underscored: true,
  indexes: [
    { fields: ['video_id'] },
    { fields: ['viewer_user_id'] },
    { fields: ['rating'] },
    { fields: ['authenticity_rating'] },
    { unique: true, fields: ['video_id', 'viewer_user_id'] }, // One rating per user per video
  ],
});

module.exports = IcebreakerVideoRating;
