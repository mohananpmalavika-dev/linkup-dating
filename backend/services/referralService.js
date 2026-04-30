/**
 * Referral Service
 * Handles all referral logic including code generation, rewards, and tracking
 */

const { Op, Sequelize } = require('sequelize');
const {
  Referral,
  ReferralReward,
  User,
  DatingProfile,
  DiscoveryBoostPoints
} = require('../models');
const crypto = require('crypto');

class ReferralService {
  /**
   * Generate unique referral code for user
   * Format: USER{userId}_{randomString}
   */
  static generateReferralCode(userId) {
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `LINK${userId}${random}`;
  }

  /**
   * Generate or get existing referral code for user
   */
  static async getOrCreateReferralCode(userId) {
    try {
      // Check if user already has an active referral code
      const existingReferral = await Referral.findOne({
        where: {
          referrer_user_id: userId,
          status: { [Op.ne]: 'expired' }
        }
      });

      if (existingReferral) {
        return {
          success: true,
          code: existingReferral.referral_code,
          link: existingReferral.referral_link || this.generateReferralLink(existingReferral.referral_code),
          expiresAt: existingReferral.expires_at
        };
      }

      // Generate new referral code
      const code = this.generateReferralCode(userId);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 365); // Valid for 1 year

      const referralLink = this.generateReferralLink(code);

      const referral = await Referral.create({
        referrer_user_id: userId,
        referral_code: code,
        referral_link: referralLink,
        status: 'pending',
        expires_at: expiresAt
      });

      return {
        success: true,
        code: referral.referral_code,
        link: referralLink,
        expiresAt: referral.expires_at
      };
    } catch (error) {
      console.error('Error generating referral code:', error);
      return { success: false, message: 'Error generating referral code' };
    }
  }

  /**
   * Generate full referral link
   */
  static generateReferralLink(code) {
    const baseUrl = process.env.FRONTEND_URL || 'https://linkup.dating';
    return `${baseUrl}/?referral=${code}`;
  }

  /**
   * Accept/redeem a referral code
   * Called when a new user signs up with a referral code
   */
  static async acceptReferral(userId, referralCode) {
    try {
      // Find referral by code
      const referral = await Referral.findOne({
        where: { referral_code: referralCode }
      });

      if (!referral) {
        return { success: false, message: 'Invalid referral code' };
      }

      // Check if already used
      if (referral.referred_user_id) {
        return { success: false, message: 'This referral code has already been used' };
      }

      // Check if expired
      if (new Date() > referral.expires_at) {
        await referral.update({ status: 'expired' });
        return { success: false, message: 'This referral code has expired' };
      }

      // Check if user is trying to refer themselves
      if (referral.referrer_user_id === userId) {
        return { success: false, message: 'You cannot refer yourself' };
      }

      // Update referral with referred user
      await referral.update({
        referred_user_id: userId,
        status: 'completed'
      });

      // Create rewards for both users
      const referrerReward = await this.createReferralReward(
        referral.id,
        referral.referrer_user_id,
        'premium_days',
        7,
        '+7 days premium from referral'
      );

      const referredReward = await this.createReferralReward(
        referral.id,
        userId,
        'premium_days',
        7,
        '+7 days premium from referral'
      );

      const superlikes = await this.createReferralReward(
        referral.id,
        referral.referrer_user_id,
        'superlikes',
        5,
        '+5 superlikes from referral'
      );

      const referredSuperlikes = await this.createReferralReward(
        referral.id,
        userId,
        'superlikes',
        5,
        '+5 superlikes from referral'
      );

      return {
        success: true,
        message: 'Referral accepted! You and your friend will receive bonuses.',
        referralId: referral.id,
        rewards: {
          referrer: [
            { type: 'premium_days', amount: 7 },
            { type: 'superlikes', amount: 5 }
          ],
          referred: [
            { type: 'premium_days', amount: 7 },
            { type: 'superlikes', amount: 5 }
          ]
        }
      };
    } catch (error) {
      console.error('Error accepting referral:', error);
      return { success: false, message: 'Error accepting referral' };
    }
  }

  /**
   * Create a referral reward record
   */
  static async createReferralReward(referralId, userId, type, amount, description) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Rewards expire in 30 days if not claimed

      const reward = await ReferralReward.create({
        referral_id: referralId,
        user_id: userId,
        reward_type: type,
        reward_amount: amount,
        reward_description: description,
        expires_at: expiresAt
      });

      return reward;
    } catch (error) {
      console.error('Error creating referral reward:', error);
      throw error;
    }
  }

  /**
   * Claim referral rewards
   */
  static async claimRewards(userId) {
    try {
      // Get all unclaimed rewards for user
      const unclaimed = await ReferralReward.findAll({
        where: {
          user_id: userId,
          claimed_at: null
        }
      });

      if (unclaimed.length === 0) {
        return { success: false, message: 'No rewards to claim' };
      }

      let totalPremiumDays = 0;
      let totalSuperlikes = 0;

      // Process each reward
      for (const reward of unclaimed) {
        if (reward.reward_type === 'premium_days') {
          totalPremiumDays += reward.reward_amount;
        } else if (reward.reward_type === 'superlikes') {
          totalSuperlikes += reward.reward_amount;
        }

        // Mark as claimed
        await reward.update({ claimed_at: new Date() });
      }

      // Apply premium days (would integrate with subscription system)
      if (totalPremiumDays > 0) {
        await this.applyPremiumDays(userId, totalPremiumDays);
      }

      // Apply superlikes (would integrate with superlikes system)
      if (totalSuperlikes > 0) {
        await this.addSuperlikes(userId, totalSuperlikes);
      }

      return {
        success: true,
        message: 'Rewards claimed successfully!',
        rewards: {
          premiumDays: totalPremiumDays,
          superlikes: totalSuperlikes
        }
      };
    } catch (error) {
      console.error('Error claiming rewards:', error);
      return { success: false, message: 'Error claiming rewards' };
    }
  }

  /**
   * Apply premium days to user account
   * TODO: Integrate with actual subscription system
   */
  static async applyPremiumDays(userId, days) {
    try {
      // This would integrate with your user subscription/premium system
      // For now, just log it
      console.log(`Applied ${days} premium days to user ${userId}`);

      // Update user profile or subscription table
      // Example: await UserSubscription.increment('premium_days', { where: { user_id: userId } });

      return true;
    } catch (error) {
      console.error('Error applying premium days:', error);
      throw error;
    }
  }

  /**
   * Add superlikes to user
   * TODO: Integrate with actual superlikes system
   */
  static async addSuperlikes(userId, count) {
    try {
      // This would integrate with your superlikes system
      // For now, just log it
      console.log(`Added ${count} superlikes to user ${userId}`);

      // Update user profile or superlikes table
      // Example: await DatingProfile.increment('super_likes', { where: { user_id: userId } });

      return true;
    } catch (error) {
      console.error('Error adding superlikes:', error);
      throw error;
    }
  }

  /**
   * Get referral statistics for a user
   */
  static async getReferralStats(userId) {
    try {
      // Get all referrals by this user (without complex includes that can cause errors)
      const referralsCreated = await Referral.findAll({
        where: { referrer_user_id: userId },
        attributes: ['id', 'referral_code', 'status', 'referred_user_id', 'completed_at', 'created_at'],
        include: [
          {
            model: User,
            as: 'referredUser',
            attributes: ['id', 'firstName', 'lastName', 'email'],
            include: [
              {
                model: DatingProfile,
                as: 'datingProfile',
                attributes: ['bio', 'age'],
                required: false
              }
            ],
            required: false
          }
        ],
        order: [['created_at', 'DESC']],
        subQuery: false
      });

      // Fetch photos separately to avoid issues with nested limits
      const ProfilePhoto = require('../models').ProfilePhoto;
      const referredUserIds = referralsCreated
        .map(r => r.referred_user_id)
        .filter(Boolean);
      
      let photosMap = {};
      if (referredUserIds.length > 0) {
        const photos = await ProfilePhoto.findAll({
          where: { user_id: referredUserIds },
          attributes: ['user_id', 'photoUrl', 'position'],
          order: [['position', 'ASC']]
        });
        // Map first photo for each user
        photos.forEach(photo => {
          if (!photosMap[photo.user_id]) {
            photosMap[photo.user_id] = photo.photoUrl;
          }
        });
      }

      // Get rewards earned from referrals
      const rewardsEarned = await ReferralReward.findAll({
        where: { user_id: userId },
        attributes: [
          [Sequelize.fn('SUM', Sequelize.col('reward_amount')), 'total'],
          'reward_type'
        ],
        group: ['reward_type'],
        raw: true
      });

      // Calculate stats
      const stats = {
        totalInvited: referralsCreated.length,
        successfulReferrals: referralsCreated.filter(r => r.status === 'completed').length,
        pendingReferrals: referralsCreated.filter(r => r.status === 'pending').length,
        expiredReferrals: referralsCreated.filter(r => r.status === 'expired').length,
        referralCode: null,
        referralLink: null,
        rewardsEarned: {},
        referredFriends: referralsCreated
          .filter(r => r.referredUser)
          .map(r => ({
            id: r.referredUser.id,
            name: `${r.referredUser.firstName} ${r.referredUser.lastName}`,
            email: r.referredUser.email,
            joinedAt: r.created_at,
            completedAt: r.completed_at,
            photo: photosMap[r.referredUser.id] || null,
            age: r.referredUser.datingProfile?.age
          }))
      };

      // Parse rewards earned
      rewardsEarned.forEach(reward => {
        stats.rewardsEarned[reward.reward_type] = parseInt(reward.total) || 0;
      });

      // Get referral code
      const userReferral = await Referral.findOne({
        where: { referrer_user_id: userId },
        order: [['created_at', 'DESC']]
      });

      if (userReferral) {
        stats.referralCode = userReferral.referral_code;
        stats.referralLink = userReferral.referral_link || this.generateReferralLink(userReferral.referral_code);
      }

      return {
        success: true,
        stats
      };
    } catch (error) {
      console.error('Error getting referral stats:', error);
      return { success: false, message: 'Error fetching referral statistics' };
    }
  }

  /**
   * Get leaderboard of top referrers
   */
  static async getTopReferrers(limit = 10) {
    try {
      const leaderboard = await Referral.findAll({
        attributes: [
          'referrer_user_id',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'referral_count'],
          [Sequelize.fn('SUM', Sequelize.literal(`CASE WHEN status = 'completed' THEN 1 ELSE 0 END`)), 'successful_count']
        ],
        group: ['referrer_user_id'],
        include: [
          {
            model: User,
            as: 'referrer',
            attributes: ['id', 'firstName', 'lastName'],
            include: [
              {
                model: DatingProfile,
                as: 'datingProfile',
                attributes: ['profile_photo_url', 'age']
              }
            ]
          }
        ],
        order: [[Sequelize.literal('successful_count'), 'DESC']],
        limit: limit,
        subQuery: false,
        raw: false
      });

      return {
        success: true,
        leaderboard: leaderboard.map((entry, idx) => ({
          rank: idx + 1,
          userId: entry.referrer_user_id,
          name: `${entry.referrer.firstName} ${entry.referrer.lastName}`,
          photo: entry.referrer.datingProfile?.profile_photo_url,
          totalReferrals: parseInt(entry.dataValues.referral_count) || 0,
          successfulReferrals: parseInt(entry.dataValues.successful_count) || 0
        }))
      };
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return { success: false, message: 'Error fetching leaderboard' };
    }
  }

  /**
   * Get pending rewards for user
   */
  static async getPendingRewards(userId) {
    try {
      const pendingRewards = await ReferralReward.findAll({
        where: {
          user_id: userId,
          claimed_at: null,
          expires_at: { [Op.gt]: new Date() }
        },
        include: [
          {
            model: Referral,
            as: 'referral',
            attributes: ['referral_code', 'created_at'],
            include: [
              {
                model: User,
                as: 'referrer',
                attributes: ['id', 'firstName', 'lastName']
              }
            ]
          }
        ]
      });

      return {
        success: true,
        rewards: pendingRewards.map(r => ({
          id: r.id,
          type: r.reward_type,
          amount: r.reward_amount,
          description: r.reward_description,
          expiresAt: r.expires_at,
          referrerName: `${r.referral.referrer.firstName} ${r.referral.referrer.lastName}`,
          createdAt: r.referral.created_at
        }))
      };
    } catch (error) {
      console.error('Error getting pending rewards:', error);
      return { success: false, message: 'Error fetching pending rewards' };
    }
  }

  /**
   * Check if user has used a referral code
   */
  static async getUserReferralHistory(userId) {
    try {
      // Check if this user was referred
      const referralUsedBy = await Referral.findOne({
        where: { referred_user_id: userId },
        include: [
          {
            model: User,
            as: 'referrer',
            attributes: ['id', 'firstName', 'lastName', 'email'],
            include: [
              {
                model: DatingProfile,
                as: 'datingProfile',
                attributes: ['profile_photo_url', 'age']
              }
            ]
          }
        ]
      });

      return {
        success: true,
        wasReferred: !!referralUsedBy,
        referredBy: referralUsedBy
          ? {
              id: referralUsedBy.referrer.id,
              name: `${referralUsedBy.referrer.firstName} ${referralUsedBy.referrer.lastName}`,
              photo: referralUsedBy.referrer.datingProfile?.profile_photo_url,
              usedAt: referralUsedBy.created_at
            }
          : null
      };
    } catch (error) {
      console.error('Error getting referral history:', error);
      return { success: false, message: 'Error fetching referral history' };
    }
  }
}

module.exports = ReferralService;
