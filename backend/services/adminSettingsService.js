/**
 * Admin Settings Service
 * Manages system-wide configuration settings
 */

const { AdminSetting } = require('../models');

class AdminSettingsService {
  /**
   * Get a setting by key
   */
  static async getSetting(key, defaultValue = null) {
    try {
      const setting = await AdminSetting.findOne({
        where: { setting_key: key }
      });

      if (!setting || !setting.setting_value) {
        return defaultValue;
      }

      // Parse based on type
      switch (setting.setting_type) {
        case 'integer':
          return parseInt(setting.setting_value, 10);
        case 'boolean':
          return setting.setting_value === 'true' || setting.setting_value === '1';
        case 'json':
          return JSON.parse(setting.setting_value);
        case 'string':
        default:
          return setting.setting_value;
      }
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Set a setting value
   */
  static async setSetting(key, value, type = 'string', category = 'general', adminId = null, description = null) {
    try {
      // Convert value to string based on type
      let stringValue = String(value);
      if (type === 'json') {
        stringValue = JSON.stringify(value);
      }

      const [setting, created] = await AdminSetting.findOrCreate({
        where: { setting_key: key },
        defaults: {
          settingKey: key,
          settingValue: stringValue,
          settingType: type,
          category,
          description,
          updatedByAdminId: adminId
        }
      });

      if (!created) {
        await setting.update({
          settingValue: stringValue,
          settingType: type,
          category,
          description: description || setting.description,
          updatedByAdminId: adminId
        });
      }

      return setting;
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get all settings in a category
   */
  static async getSettingsByCategory(category) {
    try {
      const settings = await AdminSetting.findAll({
        where: { category },
        attributes: ['setting_key', 'setting_value', 'setting_type', 'description', 'updated_at']
      });

      const result = {};
      settings.forEach(setting => {
        let value = setting.setting_value;
        
        switch (setting.setting_type) {
          case 'integer':
            value = parseInt(value, 10);
            break;
          case 'boolean':
            value = value === 'true' || value === '1';
            break;
          case 'json':
            value = JSON.parse(value);
            break;
        }

        result[setting.setting_key] = {
          value,
          type: setting.setting_type,
          description: setting.description,
          lastUpdated: setting.updated_at
        };
      });

      return result;
    } catch (error) {
      console.error(`Error getting settings for category ${category}:`, error);
      throw error;
    }
  }

  /**
   * Initialize default settings if they don't exist
   */
  static async initializeDefaultSettings() {
    try {
      const defaults = [
        {
          key: 'underage_ip_block_duration_hours',
          value: '2',
          type: 'integer',
          category: 'age_verification',
          description: 'Hours to block IP address for underage signup attempts'
        },
        {
          key: 'underage_block_enabled',
          value: 'true',
          type: 'boolean',
          category: 'age_verification',
          description: 'Enable IP blocking for underage attempts'
        },
        {
          key: 'max_underage_attempts_per_ip',
          value: '3',
          type: 'integer',
          category: 'age_verification',
          description: 'Maximum underage attempts before permanent block per IP'
        },
        {
          key: 'app_name',
          value: 'LinkUp Dating',
          type: 'string',
          category: 'general',
          description: 'Application name'
        },
        {
          key: 'support_email',
          value: 'support@linkup.dating',
          type: 'string',
          category: 'general',
          description: 'Support email address'
        }
      ];

      for (const defaultSetting of defaults) {
        const existing = await AdminSetting.findOne({
          where: { setting_key: defaultSetting.key }
        });

        if (!existing) {
          await AdminSetting.create({
            settingKey: defaultSetting.key,
            settingValue: defaultSetting.value,
            settingType: defaultSetting.type,
            category: defaultSetting.category,
            description: defaultSetting.description
          });

          console.log(`✓ Created default setting: ${defaultSetting.key}`);
        }
      }
    } catch (error) {
      console.error('Error initializing default settings:', error);
    }
  }
}

module.exports = AdminSettingsService;
