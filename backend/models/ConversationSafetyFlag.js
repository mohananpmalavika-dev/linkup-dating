const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ConversationSafetyFlag = sequelize.define(
    'ConversationSafetyFlag',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      match_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'matches', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Match between reporter and reported user'
      },
      reporter_id: {
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
        type: DataTypes.ENUM(
          'sexual_harassment',
          'threatening_behavior',
          'spam',
          'inappropriate_language',
          'scam',
          'catfishing',
          'hate_speech',
          'other'
        ),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        comment: 'Detailed description of incident'
      },
      message_ids: {
        type: DataTypes.JSON,
        comment: 'Array of message IDs that triggered the report'
      },
      status: {
        type: DataTypes.ENUM('reported', 'investigating', 'resolved', 'dismissed', 'action_taken'),
        defaultValue: 'reported'
      },
      severity: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        defaultValue: 'medium'
      },
      is_blocking_recommended: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'System recommends blocking this user'
      },
      reporter_action_taken: {
        type: DataTypes.ENUM('none', 'blocked', 'reported'),
        defaultValue: 'none'
      },
      admin_response: {
        type: DataTypes.TEXT,
        comment: 'Admin notes on investigation'
      },
      admin_id: {
        type: DataTypes.INTEGER,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL'
      },
      investigation_started_at: {
        type: DataTypes.DATE
      },
      resolved_at: {
        type: DataTypes.DATE
      },
      action_type: {
        type: DataTypes.ENUM('none', 'warning', 'suspension', 'permanent_ban', 'profile_deleted'),
        defaultValue: 'none',
        comment: 'Action taken against reported user'
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
      tableName: 'conversation_safety_flags',
      timestamps: false,
      indexes: [
        { fields: ['match_id'] },
        { fields: ['reporter_id'] },
        { fields: ['reported_user_id'] },
        { fields: ['status'] },
        { fields: ['severity'] }
      ]
    }
  );

  ConversationSafetyFlag.associate = (db) => {
    ConversationSafetyFlag.belongsTo(db.Match, { foreignKey: 'match_id' });
    ConversationSafetyFlag.belongsTo(db.User, { foreignKey: 'reporter_id', as: 'reporter' });
    ConversationSafetyFlag.belongsTo(db.User, { foreignKey: 'reported_user_id', as: 'reportedUser' });
    ConversationSafetyFlag.belongsTo(db.User, { foreignKey: 'admin_id', as: 'admin' });
  };

  return ConversationSafetyFlag;
};
