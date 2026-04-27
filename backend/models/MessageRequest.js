module.exports = (sequelize, DataTypes) => {
  const MessageRequest = sequelize.define('MessageRequest', {
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
      allowNull: false,
      validate: {
        len: [10, 500]
      }
    },
    requestType: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'intent',
      field: 'request_type',
      validate: {
        isIn: [['intent', 'message_request']]
      }
    },
    isPriority: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_priority'
    },
    deliveryBand: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'standard',
      field: 'delivery_band',
      validate: {
        isIn: [['limited', 'standard', 'priority']]
      }
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['pending', 'accepted', 'declined', 'expired']]
      },
      defaultValue: 'pending'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    }
  }, {
    tableName: 'message_requests',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['from_user_id'] },
      { fields: ['to_user_id'] },
      { fields: ['status'] },
      { fields: ['from_user_id', 'to_user_id'], unique: true }
    ]
  });

  MessageRequest.associate = (models) => {
    MessageRequest.belongsTo(models.User, { foreignKey: 'from_user_id', as: 'fromUser', onDelete: 'CASCADE' });
    MessageRequest.belongsTo(models.User, { foreignKey: 'to_user_id', as: 'toUser', onDelete: 'CASCADE' });
  };

  return MessageRequest;
};

