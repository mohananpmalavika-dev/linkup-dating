module.exports = (sequelize, DataTypes) => {
  const UserPreference = sequelize.define('UserPreference', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    ageRangeMin: {
      type: DataTypes.INTEGER,
      defaultValue: 18,
      field: 'age_range_min',
      validate: { min: 18, max: 120 }
    },
    ageRangeMax: {
      type: DataTypes.INTEGER,
      defaultValue: 50,
      field: 'age_range_max',
      validate: { min: 18, max: 120 }
    },
    locationRadius: {
      type: DataTypes.INTEGER,
      defaultValue: 50,
      field: 'location_radius',
      comment: 'Radius in kilometers'
    },
    genderPreferences: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      field: 'gender_preferences'
    },
    relationshipGoals: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      field: 'relationship_goals'
    },
    interests: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    heightRangeMin: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'height_range_min'
    },
    heightRangeMax: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'height_range_max'
    },
    bodyTypes: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      field: 'body_types'
    },
    showMyProfile: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'show_my_profile'
    },
    allowMessages: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'allow_messages'
    },
    notificationsEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'notifications_enabled'
    },
    dealBreakers: {
      type: DataTypes.JSONB,
      defaultValue: {},
      field: 'deal_breakers'
    },
    preferenceFlexibility: {
      type: DataTypes.JSONB,
      defaultValue: {
        mode: 'balanced',
        learnFromActivity: true
      },
      field: 'preference_flexibility'
    },
    compatibilityAnswers: {
      type: DataTypes.JSONB,
      defaultValue: {},
      field: 'compatibility_answers'
    },
    learningProfile: {
      type: DataTypes.JSONB,
      defaultValue: {
        positiveSignals: {
          interests: {},
          relationshipGoals: {},
          bodyTypes: {},
          ageBands: {},
          verification: {}
        },
        negativeSignals: {
          interests: {},
          relationshipGoals: {},
          bodyTypes: {},
          ageBands: {},
          verification: {}
        },
        totalPositiveActions: 0,
        totalNegativeActions: 0,
        lastInteractionAt: null
      },
      field: 'learning_profile'
    }
  }, {
    tableName: 'user_preferences',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id'], unique: true }
    ]
  });

  UserPreference.associate = (models) => {
    UserPreference.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return UserPreference;
};
