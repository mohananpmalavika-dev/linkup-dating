module.exports = (sequelize, DataTypes) => {
  const LobbyMessage = sequelize.define('LobbyMessage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
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
    tableName: 'lobby_messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['from_user_id'] },
      { fields: ['created_at'] }
    ]
  });

  LobbyMessage.associate = (models) => {
    LobbyMessage.belongsTo(models.User, { foreignKey: 'from_user_id', as: 'sender', onDelete: 'CASCADE' });
  };

  return LobbyMessage;
};
