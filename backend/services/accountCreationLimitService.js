/**
 * Account Creation Limit Service
 * Manages account creation rate limiting by IP address
 * Prevents spam accounts from same IP/device
 */

const { AccountCreationLimit, AdminSetting } = require('../models');
const AdminSettingsService = require('./adminSettingsService');

class AccountCreationLimitService {
  /**
   * Get the configured account creation limit threshold
   * Default: 2 accounts per IP before blocking (user can create max 2 accounts)
   */
  static async getAccountCreationThreshold() {
    try {
      const setting = await AdminSetting.findOne({
        where: { settingKey: 'account_creation_limit_threshold' }
      });

      if (setting) {
        return parseInt(setting.settingValue, 10) || 2;
      }

      // If setting doesn't exist, create default
      await AdminSetting.create({
        settingKey: 'account_creation_limit_threshold',
        settingValue: '2',
        settingType: 'integer',
        category: 'account_creation',
        description: 'Maximum accounts allowed per IP before blocking (configurable: 2, 24, 37, etc.)'
      });

      return 2;
    } catch (err) {
      console.error('Error getting account creation threshold:', err);
      return 2; // Default
    }
  }

  /**
   * Get the block duration for account creation spam
   * Default: 24 hours
   */
  static async getAccountCreationBlockDuration() {
    try {
      const setting = await AdminSetting.findOne({
        where: { settingKey: 'account_creation_block_duration_hours' }
      });

      if (setting) {
        return parseInt(setting.settingValue, 10) || 24;
      }

      // If setting doesn't exist, create default
      await AdminSetting.create({
        settingKey: 'account_creation_block_duration_hours',
        settingValue: '24',
        settingType: 'integer',
        category: 'account_creation',
        description: 'Hours to block IP for account creation spam'
      });

      return 24;
    } catch (err) {
      console.error('Error getting account creation block duration:', err);
      return 24; // Default
    }
  }

  /**
   * Get the status of an IP - how many accounts, is it blocked, etc.
   */
  static async getIPStatus(ipAddress) {
    try {
      const record = await AccountCreationLimit.findOne({
        where: { ipAddress }
      });

      if (!record) {
        return {
          ipAddress,
          accountCount: 0,
          isBlocked: false,
          blockedUntil: null,
          remainingMinutes: null
        };
      }

      const now = new Date();
      const isBlocked = record.isBlocked && record.blockExpiresAt && record.blockExpiresAt > now;
      let remainingMinutes = null;

      if (isBlocked && record.blockExpiresAt) {
        remainingMinutes = Math.ceil((record.blockExpiresAt - now) / 60000);
      }

      return {
        ipAddress: record.ipAddress,
        accountCount: record.accountCount,
        accountIds: record.accountIds || [],
        lastAccountCreatedAt: record.lastAccountCreatedAt,
        isBlocked,
        blockedUntil: isBlocked ? record.blockExpiresAt : null,
        remainingMinutes,
        blockReason: record.blockReason,
        blockDurationHours: record.blockDurationHours
      };
    } catch (err) {
      console.error('Error getting IP status:', err);
      throw err;
    }
  }

  /**
   * Check if an IP can create more accounts
   * Returns: { canCreate: boolean, reason?: string, blockedUntil?: Date, remainingMinutes?: number }
   */
  static async canCreateAccount(ipAddress) {
    try {
      const threshold = await this.getAccountCreationThreshold();
      const record = await AccountCreationLimit.findOne({
        where: { ipAddress }
      });

      // New IP - can create
      if (!record) {
        return {
          canCreate: true,
          accountCount: 0,
          threshold
        };
      }

      // Check if blocked and still within block duration
      if (record.isBlocked && record.blockExpiresAt) {
        const now = new Date();
        if (record.blockExpiresAt > now) {
          const remainingMinutes = Math.ceil((record.blockExpiresAt - now) / 60000);
          return {
            canCreate: false,
            reason: 'account_creation_blocked',
            accountCount: record.accountCount,
            threshold,
            blockedUntil: record.blockExpiresAt,
            remainingMinutes,
            blockReason: record.blockReason
          };
        } else {
          // Block expired - mark as inactive
          await AccountCreationLimit.update(
            { isBlocked: false },
            { where: { id: record.id } }
          );
          record.isBlocked = false;
        }
      }

      // Check if account count exceeds threshold
      if (record.accountCount >= threshold) {
        return {
          canCreate: false,
          reason: 'account_limit_exceeded',
          accountCount: record.accountCount,
          threshold
        };
      }

      return {
        canCreate: true,
        accountCount: record.accountCount,
        threshold
      };
    } catch (err) {
      console.error('Error checking if can create account:', err);
      // Fail open - allow creation if service error
      return { canCreate: true, error: err.message };
    }
  }

