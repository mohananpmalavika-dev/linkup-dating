module.exports = (sequelize, DataTypes) => {
  const ConversationQualityMetric = sequelize.define('ConversationQualityMetric', {
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
    userId1: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id_1'
    },
    userId2: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id_2'
    },
    messageCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'message_count'
    },
    daysActive: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'days_active'
    },
    avgResponseTimeMinutes: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'avg_response_time_minutes'
    },
    sentimentScore: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.5,
      field: 'sentiment_score',
      validate: {
        min: 0,
        max: 1
      },
      comment: '0 = negative, 0.5 = neutral, 1 = positive'
    },
    conversationDepthScore: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.5,
      field: 'conversation_depth_score',
      validate: {
        min: 0,
        max: 1
      },
      comment: '0 = surface level, 1 = deep topics'
    },
    engagementPattern: {
      type: DataTypes.ENUM('low', 'moderate', 'high', 'very_high'),
      defaultValue: 'low',
      field: 'engagement_pattern'
    },
    qualityScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      field: 'quality_score',
      validate: {
        min: 0,
        max: 1
      },
      comment: 'Overall conversation quality 0-1'
    },
    qualityTier: {
      type: DataTypes.ENUM('poor', 'fair', 'good', 'excellent'),
      allowNull: true,
      field: 'quality_tier'
    },
    lastActivityAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_activity_at'
    },
    lastAnalyzedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_analyzed_at'
    },
    inactivityDaysCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'inactivity_days_count'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'conversation_quality_metrics',
    timestamps: true
  });

  ConversationQualityMetric.associate = (models) => {
    ConversationQualityMetric.belongsTo(models.Match, {
      foreignKey: 'matchId'
    });
  };

  return ConversationQualityMetric;
};
