module.exports = (sequelize, DataTypes) => {
  const Referral = sequelize.define('Referral', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    referrerUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'referrer_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    referralCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      field: 'referral_code'
    },
    referralLink: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'referral_link'
    },
    referredUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'referred_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'expired'),
      defaultValue: 'pending',
      allowNull: false
    },
    reward: {
      type: DataTypes.JSONB,
      defaultValue: { type: 'premium_days', amount: 7 },
      allowNull: true,
      comment: 'Reward for successful referral (premium days, coins, etc.)'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at'
    }
  }, {
    tableName: 'referrals',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['referrer_user_id'] },
      { fields: ['referral_code'], unique: true },
      { fields: ['referred_user_id'] },
      { fields: ['status'] }
    ]
  });

  Referral.associate = (models) => {
    Referral.belongsTo(models.User, { foreignKey: 'referrer_user_id', as: 'referrer', onDelete: 'CASCADE' });
    Referral.belongsTo(models.User, { foreignKey: 'referred_user_id', as: 'referredUser', onDelete: 'SET NULL' });
  };

  return Referral;
};
