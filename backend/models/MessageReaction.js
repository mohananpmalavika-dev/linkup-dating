module.exports = (sequelize, DataTypes) => {
  const MessageReaction = sequelize.define('MessageReaction', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    messageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'message_id',
      references: {
        model: 'messages',
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
    emoji: {
      type: DataTypes.STRING(16),
      allowNull: false
    }
  }, {
    tableName: 'message_reactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['message_id', 'user_id', 'emoji'], unique: true },
      { fields: ['message_id'] },
      { fields: ['user_id'] }
    ]
  });

  MessageReaction.associate = (models) => {
    MessageReaction.belongsTo(models.Message, { foreignKey: 'message_id', as: 'message', onDelete: 'CASCADE' });
    MessageReaction.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return MessageReaction;
};
