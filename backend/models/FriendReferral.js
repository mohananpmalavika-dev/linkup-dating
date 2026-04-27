'use strict';
module.exports = (sequelize, DataTypes) => {
  const FriendReferral = sequelize.define('FriendReferral', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    referrer_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Users', key: 'id' }
    },
    referred_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Users', key: 'id' }
    },
    recipient_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Users', key: 'id' }
    },
    referral_type: {
      type: DataTypes.ENUM('romantic_setup'),
      allowNull: false,
      defaultValue: 'romantic_setup'
    },
    referral_message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    accepted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    match_result: {
      type: DataTypes.ENUM('pending', 'matched', 'met', 'still_talking'),
      defaultValue: 'pending',
      allowNull: false
    }
  }, {
    tableName: 'friend_referrals',
    timestamps: false
  });

  FriendReferral.associate = (models) => {
    FriendReferral.belongsTo(models.User, { as: 'referrer', foreignKey: 'referrer_user_id' });
    FriendReferral.belongsTo(models.User, { as: 'referred', foreignKey: 'referred_user_id' });
    FriendReferral.belongsTo(models.User, { as: 'recipient', foreignKey: 'recipient_user_id' });
  };

  return FriendReferral;
};
