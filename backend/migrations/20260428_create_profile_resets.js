/**
 * Migration: Create Profile Reset table
 * Date: 2026-04-28
 */

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('profile_resets', {
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
        onDelete: 'CASCADE'
      },
      reset_type: {
        type: DataTypes.ENUM('premium', 'free'),
        allowNull: false,
        defaultValue: 'free'
      },
      photos_rotated: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      bio_updated: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      swipes_cleared: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      impressions_before: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      impressions_after_reset: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      matches_preserved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      reset_reason: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      reset_impact: {
        type: DataTypes.JSON,
        allowNull: true
      },
      next_free_reset: {
        type: DataTypes.DATE,
        allowNull: true
      },
      total_resets_lifetime: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      reset_count_this_month: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      month_year: {
        type: DataTypes.STRING(10),
        allowNull: false
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

    // Create indexes
    await queryInterface.addIndex('profile_resets', ['user_id']);
    await queryInterface.addIndex('profile_resets', ['reset_type']);
    await queryInterface.addIndex('profile_resets', ['created_at']);
    await queryInterface.addIndex('profile_resets', ['month_year']);
    await queryInterface.addIndex('profile_resets', ['user_id', 'month_year']);
    await queryInterface.addIndex('profile_resets', ['user_id', 'created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('profile_resets');
  }
};
