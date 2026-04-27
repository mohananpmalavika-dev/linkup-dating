module.exports = (sequelize, DataTypes) => {
  const MessageReaction = sequelize.define('MessageReaction', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    messageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'message_id',
      references: {
        model: 'messages',
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
    emoji: {
      type: DataTypes.STRING(16),
      allowNull: false,
      comment: 'Emoji reaction: 👍, ❤️, 😂, 🔥, etc.'
    },
    // Custom reaction support (profile photos)
    customReactionType: {
      type: DataTypes.ENUM('emoji', 'photo'),
      defaultValue: 'emoji',
      field: 'custom_reaction_type',
      comment: 'Type of reaction: emoji or photo'
    },
    customPhotoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'custom_photo_url',
      comment: 'URL to profile photo for custom reactions'
    },
    customPhotoId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'custom_photo_id',
      references: {
        model: 'profile_photos',
        key: 'id'
      }
    },
    customDisplayName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'custom_display_name',
      comment: 'Display name for custom reactions'
    }
  }, {
    tableName: 'message_reactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['message_id', 'user_id'], unique: true },
      { fields: ['message_id'] },
      { fields: ['user_id'] },
      { fields: ['custom_reaction_type'] }
    ]
  });

  MessageReaction.associate = (models) => {
    MessageReaction.belongsTo(models.Message, { foreignKey: 'message_id', as: 'message', onDelete: 'CASCADE' });
    MessageReaction.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
    MessageReaction.belongsTo(models.ProfilePhoto, { foreignKey: 'custom_photo_id', as: 'photo', onDelete: 'SET NULL' });
  };

  return MessageReaction;
};
