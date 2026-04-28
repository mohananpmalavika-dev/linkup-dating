/**
 * Admin Routes for IP Blocking & Settings Management
 * POST /api/admin/ip-blocking/block-ip - Manually block an IP
 * DELETE /api/admin/ip-blocking/unblock-ip/:ip - Unblock an IP
 * GET /api/admin/ip-blocking/blocked-ips - List blocked IPs
 * GET /api/admin/ip-blocking/stats - Get blocking statistics
 * POST /api/admin/settings/update - Update admin settings
 * GET /api/admin/settings/get - Get settings
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const IPBlockingService = require('../services/ipBlockingService');
const AdminSettingsService = require('../services/adminSettingsService');

/**
 * Admin authentication middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || (!req.user.isAdmin && !req.user.is_admin)) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  next();
};

// ============================================
// IP BLOCKING ENDPOINTS
// ============================================

/**
 * POST /api/admin/ip-blocking/block-ip
 * Manually block an IP address
 */
router.post('/block-ip', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ipAddress, reason, durationHours } = req.body;

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'IP address required'
      });
    }

    const duration = parseInt(durationHours, 10) || 2;

    const block = await IPBlockingService.blockIPManually(
      ipAddress,
      reason || 'manual_block',
      duration,
      req.user.id
    );

    return res.json({
      success: true,
      message: `IP ${ipAddress} blocked for ${duration} hours`,
      block: {
        ipAddress: block.ipAddress,
        reason: block.reason,
        durationHours: block.blockDurationHours,
        expiresAt: block.expiresAt
      }
    });
  } catch (error) {
    console.error('Error blocking IP:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to block IP'
    });
  }
});

/**
 * DELETE /api/admin/ip-blocking/unblock-ip/:ip
 * Unblock an IP address
 */
router.delete('/unblock-ip/:ip', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ip } = req.params;

    const block = await IPBlockingService.unblockIP(ip, req.user.id);

    return res.json({
      success: true,
      message: `IP ${ip} unblocked`,
      block: {
        ipAddress: block.ipAddress,
        reason: block.reason,
        removedAt: block.removedAt
      }
    });
  } catch (error) {
    console.error('Error unblocking IP:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to unblock IP'
    });
  }
});

/**
 * GET /api/admin/ip-blocking/blocked-ips
 * Get list of blocked IPs (paginated)
 * Query: ?page=1&limit=50&activeOnly=true
 */
router.get('/blocked-ips', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const activeOnly = req.query.activeOnly !== 'false';

    const result = await IPBlockingService.getBlockedIPs(page, limit, activeOnly);

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching blocked IPs:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch blocked IPs'
    });
  }
});

/**
 * GET /api/admin/ip-blocking/check/:ip
 * Check if an IP is blocked
 */
router.get('/check/:ip', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ip } = req.params;

    const blockDetails = await IPBlockingService.getIPBlockDetails(ip);

    return res.json({
      success: true,
      isBlocked: blockDetails?.isBlocked || false,
      details: blockDetails
    });
  } catch (error) {
    console.error('Error checking IP:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to check IP'
    });
  }
});

/**
 * GET /api/admin/ip-blocking/stats
 * Get IP blocking statistics
 */
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await IPBlockingService.getBlockStatistics();

    return res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Error fetching IP stats:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch statistics'
    });
  }
});

/**
 * POST /api/admin/ip-blocking/cleanup
 * Clean up expired IP blocks
 */
router.post('/cleanup', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const cleaned = await IPBlockingService.cleanupExpiredBlocks();

    return res.json({
      success: true,
      message: `Cleaned up ${cleaned} expired IP blocks`,
      cleaned
    });
  } catch (error) {
    console.error('Error cleaning up blocks:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to cleanup blocks'
    });
  }
});

// ============================================
// SETTINGS ENDPOINTS
// ============================================

/**
 * GET /api/admin/ip-blocking/settings
 * Get all age verification settings
 */
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await AdminSettingsService.getSettingsByCategory('age_verification');

    return res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch settings'
    });
  }
});

/**
 * POST /api/admin/ip-blocking/settings/update
 * Update IP blocking settings
 * Body: { key, value, type }
 */
router.post('/settings/update', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key, value, type = 'string', description } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Key and value required'
      });
    }

    // Validate allowed settings
    const allowedSettings = [
      'underage_ip_block_duration_hours',
      'underage_block_enabled',
      'max_underage_attempts_per_ip'
    ];

    if (!allowedSettings.includes(key)) {
      return res.status(400).json({
        success: false,
        error: `Unknown setting: ${key}`
      });
    }

    // Validate value ranges
    if (key === 'underage_ip_block_duration_hours') {
      const numValue = parseInt(value, 10);
      if (numValue < 1 || numValue > 168) {
        return res.status(400).json({
          success: false,
          error: 'Block duration must be between 1 and 168 hours'
        });
      }
    }

    const setting = await AdminSettingsService.setSetting(
      key,
      value,
      type,
      'age_verification',
      req.user.id,
      description
    );

    return res.json({
      success: true,
      message: `Setting ${key} updated`,
      setting: {
        key: setting.settingKey,
        value: setting.settingValue,
        type: setting.settingType
      }
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update setting'
    });
  }
});

/**
 * GET /api/admin/ip-blocking/settings/get/:key
 * Get a specific setting
 */
