/**
 * Referral Reward Model
 * Tracks rewards given to users from referrals
 */

module.exports = (sequelize, DataTypes) => {
  const ReferralReward = sequelize.define('ReferralReward', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    referralId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'referral_id',
      references: {
        model: 'referrals',
        key: 'id'
      },
      comment: 'Associated referral'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'User receiving the reward'
    },
    rewardType: {
      type: DataTypes.ENUM('premium_days', 'superlikes'),
      allowNull: false,
      field: 'reward_type',
      comment: 'Type of reward'
    },
    rewardAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'reward_amount',
      comment: 'Amount (days or count)'
    },
    rewardDescription: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'reward_description',
      comment: 'Human-readable description'
    },
    claimedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'claimed_at',
      comment: 'When user claimed the reward'
    },
    appliedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'applied_at',
      comment: 'When reward was applied to account'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
      comment: 'When reward expires (if applicable)'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at'
    }
  }, {
    tableName: 'referral_rewards',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['referral_id'] },
      { fields: ['user_id'] },
      { fields: ['reward_type'] }
    ]
  });

  ReferralReward.associate = (models) => {
    ReferralReward.belongsTo(models.Referral, {
      foreignKey: 'referral_id',
      as: 'referral',
      onDelete: 'CASCADE'
    });
    ReferralReward.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE'
    });
  };

  return ReferralReward;
};
