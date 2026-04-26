module.exports = (sequelize, DataTypes) => {
  const SystemMetric = sequelize.define('SystemMetric', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    metricDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      unique: true,
      field: 'metric_date'
    },
    dailyActiveUsers: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'daily_active_users'
    },
    monthlyActiveUsers: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'monthly_active_users'
    },
    totalMessages: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_messages'
    },
    totalMatches: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_matches'
    },
    newUsers: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'new_users'
    },
    reportedUsers: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'reported_users'
    },
    spamFlaggedUsers: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'spam_flagged_users'
    },
    fraudFlaggedUsers: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'fraud_flagged_users'
    }
  }, {
    tableName: 'system_metrics',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['metric_date'], unique: true },
      { fields: ['created_at'] }
    ]
  });

  return SystemMetric;
};
