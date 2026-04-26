/**
 * UserActivity Model
 * Tracks user activities: typing, viewing profiles, calls, etc.
 */
module.exports = (sequelize, DataTypes) => {
  const UserActivity = sequelize.define(
    'UserActivity',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      activityType: {
        type: DataTypes.ENUM(
          'typing',
          'viewing_profile',
          'voice_calling',
          'video_calling',
          'in_chat',
          'idle'
        ),
        allowNull: false,
        defaultValue: 'idle'
      },
      matchId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Matches',
          key: 'id'
        }
      },
      targetUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      startTime: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      endTime: {
        type: DataTypes.DATE,
        allowNull: true
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Duration in seconds'
      },
      deviceType: {
        type: DataTypes.ENUM('web', 'mobile', 'tablet', 'desktop'),
        allowNull: true,
        defaultValue: 'web'
      },
      platform: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Browser/OS information'
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {}
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'UserActivities',
      indexes: [
        { fields: ['userId'] },
        { fields: ['userId', 'activityType'] },
        { fields: ['matchId'] },
        { fields: ['targetUserId'] },
        { fields: ['isActive'] },
        { fields: ['createdAt'] }
      ]
    }
  );

  UserActivity.associate = (models) => {
    UserActivity.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    UserActivity.belongsTo(models.User, {
      foreignKey: 'targetUserId',
      as: 'targetUser'
    });
    UserActivity.belongsTo(models.Match, {
      foreignKey: 'matchId',
      as: 'match'
    });
  };

  return UserActivity;
};
