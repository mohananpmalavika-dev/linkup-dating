/**
 * User Daily Challenge Model
 * Tracks which daily challenges each user has completed
 */

module.exports = (sequelize, DataTypes) => {
  const UserDailyChallenge = sequelize.define('UserDailyChallenge', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    dailyChallengeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'daily_challenge_id',
      references: {
        model: 'daily_challenges',
        key: 'id'
      }
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at',
      comment: 'When the challenge was completed'
    },
    progressCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'progress_count',
      comment: 'Current progress towards completion'
    },
    pointsEarned: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'points_earned',
      comment: 'Points awarded for this challenge'
    },
    isCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_completed',
      comment: 'Whether challenge is completed'
    },
    claimedRewardAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'claimed_reward_at',
      comment: 'When the user claimed the reward'
    },
    challengeDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'challenge_date',
      comment: 'The date this challenge instance is for'
    }
  }, {
    tableName: 'user_daily_challenges',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id', 'daily_challenge_id', 'challenge_date'], unique: true },
      { fields: ['user_id', 'challenge_date'] },
      { fields: ['user_id', 'is_completed'] },
      { fields: ['completed_at'] }
    ]
  });

  UserDailyChallenge.associate = (models) => {
    UserDailyChallenge.belongsTo(models.User, { foreignKey: 'user_id' });
    UserDailyChallenge.belongsTo(models.DailyChallenge, { foreignKey: 'daily_challenge_id' });
  };

  return UserDailyChallenge;
};
