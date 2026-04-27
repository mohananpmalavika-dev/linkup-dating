module.exports = (sequelize, DataTypes) => {
  const DatingProfile = sequelize.define('DatingProfile', {
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
    username: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: true
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'first_name'
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 18,
        max: 120
      }
    },
    gender: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    locationCity: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'location_city'
    },
    locationState: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'location_state'
    },
    locationCountry: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'location_country'
    },
    locationLat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      field: 'location_lat'
    },
    locationLng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      field: 'location_lng'
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Height in centimeters'
    },
    bodyType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'body_type'
    },
    ethnicity: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    religion: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    smoking: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    drinking: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    hasKids: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'has_kids'
    },
    wantsKids: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'wants_kids'
    },
    occupation: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    education: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    relationshipGoals: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'relationship_goals'
    },
    interests: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      allowNull: true
    },
    profileVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'profile_verified'
    },
    verifications: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true
    },
    profileCompletionPercent: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'profile_completion_percent',
      validate: {
        min: 0,
        max: 100
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    lastActive: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_active'
    },
    // New fields for enhanced matching
    languages: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      allowNull: true
    },
    zodiacSign: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'zodiac_sign'
    },
    personalityType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'personality_type'
    },
    politicalViews: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'political_views'
    },
    exerciseFrequency: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'exercise_frequency'
    },
    diet: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    pets: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    cannabis: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    lookingFor: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      allowNull: true,
      field: 'looking_for'
    },
    voiceIntroUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'voice_intro_url'
    },
    voiceIntroDurationSeconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'voice_intro_duration_seconds'
    },
    videoIntroUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'video_intro_url'
    },
    // Photo verification fields
    verificationPhotoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'verification_photo_url'
    },
    verificationStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'verification_status',
      validate: {
        isIn: [['none', 'pending', 'approved', 'rejected']]
      },
      defaultValue: 'none'
    },
    verificationPose: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'verification_pose'
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verified_at'
    }
  }, {
    tableName: 'dating_profiles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id'], unique: true },
      { fields: ['username'], unique: true },
      { fields: ['age'] },
      { fields: ['gender'] },
      { fields: ['location_city'] },
      { fields: ['location_state'] },
      { fields: ['relationship_goals'] },
      { fields: ['is_active'] },
      { fields: ['profile_verified'] },
      { fields: ['last_active'] },
      { fields: ['profile_completion_percent'] },
      // Geospatial index for location-based queries
      { fields: ['location_lat', 'location_lng'] }
    ]
  });

  DatingProfile.associate = (models) => {
    DatingProfile.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return DatingProfile;
};
