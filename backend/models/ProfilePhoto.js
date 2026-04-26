module.exports = (sequelize, DataTypes) => {
  const ProfilePhoto = sequelize.define('ProfilePhoto', {
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
    photoUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'photo_url'
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_primary'
    },
    position: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    uploadedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'uploaded_at'
    }
  }, {
    tableName: 'profile_photos',
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['user_id', 'position'] }
    ]
  });

  ProfilePhoto.associate = (models) => {
    ProfilePhoto.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return ProfilePhoto;
};
