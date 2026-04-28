/**
 * Leaderboard Model
 * Tracks user rankings by city, interest, and activity type
 * Updated monthly for "Most Active" per location/interest
 */

module.exports = (sequelize, DataTypes) => {
  const Leaderboard = sequelize.define('Leaderboard', {
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
    leaderboardType: {
      type: DataTypes.ENUM(
        'most_active_city',
        'most_active_interest',
        'best_conversation_starters',
        'highest_engagement',
        'best_first_impressions'
      ),
      allowNull: false,
      field: 'leaderboard_type',
      comment: 'Type of leaderboard'
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'City for location-based leaderboards'
    },
    interest: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Interest for interest-based leaderboards'
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Current rank (1 = top)'
    },
    score: {
      type: DataTypes.FLOAT,
      allowNull: false,
      comment: 'Score used for ranking (messages, engagements, etc)'
    },
    period: {
      type: DataTypes.ENUM('monthly', 'weekly', 'all_time'),
      defaultValue: 'monthly',
      comment: 'Time period for leaderboard'
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Month (1-12) for monthly rankings'
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Year for monthly rankings'
    },
    votesReceived: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'votes_received',
      comment: 'Votes for best conversation starters'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at'
    }
  }, {
    tableName: 'leaderboards',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        fields: ['leaderboard_type', 'period', 'month', 'year', 'rank'],
        name: 'leaderboard_ranking_idx'
      },
      {
        fields: ['user_id', 'leaderboard_type'],
        name: 'user_leaderboard_idx'
      },
      {
        fields: ['city', 'leaderboard_type'],
        name: 'city_leaderboard_idx'
      },
      {
        fields: ['interest', 'leaderboard_type'],
        name: 'interest_leaderboard_idx'
      }
    ]
  });

  Leaderboard.associate = (models) => {
    Leaderboard.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return Leaderboard;
};
