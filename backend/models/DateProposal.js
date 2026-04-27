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
    initiatorUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'initiator_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    recipientUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'recipient_user_id',
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
    activityType: {
      type: DataTypes.ENUM('coffee', 'dinner', 'lunch', 'walk', 'drinks', 'activity', 'virtual_date', 'other'),
      defaultValue: 'coffee',
      field: 'activity_type'
    },
    proposedLocationName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'proposed_location_name'
    },
    proposedLocationLat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      field: 'proposed_location_lat'
    },
    proposedLocationLng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      field: 'proposed_location_lng'
    },
    proposedLocationVenueId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'proposed_location_venue_id'
    },
    durationHours: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      field: 'duration_hours'
    },
    initiatorNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'initiator_notes'
    },
    status: {
      type: DataTypes.ENUM('proposed', 'accepted', 'declined', 'completed', 'no_show', 'rescheduled', 'cancelled'),
      defaultValue: 'proposed',
      field: 'status'
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'responded_at'
    },
    declineReason: {
      type: DataTypes.ENUM('busy_that_week', 'not_interested', 'location_issue', 'time_issue', 'other'),
      allowNull: true,
      field: 'decline_reason'
    },
    declineNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'decline_notes'
    },
    actualMeetTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'actual_meet_time'
    },
    durationMinutesActual: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'duration_minutes_actual'
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
      foreignKey: 'initiatorUserId',
      as: 'initiator'
    });
    DateProposal.belongsTo(models.User, {
      foreignKey: 'recipientUserId',
      as: 'recipient'
    });
  };

  return DateProposal;
};
