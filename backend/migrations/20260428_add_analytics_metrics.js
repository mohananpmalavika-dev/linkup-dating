'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create profile_engagement_metrics table
    await queryInterface.createTable('profile_engagement_metrics', {
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
        onDelete: 'CASCADE'
      },
      metric_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      profile_views: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      likes_received: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      superlikes_received: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      message_requests_received: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      matches_formed: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      avg_like_received_per_view: {
        type: Sequelize.DECIMAL(5, 3),
        defaultValue: 0
      },
      engagement_score: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes for profile_engagement_metrics
    await queryInterface.addIndex('profile_engagement_metrics', ['user_id', 'metric_date'], { 
      unique: true,
      name: 'unique_user_metric_date'
    });
    await queryInterface.addIndex('profile_engagement_metrics', ['user_id']);
    await queryInterface.addIndex('profile_engagement_metrics', ['metric_date']);

    // Create interaction_metrics table
    await queryInterface.createTable('interaction_metrics', {
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
        onDelete: 'CASCADE'
      },
      metric_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      messages_sent: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      messages_received: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      avg_message_response_time: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Response time in minutes'
      },
      video_calls_initiated: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      video_calls_received: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      total_video_call_duration: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Duration in minutes'
      },
      avg_video_call_duration: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Duration in minutes'
      },
      conversation_quality_score: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0
      },
      response_rate: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Percentage 0-100'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes for interaction_metrics
    await queryInterface.addIndex('interaction_metrics', ['user_id', 'metric_date'], { 
      unique: true,
      name: 'unique_user_interaction_date'
    });
    await queryInterface.addIndex('interaction_metrics', ['user_id']);
    await queryInterface.addIndex('interaction_metrics', ['metric_date']);

    // Create dating_benchmarks table
    await queryInterface.createTable('dating_benchmarks', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      age_group: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: '18-25, 26-35, 36-45, 46-55, 55+'
      },
      gender: {
        type: Sequelize.ENUM('male', 'female', 'non-binary'),
        allowNull: false
      },
      location: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'City or region, null for global'
      },
      benchmark_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      avg_profile_views: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      avg_likes_received: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      avg_match_rate: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Percentage 0-100'
      },
      avg_message_response_time: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Minutes'
      },
      avg_video_call_rate: {
        type: Sequelize.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Percentage 0-100'
      },
      avg_conversation_duration: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Minutes'
      },
      sample_size: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of users in sample'
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

    // Create indexes for dating_benchmarks
    await queryInterface.addIndex('dating_benchmarks', ['age_group', 'gender', 'location', 'benchmark_date'], { 
      unique: true,
      name: 'unique_benchmark_demographics'
    });
    await queryInterface.addIndex('dating_benchmarks', ['age_group', 'gender']);
    await queryInterface.addIndex('dating_benchmarks', ['benchmark_date']);
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables in reverse order
    await queryInterface.dropTable('dating_benchmarks');
    await queryInterface.dropTable('interaction_metrics');
    await queryInterface.dropTable('profile_engagement_metrics');
  }
};
