module.exports = (sequelize, DataTypes) => {
  const SpamFlag = sequelize.define('SpamFlag', {
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
    flaggedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'flagged_by_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    severity: {
      type: DataTypes.STRING(50),
      defaultValue: 'low',
      validate: {
        isIn: [['low', 'medium', 'high', 'critical']]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isResolved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_resolved'
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'resolved_at'
    }
  }, {
    tableName: 'spam_flags',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['flagged_by_user_id'] },
      { fields: ['is_resolved'] },
      { fields: ['created_at'] }
    ]
  });

  SpamFlag.associate = (models) => {
    SpamFlag.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
    SpamFlag.belongsTo(models.User, { foreignKey: 'flagged_by_user_id', as: 'flaggedBy', onDelete: 'SET NULL' });
  };

  return SpamFlag;
};
