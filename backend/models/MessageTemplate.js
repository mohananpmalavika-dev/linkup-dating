/**
 * MessageTemplate Model
 * Stores AI-generated and user-created message templates with performance tracking
 * Enables context-aware icebreakers based on shared interests
 */
module.exports = (sequelize, DataTypes) => {
  const MessageTemplate = sequelize.define('MessageTemplate', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    recipientUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'recipient_user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'If generated for specific profile, reference here'
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'The actual message template text'
    },
    category: {
      type: DataTypes.ENUM(
        'greeting',
        'question_based',
        'shared_interest',
        'location_based',
        'humor',
        'compliment',
        'activity_suggestion',
        'general',
        'flirtation',
        'thoughtful'
      ),
      defaultValue: 'general',
      allowNull: false,
      field: 'category'
    },
    templateSource: {
      type: DataTypes.ENUM('ai_generated', 'user_custom', 'system_template'),
      defaultValue: 'ai_generated',
      allowNull: false,
      field: 'template_source',
      comment: 'Where template originated'
    },
    interestTrigger: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'interest_trigger',
      comment: 'The shared interest that triggered this template e.g. "hiking"'
    },
    contextJson: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'context_json',
      comment: 'Context: {interests: [], topics: [], similarity_factors: []}'
    },
    emoji: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    isPinned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_pinned'
    },
    // Performance Tracking
    usageCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'usage_count',
      comment: 'How many times this template was sent'
    },
    responseCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'response_count',
      comment: 'How many times template got a response'
    },
    matchCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'match_count',
      comment: 'How many times template led to a match'
    },
    responseRatePercent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      field: 'response_rate_percent',
      comment: 'Response count / usage count * 100'
    },
    avgResponseTimeSeconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'avg_response_time_seconds',
      comment: 'Average time to response'
    },
    engagementScore: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      field: 'engagement_score',
      comment: 'ML-calculated score 0-100 based on responses'
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_used_at'
    },
    lastResponseAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_response_at',
      comment: 'Last time this template got a response'
    }
  }, {
    tableName: 'message_templates',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id'], name: 'idx_user_id' },
      { fields: ['user_id', 'is_pinned'], name: 'idx_user_pinned' },
      { fields: ['user_id', 'engagement_score'], name: 'idx_user_engagement' },
      { fields: ['category'], name: 'idx_category' },
      { fields: ['template_source'], name: 'idx_template_source' },
      { fields: ['interest_trigger'], name: 'idx_interest_trigger' },
      { fields: ['user_id', 'created_at'], name: 'idx_user_created' },
      { fields: ['response_rate_percent'], name: 'idx_response_rate' }
    ]
  });

  MessageTemplate.associate = (models) => {
    MessageTemplate.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
    MessageTemplate.belongsTo(models.User, { foreignKey: 'recipient_user_id', as: 'recipientUser', onDelete: 'SET NULL' });
  };

  return MessageTemplate;
};
