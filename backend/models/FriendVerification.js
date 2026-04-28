'use strict';
module.exports = (sequelize, DataTypes) => {
  const FriendVerification = sequelize.define('FriendVerification', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    // User who enabled friend verification
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    // Their match/partner they're sharing visibility of
    match_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'matches', key: 'id' },
      onDelete: 'CASCADE'
    },
    // The friend who can see the match
    friend_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    // Whether the match person knows they're being shown to friends
    status: {
      type: DataTypes.ENUM('pending_approval', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending_approval'
    },
    // When the friend saw the match info
    viewed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Comments from friend verification
    friend_feedback: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'friend_verifications',
    timestamps: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['friend_id'] },
      { fields: ['match_id'] },
      { fields: ['status'] },
      { fields: ['user_id', 'friend_id', 'match_id'], unique: true }
    ]
  });

  FriendVerification.associate = (models) => {
    FriendVerification.belongsTo(models.User, { as: 'user', foreignKey: 'user_id' });
    FriendVerification.belongsTo(models.User, { as: 'friend', foreignKey: 'friend_id' });
    FriendVerification.belongsTo(models.Match, { foreignKey: 'match_id' });
  };

  return FriendVerification;
};
