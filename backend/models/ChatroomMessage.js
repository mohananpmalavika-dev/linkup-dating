module.exports = (sequelize, DataTypes) => {
  const ChatroomMessage = sequelize.define('ChatroomMessage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    chatroomId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'chatroom_id',
      references: {
        model: 'chatrooms',
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
      allowNull: false
    }
  }, {
    tableName: 'chatroom_messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['chatroom_id'] },
      { fields: ['from_user_id'] },
      { fields: ['created_at'] },
      { fields: ['chatroom_id', 'created_at'] }
    ]
  });

  ChatroomMessage.associate = (models) => {
    ChatroomMessage.belongsTo(models.Chatroom, { foreignKey: 'chatroom_id', as: 'chatroom', onDelete: 'CASCADE' });
    ChatroomMessage.belongsTo(models.User, { foreignKey: 'from_user_id', as: 'sender', onDelete: 'CASCADE' });
  };

  return ChatroomMessage;
};
