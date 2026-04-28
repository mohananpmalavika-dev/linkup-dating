module.exports = (sequelize, DataTypes) => {
  const ConversationSuggestion = sequelize.define('ConversationSuggestion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    matchId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'match_id',
      references: {
        model: 'matches',
        key: 'id'
      }
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
    suggestionType: {
      type: DataTypes.ENUM(
        'question',
        'topic_continuation',
        'icebreaker',
        'deep_dive',
        'light_topic',
        'connection_builder'
      ),
      allowNull: false,
      field: 'suggestion_type'
    },
    suggestionText: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'suggestion_text',
      comment: 'The actual suggestion message'
    },
    context: {
      type: DataTypes.JSONB,
      defaultValue: {},
      field: 'context',
      comment: 'Context about why this suggestion was made'
    },
    relevantTopics: {
      type: DataTypes.JSONB,
      defaultValue: [],
      field: 'relevant_topics',
      comment: 'Array of topics this suggestion relates to'
    },
    suggestedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'suggested_at'
    },
    wasUsed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'was_used',
      comment: 'Whether user clicked/used this suggestion'
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'used_at'
    },
    userRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_rating',
      comment: '1-5 star rating from user'
    },
    messageCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'message_count',
      comment: 'How many messages sent after suggestion'
    }
  }, {
    tableName: 'conversation_suggestions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['match_id'] },
      { fields: ['user_id'] },
      { fields: ['suggested_at'] },
      { fields: ['was_used'] }
    ]
  });

  ConversationSuggestion.associate = (models) => {
    ConversationSuggestion.belongsTo(models.Match, { 
      foreignKey: 'match_id', 
      as: 'match', 
      onDelete: 'CASCADE' 
    });
    ConversationSuggestion.belongsTo(models.User, { 
      foreignKey: 'user_id', 
      as: 'user', 
      onDelete: 'CASCADE' 
    });
  };

  return ConversationSuggestion;
};
