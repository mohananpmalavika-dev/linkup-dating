module.exports = (sequelize, DataTypes) => {
  const UserReport = sequelize.define('UserReport', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    reportingUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'reporting_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    reportedUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'reported_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'investigating', 'resolved', 'dismissed']]
      }
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'resolved_at'
    }
  }, {
    tableName: 'user_reports',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['reporting_user_id'] },
      { fields: ['reported_user_id'] },
      { fields: ['status'] },
      { fields: ['created_at'] }
    ]
  });

  UserReport.associate = (models) => {
    UserReport.belongsTo(models.User, { foreignKey: 'reporting_user_id', as: 'reportingUser', onDelete: 'CASCADE' });
    UserReport.belongsTo(models.User, { foreignKey: 'reported_user_id', as: 'reportedUser', onDelete: 'CASCADE' });
  };

  return UserReport;
};
