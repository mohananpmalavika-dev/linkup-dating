const express = require('express');
const router = express.Router();
const db = require('../config/database');
const crypto = require('crypto');

const MAX_FRIENDS = 1000;
const REFERRAL_EXPIRY_DAYS = 30;
const REFERRAL_CODE_LENGTH = 12;

/**
 * Generate unique referral code
 */
const generateReferralCode = () => {
  return crypto.randomBytes(REFERRAL_CODE_LENGTH / 2).toString('hex').toUpperCase();
};

/**
 * Generate referral link
 */
const generateReferralLink = (referralCode) => {
  const baseUrl = process.env.APP_BASE_URL || 'https://linkup-dating.com';
  return `${baseUrl}/signup?ref=${referralCode}`;
};

// ========== REFERRAL ENDPOINTS ==========

/**
 * GET /social/referral/me - Get user's referral info
 */
router.get('/referral/me', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const referral = await db.Referral.findOne({
      where: { referrer_user_id: userId },
      attributes: ['id', 'referral_code', 'referral_link', 'status', 'reward']
    });

    if (!referral) {
      // Create first-time referral
      const code = generateReferralCode();
      const newReferral = await db.Referral.create({
        referrer_user_id: userId,
        referral_code: code,
        referral_link: generateReferralLink(code),
        expires_at: new Date(Date.now() + REFERRAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      });

      return res.json({
        id: newReferral.id,
        code: newReferral.referral_code,
        link: newReferral.referral_link,
        status: newReferral.status
      });
    }

    res.json({
      id: referral.id,
      code: referral.referral_code,
      link: referral.referral_link,
      status: referral.status,
      reward: referral.reward
    });
  } catch (error) {
    console.error('Get referral error:', error);
    res.status(500).json({ error: 'Failed to get referral info' });
  }
});

/**
 * GET /social/referral/stats - Get referral statistics
 */
router.get('/referral/stats', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const stats = await db.sequelize.query(`
      SELECT 
        COUNT(*) as total_referrals,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
      FROM referrals
      WHERE referrer_user_id = $1
    `, {
      bind: [userId],
      type: db.sequelize.QueryTypes.SELECT
    });

    res.json(stats[0] || {
      total_referrals: 0,
      completed: 0,
      pending: 0,
      expired: 0
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ error: 'Failed to get referral stats' });
  }
});

/**
 * POST /social/referral/validate - Validate referral code on signup
 */
router.post('/referral/validate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Referral code required' });

    const referral = await db.Referral.findOne({
      where: { referral_code: code, status: 'pending' },
      attributes: ['id', 'referrer_user_id', 'reward']
    });

    if (!referral) {
      return res.status(404).json({ error: 'Invalid or expired referral code' });
    }

    res.json({
      valid: true,
      referrerId: referral.referrer_user_id,
      reward: referral.reward
    });
  } catch (error) {
    console.error('Validate referral error:', error);
    res.status(500).json({ error: 'Failed to validate referral' });
  }
});

// ========== FRIEND RELATIONSHIP ENDPOINTS ==========

/**
 * POST /social/friends/add - Send friend request
 */
