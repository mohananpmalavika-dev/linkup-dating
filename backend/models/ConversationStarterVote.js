/**
 * ConversationStarterVote Model
 * Tracks votes for best conversation starters (for leaderboard)
 */

module.exports = (sequelize, DataTypes) => {
  const ConversationStarterVote = sequelize.define('ConversationStarterVote', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    votedForUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'voted_for_user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'User receiving the vote'
    },
    votedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'voted_by_user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      comment: 'User casting the vote'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Why this person is a great conversation starter'
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
    tableName: 'conversation_starter_votes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        fields: ['voted_for_user_id', 'voted_by_user_id'],
        unique: true,
        name: 'unique_voter_votee'
      },
      {
        fields: ['voted_for_user_id'],
        name: 'votes_received_idx'
      }
    ]
  });

  ConversationStarterVote.associate = (models) => {
    ConversationStarterVote.belongsTo(models.User, {
      foreignKey: 'voted_for_user_id',
      as: 'votedForUser'
    });
    ConversationStarterVote.belongsTo(models.User, {
      foreignKey: 'voted_by_user_id',
      as: 'votedByUser'
    });
  };

  return ConversationStarterVote;
};
