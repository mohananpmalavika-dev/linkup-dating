/**
 * IP Blocking Service
 * Manages IP blocklist for underage signup attempts and other violations
 */

const { IPBlocklist, AdminSetting } = require('../models');
const { Op, sequelize } = require('sequelize');

class IPBlockingService {
  /**
   * Get block duration from admin settings (in hours)
   * Default: 2 hours
   */
  static async getBlockDurationHours() {
    try {
      const setting = await AdminSetting.findOne({
        where: { setting_key: 'underage_ip_block_duration_hours' }
      });

      if (setting && setting.setting_value) {
        const duration = parseInt(setting.setting_value, 10);
        return duration > 0 ? duration : 2; // Default 2 hours if invalid
      }

      return 2; // Default
    } catch (error) {
      console.error('Error fetching block duration:', error);
      return 2; // Default fallback
    }
  }

  /**
   * Check if an IP address is currently blocked
   */
  static async isIPBlocked(ipAddress) {
    if (!ipAddress) return false;

    try {
      const block = await IPBlocklist.findOne({
        where: {
          ipAddress,
          isActive: true,
          expiresAt: {
            [Op.gt]: new Date() // Expiration time in future
          }
        }
      });

      return !!block;
    } catch (error) {
      console.error('Error checking IP block:', error);
      return false;
    }
  }

  /**
   * Get block details for an IP
   */
  static async getIPBlockDetails(ipAddress) {
    if (!ipAddress) return null;

    try {
      const block = await IPBlocklist.findOne({
        where: {
          ipAddress,
          isActive: true,
          expiresAt: {
            [Op.gt]: new Date()
          }
        }
      });

      if (!block) return null;

      return {
        isBlocked: true,
        reason: block.reason,
        blockedAt: block.blockedAt,
        expiresAt: block.expiresAt,
        remainingMinutes: Math.ceil((block.expiresAt - new Date()) / (1000 * 60)),
        attemptedAge: block.attemptedAge,
        attemptedEmail: block.attemptedEmail,
        attemptCount: block.attemptCount
      };
    } catch (error) {
      console.error('Error getting block details:', error);
      return null;
    }
  }

