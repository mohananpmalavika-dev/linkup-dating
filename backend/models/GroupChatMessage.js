module.exports = (sequelize, DataTypes) => {
  const GroupChatMessage = sequelize.define('GroupChatMessage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'group_id',
      references: {
        model: 'group_chats',
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
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    mediaType: {
      type: DataTypes.ENUM('image', 'video', 'audio', 'file'),
      allowNull: true,
      field: 'media_type'
    },
    mediaUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'media_url'
    },
    messageType: {
      type: DataTypes.ENUM('text', 'media', 'system'),
      defaultValue: 'text',
      field: 'message_type'
    },
    isEdited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_edited'
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'edited_at'
    },
    reactions: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of emoji reactions'
    }
  }, {
    tableName: 'group_chat_messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['group_id'] },
      { fields: ['from_user_id'] },
      { fields: ['created_at'] }
    ]
  });

  GroupChatMessage.associate = (models) => {
    GroupChatMessage.belongsTo(models.GroupChat, { foreignKey: 'group_id', as: 'group', onDelete: 'CASCADE' });
    GroupChatMessage.belongsTo(models.User, { foreignKey: 'from_user_id', as: 'sender', onDelete: 'CASCADE' });
  };

  return GroupChatMessage;
};
