module.exports = (sequelize, DataTypes) => {
  const ProfileView = sequelize.define('ProfileView', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    viewerUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'viewer_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    viewedUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'viewed_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    viewedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'viewed_at'
    }
  }, {
    tableName: 'profile_views',
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ['viewer_user_id', 'viewed_user_id'], unique: true },
      { fields: ['viewed_user_id'] },
      { fields: ['viewed_at'] }
    ]
  });

  ProfileView.associate = (models) => {
    ProfileView.belongsTo(models.User, { foreignKey: 'viewer_user_id', as: 'viewer', onDelete: 'CASCADE' });
    ProfileView.belongsTo(models.User, { foreignKey: 'viewed_user_id', as: 'viewed', onDelete: 'CASCADE' });
  };

  return ProfileView;
};

