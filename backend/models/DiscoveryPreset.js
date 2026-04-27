const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DiscoveryPreset = sequelize.define(
    'DiscoveryPreset',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      preset_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'User-friendly name: "Weekend Vibes", "Serious Dating"'
      },
      preset_description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional description of preset'
      },
      filters_json: {
        type: DataTypes.JSON,
        allowNull: false,
        comment: 'Saved filter criteria: { ageMin, ageMax, distance, interests, goals, etc }'
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Is this the default search for this user'
      },
      usage_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Times this preset has been applied'
      },
      last_used_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When this preset was last used'
      },
      results_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Last count of matching profiles'
      },
      matches_from_preset: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Matches created from profiles found with this preset'
      },
      avg_profile_rating: {
        type: DataTypes.DECIMAL(3, 2),
        comment: 'Average quality rating of profiles from this search (1-5)'
      },
      icon: {
        type: DataTypes.STRING(50),
        defaultValue: '🔍',
        comment: 'Emoji icon for preset'
      },
      color_tag: {
        type: DataTypes.STRING(50),
        defaultValue: 'blue',
        comment: 'Color for visual categorization: blue, red, green, etc'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'discovery_presets',
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['user_id', 'is_default'] },
        { fields: ['user_id', 'last_used_at'] },
        { fields: ['user_id', 'matches_from_preset'] }
      ]
    }
  );

  DiscoveryPreset.associate = (db) => {
    DiscoveryPreset.belongsTo(db.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE'
    });
    DiscoveryPreset.hasMany(db.PresetPerformance, {
      foreignKey: 'preset_id',
      as: 'performances'
    });
  };

  return DiscoveryPreset;
};
