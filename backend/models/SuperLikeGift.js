const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SuperLikeGift = sequelize.define(
    'SuperLikeGift',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      receiver_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      interaction_id: {
        type: DataTypes.INTEGER,
        references: { model: 'interactions', key: 'id' },
        onDelete: 'SET NULL'
      },
      gift_type: {
        type: DataTypes.ENUM('opening_message', 'conversation_starter', 'date_idea', 'verification_badge'),
        allowNull: false,
        comment: 'Type of message/signal sent with superlike'
      },
      gift_message: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'The actual message text (max 500 chars)'
      },
      verification_type: {
        type: DataTypes.ENUM('none', 'photo_verified', 'video_call', 'in_person'),
        defaultValue: 'none',
        comment: 'Verification badge shown (premium feature)'
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      read_at: {
        type: DataTypes.DATE
      },
      receiver_response: {
        type: DataTypes.ENUM('none', 'liked', 'passed', 'matched'),
        defaultValue: 'none'
      },
      response_at: {
        type: DataTypes.DATE,
        comment: 'When receiver responded'
      },
      sent_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: DataTypes.NOW
      }
    },
    {
      tableName: 'superlike_gifts',
      timestamps: false,
      indexes: [
        { fields: ['sender_id'] },
        { fields: ['receiver_id'] },
        { fields: ['receiver_id', 'is_read'] },
        { fields: ['sent_at'] }
      ]
    }
  );

  SuperLikeGift.associate = (db) => {
    SuperLikeGift.belongsTo(db.User, { foreignKey: 'sender_id', as: 'sender' });
    SuperLikeGift.belongsTo(db.User, { foreignKey: 'receiver_id', as: 'receiver' });
    if (db.Interaction) {
      SuperLikeGift.belongsTo(db.Interaction, { foreignKey: 'interaction_id' });
    }
  };

  return SuperLikeGift;
};
