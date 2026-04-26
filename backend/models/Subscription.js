module.exports = (sequelize, DataTypes) => {
  const Subscription = sequelize.define('Subscription', {
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
    plan: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['free', 'premium', 'gold']]
      },
      defaultValue: 'free'
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['active', 'cancelled', 'expired', 'trial']]
      },
      defaultValue: 'active'
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'started_at'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    },
    stripeCustomerId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'stripe_customer_id'
    },
    stripeSubscriptionId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'stripe_subscription_id'
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'payment_method'
    }
  }, {
    tableName: 'subscriptions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id'], unique: true },
      { fields: ['plan'] },
      { fields: ['status'] },
      { fields: ['expires_at'] }
    ]
  });

  Subscription.associate = (models) => {
    Subscription.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return Subscription;
};

