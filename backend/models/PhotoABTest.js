module.exports = (sequelize, DataTypes) => {
  const PhotoABTest = sequelize.define('PhotoABTest', {
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
    photoAId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'photo_a_id',
      references: {
        model: 'profile_photos',
        key: 'id'
      }
    },
    photoBId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'photo_b_id',
      references: {
        model: 'profile_photos',
        key: 'id'
      }
    },
    testName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'test_name'
    },
    status: {
      type: DataTypes.ENUM('active', 'paused', 'completed'),
      defaultValue: 'active',
      field: 'status',
      comment: 'Current status of the A/B test'
    },
    testDurationHours: {
      type: DataTypes.INTEGER,
      defaultValue: 48,
      field: 'test_duration_hours',
      comment: 'Duration of the test in hours'
    },
    likesA: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'likes_a',
      comment: 'Total likes for photo A'
    },
    likesB: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'likes_b',
      comment: 'Total likes for photo B'
    },
    viewsA: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'views_a',
      comment: 'Total profile views while photo A was active'
    },
    viewsB: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'views_b',
      comment: 'Total profile views while photo B was active'
    },
    engagementA: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      field: 'engagement_a',
      comment: 'Engagement rate for photo A (likes/views)'
    },
    engagementB: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      field: 'engagement_b',
      comment: 'Engagement rate for photo B (likes/views)'
    },
    winner: {
      type: DataTypes.ENUM('A', 'B', 'tie', null),
      defaultValue: null,
      field: 'winner',
      comment: 'Winning photo (A or B) based on performance'
    },
    winMargin: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      field: 'win_margin',
      comment: 'Percentage difference between winner and loser'
    },
    autoPromoted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'auto_promoted',
      comment: 'Whether the winner was automatically promoted to position 1'
    },
    promotedPhotoId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'promoted_photo_id',
      comment: 'ID of the photo that was promoted to position 1'
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'started_at',
      defaultValue: DataTypes.NOW
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at',
      comment: 'When the test was completed'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'notes',
      comment: 'User notes about the test'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    }
  }, {
    tableName: 'photo_ab_tests',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['winner'] },
      { fields: ['created_at'] },
      { fields: ['user_id', 'status'] }
    ]
  });

  return PhotoABTest;
};
