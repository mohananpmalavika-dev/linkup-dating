module.exports = (sequelize, DataTypes) => {
  const PhotoABTestResult = sequelize.define('PhotoABTestResult', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    testId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'test_id',
      references: {
        model: 'photo_ab_tests',
        key: 'id'
      }
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
    likerUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'liker_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    photoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'photo_id',
      references: {
        model: 'profile_photos',
        key: 'id'
      }
    },
    photoVersion: {
      type: DataTypes.ENUM('A', 'B'),
      allowNull: false,
      field: 'photo_version',
      comment: 'Which version of the test (A or B)'
    },
    eventType: {
      type: DataTypes.ENUM('like', 'view', 'pass'),
      allowNull: false,
      field: 'event_type',
      comment: 'Type of interaction'
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'timestamp',
      comment: 'When the interaction occurred'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    }
  }, {
    tableName: 'photo_ab_test_results',
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ['test_id'] },
      { fields: ['user_id'] },
      { fields: ['photo_version'] },
      { fields: ['event_type'] },
      { fields: ['test_id', 'photo_version'] },
      { fields: ['timestamp'] }
    ]
  });

  return PhotoABTestResult;
};
