/**
 * IP Blocklist Model
 * Stores blocked IP addresses with expiration times
 */

module.exports = (sequelize, DataTypes) => {
  const IPBlocklist = sequelize.define('IPBlocklist', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: false,
      unique: true,
      field: 'ip_address',
      comment: 'IPv4 or IPv6 address'
    },
    reason: {
      type: DataTypes.ENUM('underage_attempt', 'suspicious_activity', 'manual_block'),
      defaultValue: 'underage_attempt',
      allowNull: false,
      comment: 'Reason for blocking'
    },
    blockDurationHours: {
      type: DataTypes.INTEGER,
      defaultValue: 2,
      allowNull: false,
      field: 'block_duration_hours',
      comment: 'How many hours to block this IP'
    },
    blockedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
      field: 'blocked_at',
      comment: 'When the IP was blocked'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
      comment: 'When the block expires'
    },
    attemptedEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'attempted_email',
      comment: 'Email that tried to signup with underage'
    },
    attemptedAge: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'attempted_age',
      comment: 'Age provided in failed attempt'
    },
    attemptCount: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
      field: 'attempt_count',
      comment: 'Number of failed attempts from this IP'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      field: 'is_active',
      comment: 'Whether this block is currently active'
    },
    removedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'removed_at',
      comment: 'When manually removed by admin'
    },
    removedByAdminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'removed_by_admin_id',
      comment: 'Admin who manually removed the block'
    }
  }, {
    tableName: 'ip_blocklist',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['ip_address'], unique: true },
      { fields: ['expires_at'] },
      { fields: ['is_active'] },
      { fields: ['reason'] }
    ]
  });

  return IPBlocklist;
};
