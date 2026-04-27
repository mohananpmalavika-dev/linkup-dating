module.exports = (sequelize, DataTypes) => {
  const UserRewardBalance = sequelize.define('UserRewardBalance', {
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
    boostCredits: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'boost_credits'
    },
    superlikeCredits: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'superlike_credits'
    },
    premiumDaysAwarded: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'premium_days_awarded'
    },
    lastRewardedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_rewarded_at'
    }
  }, {
    tableName: 'user_reward_balances',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id'], unique: true }
    ]
  });

  UserRewardBalance.associate = (models) => {
    UserRewardBalance.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return UserRewardBalance;
};
