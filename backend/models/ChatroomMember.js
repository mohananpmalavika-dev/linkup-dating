module.exports = (sequelize, DataTypes) => {
  const ChatroomMember = sequelize.define('ChatroomMember', {
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
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'joined_at'
    },
    role: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'member'
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'active'
    },
    leftAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'left_at'
    }
  }, {
    tableName: 'chatroom_members',
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ['chatroom_id', 'user_id'], unique: true },
      { fields: ['chatroom_id'] },
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['role'] }
    ]
  });

  ChatroomMember.associate = (models) => {
    ChatroomMember.belongsTo(models.Chatroom, { foreignKey: 'chatroom_id', as: 'chatroom', onDelete: 'CASCADE' });
    ChatroomMember.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return ChatroomMember;
};
