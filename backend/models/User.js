module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING(32),
      allowNull: true,
      unique: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_admin'
    },
    storefrontData: {
      type: DataTypes.JSONB,
      defaultValue: { cart: [], favorites: [], savedAddresses: [] },
      field: 'storefront_data'
    }
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
  });

  User.associate = (models) => {
    User.hasOne(models.DatingProfile, { foreignKey: 'user_id', as: 'datingProfile', onDelete: 'CASCADE' });
    User.hasOne(models.UserPreference, { foreignKey: 'user_id', as: 'preferences', onDelete: 'CASCADE' });
    User.hasMany(models.ProfilePhoto, { foreignKey: 'user_id', as: 'photos', onDelete: 'CASCADE' });
    User.hasMany(models.Interaction, { foreignKey: 'from_user_id', as: 'sentInteractions', onDelete: 'CASCADE' });
    User.hasMany(models.Interaction, { foreignKey: 'to_user_id', as: 'receivedInteractions', onDelete: 'CASCADE' });
    User.hasMany(models.Match, { foreignKey: 'user_id_1', as: 'matchesAsUser1', onDelete: 'CASCADE' });
    User.hasMany(models.Match, { foreignKey: 'user_id_2', as: 'matchesAsUser2', onDelete: 'CASCADE' });
    User.hasMany(models.Message, { foreignKey: 'from_user_id', as: 'sentMessages', onDelete: 'CASCADE' });
    User.hasMany(models.Message, { foreignKey: 'to_user_id', as: 'receivedMessages', onDelete: 'CASCADE' });
    User.hasMany(models.UserBlock, { foreignKey: 'blocking_user_id', as: 'blockedUsers', onDelete: 'CASCADE' });
    User.hasMany(models.UserBlock, { foreignKey: 'blocked_user_id', as: 'blockedByUsers', onDelete: 'CASCADE' });
    User.hasMany(models.UserReport, { foreignKey: 'reporting_user_id', as: 'reportsMade', onDelete: 'CASCADE' });
    User.hasMany(models.UserReport, { foreignKey: 'reported_user_id', as: 'reportsReceived', onDelete: 'CASCADE' });
    User.hasMany(models.ChatroomMember, { foreignKey: 'user_id', as: 'chatroomMemberships', onDelete: 'CASCADE' });
    User.hasMany(models.ChatroomMessage, { foreignKey: 'from_user_id', as: 'chatroomMessages', onDelete: 'CASCADE' });
    User.hasMany(models.LobbyMessage, { foreignKey: 'from_user_id', as: 'lobbyMessages', onDelete: 'CASCADE' });
    User.hasMany(models.UserAnalytics, { foreignKey: 'user_id', as: 'analytics', onDelete: 'CASCADE' });
    User.hasMany(models.UserSessionLog, { foreignKey: 'user_id', as: 'sessionLogs', onDelete: 'CASCADE' });
    User.hasMany(models.SpamFlag, { foreignKey: 'user_id', as: 'spamFlags', onDelete: 'CASCADE' });
    User.hasMany(models.FraudFlag, { foreignKey: 'user_id', as: 'fraudFlags', onDelete: 'CASCADE' });
    User.hasMany(models.AdminAction, { foreignKey: 'admin_user_id', as: 'adminActions', onDelete: 'CASCADE' });
    User.hasMany(models.AdminAction, { foreignKey: 'target_user_id', as: 'targetedByActions', onDelete: 'SET NULL' });
    User.hasMany(models.VerificationToken, { foreignKey: 'user_id', as: 'verificationTokens', onDelete: 'CASCADE' });
    User.hasOne(models.Subscription, { foreignKey: 'user_id', as: 'subscription', onDelete: 'CASCADE' });
    User.hasMany(models.MessageRequest, { foreignKey: 'from_user_id', as: 'sentMessageRequests', onDelete: 'CASCADE' });
    User.hasMany(models.MessageRequest, { foreignKey: 'to_user_id', as: 'receivedMessageRequests', onDelete: 'CASCADE' });
    
    // Social Features
    User.hasMany(models.Referral, { foreignKey: 'referrer_user_id', as: 'referrals', onDelete: 'CASCADE' });
    User.hasMany(models.FriendRelationship, { foreignKey: 'user_id_1', as: 'friendRequestsSent', onDelete: 'CASCADE' });
    User.hasMany(models.FriendRelationship, { foreignKey: 'user_id_2', as: 'friendRequestsReceived', onDelete: 'CASCADE' });
    User.hasMany(models.SocialIntegration, { foreignKey: 'user_id', as: 'socialIntegrations', onDelete: 'CASCADE' });
    User.hasOne(models.UserRewardBalance, { foreignKey: 'user_id', as: 'rewardBalance', onDelete: 'CASCADE' });
    User.hasMany(models.GroupChat, { foreignKey: 'created_by_user_id', as: 'groupChatsCreated', onDelete: 'CASCADE' });
    User.hasMany(models.GroupChatMember, { foreignKey: 'user_id', as: 'groupChatMemberships', onDelete: 'CASCADE' });
    User.hasMany(models.GroupChatMessage, { foreignKey: 'from_user_id', as: 'groupChatMessages', onDelete: 'CASCADE' });
  };

  return User;
};
