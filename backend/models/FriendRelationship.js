module.exports = (sequelize, DataTypes) => {
  const FriendRelationship = sequelize.define('FriendRelationship', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    userId1: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id_1',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    userId2: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id_2',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'blocked'),
      defaultValue: 'pending',
      allowNull: false,
      comment: 'pending=request sent, accepted=friends, blocked=one blocked the other'
    },
    requestSentBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'request_sent_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'accepted_at'
    }
  }, {
    tableName: 'friend_relationships',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id_1', 'user_id_2'], unique: true },
      { fields: ['user_id_1', 'status'] },
      { fields: ['user_id_2', 'status'] },
      { fields: ['status'] }
    ]
  });

  FriendRelationship.associate = (models) => {
    FriendRelationship.belongsTo(models.User, { foreignKey: 'user_id_1', as: 'user1', onDelete: 'CASCADE' });
    FriendRelationship.belongsTo(models.User, { foreignKey: 'user_id_2', as: 'user2', onDelete: 'CASCADE' });
    FriendRelationship.belongsTo(models.User, { foreignKey: 'request_sent_by', as: 'requester', onDelete: 'SET NULL' });
  };

  return FriendRelationship;
};
