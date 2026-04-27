module.exports = (sequelize, DataTypes) => {
  const VideoAuthenticationResult = sequelize.define('VideoAuthenticationResult', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    videoIntroUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'video_intro_url'
    },
    videoUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'video_url'
    },
    analysisType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'analysis_type',
      validate: {
        isIn: [['facial_match', 'frame_consistency', 'liveness_detection', 'background_analysis']]
      }
    },
    overallAuthenticityScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      field: 'overall_authenticity_score',
      validate: {
        min: 0,
        max: 1
      },
      comment: '0.0 = likely fake, 1.0 = likely authentic'
    },
    facialMatchScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      field: 'facial_match_score',
      validate: {
        min: 0,
        max: 1
      },
      comment: 'Similarity between video face and profile photos'
    },
    frameConsistencyScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      field: 'frame_consistency_score',
      validate: {
        min: 0,
        max: 1
      },
      comment: 'Consistency of facial features throughout video'
    },
    livenessDetectionScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      field: 'liveness_detection_score',
      validate: {
        min: 0,
        max: 1
      },
      comment: 'Probability video is live person (not deepfake/video replay)'
    },
    backgroundAnalysisScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      field: 'background_analysis_score',
      validate: {
        min: 0,
        max: 1
      },
      comment: 'Consistency of background/environment'
    },
    riskFlags: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'risk_flags',
      comment: 'Array of detected risk indicators: ["face_mismatch", "deepfake_detected", "multiple_faces", "poor_lighting", "video_edited"]'
    },
    fraudFlagId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'fraud_flag_id',
      references: {
        model: 'fraud_flags',
        key: 'id'
      },
      comment: 'Link to FraudFlag if fraud was detected'
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'status',
      validate: {
        isIn: [['pending', 'analyzing', 'completed', 'failed']]
      },
      defaultValue: 'pending'
    },
    analysisError: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'analysis_error',
      comment: 'Error message if analysis failed'
    },
    analysisMetadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'analysis_metadata',
      comment: 'Additional analysis details: frames_analyzed, duration_seconds, model_version'
    },
    reviewedByAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'reviewed_by_admin'
    },
    adminNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'admin_notes'
    }
  }, {
    tableName: 'video_authentication_results',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['overall_authenticity_score'] },
      { fields: ['created_at'] },
      { fields: ['fraud_flag_id'] }
    ]
  });

  VideoAuthenticationResult.associate = (models) => {
    VideoAuthenticationResult.belongsTo(models.User, { 
      foreignKey: 'user_id', 
      as: 'user', 
      onDelete: 'CASCADE' 
    });
    VideoAuthenticationResult.belongsTo(models.FraudFlag, { 
      foreignKey: 'fraud_flag_id', 
      as: 'fraudFlag', 
      onDelete: 'SET NULL' 
    });
  };

  return VideoAuthenticationResult;
};
