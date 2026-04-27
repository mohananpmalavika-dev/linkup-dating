'use strict';
module.exports = (sequelize, DataTypes) => {
  const EventAttendees = sequelize.define('EventAttendees', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'DatingEvents', key: 'id' }
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Users', key: 'id' }
    },
    status: {
      type: DataTypes.ENUM('attending', 'interested', 'declined'),
      defaultValue: 'attending',
      allowNull: false
    },
    joined_at: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    attended_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'event_attendees',
    timestamps: false,
    indexes: [
      { fields: ['event_id'] },
      { fields: ['user_id'] },
      { fields: ['event_id', 'user_id'], unique: true }
    ]
  });

  EventAttendees.associate = (models) => {
    EventAttendees.belongsTo(models.DatingEvent, { foreignKey: 'event_id' });
    EventAttendees.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return EventAttendees;
};
