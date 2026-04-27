'use strict';
module.exports = (sequelize, DataTypes) => {
  const DatingEvent = sequelize.define('DatingEvent', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    event_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    location_city: {
      type: DataTypes.STRING,
      allowNull: false
    },
    location_latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true
    },
    location_longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true
    },
    category: {
      type: DataTypes.ENUM(
        'singles_event', 'speed_dating', 'social_gathering',
        'outdoor_activity', 'hobby_meetup', 'sports', 'cultural', 'other'
      ),
      allowNull: false
    },
    is_dating_focused: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    organizer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' }
    },
    max_attendees: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    attending_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    interested_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    image_url: {
      type: DataTypes.STRING,
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
    tableName: 'dating_events',
    timestamps: false,
    indexes: [
      { fields: ['location_city'] },
      { fields: ['event_date'] },
      { fields: ['category'] },
      { fields: ['organizer_id'] }
    ]
  });

  DatingEvent.associate = (models) => {
    DatingEvent.belongsToMany(models.User, {
      through: 'EventAttendees',
      as: 'attendees',
      foreignKey: 'event_id'
    });
    DatingEvent.belongsTo(models.User, { as: 'organizer', foreignKey: 'organizer_id' });
  };

  return DatingEvent;
};
