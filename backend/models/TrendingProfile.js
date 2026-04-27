const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TrendingProfile = sequelize.define(
    'TrendingProfile',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      profile_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Profile being tracked'
      },
      snapshot_hour: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Start of hour UTC (YYYY-MM-DD HH:00:00)'
      },
      snapshot_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Date for daily trending'
      },
      likes_received: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Likes in this hour'
      },
      superlikes_received: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Superlikes in this hour'
      },
      profile_views: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Profile views in this hour'
      },
      matches_created: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'New matches in this hour'
      },
      engagement_score: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        comment: 'Weighted engagement: likes + superlikes*2 + views*0.1'
      },
      daily_rank: {
        type: DataTypes.INTEGER,
        comment: 'Position in today\'s leaderboard (1=hottest)'
      },
      hourly_rank: {
        type: DataTypes.INTEGER,
        comment: 'Position in last-hour leaderboard'
      },
      trend_momentum: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Hour-over-hour change in engagement'
      },
      is_premium: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Is this a premium user (for filtering)'
      },
      profile_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Is profile verified'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'trending_profiles',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['snapshot_date'] },
        { fields: ['snapshot_hour'] },
        { fields: ['profile_user_id', 'snapshot_date'] },
        { fields: ['daily_rank'] },
        { fields: ['engagement_score'] },
        { fields: ['snapshot_date', 'engagement_score'] }
      ]
    }
  );

  TrendingProfile.associate = (db) => {
    TrendingProfile.belongsTo(db.User, {
      foreignKey: 'profile_user_id',
      as: 'profile',
      onDelete: 'CASCADE'
    });
  };

  return TrendingProfile;
};
