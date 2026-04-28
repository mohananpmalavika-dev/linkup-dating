/**
 * Migration: Add Referral Rewards system
 * Date: April 28, 2026
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create referral_rewards table
    await queryInterface.createTable('referral_rewards', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      referral_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'referrals',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        comment: 'Associated referral'
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        comment: 'User receiving the reward'
      },
      reward_type: {
        type: Sequelize.ENUM('premium_days', 'superlikes'),
        allowNull: false,
        comment: 'Type of reward'
      },
      reward_amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Amount (days or count)'
      },
      reward_description: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Human-readable description'
      },
      claimed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When user claimed the reward'
      },
      applied_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When reward was applied to account'
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When reward expires'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('referral_rewards', ['referral_id']);
    await queryInterface.addIndex('referral_rewards', ['user_id']);
    await queryInterface.addIndex('referral_rewards', ['reward_type']);
    await queryInterface.addIndex('referral_rewards', ['claimed_at']);

    // Modify referrals table to add more columns
    await queryInterface.addColumn('referrals', 'rewards_claimed_by_referrer_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When referrer claimed their reward'
    });

    await queryInterface.addColumn('referrals', 'rewards_claimed_by_referred_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When referred user claimed their reward'
    });

    // Add index to referrals for better queries
    await queryInterface.addIndex('referrals', ['status']);
    await queryInterface.addIndex('referrals', ['expires_at']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('referrals', ['status']);
    await queryInterface.removeIndex('referrals', ['expires_at']);

    // Remove columns from referrals
    await queryInterface.removeColumn('referrals', 'rewards_claimed_by_referrer_at');
    await queryInterface.removeColumn('referrals', 'rewards_claimed_by_referred_at');

    // Drop referral_rewards table
    await queryInterface.dropTable('referral_rewards');
  }
};
