const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SuspiciousProfileReport = sequelize.define(
    'SuspiciousProfileReport',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      reporting_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      reported_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      reason: {
        type: DataTypes.ENUM('catfishing', 'fake_profile', 'bot', 'scam', 'harassment', 'other'),
        allowNull: false,
        comment: 'Category of suspicious activity'
      },
      message_ids: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'Array of message IDs (if applicable)'
      },
      notes: {
        type: DataTypes.TEXT,
        comment: 'Additional details provided by reporter'
      },
      status: {
        type: DataTypes.ENUM('reported', 'investigating', 'confirmed', 'dismissed', 'action_taken'),
        defaultValue: 'reported',
        comment: 'Status of the report'
      },
      moderator_id: {
        type: DataTypes.INTEGER,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Admin who reviewed the report'
      },
      moderator_notes: {
        type: DataTypes.TEXT,
        comment: 'Internal notes from moderator'
      },
      action_taken: {
        type: DataTypes.STRING,
        comment: 'What action was taken (warning, suspension, etc.)'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: DataTypes.NOW
      }
    },
    {
      tableName: 'suspicious_profile_reports',
      timestamps: false,
      indexes: [
        { fields: ['reported_user_id'] },
        { fields: ['reporting_user_id'] },
        { fields: ['status'] },
        { fields: ['reason'] },
        { fields: ['created_at'] }
      ]
    }
  );

  SuspiciousProfileReport.associate = (models) => {
    SuspiciousProfileReport.belongsTo(models.User, {
      foreignKey: 'reporting_user_id',
      as: 'ReportingUser',
      onDelete: 'CASCADE'
    });

    SuspiciousProfileReport.belongsTo(models.User, {
      foreignKey: 'reported_user_id',
      as: 'ReportedUser',
      onDelete: 'CASCADE'
    });
  };

  return SuspiciousProfileReport;
};
