'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('date_safety_kits', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      trusted_friend_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      date_match_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Matches', key: 'id' },
        onDelete: 'SET NULL',
      },
      session_status: {
        type: Sequelize.ENUM('active', 'inactive', 'paused', 'completed', 'emergency'),
        defaultValue: 'inactive',
      },
      sharing_start_time: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sharing_end_time: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      share_duration_minutes: {
        type: Sequelize.INTEGER,
        defaultValue: 180,
      },
      current_latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
      },
      current_longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
      },
      last_location_update: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      check_in_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      last_check_in_time: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_check_in_status: {
        type: Sequelize.ENUM('good', 'ok', 'help'),
        allowNull: true,
      },
      sos_activated: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      sos_activated_time: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sos_location_latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
      },
      sos_location_longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
      },
      emergency_contact_called: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      emergency_contact_number: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      safety_tips_acknowledged: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      location_history: {
        type: Sequelize.JSON,
        defaultValue: [],
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      session_end_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    // Create indexes
    await queryInterface.addIndex('date_safety_kits', {
      fields: ['user_id', 'session_status'],
      name: 'idx_date_safety_user_status',
    });

    await queryInterface.addIndex('date_safety_kits', {
      fields: ['trusted_friend_id', 'session_status'],
      name: 'idx_date_safety_friend',
    });

    await queryInterface.addIndex('date_safety_kits', {
      fields: ['date_match_id'],
      name: 'idx_date_safety_match',
    });

    await queryInterface.addIndex('date_safety_kits', {
      fields: ['sos_activated', 'created_at'],
      order: [
        ['sos_activated', 'DESC'],
        ['created_at', 'DESC'],
      ],
      name: 'idx_date_safety_sos',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('date_safety_kits');
  },
};
