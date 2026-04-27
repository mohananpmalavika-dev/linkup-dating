module.exports = (sequelize, DataTypes) => {
  const UserPresenceSession = sequelize.define('UserPresenceSession', {
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
    sessionId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'session_id',
      comment: 'Unique session identifier from frontend'
    },
    loginTimestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'login_timestamp',
      defaultValue: DataTypes.NOW
    },
    lastActivityTimestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'last_activity_timestamp',
      defaultValue: DataTypes.NOW
    },
    deviceType: {
      type: DataTypes.ENUM('mobile', 'web', 'tablet', 'unknown'),
      defaultValue: 'web',
      field: 'device_type'
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address',
      comment: 'IPv4 or IPv6 address'
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
      comment: 'Updated every 30 seconds by heartbeat'
    },
    logoutTimestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'logout_timestamp'
    },
    activityLog: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'activity_log',
      comment: 'Track: view_profile, send_message, like, superlike, etc.'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'user_presence_sessions',
    timestamps: true
  });

  UserPresenceSession.associate = (models) => {
    UserPresenceSession.belongsTo(models.User, {
      foreignKey: 'userId'
    });
  };

  return UserPresenceSession;
};
