module.exports = (sequelize, DataTypes) => {
  const SocialIntegration = sequelize.define('SocialIntegration', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
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
    platform: {
      type: DataTypes.ENUM('instagram', 'tiktok', 'twitter', 'facebook'),
      allowNull: false,
      comment: 'Social media platform'
    },
    username: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Social media username/handle'
    },
    externalId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'external_id',
      comment: 'External user ID from the platform'
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'access_token',
      comment: 'OAuth access token (encrypted in production)'
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_public',
      comment: 'Whether profile link is visible to other users'
    },
    syncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'synced_at',
      comment: 'Last time profile data was synced'
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verified_at',
      comment: 'When social account was verified'
    }
  }, {
    tableName: 'social_integrations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id', 'platform'], unique: true },
      { fields: ['platform', 'username'] },
      { fields: ['is_public'] }
    ]
  });

  SocialIntegration.associate = (models) => {
    SocialIntegration.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return SocialIntegration;
};
