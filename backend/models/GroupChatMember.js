module.exports = (sequelize, DataTypes) => {
  const GroupChatMember = sequelize.define('GroupChatMember', {
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
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    role: {
      type: DataTypes.ENUM('admin', 'moderator', 'member'),
      defaultValue: 'member',
      comment: 'Member role in the group'
    },
    status: {
      type: DataTypes.ENUM('active', 'muted', 'left'),
      defaultValue: 'active',
      comment: 'Member status'
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'joined_at'
    },
    leftAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'left_at'
    },
    lastReadMessageId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'last_read_message_id'
    }
  }, {
    tableName: 'group_chat_members',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['group_id', 'user_id'], unique: true },
      { fields: ['group_id'] },
      { fields: ['user_id'] },
      { fields: ['status'] }
    ]
  });

  GroupChatMember.associate = (models) => {
    GroupChatMember.belongsTo(models.GroupChat, { foreignKey: 'group_id', as: 'group', onDelete: 'CASCADE' });
    GroupChatMember.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return GroupChatMember;
};
