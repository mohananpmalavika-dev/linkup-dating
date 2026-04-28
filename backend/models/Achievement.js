/**
 * Achievement Model
 * Defines available achievements and badges in the system
 */

module.exports = (sequelize, DataTypes) => {
  const Achievement = sequelize.define('Achievement', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'Unique identifier like CONVERSATION_MASTER'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Display name like "Conversation Master"'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Achievement description'
    },
    emoji: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'Badge emoji like 🎯'
    },
    category: {
      type: DataTypes.ENUM(
        'messaging',
        'verification',
        'video',
        'profile_quality',
        'responsiveness',
        'engagement',
        'community'
      ),
      allowNull: false,
      comment: 'Category of achievement'
    },
    tier: {
      type: DataTypes.ENUM('bronze', 'silver', 'gold', 'platinum', 'diamond'),
      defaultValue: 'bronze',
      comment: 'Achievement tier level'
    },
    requirementType: {
      type: DataTypes.ENUM(
        'message_count',
        'verification',
        'video_calls',
        'profile_likes',
        'response_time',
        'reaction_count',
        'streak_days',
        'manual'
      ),
      allowNull: false,
      field: 'requirement_type'
    },
    requirementValue: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'requirement_value',
      comment: 'Numeric threshold for requirement'
    },
    rarity: {
      type: DataTypes.ENUM('common', 'uncommon', 'rare', 'epic', 'legendary'),
      defaultValue: 'common',
      comment: 'Rarity affects badge color and prominence'
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
      comment: 'Achievement points for gamification'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at'
    }
  }, {
    tableName: 'achievements',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
  });

  Achievement.associate = (models) => {
    Achievement.hasMany(models.UserAchievement, {
      foreignKey: 'achievement_id',
      as: 'userAchievements',
      onDelete: 'CASCADE'
    });
  };

  return Achievement;
};
