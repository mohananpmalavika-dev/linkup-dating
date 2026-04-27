module.exports = (sequelize, DataTypes) => {
  const DateProposal = sequelize.define('DateProposal', {
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
    proposerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'proposer_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    recipientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'recipient_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    proposedDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'proposed_date'
    },
    proposedTime: {
      type: DataTypes.TIME,
      allowNull: false,
      field: 'proposed_time'
    },
    suggestedActivity: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'suggested_activity'
    },
    locationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'location_id'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'notes'
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'declined', 'cancelled'),
      defaultValue: 'pending',
      field: 'status'
    },
    responseDeadlineAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'response_deadline_at'
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'responded_at'
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
    tableName: 'date_proposals',
    timestamps: true
  });

  DateProposal.associate = (models) => {
    DateProposal.belongsTo(models.Match, {
      foreignKey: 'matchId'
    });
    DateProposal.belongsTo(models.User, {
      foreignKey: 'proposerId',
      as: 'proposer'
    });
    DateProposal.belongsTo(models.User, {
      foreignKey: 'recipientId',
      as: 'recipient'
    });
  };

  return DateProposal;
};
