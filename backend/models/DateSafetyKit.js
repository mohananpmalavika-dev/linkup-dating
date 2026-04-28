const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DateSafetyKit = sequelize.define('DateSafetyKit', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'Users', key: 'id' },
    },
    trusted_friend_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      comment: 'Designated trusted friend receiving location',
    },
    date_match_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Matches', key: 'id' },
      comment: 'Associated match for the date',
    },
    session_status: {
      type: DataTypes.ENUM('active', 'inactive', 'paused', 'completed', 'emergency'),
      defaultValue: 'inactive',
      comment: 'Current session state',
    },
    sharing_start_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When location sharing started',
    },
    sharing_end_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When location sharing ended',
    },
    share_duration_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 180,
      comment: 'Duration of location sharing (default 3 hours)',
    },
    current_latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      comment: 'Current user latitude',
    },
    current_longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      comment: 'Current user longitude',
    },
    last_location_update: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last location update timestamp',
    },
    check_in_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of check-ins during this session',
    },
    last_check_in_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last check-in timestamp',
    },
    last_check_in_status: {
      type: DataTypes.ENUM('good', 'ok', 'help'),
      allowNull: true,
      comment: 'Status from last check-in',
    },
    sos_activated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether SOS was activated',
    },
    sos_activated_time: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When SOS was activated',
    },
    sos_location_latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      comment: 'Location when SOS activated',
    },
    sos_location_longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      comment: 'Location when SOS activated',
    },
    emergency_contact_called: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether emergency was contacted',
    },
    emergency_contact_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Emergency number that was called',
    },
    safety_tips_acknowledged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'User acknowledged safety tips',
    },
    location_history: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: 'Array of location points during session',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User notes about the date/session',
    },
    session_end_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notes about how date ended',
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'date_safety_kits',
    timestamps: true,
    underscored: true,
  });

  DateSafetyKit.associate = (models) => {
    DateSafetyKit.belongsTo(models.User, { 
      foreignKey: 'user_id', 
      as: 'user',
    });
    DateSafetyKit.belongsTo(models.User, { 
      foreignKey: 'trusted_friend_id', 
      as: 'trustedFriend',
    });
    DateSafetyKit.belongsTo(models.Match, { 
      foreignKey: 'date_match_id', 
      as: 'match',
    });
  };

  // Index for performance
  // Note: Syncing is handled by utils/syncModels.js in controlled order
  // DateSafetyKit.sync({ alter: false }).then(() => {
  //   sequelize.query(`
  //     CREATE INDEX IF NOT EXISTS idx_date_safety_user_status 
  //     ON date_safety_kits(user_id, session_status);
      
      CREATE INDEX IF NOT EXISTS idx_date_safety_friend 
      ON date_safety_kits(trusted_friend_id, session_status);
      
      CREATE INDEX IF NOT EXISTS idx_date_safety_match 
      ON date_safety_kits(date_match_id);
      
      CREATE INDEX IF NOT EXISTS idx_date_safety_sos 
      ON date_safety_kits(sos_activated, created_at DESC);
    `).catch(() => {});
  });

  return DateSafetyKit;
};
