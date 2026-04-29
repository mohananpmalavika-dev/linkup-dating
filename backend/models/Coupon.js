/**
 * Coupon Model
 * Stores discount/credit coupons created by admins for users
 */

module.exports = (sequelize, DataTypes) => {
  const Coupon = sequelize.define('Coupon', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: 'code',
      comment: 'Unique coupon code (uppercase alphanumeric)'
    },
    couponType: {
      type: DataTypes.ENUM('likes', 'superlikes', 'both'),
      allowNull: false,
      field: 'coupon_type',
      comment: 'Type of credit this coupon provides'
    },
    likesValue: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'likes_value',
      comment: 'Number of likes credits to grant'
    },
    superlikesValue: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'superlikes_value',
      comment: 'Number of superlikes credits to grant'
    },
    maxRedemptions: {
      type: DataTypes.INTEGER,
      defaultValue: null,
      allowNull: true,
      field: 'max_redemptions',
      comment: 'Total number of times this coupon can be redeemed (null = unlimited)'
    },
    currentRedemptions: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'current_redemptions',
      comment: 'Number of times this coupon has been redeemed'
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expiry_date',
      comment: 'When this coupon expires (null = never expires)'
    },
    startDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'start_date',
      comment: 'When this coupon becomes active'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
      comment: 'Whether this coupon can be redeemed'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Admin notes about the coupon'
    },
    createdByAdminId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'created_by_admin_id',
      comment: 'Admin who created this coupon'
    },
    minUserLevel: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'min_user_level',
      comment: 'Minimum user level required to use coupon'
    },
    targetUserIds: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'target_user_ids',
      comment: 'Comma-separated list of user IDs who can use this (null = everyone)'
    }
  }, {
    tableName: 'coupons',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['code'], unique: true },
      { fields: ['is_active'] },
      { fields: ['expiry_date'] },
      { fields: ['created_at'] }
    ]
  });

  Coupon.associate = (models) => {
    Coupon.hasMany(models.CouponUsage, { foreignKey: 'coupon_id', as: 'usages' });
  };

  return Coupon;
};
