/**
 * VideoVerificationBadge Model
 * Tracks users who have successfully passed AI video face verification
 * Shows ✅ badge on profile indicating verified identity
 */
module.exports = (sequelize, DataTypes) => {
  const VideoVerificationBadge = sequelize.define('VideoVerificationBadge', {
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
      unique: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    videoAuthenticationResultId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'video_authentication_result_id',
      references: {
        model: 'video_authentication_results',
        key: 'id'
      },
      comment: 'Link to the verification video analysis'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_verified',
      comment: 'TRUE if face matched profile photos with >90% confidence'
    },
    verificationStatus: {
      type: DataTypes.ENUM('pending', 'verified', 'failed', 'expired', 'revoked'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'verification_status',
      comment: 'Current badge status'
    },
    facialMatchScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      field: 'facial_match_score',
      validate: {
        min: 0,
        max: 1
      },
      comment: 'Face match percentage (>0.90 = verified)'
    },
    livenessScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      field: 'liveness_score',
      validate: {
        min: 0,
        max: 1
      },
      comment: 'Probability video is real person (not deepfake)'
    },
    overallAuthenticityScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      field: 'overall_authenticity_score',
      validate: {
        min: 0,
        max: 1
      },
      comment: 'Overall authenticity assessment'
    },
    riskFlags: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'risk_flags',
      comment: 'Array of detected risks: ["face_mismatch", "deepfake", "multiple_faces", "poor_quality"]'
    },
    verificationTimestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'verification_timestamp',
      defaultValue: DataTypes.NOW,
      comment: 'When verification was completed'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
      comment: 'Verification expiration date (e.g., 1 year from now)'
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejection_reason',
      comment: 'Why verification failed (if rejected)'
    },
    manualReviewFlag: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'manual_review_flag',
      comment: 'TRUE if verification flagged for manual review'
    },
    manualReviewNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'manual_review_notes',
      comment: 'Notes from manual review'
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
    tableName: 'video_verification_badges',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
        name: 'idx_badge_user_id'
      },
      {
        fields: ['is_verified'],
        name: 'idx_badge_verified'
      },
      {
        fields: ['verification_status'],
        name: 'idx_badge_status'
      },
      {
        fields: ['facial_match_score'],
        name: 'idx_badge_facial_match'
      },
      {
        fields: ['verification_timestamp'],
        name: 'idx_badge_timestamp'
      },
      {
        fields: ['expires_at'],
        name: 'idx_badge_expires'
      }
    ]
  });

  VideoVerificationBadge.associate = (models) => {
    VideoVerificationBadge.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    VideoVerificationBadge.belongsTo(models.VideoAuthenticationResult, {
      foreignKey: 'video_authentication_result_id',
      as: 'videoAuthenticationResult'
    });

    VideoVerificationBadge.belongsTo(models.DatingProfile, {
      foreignKey: 'user_id',
      targetKey: 'user_id',
      as: 'profile'
    });
  };

  /**
   * Instance Methods
   */
  VideoVerificationBadge.prototype.isExpired = function() {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
  };

  VideoVerificationBadge.prototype.getDisplayBadge = function() {
    if (this.verificationStatus === 'verified' && !this.isExpired()) {
      return {
        isVisible: true,
        icon: '✅',
        label: 'Video Verified',
        color: '#10b981', // green
        tooltip: `Face verified on ${new Date(this.verificationTimestamp).toLocaleDateString()}`
      };
    }
    return { isVisible: false };
  };

  /**
   * Static Methods
   */
  VideoVerificationBadge.getVerifiedUsers = async function(options = {}) {
    const {
      limit = 50,
      offset = 0,
      onlyActive = true
    } = options;

    const where = { verification_status: 'verified' };

    if (onlyActive) {
      where[sequelize.Op.or] = [
        { expires_at: null },
        { expires_at: { [sequelize.Op.gt]: sequelize.fn('NOW') } }
      ];
    }

    return this.findAll({
      where,
      limit,
      offset,
      include: [
        { association: 'user', attributes: ['id', 'email'] },
        { association: 'profile', attributes: ['username', 'first_name', 'age'] }
      ],
      order: [['verification_timestamp', 'DESC']]
    });
  };

  VideoVerificationBadge.isUserVerified = async function(userId) {
    const badge = await this.findOne({
      where: { user_id: userId, verification_status: 'verified' },
      raw: true
    });

    if (!badge) return false;
    if (badge.expires_at && new Date() > new Date(badge.expires_at)) return false;
    return true;
  };

  return VideoVerificationBadge;
};
