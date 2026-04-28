/**
 * Migration: Create Events and Event Attendees tables
 * Date: 2026-04-28
 * Interest-based group events feature
 */

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create DatingEvents table
    await queryInterface.createTable('dating_events', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      creator_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      interest_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'interests',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      event_name: {
        type: DataTypes.STRING(200),
        allowNull: false
      },
      event_description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      event_category: {
        type: DataTypes.ENUM(
          'sports', 'outdoor', 'arts', 'food', 'nightlife',
          'wellness', 'culture', 'tech', 'other'
        ),
        allowNull: false,
        defaultValue: 'other'
      },
      location_address: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      location_latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
      },
      location_longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
      },
      privacy_buffer_meters: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 500
      },
      event_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      event_time_start: {
        type: DataTypes.TIME,
        allowNull: false
      },
      event_time_end: {
        type: DataTypes.TIME,
        allowNull: true
      },
      duration_minutes: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      max_attendees: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      current_attendee_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      interested_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: DataTypes.ENUM('draft', 'published', 'cancelled', 'completed', 'archived'),
        allowNull: false,
        defaultValue: 'draft'
      },
      views_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      matches_generated: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      avg_rating: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true
      },
      total_ratings: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      event_photo_url: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      age_restriction_min: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      age_restriction_max: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      gender_preference: {
        type: DataTypes.ENUM('any', 'men', 'women'),
        allowNull: false,
        defaultValue: 'any'
      },
      outdoor: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      free_event: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      entry_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      hashtags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
      },
      created_at: {
        allowNull: false,
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        allowNull: false,
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes for DatingEvents
    await queryInterface.addIndex('dating_events', ['creator_id']);
    await queryInterface.addIndex('dating_events', ['interest_id']);
    await queryInterface.addIndex('dating_events', ['status']);
    await queryInterface.addIndex('dating_events', ['event_date']);
    await queryInterface.addIndex('dating_events', ['location_latitude', 'location_longitude']);
    await queryInterface.addIndex('dating_events', ['created_at']);
    await queryInterface.addIndex('dating_events', ['event_category']);

    // Create EventAttendees table (already might exist, but ensure it's there)
    await queryInterface.createTable('event_attendees', {
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
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      status: {
        type: DataTypes.ENUM('attending', 'interested', 'declined'),
        defaultValue: 'attending',
        allowNull: false
      },
      joined_at: {
        allowNull: false,
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW
      },
      attended_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, {
      timestamps: false
    });

    // Create indexes for EventAttendees
    await queryInterface.addIndex('event_attendees', ['event_id']);
    await queryInterface.addIndex('event_attendees', ['user_id']);
    await queryInterface.addIndex('event_attendees', ['event_id', 'user_id'], { unique: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('event_attendees');
    await queryInterface.dropTable('dating_events');
  }
};
