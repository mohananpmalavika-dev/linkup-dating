const { DataTypes } = require('sequelize');
const db = require('../config/sequelize');

const IcebreakerVideo = db.define('IcebreakerVideo', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  video_url: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'S3 or CDN URL to video file',
  },
  video_key: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'S3 object key for deletion/management',
  },
  duration_seconds: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5,
    },
    comment: 'Video duration in seconds (max 5)',
  },
  thumbnail_url: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Video thumbnail image URL',
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Video title (e.g., "Why I love hiking")',
  },
  prompt: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: "Why I'm looking for someone",
    comment: 'The prompt this video responds to',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Whether this is the user\'s active intro video',
  },
  view_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of times this video was viewed',
  },
  like_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of likes/positive reactions',
  },
  share_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of times shared',
  },
  average_rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 5,
    },
    comment: 'Average rating 0-5',
  },
  authenticity_score: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100,
    },
    comment: 'AI-calculated authenticity perception score',
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Featured on discovery/explore page',
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
  tableName: 'icebreaker_videos',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['is_active'] },
    { fields: ['is_featured'] },
    { fields: ['average_rating', 'created_at'] },
    { fields: ['authenticity_score'] },
    { fields: ['view_count'] },
  ],
});

module.exports = IcebreakerVideo;
