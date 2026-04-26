module.exports = (sequelize, DataTypes) => {
  const UserSessionLog = sequelize.define('UserSessionLog', {
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
      field: 'session_id'
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address'
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent'
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    tableName: 'user_session_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['session_id'] },
      { fields: ['created_at'] }
    ]
  });

  UserSessionLog.associate = (models) => {
    UserSessionLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return UserSessionLog;
};
