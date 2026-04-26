module.exports = (sequelize, DataTypes) => {
  const UserBlock = sequelize.define('UserBlock', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    blockingUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'blocking_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    blockedUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'blocked_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'user_blocks',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['blocking_user_id', 'blocked_user_id'], unique: true },
      { fields: ['blocking_user_id'] },
      { fields: ['blocked_user_id'] }
    ]
  });

  UserBlock.associate = (models) => {
    UserBlock.belongsTo(models.User, { foreignKey: 'blocking_user_id', as: 'blockingUser', onDelete: 'CASCADE' });
    UserBlock.belongsTo(models.User, { foreignKey: 'blocked_user_id', as: 'blockedUser', onDelete: 'CASCADE' });
  };

  return UserBlock;
};
