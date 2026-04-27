'use strict';
module.exports = (sequelize, DataTypes) => {
  const DatingGoal = sequelize.define('DatingGoal', {
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
    goal_type: {
      type: DataTypes.ENUM(
        'find_matches', 'go_on_dates', 'serious_relationship',
        'meet_at_event', 'profile_completion', 'daily_active'
      ),
      allowNull: false
    },
    goal_description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    deadline: {
      type: DataTypes.DATE,
      allowNull: true
    },
    target_count: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    current_progress: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('active', 'completed', 'abandoned', 'paused'),
      defaultValue: 'active',
      allowNull: false
    },
    progress_metrics: {
      type: DataTypes.JSON,
      defaultValue: {},
      allowNull: false
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
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'dating_goals',
    timestamps: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['user_id', 'status'] },
      { fields: ['status'] }
    ]
  });

  DatingGoal.associate = (models) => {
    DatingGoal.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return DatingGoal;
};
