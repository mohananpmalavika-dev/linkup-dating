const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PresetPerformance = sequelize.define(
    'PresetPerformance',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      preset_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'discovery_presets', key: 'id' },
        onDelete: 'CASCADE'
      },
      performance_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Date of this performance measurement'
      },
      views_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Profiles viewed using this preset'
      },
      likes_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Profiles liked from this preset'
      },
      superlikes_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Superlikes sent from this preset'
      },
      matches_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Matches created from this preset'
      },
      conversations_started: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of conversations started from these matches'
      },
      engagement_rate: {
        type: DataTypes.DECIMAL(5, 2),
        comment: '% of viewed profiles that were liked/superliked'
      },
      response_rate: {
        type: DataTypes.DECIMAL(5, 2),
        comment: '% of likes/superlikes that resulted in matches'
      },
      avg_response_time: {
        type: DataTypes.INTEGER,
        comment: 'Average time (minutes) for matched profile to respond'
      },
      quality_score: {
        type: DataTypes.DECIMAL(5, 2),
        comment: 'ML-calculated quality (0-100) of matches from this preset'
      },
      user_feedback_rating: {
        type: DataTypes.DECIMAL(3, 2),
        comment: 'User\'s manual rating of preset quality (1-5 stars)'
      },
      notes: {
        type: DataTypes.TEXT,
        comment: 'User notes on this preset performance'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'preset_performance',
      timestamps: false,
      underscored: true,
      indexes: [
        { fields: ['preset_id'] },
        { fields: ['preset_id', 'performance_date'] },
        { fields: ['quality_score'] }
      ]
    }
  );

  PresetPerformance.associate = (db) => {
    PresetPerformance.belongsTo(db.DiscoveryPreset, {
      foreignKey: 'preset_id',
      as: 'preset'
    });
  };

  return PresetPerformance;
};
