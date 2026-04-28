/**
 * Migration: Create Double Date Tables
 * Date: 2026-04-28
 * Feature: Double dates with friend verification
 */

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create double_date_requests table
    await queryInterface.createTable('double_date_requests', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      user_id_1: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      user_id_2: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      friend_id_1: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      friend_id_2: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      initiated_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      status: {
        type: DataTypes.ENUM(
          'pending',
          'accepted_by_user_1',
          'accepted_by_user_2',
          'accepted_by_friend_1',
          'accepted_by_friend_2',
          'all_accepted',
          'rejected',
          'cancelled'
        ),
        allowNull: false,
        defaultValue: 'pending'
      },
      proposed_date: {
        type: DataTypes.DATE,
        allowNull: true
      },
      proposed_location: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      proposed_activity: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      user_1_approved_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      user_2_approved_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      friend_1_approved_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      friend_2_approved_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      double_date_group_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'double_date_groups', key: 'id' },
        onDelete: 'SET NULL'
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

    // Indexes for double_date_requests
    await queryInterface.addIndex('double_date_requests', ['user_id_1', 'user_id_2']);
    await queryInterface.addIndex('double_date_requests', ['initiated_by']);
    await queryInterface.addIndex('double_date_requests', ['status']);
    await queryInterface.addIndex('double_date_requests', ['created_at']);
    await queryInterface.addIndex('double_date_requests', ['friend_id_1', 'friend_id_2']);

    // Create double_date_groups table
    await queryInterface.createTable('double_date_groups', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      user_id_1: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      user_id_2: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      friend_id_1: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      friend_id_2: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      scheduled_date: {
        type: DataTypes.DATE,
        allowNull: true
      },
      location: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      activity: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'scheduled'
      },
      chatroom_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'chatrooms', key: 'id' },
        onDelete: 'SET NULL'
      },
      marked_completed_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL'
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      match_id_pair_1: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'matches', key: 'id' },
        onDelete: 'SET NULL'
      },
      match_id_pair_2: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'matches', key: 'id' },
        onDelete: 'SET NULL'
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

    // Indexes for double_date_groups
    await queryInterface.addIndex('double_date_groups', ['status']);
    await queryInterface.addIndex('double_date_groups', ['scheduled_date']);
    await queryInterface.addIndex('double_date_groups', ['created_at']);
    await queryInterface.addIndex('double_date_groups', ['user_id_1', 'user_id_2', 'friend_id_1', 'friend_id_2']);

    // Create friend_verifications table
    await queryInterface.createTable('friend_verifications', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      match_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'matches', key: 'id' },
        onDelete: 'CASCADE'
      },
      friend_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      status: {
        type: DataTypes.ENUM('pending_approval', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending_approval'
      },
      viewed_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      friend_feedback: {
        type: DataTypes.TEXT,
        allowNull: true
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

    // Indexes for friend_verifications
    await queryInterface.addIndex('friend_verifications', ['user_id']);
    await queryInterface.addIndex('friend_verifications', ['friend_id']);
    await queryInterface.addIndex('friend_verifications', ['match_id']);
    await queryInterface.addIndex('friend_verifications', ['status']);
    await queryInterface.addIndex('friend_verifications', ['user_id', 'friend_id', 'match_id'], { unique: true });

    // Create double_date_ratings table
    await queryInterface.createTable('double_date_ratings', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      double_date_group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'double_date_groups', key: 'id' },
        onDelete: 'CASCADE'
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      overall_rating: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      rating_for_user_2: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      rating_for_friend_1: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      rating_for_friend_2: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      review: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      would_do_again: {
        type: DataTypes.BOOLEAN,
        allowNull: true
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

    // Indexes for double_date_ratings
    await queryInterface.addIndex('double_date_ratings', ['double_date_group_id']);
    await queryInterface.addIndex('double_date_ratings', ['user_id']);
    await queryInterface.addIndex('double_date_ratings', ['created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('double_date_ratings');
    await queryInterface.dropTable('friend_verifications');
    await queryInterface.dropTable('double_date_groups');
    await queryInterface.dropTable('double_date_requests');
  }
};
