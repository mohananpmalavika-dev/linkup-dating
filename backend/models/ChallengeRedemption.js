/**
 * Challenge Redemption Model
 * Tracks when users redeem challenge points for premium features
 */

module.exports = (sequelize, DataTypes) => {
  const ChallengeRedemption = sequelize.define('ChallengeRedemption', {
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
    pointsRedeemed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'points_redeemed',
      comment: 'Number of points redeemed'
    },
    rewardType: {
      type: DataTypes.ENUM(
        'premium_week',
        'premium_month',
        'super_likes',
        'boost',
        'rewind',
        'spotlight',
        'custom'
      ),
      allowNull: false,
      field: 'reward_type',
      comment: 'Type of reward redeemed'
    },
    rewardValue: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'reward_value',
      comment: 'Value of reward (e.g., "1 week premium" or "10 super likes")'
    },
    status: {
      type: DataTypes.ENUM(
        'pending',
        'approved',
        'applied',
        'expired',
        'cancelled'
      ),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'Current status of redemption'
    },
    appliedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'applied_at',
      comment: 'When the reward was applied to user account'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
      comment: 'When the reward expires'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about this redemption'
    }
  }, {
    tableName: 'challenge_redemptions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id', 'created_at'] },
      { fields: ['status'] },
      { fields: ['reward_type'] }
    ]
  });

  ChallengeRedemption.associate = (models) => {
    ChallengeRedemption.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return ChallengeRedemption;
};
