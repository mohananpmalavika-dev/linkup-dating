'use strict';
module.exports = (sequelize, DataTypes) => {
  const DoubleDateGroup = sequelize.define('DoubleDateGroup', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    // The four participants
    user_id_1: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    user_id_2: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    friend_id_1: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    friend_id_2: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    // Double date details
    scheduled_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    activity: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Status: scheduled, in_progress, completed, cancelled
    status: {
      type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'scheduled'
    },
    // Group chat reference
    chatroom_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'chatrooms', key: 'id' },
      onDelete: 'SET NULL'
    },
    // Completion tracking
    marked_completed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL'
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Matching information
    match_id_pair_1: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'matches', key: 'id' },
      onDelete: 'SET NULL'
    },
    match_id_pair_2: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'matches', key: 'id' },
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
    tableName: 'double_date_groups',
    timestamps: false,
    indexes: [
      { fields: ['status'] },
      { fields: ['scheduled_date'] },
      { fields: ['created_at'] },
      { fields: ['user_id_1', 'user_id_2', 'friend_id_1', 'friend_id_2'] }
    ]
  });

  DoubleDateGroup.associate = (models) => {
    DoubleDateGroup.belongsTo(models.User, { as: 'user1', foreignKey: 'user_id_1' });
    DoubleDateGroup.belongsTo(models.User, { as: 'user2', foreignKey: 'user_id_2' });
    DoubleDateGroup.belongsTo(models.User, { as: 'friend1', foreignKey: 'friend_id_1' });
    DoubleDateGroup.belongsTo(models.User, { as: 'friend2', foreignKey: 'friend_id_2' });
    DoubleDateGroup.belongsTo(models.Chatroom, { foreignKey: 'chatroom_id' });
    DoubleDateGroup.belongsTo(models.Match, { as: 'pair1Match', foreignKey: 'match_id_pair_1' });
    DoubleDateGroup.belongsTo(models.Match, { as: 'pair2Match', foreignKey: 'match_id_pair_2' });
    DoubleDateGroup.hasMany(models.DoubleDateRating, { foreignKey: 'double_date_group_id' });
  };

  return DoubleDateGroup;
};
