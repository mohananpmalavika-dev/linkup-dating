const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CatfishDetectionFlag = sequelize.define(
    'CatfishDetectionFlag',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      messageId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'message_id',
        references: {
          model: 'messages',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'Message that triggered the flag (if from direct messaging)'
      },
      chatroomMessageId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'chatroom_message_id',
        references: {
          model: 'chatroom_messages',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'Message that triggered the flag (if from chatroom)'
      },
      fromUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'from_user_id',
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'User sending the suspicious message'
      },
      toUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'to_user_id',
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'User receiving the suspicious message'
      },
      messageText: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'message_text',
        comment: 'The full message text that was flagged'
      },
      redFlags: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: 'Array of detected red flag keywords/patterns'
      },
      flagType: {
        type: DataTypes.ENUM('money_request', 'payment_app', 'crypto', 'suspicious_link', 'identity_theft', 'other'),
        allowNull: false,
        field: 'flag_type',
        comment: 'Category of the detected threat'
      },
      riskLevel: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        field: 'risk_level',
        defaultValue: 'medium',
        comment: 'How suspicious the message is'
      },
      hasBeenReported: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: 'has_been_reported',
        defaultValue: false,
        comment: 'Whether user has reported this message'
      },
      reportedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'reported_by',
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL',
        comment: 'User ID who reported this message'
      },
      reportReason: {
        type: DataTypes.ENUM('scam', 'money_request', 'catfishing', 'harassment', 'other'),
        allowNull: true,
        field: 'report_reason',
        comment: 'Why the user reported it'
      },
      reportedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'reported_at',
        comment: 'When the user reported it'
      },
      aiConfidenceScore: {
        type: DataTypes.FLOAT,
        allowNull: false,
        field: 'ai_confidence_score',
        defaultValue: 0.5,
        validate: { min: 0, max: 1 },
        comment: 'Confidence score (0-1) of the AI detection'
      },
      userDismissed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        field: 'user_dismissed',
        defaultValue: false,
        comment: 'Whether user dismissed the warning'
      },
      dismissedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'dismissed_at',
        comment: 'When user dismissed the warning'
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional metadata (matched keywords, patterns, etc)'
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
    },
    {
      tableName: 'catfish_detection_flags',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      indexes: [
        { fields: ['from_user_id'] },
        { fields: ['to_user_id'] },
        { fields: ['message_id'] },
        { fields: ['chatroom_message_id'] },
        { fields: ['flag_type'] },
        { fields: ['risk_level'] },
        { fields: ['has_been_reported'] },
        { fields: ['created_at'] },
        { fields: ['from_user_id', 'flag_type'] },
        { fields: ['to_user_id', 'created_at'] }
      ]
    }
  );

  CatfishDetectionFlag.associate = (models) => {
    CatfishDetectionFlag.belongsTo(models.Message, {
      foreignKey: 'message_id',
      as: 'message',
      onDelete: 'CASCADE'
    });
    CatfishDetectionFlag.belongsTo(models.ChatroomMessage, {
      foreignKey: 'chatroom_message_id',
      as: 'chatroomMessage',
      onDelete: 'CASCADE'
    });
    CatfishDetectionFlag.belongsTo(models.User, {
      foreignKey: 'from_user_id',
      as: 'sender',
      onDelete: 'CASCADE'
    });
    CatfishDetectionFlag.belongsTo(models.User, {
      foreignKey: 'to_user_id',
      as: 'recipient',
      onDelete: 'CASCADE'
    });
    CatfishDetectionFlag.belongsTo(models.User, {
      foreignKey: 'reported_by',
      as: 'reporter',
      onDelete: 'SET NULL'
    });
  };

  return CatfishDetectionFlag;
};
