/**
 * Discovery Boost Points Model
 * Tracks discovery boost points earned by users through challenges
 */

module.exports = (sequelize, DataTypes) => {
  const DiscoveryBoostPoints = sequelize.define('DiscoveryBoostPoints', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    totalPoints: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'total_points',
      comment: 'Total points earned from all challenges'
    },
    pointsUsed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'points_used',
      comment: 'Points already redeemed for premium features'
    },
    availablePoints: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.totalPoints - this.pointsUsed;
      }
    },
    weeklyPoints: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'weekly_points',
      comment: 'Points earned this week'
    },
    lastWeekResetAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_week_reset_at',
      comment: 'Last time weekly points were reset'
    },
    monthlyStreak: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'monthly_streak',
      comment: 'Number of weeks with challenges completed'
    },
    lastChallengeDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'last_challenge_date',
      comment: 'Last date a challenge was completed'
    }
  }, {
    tableName: 'discovery_boost_points',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id'], unique: true },
      { fields: ['total_points'] }
    ]
  });

  DiscoveryBoostPoints.associate = (models) => {
    DiscoveryBoostPoints.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return DiscoveryBoostPoints;
};
