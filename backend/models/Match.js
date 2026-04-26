module.exports = (sequelize, DataTypes) => {
  const Match = sequelize.define('Match', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
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
    matchedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'matched_at'
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'active',
      validate: {
        isIn: [['active', 'unmatched', 'blocked', 'paused']]
      }
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_message_at'
    },
    messageCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'message_count'
    }
  }, {
    tableName: 'matches',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['user_id_1', 'user_id_2'], unique: true },
      { fields: ['user_id_1'] },
      { fields: ['user_id_2'] },
      { fields: ['status'] },
      { fields: ['matched_at'] },
      { fields: ['last_message_at'] }
    ]
  });

  Match.associate = (models) => {
    Match.belongsTo(models.User, { foreignKey: 'user_id_1', as: 'user1', onDelete: 'CASCADE' });
    Match.belongsTo(models.User, { foreignKey: 'user_id_2', as: 'user2', onDelete: 'CASCADE' });
    Match.hasMany(models.Message, { foreignKey: 'match_id', as: 'messages', onDelete: 'CASCADE' });
    Match.hasMany(models.VideoDate, { foreignKey: 'match_id', as: 'videoDates', onDelete: 'CASCADE' });
  };

  return Match;
};
