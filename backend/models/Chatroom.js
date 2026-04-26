module.exports = (sequelize, DataTypes) => {
  const Chatroom = sequelize.define('Chatroom', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    createdByUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'created_by_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    avatarUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'avatar_url'
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_public'
    },
    maxMembers: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
      field: 'max_members'
    },
    memberCount: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      field: 'member_count'
    }
  }, {
    tableName: 'chatrooms',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['created_by_user_id'] },
      { fields: ['is_public'] },
      { fields: ['created_at'] }
    ]
  });

  Chatroom.associate = (models) => {
    Chatroom.belongsTo(models.User, { foreignKey: 'created_by_user_id', as: 'creator', onDelete: 'CASCADE' });
    Chatroom.hasMany(models.ChatroomMember, { foreignKey: 'chatroom_id', as: 'members', onDelete: 'CASCADE' });
    Chatroom.hasMany(models.ChatroomMessage, { foreignKey: 'chatroom_id', as: 'messages', onDelete: 'CASCADE' });
  };

  return Chatroom;
};
