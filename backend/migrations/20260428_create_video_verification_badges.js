/**
 * Migration: Create video_verification_badges table
 * Tracks users who have completed video verification
 */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('video_verification_badges', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      video_authentication_result_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'video_authentication_results',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      verification_status: {
        type: Sequelize.ENUM('pending', 'verified', 'failed', 'expired', 'revoked'),
        allowNull: false,
        defaultValue: 'pending'
      },
      facial_match_score: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        validate: {
          min: 0,
          max: 1
        }
      },
      liveness_score: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
        validate: {
          min: 0,
          max: 1
        }
      },
      overall_authenticity_score: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
        validate: {
          min: 0,
          max: 1
        }
      },
      risk_flags: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      verification_timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      manual_review_flag: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      manual_review_notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes for performance
    await queryInterface.addIndex('video_verification_badges', ['user_id'], {
      name: 'idx_badge_user_id'
    });

    await queryInterface.addIndex('video_verification_badges', ['is_verified'], {
      name: 'idx_badge_verified'
    });

    await queryInterface.addIndex('video_verification_badges', ['verification_status'], {
      name: 'idx_badge_status'
    });

    await queryInterface.addIndex('video_verification_badges', ['facial_match_score'], {
      name: 'idx_badge_facial_match'
    });

    await queryInterface.addIndex('video_verification_badges', ['verification_timestamp'], {
      name: 'idx_badge_timestamp'
    });

    await queryInterface.addIndex('video_verification_badges', ['expires_at'], {
      name: 'idx_badge_expires'
    });

    await queryInterface.addIndex('video_verification_badges', ['manual_review_flag'], {
      name: 'idx_badge_manual_review'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('video_verification_badges');
  }
};