  /**
   * Block an IP for underage signup attempt
   */
  static async blockIPForUnderageAttempt(ipAddress, email, age) {
    if (!ipAddress) {
      console.warn('Attempted to block null IP address');
      return null;
    }

    try {
      // Get current block duration from admin settings
      const blockDurationHours = await this.getBlockDurationHours();

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + blockDurationHours);

      // Check if IP already exists
      const existingBlock = await IPBlocklist.findOne({
        where: { ipAddress }
      });

      if (existingBlock) {
        // Update existing block
        await existingBlock.update({
          attemptCount: existingBlock.attemptCount + 1,
          attemptedEmail: email,
          attemptedAge: age,
          blockedAt: new Date(),
          expiresAt,
          isActive: true,
          removedAt: null,
          removedByAdminId: null
        });

        return existingBlock;
      } else {
        // Create new block
        const block = await IPBlocklist.create({
          ipAddress,
          reason: 'underage_attempt',
          blockDurationHours,
          attemptedEmail: email,
          attemptedAge: age,
          attemptCount: 1,
          expiresAt,
          isActive: true
        });

        console.log(`[SECURITY] Blocked IP ${ipAddress} for underage attempt (age: ${age}, email: ${email})`);
        return block;
      }
    } catch (error) {
      console.error('Error blocking IP:', error);
      throw error;
    }
  }

  /**
   * Manually block an IP (by admin)
   */
  static async blockIPManually(ipAddress, reason, durationHours, adminId) {
    if (!ipAddress) throw new Error('IP address required');

    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + durationHours);

      const existingBlock = await IPBlocklist.findOne({
        where: { ipAddress }
      });

      if (existingBlock) {
        await existingBlock.update({
          reason: reason || existingBlock.reason,
          blockDurationHours: durationHours,
          expiresAt,
          isActive: true,
          removedAt: null,
          updatedByAdminId: adminId
        });
        return existingBlock;
      } else {
        return await IPBlocklist.create({
          ipAddress,
          reason: reason || 'manual_block',
          blockDurationHours: durationHours,
          expiresAt,
          isActive: true,
          updatedByAdminId: adminId
        });
      }
    } catch (error) {
      console.error('Error manually blocking IP:', error);
      throw error;
    }
  }

  /**
   * Remove/unblock an IP
   */
  static async unblockIP(ipAddress, adminId) {
    if (!ipAddress) throw new Error('IP address required');

    try {
      const block = await IPBlocklist.findOne({
        where: { ipAddress }
      });

      if (!block) {
        throw new Error('IP block not found');
      }

      await block.update({
        isActive: false,
        removedAt: new Date(),
        removedByAdminId: adminId
      });

      console.log(`[ADMIN] Removed block for IP ${ipAddress} by admin ${adminId}`);
      return block;
    } catch (error) {
      console.error('Error unblocking IP:', error);
      throw error;
    }
  }

  /**
   * Get list of all blocked IPs (paginated)
   */
  static async getBlockedIPs(page = 1, limit = 50, activeOnly = true) {
    try {
      const offset = (page - 1) * limit;

      const where = activeOnly
        ? {
            isActive: true,
            expiresAt: { [Op.gt]: new Date() }
          }
        : {};

      const { count, rows } = await IPBlocklist.findAndCountAll({
        where,
        order: [['blockedAt', 'DESC']],
        offset,
        limit,
        attributes: [
          'id', 'ipAddress', 'reason', 'blockedAt', 'expiresAt',
          'attemptedEmail', 'attemptedAge', 'attemptCount', 'isActive'
        ]
      });

      return {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
        blocks: rows.map(block => ({
          id: block.id,
          ipAddress: block.ipAddress,
          reason: block.reason,
          blockedAt: block.blockedAt,
          expiresAt: block.expiresAt,
          remainingMinutes: Math.ceil((block.expiresAt - new Date()) / (1000 * 60)),
          attemptedEmail: block.attemptedEmail,
          attemptedAge: block.attemptedAge,
          attemptCount: block.attemptCount,
          isActive: block.isActive
        }))
      };
    } catch (error) {
      console.error('Error getting blocked IPs:', error);
      throw error;
    }
  }

  /**
   * Clean up expired blocks (mark as inactive)
   */
  static async cleanupExpiredBlocks() {
    try {
      const now = new Date();

      const result = await IPBlocklist.update(
        { isActive: false },
        {
          where: {
            isActive: true,
            expiresAt: { [Op.lte]: now }
          }
        }
      );

      console.log(`[CLEANUP] Marked ${result[0]} expired IP blocks as inactive`);
      return result[0];
    } catch (error) {
      console.error('Error cleaning up expired blocks:', error);
      throw error;
    }
  }

  /**
   * Get statistics about IP blocks
   */
  static async getBlockStatistics() {
    try {
      const now = new Date();

      const [
        activeBlocks,
        totalBlocks,
        underageAttempts,
        mostRecentBlock,
        topBlockedEmails
      ] = await Promise.all([
        // Active blocks
        IPBlocklist.count({
          where: {
            isActive: true,
            expiresAt: { [Op.gt]: now }
          }
        }),

        // Total blocks ever
        IPBlocklist.count(),

        // Underage attempts
        IPBlocklist.count({
          where: { reason: 'underage_attempt' }
        }),

        // Most recent block
        IPBlocklist.findOne({
          where: { isActive: true },
          order: [['blockedAt', 'DESC']],
          attributes: ['blockedAt', 'ipAddress']
        }),

        // Most common email addresses from blocks
        IPBlocklist.findAll({
          attributes: [
            'attemptedEmail',
            [sequelize.fn('COUNT', sequelize.col('attemptedEmail')), 'count']
          ],
          where: { attemptedEmail: { [Op.not]: null } },
          group: ['attemptedEmail'],
          order: [[sequelize.literal('count'), 'DESC']],
          limit: 5,
          raw: true
        })
      ]);

      return {
        activeBlocksCount: activeBlocks,
        totalBlocksCount: totalBlocks,
        underageAttemptsCount: underageAttempts,
        mostRecentBlock: mostRecentBlock
          ? {
              ipAddress: mostRecentBlock.ipAddress,
              blockedAt: mostRecentBlock.blockedAt
            }
          : null,
        topBlockedEmails: topBlockedEmails || []
      };
    } catch (error) {
      console.error('Error getting block statistics:', error);
      throw error;
    }
  }
}

module.exports = IPBlockingService;
