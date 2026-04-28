'use strict';
module.exports = (sequelize, DataTypes) => {
  const EventRating = sequelize.define('EventRating', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'dating_events', key: 'id' },
      onDelete: 'CASCADE'
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
      onDelete: 'CASCADE'
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      }
    },
    review: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'event_ratings',
    timestamps: false,
    indexes: [
      { fields: ['event_id'] },
      { fields: ['user_id'] },
      { fields: ['event_id', 'user_id'], unique: true }
    ]
  });

  EventRating.associate = (models) => {
    EventRating.belongsTo(models.DatingEvent, { 
      as: 'event',
      foreignKey: 'event_id' 
    });
    EventRating.belongsTo(models.User, { 
      as: 'user',
      foreignKey: 'user_id' 
    });
  };

  return EventRating;
};
