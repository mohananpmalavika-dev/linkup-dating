'use strict';
module.exports = (sequelize, DataTypes) => {
  const UserAchievement = sequelize.define('UserAchievement', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'Users', key: 'id' }
    },
    badge_type: {
      type: DataTypes.ENUM(
        'first_match', 'great_communicator', 'popular', 'superstar',
        'date_master', 'matchmaker', 'traveler', 'reliable',
        'quiz_master', 'consistent', 'on_fire', 'mvp'
      ),
      allowNull: false
    },
    earned_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    progress: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    created_at: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'user_achievements',
    timestamps: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['user_id', 'badge_type'] },
      { fields: ['badge_type'] }
    ]
  });

  UserAchievement.associate = (models) => {
    UserAchievement.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return UserAchievement;
};
