'use strict';
module.exports = (sequelize, DataTypes) => {
  const DoubleDateRating = sequelize.define('DoubleDateRating', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    double_date_group_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'double_date_groups', key: 'id' },
      onDelete: 'CASCADE'
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    // Overall experience rating 1-5
    overall_rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 }
    },
    // Rating for each person in the group
    rating_for_user_2: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 }
    },
    rating_for_friend_1: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 }
    },
    rating_for_friend_2: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 }
    },
    // Comments about the double date
    review: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Would they want to do another double date with this group?
    would_do_again: {
      type: DataTypes.BOOLEAN,
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
    tableName: 'double_date_ratings',
    timestamps: false,
    indexes: [
      { fields: ['double_date_group_id'] },
      { fields: ['user_id'] },
      { fields: ['created_at'] }
    ]
  });

  DoubleDateRating.associate = (models) => {
    DoubleDateRating.belongsTo(models.DoubleDateGroup, { foreignKey: 'double_date_group_id' });
    DoubleDateRating.belongsTo(models.User, { as: 'rater', foreignKey: 'user_id' });
  };

  return DoubleDateRating;
};
