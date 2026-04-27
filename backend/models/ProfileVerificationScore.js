const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProfileVerificationScore = sequelize.define(
    'ProfileVerificationScore',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      photo_authenticity_score: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'AI-based photo verification (0-100)'
      },
      bio_consistency_score: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Consistency between photos, bio, interests'
      },
      activity_pattern_score: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Login/interaction patterns (0-100)'
      },
      verification_status: {
        type: DataTypes.ENUM('unverified', 'pending', 'verified', 'rejected'),
        defaultValue: 'unverified'
      },
      is_verified_photo: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Profile photo passed AI verification'
      },
      is_verified_email: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      is_verified_phone: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      is_verified_facebook: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      fraud_risk_level: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'suspicious'),
        defaultValue: 'low'
      },
      red_flags: {
        type: DataTypes.JSON,
        comment: 'Array of detected red flags: [photo_mismatch, new_account, rapid_changes, etc]'
      },
      ai_check_last_run: {
        type: DataTypes.DATE,
        comment: 'When AI verification last ran'
      },
      manual_review_status: {
        type: DataTypes.ENUM('none', 'pending', 'approved', 'rejected'),
        defaultValue: 'none'
      },
      manual_reviewer_id: {
        type: DataTypes.INTEGER,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL'
      },
      manual_review_date: {
        type: DataTypes.DATE
      },
      manual_review_notes: {
        type: DataTypes.TEXT
      },
      overall_trust_score: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Composite score (0-100) for profile trust'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: DataTypes.NOW
      }
    },
    {
      tableName: 'profile_verification_scores',
      timestamps: false,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['fraud_risk_level'] },
        { fields: ['verification_status'] }
      ]
    }
  );

  ProfileVerificationScore.associate = (db) => {
    ProfileVerificationScore.belongsTo(db.User, { foreignKey: 'user_id' });
    ProfileVerificationScore.belongsTo(db.User, { foreignKey: 'manual_reviewer_id', as: 'reviewer' });
  };

  return ProfileVerificationScore;
};
