const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RewindQuotaTracker = sequelize.define(
    'RewindQuotaTracker',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: 'rewind_quota_user_date',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      quota_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        unique: 'rewind_quota_user_date',
        comment: 'Date for quota tracking (UTC)'
      },
      rewinds_used: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of rewinds used today'
      },
      is_premium_on_date: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Was user premium on this date'
      },
      quota_limit: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Daily rewind limit (3 for free, unlimited for premium)'
      },
      rewind_details_json: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Detailed rewind activities: [{profile_id, timestamp, reason}]'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'rewind_quota_tracker',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['user_id', 'quota_date'] },
        { fields: ['quota_date'] }
      ]
    }
  );

  RewindQuotaTracker.associate = (db) => {
    RewindQuotaTracker.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
  };

  return RewindQuotaTracker;
};
