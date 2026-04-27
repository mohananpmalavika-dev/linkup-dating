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
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'rating',
      validate: {
        min: 1,
        max: 5
      }
    },
    feedbackText: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'feedback_text'
    },
    wouldDateAgain: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'would_date_again'
    },
    matchQualityRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'match_quality_rating',
      validate: {
        min: 1,
        max: 5
      }
    },
    locationRating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'location_rating',
      validate: {
        min: 1,
        max: 5
      }
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
    timestamps: true,
    indexes: [
      {
        fields: ['date_proposal_id', 'rater_user_id']
      }
    ]
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