router.get('/settings/get/:key', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;

    const value = await AdminSettingsService.getSetting(key);

    return res.json({
      success: true,
      key,
      value
    });
  } catch (error) {
    console.error('Error fetching setting:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch setting'
    });
  }
});

// ============================================
// ACCOUNT CREATION LIMIT ENDPOINTS
// ============================================

/**
 * GET /api/admin/ip-blocking/account-creation/settings
 * Get account creation limit settings
 */
router.get('/account-creation/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const AccountCreationLimitService = require('../services/accountCreationLimitService');
    
    const threshold = await AccountCreationLimitService.getAccountCreationThreshold();
    const blockDuration = await AccountCreationLimitService.getAccountCreationBlockDuration();

    return res.json({
      success: true,
      settings: {
        threshold,
        blockDurationHours: blockDuration
      }
    });
  } catch (error) {
    console.error('Error fetching account creation settings:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch settings'
    });
  }
});

/**
 * POST /api/admin/ip-blocking/account-creation/settings/update
 * Update account creation limit settings
 */
router.post('/account-creation/settings/update', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key, value, type = 'integer', description } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Key and value required'
      });
    }

    // Validate allowed settings
    const allowedSettings = [
      'account_creation_limit_threshold',
      'account_creation_block_duration_hours'
    ];

    if (!allowedSettings.includes(key)) {
      return res.status(400).json({
        success: false,
        error: `Unknown setting: ${key}`
      });
    }

    // Validate value ranges
    const numValue = parseInt(value, 10);
    
    if (key === 'account_creation_limit_threshold') {
      if (numValue < 1 || numValue > 100) {
        return res.status(400).json({
          success: false,
          error: 'Threshold must be between 1 and 100'
        });
      }
    } else if (key === 'account_creation_block_duration_hours') {
      if (numValue < 1 || numValue > 720) {
        return res.status(400).json({
          success: false,
          error: 'Block duration must be between 1 and 720 hours (30 days)'
        });
      }
    }

    const setting = await AdminSettingsService.setSetting(
      key,
      String(numValue),
      'integer',
      'account_creation',
      req.user.id,
      description
    );

    return res.json({
      success: true,
      message: `Setting ${key} updated`,
      setting: {
        key: setting.settingKey,
        value: setting.settingValue,
        type: setting.settingType
      }
    });
  } catch (error) {
    console.error('Error updating account creation setting:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update setting'
    });
  }
});

/**
 * GET /api/admin/ip-blocking/account-creation/ips
 * Get list of IPs with account creation limits
 */
router.get('/account-creation/ips', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const AccountCreationLimitService = require('../services/accountCreationLimitService');
    
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const blockedOnly = req.query.blockedOnly === 'true';

    const result = await AccountCreationLimitService.getLimitedIPs(page, limit, blockedOnly);

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching account creation IPs:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch IPs'
    });
  }
});

/**
 * GET /api/admin/ip-blocking/account-creation/check/:ip
 * Check account creation limit status for an IP
 */
router.get('/account-creation/check/:ip', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ip } = req.params;
    const AccountCreationLimitService = require('../services/accountCreationLimitService');

    const status = await AccountCreationLimitService.getIPStatus(ip);

    return res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error checking IP:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to check IP'
    });
  }
});

/**
 * POST /api/admin/ip-blocking/account-creation/block
 * Manually block an IP from creating accounts
 */
router.post('/account-creation/block', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ipAddress, durationHours = 24, reason = 'manual_block', notes = '' } = req.body;
    const AccountCreationLimitService = require('../services/accountCreationLimitService');

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'IP address required'
      });
    }

    const result = await AccountCreationLimitService.blockIP(
      ipAddress,
      parseInt(durationHours, 10) || 24,
      req.user.id,
      reason,
      notes
    );

    return res.json({
      success: true,
      message: `IP ${ipAddress} blocked from creating accounts`,
      data: result.record
    });
  } catch (error) {
    console.error('Error blocking IP:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to block IP'
    });
  }
});

/**
 * DELETE /api/admin/ip-blocking/account-creation/unblock/:ip
 * Unblock an IP
 */
router.delete('/account-creation/unblock/:ip', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ip } = req.params;
    const AccountCreationLimitService = require('../services/accountCreationLimitService');

    const result = await AccountCreationLimitService.unblockIP(ip, req.user.id);

    return res.json({
      success: true,
      message: `IP ${ip} unblocked`,
      data: result.record
    });
  } catch (error) {
    console.error('Error unblocking IP:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to unblock IP'
    });
  }
});

/**
 * POST /api/admin/ip-blocking/account-creation/reset/:ip
 * Reset account creation count for an IP
 */
router.post('/account-creation/reset/:ip', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ip } = req.params;
    const AccountCreationLimitService = require('../services/accountCreationLimitService');

    const result = await AccountCreationLimitService.resetIP(ip, req.user.id);

    return res.json({
      success: true,
      message: `Account creation count reset for IP ${ip}`,
      data: result.record
    });
  } catch (error) {
    console.error('Error resetting IP:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset IP'
    });
  }
});

/**
 * GET /api/admin/ip-blocking/account-creation/stats
 * Get account creation limit statistics
 */
router.get('/account-creation/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const AccountCreationLimitService = require('../services/accountCreationLimitService');

    const stats = await AccountCreationLimitService.getStatistics();

    return res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Error fetching account creation stats:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch statistics'
    });
  }
});

module.exports = router;
