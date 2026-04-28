/**
 * Migration: Create Preferences Priority table
 * Date: 2026-04-28
 */

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('preferences_priorities', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        unique: true
      },
      status: {
        type: DataTypes.ENUM('active', 'cancelled', 'expired', 'paused'),
        allowNull: false,
        defaultValue: 'active'
      },
      price_per_month: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 9.99
      },
      auto_renew: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      billing_cycle_start: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      billing_cycle_end: {
        type: DataTypes.DATE,
        allowNull: false
      },
      next_renewal: {
        type: DataTypes.DATE,
        allowNull: false
      },
      cancelled_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      cancellation_reason: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      rotation_week_position: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of times user has been in rotation'
      },
      current_week_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether user has top placement this week'
      },
      last_rotation_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Last time this user was in rotation'
      },
      weekly_rotation_enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      priority_ranking_boost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 100.0,
        comment: 'Multiplier for search ranking (100.0 = move to top)'
      },
      impressions_this_month: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Profile impressions during priority placement'
      },
      matches_this_month: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'New matches received during priority placement'
      },
      total_spent: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total amount spent on priority subscriptions'
      },
      total_months_active: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total months subscribed (for loyalty tiers)'
      },
      loyalty_discount_percent: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Discount percentage based on loyalty (0-25)'
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes for common queries
    await queryInterface.addIndex('preferences_priorities', ['user_id']);
    await queryInterface.addIndex('preferences_priorities', ['status']);
    await queryInterface.addIndex('preferences_priorities', ['current_week_active']);
    await queryInterface.addIndex('preferences_priorities', ['billing_cycle_end']);
    await queryInterface.addIndex('preferences_priorities', ['next_renewal']);
    await queryInterface.addIndex('preferences_priorities', ['rotation_week_position']);
    await queryInterface.addIndex('preferences_priorities', ['total_months_active']);
    await queryInterface.addIndex('preferences_priorities', [
      { name: 'status', order: 'ASC' },
      { name: 'rotation_week_position', order: 'DESC' }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('preferences_priorities');
  }
};