router.post('/friends/add', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'User IDs required' });
    }

    if (userId === targetUserId) {
      return res.status(400).json({ error: 'Cannot friend yourself' });
    }

    // Check for existing relationship
    const existing = await db.FriendRelationship.findOne({
      where: {
        [db.sequelize.Op.or]: [
          { user_id_1: userId, user_id_2: targetUserId },
          { user_id_1: targetUserId, user_id_2: userId }
        ]
      }
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ error: 'Already friends' });
      }
      if (existing.status === 'pending') {
        return res.status(400).json({ error: 'Friend request already sent' });
      }
    }

    const friendship = await db.FriendRelationship.create({
      user_id_1: userId,
      user_id_2: targetUserId,
      status: 'pending',
      request_sent_by: userId
    });

    res.status(201).json({
      id: friendship.id,
      status: 'pending',
      message: 'Friend request sent'
    });
  } catch (error) {
    console.error('Add friend error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

/**
 * POST /social/friends/:friendshipId/accept - Accept friend request
 */
router.post('/friends/:friendshipId/accept', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { friendshipId } = req.params;

    const friendship = await db.FriendRelationship.findByPk(friendshipId);
    if (!friendship) return res.status(404).json({ error: 'Friend request not found' });

    if (friendship.user_id_1 !== userId && friendship.user_id_2 !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (friendship.status !== 'pending') {
      return res.status(400).json({ error: 'Can only accept pending requests' });
    }

    await friendship.update({
      status: 'accepted',
      accepted_at: new Date()
    });

    res.json({ status: 'accepted', message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

/**
 * POST /social/friends/:friendshipId/decline - Decline friend request
 */
router.post('/friends/:friendshipId/decline', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { friendshipId } = req.params;

    const friendship = await db.FriendRelationship.findByPk(friendshipId);
    if (!friendship) return res.status(404).json({ error: 'Friend request not found' });

    if (friendship.user_id_2 !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await friendship.destroy();
    res.json({ message: 'Friend request declined' });
  } catch (error) {
    console.error('Decline friend error:', error);
    res.status(500).json({ error: 'Failed to decline friend request' });
  }
});

/**
 * GET /social/friends/list - Get user's friends
 */
router.get('/friends/list', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { status = 'accepted', limit = 50, offset = 0 } = req.query;

    const friends = await db.sequelize.query(`
      SELECT 
        CASE 
          WHEN user_id_1 = $1 THEN user_id_2
          ELSE user_id_1
        END as friend_id,
        u.email,
        u.created_at,
        fr.status,
        fr.accepted_at
      FROM friend_relationships fr
      JOIN users u ON (
        (fr.user_id_1 = $1 AND u.id = fr.user_id_2) OR
        (fr.user_id_2 = $1 AND u.id = fr.user_id_1)
      )
      WHERE fr.status = $2 AND (
        (fr.user_id_1 = $1 AND fr.user_id_2 != $1) OR
        (fr.user_id_2 = $1 AND fr.user_id_1 != $1)
      )
      ORDER BY fr.accepted_at DESC NULLS LAST
      LIMIT $3 OFFSET $4
    `, {
      bind: [userId, status, Number(limit), Number(offset)],
      type: db.sequelize.QueryTypes.SELECT
    });

    res.json({
      friends,
      count: friends.length
    });
  } catch (error) {
    console.error('Get friends list error:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

/**
 * DELETE /social/friends/:friendshipId - Remove friend
 */
router.delete('/friends/:friendshipId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { friendshipId } = req.params;

    const friendship = await db.FriendRelationship.findByPk(friendshipId);
    if (!friendship) return res.status(404).json({ error: 'Friendship not found' });

    if (friendship.user_id_1 !== userId && friendship.user_id_2 !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await friendship.destroy();
    res.json({ message: 'Friend removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// ========== SOCIAL INTEGRATION ENDPOINTS ==========

/**
 * POST /social/integrations - Add social media integration
 */
router.post('/integrations', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { platform, username, isPublic = false } = req.body;

    if (!userId || !platform || !username) {
      return res.status(400).json({ error: 'Platform and username required' });
    }

    if (!['instagram', 'tiktok', 'twitter', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    // Check if already integrated
    const existing = await db.SocialIntegration.findOne({
      where: { user_id: userId, platform }
    });

    if (existing) {
      await existing.update({ username, is_public: isPublic });
      return res.json(existing);
    }

    const integration = await db.SocialIntegration.create({
      user_id: userId,
      platform,
      username,
      is_public: isPublic
    });

    res.status(201).json({
      id: integration.id,
      platform: integration.platform,
      username: integration.username,
      isPublic: integration.is_public,
      verifiedAt: integration.verified_at
    });
  } catch (error) {
    console.error('Add social integration error:', error);
    res.status(500).json({ error: 'Failed to add social integration' });
  }
});

/**
 * GET /social/integrations - Get user's social integrations
 */
router.get('/integrations', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const integrations = await db.SocialIntegration.findAll({
      where: { user_id: userId },
      attributes: ['id', 'platform', 'username', 'is_public', 'verified_at', 'created_at']
    });

    res.json(integrations);
  } catch (error) {
    console.error('Get social integrations error:', error);
    res.status(500).json({ error: 'Failed to fetch social integrations' });
  }
});

/**
 * DELETE /social/integrations/:integrationId - Remove social integration
 */
router.delete('/integrations/:integrationId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { integrationId } = req.params;

    const integration = await db.SocialIntegration.findByPk(integrationId);
    if (!integration) return res.status(404).json({ error: 'Integration not found' });

    if (integration.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await integration.destroy();
    res.json({ message: 'Social integration removed' });
  } catch (error) {
    console.error('Remove social integration error:', error);
    res.status(500).json({ error: 'Failed to remove social integration' });
  }
});

/**
 * GET /social/integrations/:userId/public - Get user's public social profiles
 */
router.get('/integrations/:userId/public', async (req, res) => {
  try {
    const { userId } = req.params;

    const integrations = await db.SocialIntegration.findAll({
      where: { user_id: userId, is_public: true },
      attributes: ['id', 'platform', 'username', 'verified_at'],
      raw: true
    });

    res.json(integrations);
  } catch (error) {
    console.error('Get public social profiles error:', error);
    res.status(500).json({ error: 'Failed to fetch social profiles' });
  }
});

// ========== GROUP CHAT ENDPOINTS ==========

/**
 * POST /social/group-chats - Create group chat
 */
router.post('/group-chats', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, description, memberIds = [], groupType = 'custom', matchId = null } = req.body;

    if (!userId || !name) {
      return res.status(400).json({ error: 'Name required' });
    }

    const groupChat = await db.GroupChat.create({
      name,
      description: description || null,
      created_by_user_id: userId,
      group_type: groupType,
      match_id: matchId
    });

    // Add creator as admin
    await db.GroupChatMember.create({
      group_id: groupChat.id,
      user_id: userId,
      role: 'admin'
    });

    // Add other members
    if (Array.isArray(memberIds) && memberIds.length > 0) {
      const validMemberIds = memberIds.filter(id => id !== userId);
      if (validMemberIds.length > 0) {
        await db.GroupChatMember.bulkCreate(
          validMemberIds.map(memberId => ({
            group_id: groupChat.id,
            user_id: memberId,
            role: 'member'
          }))
        );
      }
    }

    res.status(201).json({
      id: groupChat.id,
      name: groupChat.name,
      description: groupChat.description,
      memberCount: 1 + Math.max(0, memberIds.filter(id => id !== userId).length)
    });
  } catch (error) {
    console.error('Create group chat error:', error);
    res.status(500).json({ error: 'Failed to create group chat' });
  }
});

/**
 * GET /social/group-chats - Get user's group chats
 */
router.get('/group-chats', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const groupChats = await db.sequelize.query(`
      SELECT 
        gc.id,
        gc.name,
        gc.description,
        gc.group_type,
        gc.created_at,
        COUNT(DISTINCT gcm.user_id) as member_count,
        MAX(gcm2.last_read_message_id) as last_read_message_id
      FROM group_chats gc
      JOIN group_chat_members gcm ON gc.id = gcm.group_id
      LEFT JOIN group_chat_members gcm2 ON gc.id = gcm2.group_id AND gcm2.user_id = $1
      WHERE gcm.user_id = $1 AND gcm.status = 'active'
      GROUP BY gc.id
      ORDER BY gc.updated_at DESC
    `, {
      bind: [userId],
      type: db.sequelize.QueryTypes.SELECT
    });

    res.json(groupChats);
  } catch (error) {
    console.error('Get group chats error:', error);
    res.status(500).json({ error: 'Failed to fetch group chats' });
  }
});

/**
 * POST /social/group-chats/:groupId/messages - Send message to group chat
 */
router.post('/group-chats/:groupId/messages', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { groupId } = req.params;
    const { message, mediaType = null, mediaUrl = null } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: 'Message required' });
    }

    // Verify user is member
    const member = await db.GroupChatMember.findOne({
      where: { group_id: groupId, user_id: userId, status: 'active' }
    });

    if (!member) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const groupMessage = await db.GroupChatMessage.create({
      group_id: groupId,
      from_user_id: userId,
      message,
      media_type: mediaType,
      media_url: mediaUrl,
      message_type: mediaType ? 'media' : 'text'
    });

    res.status(201).json({
      id: groupMessage.id,
      message: groupMessage.message,
      mediaType: groupMessage.media_type,
      createdAt: groupMessage.created_at
    });
  } catch (error) {
    console.error('Send group message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * GET /social/group-chats/:groupId/messages - Get group chat messages
 */
router.get('/group-chats/:groupId/messages', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { groupId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify user is member
    const member = await db.GroupChatMember.findOne({
      where: { group_id: groupId, user_id: userId, status: 'active' }
    });

    if (!member) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const messages = await db.GroupChatMessage.findAll({
      where: { group_id: groupId },
      include: [{ model: db.User, as: 'sender', attributes: ['id', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: Number(limit),
      offset: Number(offset)
    });

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get group messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /social/group-chats/:groupId/leave - Leave group chat
 */
router.post('/group-chats/:groupId/leave', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { groupId } = req.params;

    const member = await db.GroupChatMember.findOne({
      where: { group_id: groupId, user_id: userId }
    });

    if (!member) return res.status(404).json({ error: 'Not a member' });

    await member.update({
      status: 'left',
      left_at: new Date()
    });

    res.json({ message: 'Left group chat' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

module.exports = router;