  /**
   * Record a new account creation from an IP
   */
  static async recordAccountCreation(ipAddress, userId) {
    try {
      const threshold = await this.getAccountCreationThreshold();
      const blockDuration = await this.getAccountCreationBlockDuration();

      let record = await AccountCreationLimit.findOne({
        where: { ipAddress }
      });

      if (!record) {
        // First account from this IP
        record = await AccountCreationLimit.create({
          ipAddress,
          accountCount: 1,
          accountIds: [userId],
          lastAccountCreatedAt: new Date()
        });
        console.log(`[ACCOUNT_CREATION] First account (${userId}) from IP ${ipAddress}`);
      } else {
        // Additional account from this IP
        const accountIds = Array.isArray(record.accountIds) ? record.accountIds : [];
        accountIds.push(userId);

        // Keep only first 50 account IDs
        if (accountIds.length > 50) {
          accountIds.splice(50);
        }

        const newCount = record.accountCount + 1;
        const willBeBlocked = newCount >= threshold;

        const updateData = {
          accountCount: newCount,
          accountIds,
          lastAccountCreatedAt: new Date()
        };

        // If account count reaches threshold, block the IP
        if (willBeBlocked && !record.isBlocked) {
          updateData.isBlocked = true;
          updateData.blockedAt = new Date();
          updateData.blockExpiresAt = new Date(Date.now() + blockDuration * 60 * 60 * 1000);
          updateData.blockReason = 'account_spam';

          console.log(
            `[SECURITY] IP ${ipAddress} blocked after creating ${newCount} accounts ` +
            `(IDs: ${accountIds.slice(0, 5).join(', ')}...)`
          );
        }

        await record.update(updateData);

        console.log(
          `[ACCOUNT_CREATION] Account ${userId} created from IP ${ipAddress} ` +
          `(count: ${newCount}/${threshold})`
        );
      }

      return {
        success: true,
        accountCount: record.accountCount,
        threshold,
        isBlocked: record.isBlocked
      };
    } catch (err) {
      console.error('Error recording account creation:', err);
      // Don't block signup if service error
      return { success: false, error: err.message };
    }
  }

  /**
   * Manually block an IP from creating accounts
   */
  static async blockIP(ipAddress, durationHours = 24, adminId = null, reason = 'manual_block', notes = '') {
    try {
      let record = await AccountCreationLimit.findOne({
        where: { ipAddress }
      });

      if (!record) {
        record = await AccountCreationLimit.create({
          ipAddress,
          isBlocked: true,
          blockedAt: new Date(),
          blockExpiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000),
          blockDurationHours: durationHours,
          blockedByAdminId: adminId,
          blockReason: reason,
          notes
        });
      } else {
        await record.update({
          isBlocked: true,
          blockedAt: new Date(),
          blockExpiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000),
          blockDurationHours: durationHours,
          blockedByAdminId: adminId,
          blockReason: reason,
          notes
        });
      }

