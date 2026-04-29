/**
 * Coupon Usage Model
 * Tracks when and which users have redeemed coupons
 */

module.exports = (sequelize, DataTypes) => {
  const CouponUsage = sequelize.define('CouponUsage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    couponId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'coupon_id',
      references: {
        model: 'coupons',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    likesGranted: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'likes_granted',
      comment: 'Likes credits granted from this redemption'
    },
    superlikesGranted: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'superlikes_granted',
      comment: 'Superlikes credits granted from this redemption'
    },
    redeemedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'redeemed_at',
      comment: 'When the coupon was redeemed'
    },
    ipAddress: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'ip_address',
      comment: 'IP address from which coupon was redeemed'
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent',
      comment: 'User agent from the redemption request'
    }
  }, {
    tableName: 'coupon_usages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['coupon_id'] },
      { fields: ['user_id'] },
      { fields: ['coupon_id', 'user_id'], unique: true },
      { fields: ['redeemed_at'] }
    ]
  });

  CouponUsage.associate = (models) => {
    CouponUsage.belongsTo(models.Coupon, { foreignKey: 'coupon_id', as: 'coupon' });
    CouponUsage.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return CouponUsage;
};
