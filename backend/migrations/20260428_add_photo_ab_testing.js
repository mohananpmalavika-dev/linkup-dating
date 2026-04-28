'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create photo_ab_tests table
    await queryInterface.createTable('photo_ab_tests', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      photo_a_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'profile_photos',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      photo_b_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'profile_photos',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      test_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'paused', 'completed'),
        defaultValue: 'active'
      },
      test_duration_hours: {
        type: Sequelize.INTEGER,
        defaultValue: 48
      },
      likes_a: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      likes_b: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      views_a: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      views_b: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      engagement_a: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      },
      engagement_b: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      },
      winner: {
        type: Sequelize.ENUM('A', 'B', 'tie'),
        allowNull: true
      },
      win_margin: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      },
      auto_promoted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      promoted_photo_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'profile_photos',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      notes: {
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

    // Add indexes
    await queryInterface.addIndex('photo_ab_tests', ['user_id']);
    await queryInterface.addIndex('photo_ab_tests', ['status']);
    await queryInterface.addIndex('photo_ab_tests', ['winner']);
    await queryInterface.addIndex('photo_ab_tests', ['created_at']);
    await queryInterface.addIndex('photo_ab_tests', ['user_id', 'status']);

    // Create photo_ab_test_results table
    await queryInterface.createTable('photo_ab_test_results', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      test_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'photo_ab_tests',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      liker_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      photo_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'profile_photos',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      photo_version: {
        type: Sequelize.ENUM('A', 'B'),
        allowNull: false
      },
      event_type: {
        type: Sequelize.ENUM('like', 'view', 'pass'),
        allowNull: false
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes
    await queryInterface.addIndex('photo_ab_test_results', ['test_id']);
    await queryInterface.addIndex('photo_ab_test_results', ['user_id']);
    await queryInterface.addIndex('photo_ab_test_results', ['photo_version']);
    await queryInterface.addIndex('photo_ab_test_results', ['event_type']);
    await queryInterface.addIndex('photo_ab_test_results', ['test_id', 'photo_version']);
    await queryInterface.addIndex('photo_ab_test_results', ['timestamp']);
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order of creation
    await queryInterface.dropTable('photo_ab_test_results');
    await queryInterface.dropTable('photo_ab_tests');
  }
};
