module.exports = (sequelize, DataTypes) => {
  const VideoDate = sequelize.define('VideoDate', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    matchId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'match_id',
      references: {
        model: 'matches',
        key: 'id'
      }
    },
    userId1: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id_1',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    userId2: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id_2',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'scheduled_at'
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'started_at'
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'ended_at'
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'scheduled',
      validate: {
        isIn: [['scheduled', 'ongoing', 'completed', 'cancelled', 'missed']]
      }
    },
    roomId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'room_id'
    },
    durationSeconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'duration_seconds'
    }
  }, {
    tableName: 'video_dates',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['match_id'] },
      { fields: ['user_id_1'] },
      { fields: ['user_id_2'] },
      { fields: ['status'] },
      { fields: ['scheduled_at'] }
    ]
  });

  VideoDate.associate = (models) => {
    VideoDate.belongsTo(models.Match, { foreignKey: 'match_id', as: 'match', onDelete: 'CASCADE' });
    VideoDate.belongsTo(models.User, { foreignKey: 'user_id_1', as: 'user1', onDelete: 'CASCADE' });
    VideoDate.belongsTo(models.User, { foreignKey: 'user_id_2', as: 'user2', onDelete: 'CASCADE' });
  };

  return VideoDate;
};
