/**
 * Migration: Create Profile Boosts Table
 * Timestamp: 20260501
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('profile_boosts', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      boost_type: {
        type: Sequelize.ENUM('standard', 'premium', 'ultimate'),
        defaultValue: 'standard',
        allowNull: false
      },
      visibility_multiplier: {
        type: Sequelize.DECIMAL(3, 1),
        allowNull: false
      },
      duration_minutes: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      price_paid: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('scheduled', 'active', 'completed', 'cancelled'),
        defaultValue: 'scheduled',
        allowNull: false
      },
      scheduled_start: {
        type: Sequelize.DATE,
        allowNull: true
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      impressions: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      clicks: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      likes_received: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      messages_received: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      smart_scheduling_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      target_gender: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      target_age_min: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      target_age_max: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      optimal_day_of_week: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      optimal_hour: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      ctr: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      roi: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes
    await queryInterface.addIndex('profile_boosts', ['user_id']);
    await queryInterface.addIndex('profile_boosts', ['user_id', 'status']);
    await queryInterface.addIndex('profile_boosts', ['status']);
    await queryInterface.addIndex('profile_boosts', ['expires_at']);
    await queryInterface.addIndex('profile_boosts', ['scheduled_start']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('profile_boosts');
  }
};
