/**
 * Admin Settings Model
 * Stores system-wide configuration managed by admins
 */

module.exports = (sequelize, DataTypes) => {
  const AdminSetting = sequelize.define('AdminSetting', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    settingKey: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'setting_key',
      comment: 'Configuration key (e.g., underage_ip_block_duration_hours)'
    },
    settingValue: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'setting_value',
      comment: 'Configuration value (stored as JSON string if needed)'
    },
    settingType: {
      type: DataTypes.ENUM('integer', 'string', 'boolean', 'json'),
      defaultValue: 'string',
      allowNull: false,
      field: 'setting_type',
      comment: 'Data type of the setting'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description of what this setting controls'
    },
    updatedByAdminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'updated_by_admin_id',
      comment: 'Admin who last updated this setting'
    },
    category: {
      type: DataTypes.STRING(50),
      defaultValue: 'general',
      allowNull: false,
      comment: 'Setting category (age_verification, security, etc.)'
    }
  }, {
    tableName: 'admin_settings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['setting_key'], unique: true },
      { fields: ['category'] }
    ]
  });

  return AdminSetting;
};
