module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
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
    fromUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'from_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    toUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'to_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_read'
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'read_at'
    },
    // Encryption support
    isEncrypted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_encrypted'
    },
    encryptionAlgorithm: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'encryption_algorithm'
      // e.g., 'AES-256-GCM', 'RSA'
    },
    encryptedContent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'encrypted_content'
    },
    encryptionNonce: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'encryption_nonce'
    },
    // Disappearing messages
    isDisappearing: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_disappearing'
    },
    disappearsAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'disappears_at'
    },
    disappearAfterSeconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'disappear_after_seconds'
      // e.g., 3600 for 1 hour
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_deleted'
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at'
    },
    // Location sharing
    hasLocation: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'has_location'
    },
    locationLat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      field: 'location_lat'
    },
    locationLng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      field: 'location_lng'
    },
    locationName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'location_name'
    },
    locationAccuracy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'location_accuracy'
    },
    // Message metadata
    messageType: {
      type: DataTypes.STRING(50),
      defaultValue: 'text',
      field: 'message_type',
      // Types: text, image, video, audio, location, document, system
      validate: {
        isIn: [['text', 'image', 'video', 'audio', 'location', 'document', 'system']]
      }
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'edited_at'
    },
    editCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'edit_count'
    },
    repliedToMessageId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'replied_to_message_id'
    },
    searchVector: {
      type: DataTypes.TSVECTOR,
      allowNull: true,
      field: 'search_vector'
    }
  }, {
    tableName: 'messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['match_id'] },
      { fields: ['from_user_id'] },
      { fields: ['to_user_id'] },
      { fields: ['is_read'] },
      { fields: ['created_at'] },
      { fields: ['match_id', 'created_at'] },
      { fields: ['is_deleted'] },
      { fields: ['is_disappearing'] },
      { fields: ['message_type'] },
      { fields: ['search_vector'], using: 'gin' }
    ]
  });

  Message.associate = (models) => {
    Message.belongsTo(models.Match, { foreignKey: 'match_id', as: 'match', onDelete: 'CASCADE' });
    Message.belongsTo(models.User, { foreignKey: 'from_user_id', as: 'fromUser', onDelete: 'CASCADE' });
    Message.belongsTo(models.User, { foreignKey: 'to_user_id', as: 'toUser', onDelete: 'CASCADE' });
    Message.hasMany(models.MessageReaction, { foreignKey: 'message_id', as: 'reactions', onDelete: 'CASCADE' });
    Message.hasMany(models.MessageAttachment, { foreignKey: 'message_id', as: 'attachments', onDelete: 'CASCADE' });
    Message.belongsTo(models.Message, { foreignKey: 'replied_to_message_id', as: 'repliedToMessage' });
  };

  return Message;
};
