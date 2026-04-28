module.exports = (sequelize, DataTypes) => {
  const ConversationQuality = sequelize.define('ConversationQuality', {
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
    partnerUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'partner_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    totalMessages: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_messages'
    },
    avgMessageLength: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'avg_message_length'
    },
    avgResponseTime: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'avg_response_time',
      comment: 'Response time in minutes'
    },
    conversationDepthScore: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      field: 'conversation_depth_score',
      comment: '0-100 scale'
    },
    topicsDiscussed: {
      type: DataTypes.JSONB,
      defaultValue: [],
      field: 'topics_discussed',
      comment: 'Array of detected topics'
    },
    questionAskedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'question_asked_count'
    },
    engagementScore: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      field: 'engagement_score',
      comment: '0-100 scale'
    },
    connectionQuality: {
      type: DataTypes.ENUM('excellent', 'good', 'moderate', 'developing'),
      defaultValue: 'developing',
      field: 'connection_quality'
    },
    percentileRank: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      field: 'percentile_rank',
      comment: '0-100 percentile'
    },
    lastAnalyzedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_analyzed_at'
    }
  }, {
    tableName: 'conversation_qualities',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['match_id'], unique: true },
      { fields: ['user_id'] },
      { fields: ['conversation_depth_score'] },
      { fields: ['engagement_score'] }
    ]
  });

  ConversationQuality.associate = (models) => {
    ConversationQuality.belongsTo(models.Match, { 
      foreignKey: 'match_id', 
      as: 'match', 
      onDelete: 'CASCADE' 
    });
    ConversationQuality.belongsTo(models.User, { 
      foreignKey: 'user_id', 
      as: 'user', 
      onDelete: 'CASCADE' 
    });
    ConversationQuality.belongsTo(models.User, { 
      foreignKey: 'partner_user_id', 
      as: 'partnerUser', 
      onDelete: 'CASCADE' 
    });
  };

  return ConversationQuality;
};
