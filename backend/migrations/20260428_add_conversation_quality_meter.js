'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create ConversationQuality table
    await queryInterface.createTable('conversation_qualities', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      match_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'matches',
          key: 'id'
        },
        onDelete: 'CASCADE'
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
      partner_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      total_messages: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      avg_message_length: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      avg_response_time: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Response time in minutes'
      },
      conversation_depth_score: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0,
        comment: '0-100 scale'
      },
      topics_discussed: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      question_asked_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      engagement_score: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0,
        comment: '0-100 scale'
      },
      connection_quality: {
        type: Sequelize.ENUM('excellent', 'good', 'moderate', 'developing'),
        defaultValue: 'developing'
      },
      percentile_rank: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0,
        comment: '0-100 percentile'
      },
      last_analyzed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    }, {
      indexes: [
        { fields: ['match_id'], unique: true },
        { fields: ['user_id'] },
        { fields: ['conversation_depth_score'] },
        { fields: ['engagement_score'] }
      ]
    });

    // Create ConversationSuggestion table
    await queryInterface.createTable('conversation_suggestions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      match_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'matches',
          key: 'id'
        },
        onDelete: 'CASCADE'
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
      suggestion_type: {
        type: Sequelize.ENUM(
          'question',
          'topic_continuation',
          'icebreaker',
          'deep_dive',
          'light_topic',
          'connection_builder'
        ),
        allowNull: false
      },
      suggestion_text: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      context: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      relevant_topics: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      suggested_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      was_used: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      used_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      user_rating: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '1-5 star rating'
      },
      message_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    }, {
      indexes: [
        { fields: ['match_id'] },
        { fields: ['user_id'] },
        { fields: ['suggested_at'] },
        { fields: ['was_used'] }
      ]
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('conversation_suggestions');
    await queryInterface.dropTable('conversation_qualities');
  }
};