      console.log(`[SECURITY] IP ${ipAddress} manually blocked by admin ${adminId}`);
      return { success: true, record };
    } catch (err) {
      console.error('Error blocking IP:', err);
      throw err;
    }
  }

  /**
   * Unblock an IP
   */
  static async unblockIP(ipAddress, adminId) {
    try {
      const record = await AccountCreationLimit.findOne({
        where: { ipAddress }
      });

      if (!record) {
        throw new Error(`IP ${ipAddress} not found`);
      }

      await record.update({
        isBlocked: false,
        removedAt: new Date(),
        removedByAdminId: adminId
      });

      console.log(`[SECURITY] IP ${ipAddress} unblocked by admin ${adminId}`);
      return { success: true, record };
    } catch (err) {
      console.error('Error unblocking IP:', err);
      throw err;
    }
  }

  /**
   * Reset account count for an IP (admin action)
   */
  static async resetIP(ipAddress, adminId) {
    try {
      const record = await AccountCreationLimit.findOne({
        where: { ipAddress }
      });

      if (!record) {
        throw new Error(`IP ${ipAddress} not found`);
      }

      await record.update({
        accountCount: 0,
        accountIds: [],
        isBlocked: false,
        removedAt: new Date(),
        removedByAdminId: adminId,
        notes: (record.notes || '') + `\nReset by admin ${adminId} at ${new Date().toISOString()}`
      });

      console.log(`[SECURITY] Account creation count reset for IP ${ipAddress} by admin ${adminId}`);
      return { success: true, record };
    } catch (err) {
      console.error('Error resetting IP:', err);
      throw err;
    }
  }

  /**
   * Get list of IPs with account creation limits applied
   */
  static async getLimitedIPs(page = 1, limit = 50, blockedOnly = false) {
    try {
      const where = blockedOnly ? { isBlocked: true } : {};
      const offset = (page - 1) * limit;

      const { count, rows } = await AccountCreationLimit.findAndCountAll({
        where,
        offset,
        limit,
        order: [['lastAccountCreatedAt', 'DESC']]
      });

      const records = rows.map(record => {
        const now = new Date();
        const isActive = record.isBlocked && record.blockExpiresAt && record.blockExpiresAt > now;
        const remainingMinutes = isActive
          ? Math.ceil((record.blockExpiresAt - now) / 60000)
          : null;

        return {
          id: record.id,
          ipAddress: record.ipAddress,
          accountCount: record.accountCount,
          accountIds: (record.accountIds || []).slice(0, 5),
          lastAccountCreatedAt: record.lastAccountCreatedAt,
          isBlocked: isActive,
          blockExpiresAt: record.blockExpiresAt,
          remainingMinutes,
          blockReason: record.blockReason
        };
      });

      return {
        records,
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      };
    } catch (err) {
      console.error('Error getting limited IPs:', err);
      throw err;
    }
  }

  /**
   * Get statistics on account creation limits
   */
  static async getStatistics() {
    try {
      const now = new Date();

      const [
        totalRecords,
        activeBlocks,
        totalAccounts,
        expiredBlocks,
        blockedByAdmin
      ] = await Promise.all([
        AccountCreationLimit.count(),
        AccountCreationLimit.count({
          where: {
            isBlocked: true,
            blockExpiresAt: { [require('sequelize').Op.gt]: now }
          }
        }),
        AccountCreationLimit.sum('accountCount'),
        AccountCreationLimit.count({
          where: {
            isBlocked: true,
            blockExpiresAt: { [require('sequelize').Op.lte]: now }
          }
        }),
        AccountCreationLimit.count({
          where: { blockReason: 'manual_block' }
        })
      ]);

      const threshold = await this.getAccountCreationThreshold();

      return {
        totalTrackedIPs: totalRecords || 0,
        activeBlocks: activeBlocks || 0,
        expiredBlocks: expiredBlocks || 0,
        totalAccountsCreated: totalAccounts || 0,
        manualBlocks: blockedByAdmin || 0,
        threshold,
        averageAccountsPerIP: totalRecords > 0
          ? Math.round((totalAccounts || 0) / totalRecords)
          : 0
      };
    } catch (err) {
      console.error('Error getting statistics:', err);
      throw err;
    }
  }

  /**
   * Clean up expired blocks
   */
  static async cleanupExpiredBlocks() {
    try {
      const now = new Date();

      const result = await AccountCreationLimit.update(
        { isBlocked: false },
        {
          where: {
            isBlocked: true,
            blockExpiresAt: { [require('sequelize').Op.lte]: now }
          }
        }
      );

      console.log(`[CLEANUP] Marked ${result[0]} expired account creation blocks as inactive`);
      return result[0];
    } catch (err) {
      console.error('Error cleaning up expired blocks:', err);
      throw err;
    }
  }
}

module.exports = AccountCreationLimitService;
