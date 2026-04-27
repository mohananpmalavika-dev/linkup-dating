const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ConciergeMatch = sequelize.define(
    'ConciergeMatch',
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
        onDelete: 'CASCADE',
        comment: 'Premium member receiving the match'
      },
      matched_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Suggested match'
      },
      concierge_note: {
        type: DataTypes.TEXT,
        comment: 'Personal note from concierge explaining the match'
      },
      suggested_date_idea: {
        type: DataTypes.TEXT,
        comment: 'Activity suggestion based on mutual interests'
      },
      compatibility_reasons: {
        type: DataTypes.JSON,
        comment: 'Array of reasons for match (shared interests, values, goals)'
      },
      status: {
        type: DataTypes.ENUM('pending', 'liked', 'passed', 'matched'),
        defaultValue: 'pending'
      },
      curated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        comment: 'When concierge made the suggestion'
      },
      user_response_at: {
        type: DataTypes.DATE,
        comment: 'When user acted on the suggestion'
      },
      admin_id: {
        type: DataTypes.INTEGER,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Admin/concierge who made the match'
      },
      quality_rating: {
        type: DataTypes.INTEGER,
        comment: 'User rating of concierge suggestion (1-5)'
      },
      feedback: {
        type: DataTypes.TEXT,
        comment: 'User feedback on quality of suggestion'
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
      tableName: 'concierge_matches',
      timestamps: false,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['user_id', 'status'] },
        { fields: ['matched_user_id'] }
      ]
    }
  );

  ConciergeMatch.associate = (db) => {
    ConciergeMatch.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
    ConciergeMatch.belongsTo(db.User, { foreignKey: 'matched_user_id', as: 'matchedUser' });
    ConciergeMatch.belongsTo(db.User, { foreignKey: 'admin_id', as: 'curator' });
  };

  return ConciergeMatch;
};
