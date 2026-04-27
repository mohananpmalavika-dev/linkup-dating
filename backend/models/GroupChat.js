module.exports = (sequelize, DataTypes) => {
  const GroupChat = sequelize.define('GroupChat', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Group chat name'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Group chat description'
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
    groupType: {
      type: DataTypes.ENUM('friend_matches', 'custom'),
      defaultValue: 'custom',
      field: 'group_type',
      comment: 'Type of group: friend matches or custom group'
    },
    matchId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'match_id',
      references: {
        model: 'matches',
        key: 'id'
      },
      comment: 'Associated match ID if group is from friend matches'
    },
    profilePhotoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'profile_photo_url'
    },
    maxMembers: {
      type: DataTypes.INTEGER,
      defaultValue: 100,
      field: 'max_members'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    settings: {
      type: DataTypes.JSONB,
      defaultValue: { 
        allowMediaSharing: true,
        allowVideoCall: true,
        notificationsEnabled: true,
        hideFromProfile: false
      },
      comment: 'Group settings'
    }
  }, {
    tableName: 'group_chats',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['created_by_user_id'] },
      { fields: ['match_id'] },
      { fields: ['is_active'] },
      { fields: ['group_type'] }
    ]
  });

  GroupChat.associate = (models) => {
    GroupChat.belongsTo(models.User, { foreignKey: 'created_by_user_id', as: 'creator', onDelete: 'CASCADE' });
    GroupChat.belongsTo(models.Match, { foreignKey: 'match_id', as: 'match', onDelete: 'SET NULL' });
    GroupChat.hasMany(models.GroupChatMember, { foreignKey: 'group_id', as: 'members', onDelete: 'CASCADE' });
    GroupChat.hasMany(models.GroupChatMessage, { foreignKey: 'group_id', as: 'messages', onDelete: 'CASCADE' });
  };

  return GroupChat;
};
