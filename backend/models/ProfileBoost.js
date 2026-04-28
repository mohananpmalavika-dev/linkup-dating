/**
 * Boost Model
 * Profile visibility boost system with smart scheduling and analytics
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProfileBoost = sequelize.define(
    'ProfileBoost',
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
        onDelete: 'CASCADE',
        comment: 'User whose profile is boosted'
      },
      boost_type: {
        type: DataTypes.ENUM('standard', 'premium', 'ultimate'),
        defaultValue: 'standard',
        comment: 'standard: 1hr 3x, premium: 2hr 5x, ultimate: 3hr 10x'
      },
      visibility_multiplier: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: false,
        comment: 'How many times more visible (3, 5, or 10)'
      },
      duration_minutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Duration in minutes (60, 120, or 180)'
      },
      price_paid: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Price paid in USD'
      },
      status: {
        type: DataTypes.ENUM('scheduled', 'active', 'completed', 'cancelled'),
        defaultValue: 'scheduled',
        comment: 'Current status of boost'
      },
      scheduled_start: {
        type: DataTypes.DATE,
        comment: 'When boost should start (smart scheduled or immediate)'
      },
      started_at: {
        type: DataTypes.DATE,
        comment: 'When boost actually started'
      },
      expires_at: {
        type: DataTypes.DATE,
        comment: 'When boost will/did expire'
      },
      cancelled_at: {
        type: DataTypes.DATE,
        comment: 'When cancelled (if applicable)'
      },
      impressions: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Times profile shown with boost'
      },
      clicks: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Profile view clicks during boost'
      },
      likes_received: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Likes during boost period'
      },
      messages_received: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Messages during boost period'
      },
      smart_scheduling_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Use AI to schedule at optimal time'
      },
      target_gender: {
        type: DataTypes.STRING(50),
        comment: 'Gender audience for smart scheduling'
      },
      target_age_min: {
        type: DataTypes.INTEGER,
        comment: 'Min age for smart scheduling'
      },
      target_age_max: {
        type: DataTypes.INTEGER,
        comment: 'Max age for smart scheduling'
      },
      optimal_day_of_week: {
        type: DataTypes.INTEGER,
        comment: '0-6 (Monday-Sunday) - best day to show'
      },
      optimal_hour: {
        type: DataTypes.INTEGER,
        comment: '0-23 - best hour to show (server timezone)'
      },
      ctr: {
        type: DataTypes.DECIMAL(5, 2),
        comment: 'Click-through rate percentage'
      },
      roi: {
        type: DataTypes.DECIMAL(5, 2),
        comment: 'Return on investment (likes + messages vs cost)'
      },
      notes: {
        type: DataTypes.TEXT,
        comment: 'User notes about the boost'
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
      tableName: 'profile_boosts',
      timestamps: false,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['user_id', 'status'] },
        { fields: ['status'] },
        { fields: ['expires_at'] },
        { fields: ['scheduled_start'] }
      ]
    }
  );

  ProfileBoost.associate = (db) => {
    ProfileBoost.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
  };

  return ProfileBoost;
};
