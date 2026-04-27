const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserDecisionHistory = sequelize.define(
    'UserDecisionHistory',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      profile_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      decision_type: {
        type: DataTypes.ENUM('like', 'superlike', 'pass', 'rewind', 'block'),
        allowNull: false
      },
      decision_timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: 'When decision was made'
      },
      context: {
        type: DataTypes.ENUM('discovery', 'search', 'top_picks', 'trending', 'nearby'),
        comment: 'Where profile was viewed from'
      },
      profile_still_available: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Is profile still active/visible'
      },
      undo_action: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Was this decision undone'
      },
      undone_at: {
        type: DataTypes.DATE,
        comment: 'When decision was undone'
      },
      pass_reason: {
        type: DataTypes.ENUM('age', 'distance', 'interests', 'goals', 'body_type', 'height', 'other'),
        allowNull: true,
        comment: 'Why the profile was passed (only for pass decisions)'
      },
      pass_reasons_json: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional pass reasons in JSON format for future analysis'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'user_decision_history',
      timestamps: false,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['user_id', 'decision_timestamp'] },
        { fields: ['user_id', 'decision_type'] },
        { fields: ['user_id', 'profile_user_id'] },
        { fields: ['user_id', 'pass_reason'] }
      ]
    }
  );

  UserDecisionHistory.associate = (db) => {
    UserDecisionHistory.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
    UserDecisionHistory.belongsTo(db.User, { foreignKey: 'profile_user_id', as: 'profileUser' });
  };

  return UserDecisionHistory;
};
