/**
 * PreferencesPriority Model
 * Premium subscription for top placement in filtered searches with weekly rotation
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PreferencesPriority = sequelize.define(
    'PreferencesPriority',
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
        comment: 'User who has priority subscription'
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'cancelled'),
        defaultValue: 'active',
        comment: 'Subscription status'
      },
      price_per_month: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 9.99,
        allowNull: false,
        comment: 'Monthly subscription cost'
      },
      billing_cycle_start: {
        type: DataTypes.DATE,
        comment: 'When current billing cycle started'
      },
      billing_cycle_end: {
        type: DataTypes.DATE,
        comment: 'When current billing cycle ends'
      },
      next_renewal: {
        type: DataTypes.DATE,
        comment: 'When subscription auto-renews'
      },
      auto_renew: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Auto-renew subscription'
      },
      cancelled_at: {
        type: DataTypes.DATE,
        comment: 'When subscription was cancelled'
      },
      cancellation_reason: {
        type: DataTypes.STRING(255),
        comment: 'Why user cancelled'
      },
      rotation_week_position: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Position in rotation (0-3) for weekly fairness'
      },
      last_rotation_date: {
        type: DataTypes.DATE,
        comment: 'Last time rotation was calculated'
      },
      current_week_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Is priority active this week'
      },
      weekly_rotation_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Use fairness rotation algorithm'
      },
      impressions_this_month: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Profile views this billing cycle'
      },
      matches_this_month: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Matches received this billing cycle'
      },
      priority_ranking_boost: {
        type: DataTypes.DECIMAL(3, 1),
        defaultValue: 100.0,
        comment: 'Search ranking multiplier (100% = top placement)'
      },
      total_spent: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        comment: 'Total spent on priority subscriptions'
      },
      total_months_active: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Total months user has had priority'
      },
      loyalty_discount_percent: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Loyalty discount percentage (max 25%)'
      },
      notes: {
        type: DataTypes.TEXT,
        comment: 'Admin notes'
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
      tableName: 'preferences_priority',
      timestamps: false,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['status'] },
        { fields: ['current_week_active'] },
        { fields: ['next_renewal'] },
        { fields: ['user_id', 'status'] }
      ]
    }
  );

  PreferencesPriority.associate = (db) => {
    PreferencesPriority.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });
  };

  return PreferencesPriority;
};
