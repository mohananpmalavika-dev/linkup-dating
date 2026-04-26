module.exports = (sequelize, DataTypes) => {
  const AdminAction = sequelize.define('AdminAction', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    adminUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'admin_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    actionType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'action_type',
      validate: {
        isIn: [['ban', 'warn', 'suspend', 'delete_content', 'verify_user', 'unban', 'feature_profile']]
      }
    },
    targetUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'target_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    details: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'completed',
      validate: {
        isIn: [['pending', 'completed', 'reverted', 'appealed']]
      }
    }
  }, {
    tableName: 'admin_actions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['admin_user_id'] },
      { fields: ['target_user_id'] },
      { fields: ['action_type'] },
      { fields: ['created_at'] }
    ]
  });

  AdminAction.associate = (models) => {
    AdminAction.belongsTo(models.User, { foreignKey: 'admin_user_id', as: 'admin', onDelete: 'CASCADE' });
    AdminAction.belongsTo(models.User, { foreignKey: 'target_user_id', as: 'target', onDelete: 'SET NULL' });
  };

  return AdminAction;
};
