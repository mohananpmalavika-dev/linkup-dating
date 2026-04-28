/**
 * Account Creation Limit Model
 * Tracks account creation attempts per IP address
 * Prevents spam accounts from same IP/device
 */

module.exports = (sequelize, DataTypes) => {
  const AccountCreationLimit = sequelize.define('AccountCreationLimit', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      index: true,
      comment: 'IP address creating multiple accounts'
    },
    accountCount: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
      comment: 'Number of accounts created from this IP'
    },
    accountIds: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of user IDs created from this IP (first 50)'
    },
    lastAccountCreatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'Timestamp of last account created from this IP'
    },
    isBlocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      index: true,
      comment: 'true = IP blocked from creating more accounts'
    },
    blockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the IP was blocked'
    },
    blockExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      index: true,
      comment: 'When the account creation block expires'
    },
    blockDurationHours: {
      type: DataTypes.INTEGER,
      defaultValue: 24,
      comment: 'Duration of block in hours'
    },
    blockedByAdminId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Admin ID if blocked manually'
    },
    blockReason: {
      type: DataTypes.STRING,
      defaultValue: 'account_spam',
      comment: 'Reason for block: account_spam, manual_block, etc.'
    },
    removedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When admin unblocked the IP'
    },
    removedByAdminId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Admin ID who unblocked'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Admin notes about this IP'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'account_creation_limits',
    timestamps: true,
    indexes: [
      { fields: ['ipAddress'] },
      { fields: ['isBlocked'] },
      { fields: ['blockExpiresAt'] },
      { fields: ['lastAccountCreatedAt'] }
    ]
  });

  return AccountCreationLimit;
};
