const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TrustedFriend = sequelize.define('TrustedFriend', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
      comment: 'User who designated the trusted friend',
    },
    trusted_friend_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
      comment: 'The designated trusted friend',
    },
    nickname: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Custom name for this trusted friend (e.g. "Best Friend Sarah")',
    },
    relationship: {
      type: DataTypes.ENUM('friend', 'family', 'colleague', 'other'),
      defaultValue: 'friend',
      comment: 'Relationship type with trusted friend',
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Phone number to contact in emergency (optional)',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Email for notifications',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether this trusted friend is currently active',
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Primary trusted friend for default selection',
    },
    notification_preferences: {
      type: DataTypes.JSON,
      defaultValue: {
        receive_location_updates: true,
        receive_check_ins: true,
        receive_sos_alerts: true,
        notify_via_sms: false,
        notify_via_email: true,
      },
      comment: 'Notification preferences for this trusted friend',
    },
    last_notified: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last time this friend received a notification',
    },
    total_sessions_shared: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total number of date safety sessions shared with this friend',
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'trusted_friends',
    timestamps: true,
    underscored: true,
  });

  TrustedFriend.associate = (models) => {
    TrustedFriend.belongsTo(models.User, { 
      foreignKey: 'user_id', 
      as: 'user',
      onDelete: 'CASCADE',
    });
    TrustedFriend.belongsTo(models.User, { 
      foreignKey: 'trusted_friend_id', 
      as: 'friend',
      onDelete: 'CASCADE',
    });
  };

  // Indexes for performance
  // Note: Syncing is handled by utils/syncModels.js in controlled order
  // TrustedFriend.sync({ alter: false }).then(() => {
  //   sequelize.query(`
  //     CREATE INDEX IF NOT EXISTS idx_trusted_friend_user_active 
  //     ON trusted_friends(user_id, is_active);
      
      CREATE INDEX IF NOT EXISTS idx_trusted_friend_primary 
      ON trusted_friends(user_id, is_primary);
      
      CREATE INDEX IF NOT EXISTS idx_trusted_friend_friend_id 
      ON trusted_friends(trusted_friend_id);
    `).catch(() => {});
  });

  return TrustedFriend;
};
