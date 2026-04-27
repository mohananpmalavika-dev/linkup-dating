const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CompatibilityScore = sequelize.define(
    'CompatibilityScore',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      viewer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        field: 'viewer_id'
      },
      candidate_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        field: 'candidate_id'
      },
      overall_score: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        validate: { min: 0, max: 100 },
        comment: 'Overall compatibility 0-100',
        field: 'overall_score'
      },
      factor_breakdown: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'Object: { interests, location, age, values, activity_style, communication, etc }',
        field: 'factor_breakdown'
      },
      interests_match_score: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Shared interests percentage',
        field: 'interests_match_score'
      },
      location_compatibility: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Distance/location match 0-100',
        field: 'location_compatibility'
      },
      age_compatibility: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Age range match 0-100',
        field: 'age_compatibility'
      },
      values_alignment: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Relationship goals, smoking, drinking, kids, etc',
        field: 'values_alignment'
      },
      communication_style_match: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Message patterns, response time compatibility',
        field: 'communication_style_match'
      },
      activity_level_compatibility: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Lifestyle activity level match',
        field: 'activity_level_compatibility'
      },
      reasons_json: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'Array of human-readable reason strings',
        field: 'reasons_json'
      },
      ranking_position: {
        type: DataTypes.INTEGER,
        comment: 'Position in ranked suggestions (1=best, 2=second, etc)',
        field: 'ranking_position'
      },
      was_interacted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'True if viewer has liked/passed on this candidate',
        field: 'was_interacted'
      },
      interaction_type: {
        type: DataTypes.ENUM('like', 'superlike', 'pass', null),
        defaultValue: null,
        comment: 'How user interacted with suggestion',
        field: 'interaction_type'
      },
      calculated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'calculated_at'
      },
      expires_at: {
        type: DataTypes.DATE,
        comment: 'Recalculate suggestions after this date',
        field: 'expires_at'
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: DataTypes.NOW,
        field: 'updated_at'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      }
    },
    {
      tableName: 'compatibility_scores',
      timestamps: false,
      indexes: [
        { fields: ['viewer_id'] },
        { fields: ['viewer_id', 'overall_score'], order: [['overall_score', 'DESC']] },
        { fields: ['viewer_id', 'calculated_at'] },
        { fields: ['viewer_id', 'was_interacted'] },
        { fields: ['viewer_id', 'expires_at'] },
        { fields: ['overall_score'], order: [['overall_score', 'DESC']] }
      ]
    }
  );

  CompatibilityScore.associate = (db) => {
    CompatibilityScore.belongsTo(db.User, {
      foreignKey: 'viewer_id',
      as: 'viewer',
      onDelete: 'CASCADE'
    });
    CompatibilityScore.belongsTo(db.User, {
      foreignKey: 'candidate_id',
      as: 'candidate',
      onDelete: 'CASCADE'
    });
  };

  return CompatibilityScore;
};
