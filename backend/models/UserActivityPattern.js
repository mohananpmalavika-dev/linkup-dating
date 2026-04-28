/**
 * UserActivityPattern Model
 * Tracks user activity patterns to determine optimal notification times
 */

module.exports = (sequelize, DataTypes) => {
  const UserActivityPattern = sequelize.define(
    'UserActivityPattern',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },

      // Hourly Activity (0-23 hours)
      // Stores average open rate or activity count per hour
      hour_0_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_1_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_2_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_3_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_4_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_5_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_6_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_7_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_8_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_9_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_10_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_11_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_12_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_13_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_14_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_15_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_16_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_17_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_18_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_19_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_20_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_21_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_22_activity: { type: DataTypes.INTEGER, defaultValue: 0 },
      hour_23_activity: { type: DataTypes.INTEGER, defaultValue: 0 },

      // Notification Open Rate by Hour
      hour_0_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_1_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_2_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_3_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_4_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_5_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_6_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_7_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_8_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_9_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_10_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_11_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_12_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_13_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_14_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_15_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_16_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_17_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_18_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_19_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_20_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_21_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_22_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
      hour_23_open_rate: { type: DataTypes.FLOAT, defaultValue: 0 },

      // Peak Hours
      best_hours: {
        type: DataTypes.JSON,
        defaultValue: [19, 20, 21],
        comment: 'Top 3 hours by activity'
      },
      worst_hours: {
        type: DataTypes.JSON,
        defaultValue: [2, 3, 4],
        comment: 'Bottom 3 hours by activity'
      },

      // Metadata
      total_notifications_sent: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      total_notifications_opened: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      average_open_rate: {
        type: DataTypes.FLOAT,
        defaultValue: 0
      },
      last_updated: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      data_points: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of data points used to calculate patterns'
      }
    },
    {
      tableName: 'user_activity_patterns',
      timestamps: true,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['last_updated'] },
        { fields: ['average_open_rate'] }
      ]
    }
  );

  return UserActivityPattern;
};
