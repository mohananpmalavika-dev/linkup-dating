module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    matchId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'match_id',
      references: {
        model: 'matches',
        key: 'id'
      }
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
    toUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'to_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_read'
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'read_at'
    }
  }, {
    tableName: 'messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['match_id'] },
      { fields: ['from_user_id'] },
      { fields: ['to_user_id'] },
      { fields: ['is_read'] },
      { fields: ['created_at'] },
      { fields: ['match_id', 'created_at'] }
    ]
  });

  Message.associate = (models) => {
    Message.belongsTo(models.Match, { foreignKey: 'match_id', as: 'match', onDelete: 'CASCADE' });
    Message.belongsTo(models.User, { foreignKey: 'from_user_id', as: 'fromUser', onDelete: 'CASCADE' });
    Message.belongsTo(models.User, { foreignKey: 'to_user_id', as: 'toUser', onDelete: 'CASCADE' });
    Message.hasMany(models.MessageReaction, { foreignKey: 'message_id', as: 'reactions', onDelete: 'CASCADE' });
  };

  return Message;
};
