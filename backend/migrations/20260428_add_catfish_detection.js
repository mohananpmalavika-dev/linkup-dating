'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('catfish_detection_flags', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      message_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'messages',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'Direct message reference'
      },
      chatroom_message_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'chatroom_messages',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'Chatroom message reference'
      },
      from_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      to_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      message_text: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      red_flags: {
        type: Sequelize.JSON,
        allowNull: false
      },
      flag_type: {
        type: Sequelize.ENUM('money_request', 'payment_app', 'crypto', 'suspicious_link', 'identity_theft', 'other'),
        allowNull: false
      },
      risk_level: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
        defaultValue: 'medium'
      },
      has_been_reported: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      reported_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      report_reason: {
        type: Sequelize.ENUM('scam', 'money_request', 'catfishing', 'harassment', 'other'),
        allowNull: true
      },
      reported_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      ai_confidence_score: {
        type: Sequelize.FLOAT,
        defaultValue: 0.5
      },
      user_dismissed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      dismissed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
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
    await queryInterface.addIndex('catfish_detection_flags', ['from_user_id']);
    await queryInterface.addIndex('catfish_detection_flags', ['to_user_id']);
    await queryInterface.addIndex('catfish_detection_flags', ['message_id']);
    await queryInterface.addIndex('catfish_detection_flags', ['chatroom_message_id']);
    await queryInterface.addIndex('catfish_detection_flags', ['flag_type']);
    await queryInterface.addIndex('catfish_detection_flags', ['risk_level']);
    await queryInterface.addIndex('catfish_detection_flags', ['has_been_reported']);
    await queryInterface.addIndex('catfish_detection_flags', ['created_at']);
    await queryInterface.addIndex('catfish_detection_flags', ['from_user_id', 'flag_type']);
    await queryInterface.addIndex('catfish_detection_flags', ['to_user_id', 'created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('catfish_detection_flags');
  }
};
