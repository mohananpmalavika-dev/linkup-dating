'use strict';
module.exports = (sequelize, DataTypes) => {
  const DoubleDateRequest = sequelize.define('DoubleDateRequest', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    // First user in the request (usually initiator)
    user_id_1: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    // Second user in the request (matched with user_id_1)
    user_id_2: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    // First user's friend
    friend_id_1: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    // Second user's friend (must also be match of first user's friend)
    friend_id_2: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    // Who initiated the request
    initiated_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    // Status: pending, accepted_by_user_1, accepted_by_user_2, accepted_by_friend_1, accepted_by_friend_2, all_accepted, rejected, cancelled
    status: {
      type: DataTypes.ENUM(
        'pending',
        'accepted_by_user_1',
        'accepted_by_user_2',
        'accepted_by_friend_1',
        'accepted_by_friend_2',
        'all_accepted',
        'rejected',
        'cancelled'
      ),
      allowNull: false,
      defaultValue: 'pending'
    },
    // Proposal details
    proposed_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    proposed_location: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    proposed_activity: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Track who approved what
    user_1_approved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    user_2_approved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    friend_1_approved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    friend_2_approved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Double date group reference
    double_date_group_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'double_date_groups', key: 'id' },
      onDelete: 'SET NULL'
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
    tableName: 'double_date_requests',
    timestamps: false,
    indexes: [
      { fields: ['user_id_1', 'user_id_2'] },
      { fields: ['initiated_by'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
      { fields: ['friend_id_1', 'friend_id_2'] }
    ]
  });

  DoubleDateRequest.associate = (models) => {
    DoubleDateRequest.belongsTo(models.User, { as: 'user1', foreignKey: 'user_id_1' });
    DoubleDateRequest.belongsTo(models.User, { as: 'user2', foreignKey: 'user_id_2' });
    DoubleDateRequest.belongsTo(models.User, { as: 'friend1', foreignKey: 'friend_id_1' });
    DoubleDateRequest.belongsTo(models.User, { as: 'friend2', foreignKey: 'friend_id_2' });
    DoubleDateRequest.belongsTo(models.User, { as: 'initiator', foreignKey: 'initiated_by' });
    DoubleDateRequest.belongsTo(models.DoubleDateGroup, { foreignKey: 'double_date_group_id' });
  };

  return DoubleDateRequest;
};
