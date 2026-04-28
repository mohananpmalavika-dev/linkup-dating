/**
 * Daily Challenge Model
 * Defines available daily challenges that users can complete
 */

module.exports = (sequelize, DataTypes) => {
  const DailyChallenge = sequelize.define('DailyChallenge', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    challengeCode: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'challenge_code',
      comment: 'Unique identifier like UPDATE_PHOTO_MON'
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      comment: 'Challenge title e.g., "Update 1 new photo"'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Detailed challenge description'
    },
    type: {
      type: DataTypes.ENUM(
        'update_photo',
        'answer_prompts',
        'schedule_video_call',
        'send_message',
        'complete_profile',
        'verify_identity'
      ),
      allowNull: false,
      comment: 'Type of challenge'
    },
    dayOfWeek: {
      type: DataTypes.ENUM(
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday'
      ),
      allowNull: false,
      field: 'day_of_week',
      comment: 'Which day of the week this challenge is available'
    },
    targetCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'target_count',
      comment: 'How many items need to be completed (e.g., 5 prompts)'
    },
    rewardPoints: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 50,
      field: 'reward_points',
      comment: 'Discovery boost points awarded for completion'
    },
    icon: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'Emoji icon for the challenge',
      defaultValue: '🎯'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
      comment: 'Whether challenge is currently active'
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Display order in UI'
    }
  }, {
    tableName: 'daily_challenges',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['challenge_code'], unique: true },
      { fields: ['day_of_week'] },
      { fields: ['is_active'] }
    ]
  });

  return DailyChallenge;
};
