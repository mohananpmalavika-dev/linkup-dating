module.exports = (sequelize, DataTypes) => {
  const InteractionMetric = sequelize.define('InteractionMetric', {
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
    metricDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'metric_date'
    },
    messagesSent: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'messages_sent'
    },
    messagesReceived: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'messages_received'
    },
    avgMessageResponseTime: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'avg_message_response_time',
      comment: 'Response time in minutes'
    },
    videoCallsInitiated: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'video_calls_initiated'
    },
    videoCallsReceived: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'video_calls_received'
    },
    totalVideoCallDuration: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_video_call_duration',
      comment: 'Duration in minutes'
    },
    avgVideoCallDuration: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'avg_video_call_duration',
      comment: 'Duration in minutes'
    },
    conversationQualityScore: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      field: 'conversation_quality_score'
    },
    responseRate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      field: 'response_rate',
      comment: 'Percentage 0-100'
    }
  }, {
    tableName: 'interaction_metrics',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'metric_date'], unique: true },
      { fields: ['user_id'] },
      { fields: ['metric_date'] }
    ]
  });

  InteractionMetric.associate = (models) => {
    InteractionMetric.belongsTo(models.User, { 
      foreignKey: 'user_id', 
      as: 'user', 
      onDelete: 'CASCADE' 
    });
  };

  return InteractionMetric;
};
