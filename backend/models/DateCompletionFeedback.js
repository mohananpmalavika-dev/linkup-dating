module.exports = (sequelize, DataTypes) => {
  const DateCompletionFeedback = sequelize.define('DateCompletionFeedback', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    dateProposalId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'date_proposal_id',
      references: {
        model: 'date_proposals',
        key: 'id'
      }
    },
    raterUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'rater_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    counterpartyUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'counterparty_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    met: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'met',
      comment: 'Did the date actually happen?'
    },
    wasOnTime: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'was_on_time'
    },
    wouldSeeAgain: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'would_see_again'
    },
    conversationQuality: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'conversation_quality',
      validate: {
        min: 1,
        max: 5
      },
      comment: '1-5 stars'
    },
    physicalAttraction: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'physical_attraction',
      validate: {
        min: 1,
        max: 5
      }
    },
    overallRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'overall_rating',
      validate: {
        min: 1,
        max: 5
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'notes'
    },
    compatibility: {
      type: DataTypes.ENUM('not_compatible', 'maybe', 'compatible', 'very_compatible'),
      allowNull: true,
      field: 'compatibility'
    },
    wouldIntroduce: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'would_introduce',
      comment: 'Would recommend this person to a friend?'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'date_completion_feedback',
    timestamps: true
  });

  DateCompletionFeedback.associate = (models) => {
    DateCompletionFeedback.belongsTo(models.DateProposal, {
      foreignKey: 'dateProposalId'
    });
    DateCompletionFeedback.belongsTo(models.User, {
      foreignKey: 'raterUserId',
      as: 'rater'
    });
    DateCompletionFeedback.belongsTo(models.User, {
      foreignKey: 'counterpartyUserId',
      as: 'counterparty'
    });
  };

  return DateCompletionFeedback;
};
