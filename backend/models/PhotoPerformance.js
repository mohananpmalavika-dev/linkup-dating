const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PhotoPerformance = sequelize.define(
    'PhotoPerformance',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      photo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'profile_photos', key: 'id' },
        onDelete: 'CASCADE'
      },
      photo_position: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Position in profile (1-based index)'
      },
      profile_views: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Times this photo was viewed in a profile'
      },
      likes_received: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Likes from profiles where this was primary photo'
      },
      superlikes_received: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      right_swipe_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Percentage of viewers who liked/superliked'
      },
      left_swipe_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Percentage of viewers who passed'
      },
      engagement_score: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Calculated: (likes + superlikes*2) / views'
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: DataTypes.NOW
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'photo_performance',
      timestamps: false,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['user_id', 'created_at'] },
        { fields: ['engagement_score'] }
      ]
    }
  );

  PhotoPerformance.associate = (db) => {
    PhotoPerformance.belongsTo(db.User, { foreignKey: 'user_id' });
  };

  return PhotoPerformance;
};
