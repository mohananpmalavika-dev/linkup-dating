'use strict';
module.exports = (sequelize, DataTypes) => {
  const PersonalityArchetype = sequelize.define('PersonalityArchetype', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Users', key: 'id' }
    },
    archetype_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    archetype_code: {
      type: DataTypes.ENUM(
        'adventurer', 'romantic', 'intellectual', 'protector',
        'counselor', 'mastermind', 'debater', 'campaigner',
        'logistician', 'defender', 'virtuoso', 'entrepreneur',
        'advocate', 'mediator', 'healer', 'commander'
      ),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    strengths: {
      type: DataTypes.JSON,
      defaultValue: [],
      allowNull: false
    },
    communication_style: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    best_matches: {
      type: DataTypes.JSON,
      defaultValue: [],
      allowNull: false
    },
    archetype_preferences: {
      type: DataTypes.JSON,
      defaultValue: [],
      allowNull: true
    },
    avoid_archetypes: {
      type: DataTypes.JSON,
      defaultValue: [],
      allowNull: true
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'personality_archetypes',
    timestamps: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['archetype_code'] }
    ]
  });

  PersonalityArchetype.associate = (models) => {
    PersonalityArchetype.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return PersonalityArchetype;
};
