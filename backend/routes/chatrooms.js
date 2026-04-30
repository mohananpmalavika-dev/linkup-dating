const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET ALL PUBLIC CHATROOMS
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = (page - 1) * pageSize;

    const result = await db.query(
      `SELECT c.*, 
       (SELECT COUNT(*) FROM chatroom_members WHERE chatroom_id = c.id) as member_count,
       dp.first_name, dp.username
       FROM chatrooms c
       LEFT JOIN dating_profiles dp ON c.created_by_user_id = dp.user_id
       WHERE c.is_public = true
       ORDER BY c.updated_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM chatrooms WHERE is_public = true'
    );

    res.json({
      chatrooms: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      pageSize
    });
  } catch (err) {
    console.error('Get chatrooms error:', err);
    res.status(500).json({ error: 'Failed to get chatrooms' });
  }
});

// GET CHATROOM DETAILS
router.get('/:chatroomId', async (req, res) => {
  try {
    const { chatroomId } = req.params;
    const userId = req.user?.id;

    // Check if user is a member
    let isMember = false;
    if (userId) {
      const memberCheck = await db.query(
        'SELECT * FROM chatroom_members WHERE chatroom_id = $1 AND user_id = $2',
        [chatroomId, userId]
      );
      isMember = memberCheck.rows.length > 0;
    }

    const result = await db.query(
      `SELECT c.*,
       (SELECT COUNT(*) FROM chatroom_members WHERE chatroom_id = c.id) as member_count,
       dp.first_name, dp.username
       FROM chatrooms c
       LEFT JOIN dating_profiles dp ON c.created_by_user_id = dp.user_id
       WHERE c.id = $1`,
      [chatroomId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Chatroom not found' });
    }

    res.json({
      ...result.rows[0],
      isMember
    });
  } catch (err) {
    console.error('Get chatroom error:', err);
    res.status(500).json({ error: 'Failed to get chatroom' });
  }
});

// CREATE CHATROOM (authenticated users only)
router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      console.warn('CREATE CHATROOM - No user ID in request');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description, isPublic, maxMembers } = req.body;

    if (!name) {
      console.warn('CREATE CHATROOM - No name provided');
      return res.status(400).json({ error: 'Chatroom name required' });
    }

    console.log('CREATE CHATROOM - Attempting to create:', { userId, name, isPublic });

    const result = await db.query(
      `INSERT INTO chatrooms (created_by_user_id, name, description, is_public, max_members)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, name, description || '', isPublic !== false, maxMembers || 100]
    );

    const chatroomId = result.rows[0].id;
    console.log('CREATE CHATROOM - Created with ID:', chatroomId);

    // Add creator as first member
    await db.query(
      `INSERT INTO chatroom_members (chatroom_id, user_id)
       VALUES ($1, $2)`,
      [chatroomId, userId]
    );

    console.log('CREATE CHATROOM - Success, user added as member');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create chatroom error:', err);
    console.error('Error details:', {
      code: err.code,
      message: err.message,
      detail: err.detail,
      table: err.table,
      column: err.column
    });
    res.status(500).json({ 
      error: 'Failed to create chatroom',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// JOIN CHATROOM
router.post('/:chatroomId/join', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { chatroomId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user already member
    const memberCheck = await db.query(
      'SELECT * FROM chatroom_members WHERE chatroom_id = $1 AND user_id = $2',
      [chatroomId, userId]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Already a member' });
    }

    // Check member limit
    const chatroomResult = await db.query(
      'SELECT * FROM chatrooms WHERE id = $1',
      [chatroomId]
    );

    if (chatroomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Chatroom not found' });
    }

    const chatroom = chatroomResult.rows[0];
    const memberCountResult = await db.query(
      'SELECT COUNT(*) FROM chatroom_members WHERE chatroom_id = $1',
      [chatroomId]
    );

    const memberCount = parseInt(memberCountResult.rows[0].count);
    if (memberCount >= chatroom.max_members) {
      return res.status(400).json({ error: 'Chatroom is full' });
    }

    // Add user to chatroom
    await db.query(
      `INSERT INTO chatroom_members (chatroom_id, user_id)
       VALUES ($1, $2)`,
      [chatroomId, userId]
    );

    // Update member count
    await db.query(
      `UPDATE chatrooms 
       SET member_count = member_count + 1
       WHERE id = $1`,
      [chatroomId]
    );

    res.json({ message: 'Joined chatroom successfully' });
  } catch (err) {
    console.error('Join chatroom error:', err);
    res.status(500).json({ error: 'Failed to join chatroom' });
  }
});

// LEAVE CHATROOM - WITH TIMESTAMP TRACKING
router.post('/:chatroomId/leave', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { chatroomId } = req.params;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Update member status to 'left' with timestamp (soft delete)
    const result = await db.query(
      `UPDATE chatroom_members 
       SET status = 'left', left_at = CURRENT_TIMESTAMP
       WHERE chatroom_id = $1 AND user_id = $2
       RETURNING *`,
      [chatroomId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Create system message
    await db.query(
      `INSERT INTO chatroom_messages (chatroom_id, from_user_id, message, message_type)
       VALUES ($1, $2, $3, 'system')`,
      [chatroomId, userId, `User left the group${reason ? `: ${reason}` : ''}`]
    );

    // Emit socket event
    if (req.io) {
      req.io.to(`chatroom_${chatroomId}`).emit('member_left', {
        chatroomId,
        userId,
        leftAt: new Date().toISOString()
      });
    }

    res.json({ 
      success: true, 
      leftAt: new Date().toISOString() 
    });
  } catch (err) {
    console.error('Leave chatroom error:', err);
    res.status(500).json({ error: 'Failed to leave chatroom' });
  }
});

// GET CHATROOM MEMBERS
router.get('/:chatroomId/members', async (req, res) => {
  try {
    const { chatroomId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await db.query(
      `SELECT dp.id, dp.user_id, dp.first_name, dp.username, dp.location_city, profile_photos.photo_url
       FROM chatroom_members cm
       JOIN dating_profiles dp ON cm.user_id = dp.user_id
       LEFT JOIN profile_photos ON dp.user_id = profile_photos.user_id AND profile_photos.is_primary = true
       WHERE cm.chatroom_id = $1
       ORDER BY cm.joined_at DESC
       LIMIT $2 OFFSET $3`,
      [chatroomId, limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get members error:', err);
    res.status(500).json({ error: 'Failed to get members' });
  }
});

// GET CHATROOM MESSAGES
router.get('/:chatroomId/messages', async (req, res) => {
  try {
    const { chatroomId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await db.query(
      `SELECT cm.*, dp.first_name, dp.username, profile_photos.photo_url
       FROM chatroom_messages cm
       JOIN dating_profiles dp ON cm.from_user_id = dp.user_id
       LEFT JOIN profile_photos ON cm.from_user_id = profile_photos.user_id AND profile_photos.is_primary = true
       WHERE cm.chatroom_id = $1
       ORDER BY cm.created_at DESC
       LIMIT $2 OFFSET $3`,
      [chatroomId, limit, offset]
    );

    res.json(result.rows.reverse());
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// SEND MESSAGE TO CHATROOM
router.post('/:chatroomId/messages', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { chatroomId } = req.params;
    const { message } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    // Verify user is a member
    const memberCheck = await db.query(
      'SELECT * FROM chatroom_members WHERE chatroom_id = $1 AND user_id = $2',
      [chatroomId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this chatroom' });
    }

    // Insert message
    const result = await db.query(
      `INSERT INTO chatroom_messages (chatroom_id, from_user_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [chatroomId, userId, message]
    );

    // Update chatroom updated_at
    await db.query(
      `UPDATE chatrooms SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [chatroomId]
    );

    // Get message details with user info
    const messageResult = await db.query(
      `SELECT cm.*, dp.first_name, dp.username, profile_photos.photo_url
       FROM chatroom_messages cm
       JOIN dating_profiles dp ON cm.from_user_id = dp.user_id
       LEFT JOIN profile_photos ON cm.from_user_id = profile_photos.user_id AND profile_photos.is_primary = true
       WHERE cm.id = $1`,
      [result.rows[0].id]
    );

    // Emit via WebSocket if available
    if (req.io) {
      req.io.to(`chatroom_${chatroomId}`).emit('new_chatroom_message', messageResult.rows[0]);
    }

    res.status(201).json(messageResult.rows[0]);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// EDIT MESSAGE
router.put('/:chatroomId/messages/:messageId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { chatroomId, messageId } = req.params;
    const { message } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content required' });
    }

    // Verify user is the message sender
    const messageCheck = await db.query(
      `SELECT * FROM chatroom_messages 
       WHERE id = $1 AND chatroom_id = $2 AND from_user_id = $3`,
      [messageId, chatroomId, userId]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Cannot edit this message' });
    }

    // Update message
    const result = await db.query(
      `UPDATE chatroom_messages 
       SET message = $1, is_edited = true, edited_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [message.trim(), messageId]
    );

    // Emit socket event
    if (req.io) {
      req.io.to(`chatroom_${chatroomId}`).emit('message_edited', result.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Edit message error:', err);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// DELETE MESSAGE
router.delete('/:chatroomId/messages/:messageId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { chatroomId, messageId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is sender or admin
    const messageCheck = await db.query(
      `SELECT * FROM chatroom_messages 
       WHERE id = $1 AND chatroom_id = $2 AND from_user_id = $3`,
      [messageId, chatroomId, userId]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Cannot delete this message' });
    }

    // Delete message
    await db.query(
      `DELETE FROM chatroom_messages WHERE id = $1`,
      [messageId]
    );

    // Emit socket event
    if (req.io) {
      req.io.to(`chatroom_${chatroomId}`).emit('message_deleted', { messageId });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// ADD EMOJI REACTION
router.post('/:chatroomId/messages/:messageId/reactions', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { chatroomId, messageId } = req.params;
    const { emoji } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji required' });
    }

    // Verify user is member
    const memberCheck = await db.query(
      'SELECT * FROM chatroom_members WHERE chatroom_id = $1 AND user_id = $2',
      [chatroomId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member' });
    }

    // Get current reactions
    const messageCheck = await db.query(
      'SELECT reactions FROM chatroom_messages WHERE id = $1 AND chatroom_id = $2',
      [messageId, chatroomId]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    let reactions = messageCheck.rows[0].reactions || [];
    if (typeof reactions === 'string') {
      reactions = JSON.parse(reactions);
    }

    // Find or create emoji reaction
    let emojiReaction = reactions.find(r => r.emoji === emoji);
    
    if (emojiReaction) {
      // Toggle: if user already reacted, remove; otherwise add
      const userIndex = emojiReaction.users ? emojiReaction.users.indexOf(userId) : -1;
      if (userIndex >= 0) {
        emojiReaction.users.splice(userIndex, 1);
        emojiReaction.count = emojiReaction.users.length;
      } else {
        if (!emojiReaction.users) emojiReaction.users = [];
        emojiReaction.users.push(userId);
        emojiReaction.count = emojiReaction.users.length;
      }
    } else {
      emojiReaction = {
        emoji,
        count: 1,
        users: [userId]
      };
      reactions.push(emojiReaction);
    }

    // Remove empty reactions
    reactions = reactions.filter(r => r.count > 0);

    // Update message
    const result = await db.query(
      `UPDATE chatroom_messages 
       SET reactions = $1
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(reactions), messageId]
    );

    // Emit socket event
    if (req.io) {
      req.io.to(`chatroom_${chatroomId}`).emit('reaction_updated', {
        messageId,
        reactions
      });
    }

    res.json({ messageId, reactions });
  } catch (err) {
    console.error('Add reaction error:', err);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// UPDATE MEMBER ROLE
router.put('/:chatroomId/members/:memberId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { chatroomId, memberId } = req.params;
    const { role, status } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if requester is admin
    const adminCheck = await db.query(
      `SELECT * FROM chatroom_members 
       WHERE chatroom_id = $1 AND user_id = $2 AND role = 'admin'`,
      [chatroomId, userId]
    );

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only admins can manage members' });
    }

    // Update member
    const updates = [];
    const values = [chatroomId, memberId];
    let paramIndex = 3;

    if (role && ['admin', 'moderator', 'member'].includes(role)) {
      updates.push(`role = $${paramIndex}`);
      values.push(role);
      paramIndex++;
    }

    if (status && ['active', 'muted', 'left'].includes(status)) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const result = await db.query(
      `UPDATE chatroom_members 
       SET ${updates.join(', ')}
       WHERE chatroom_id = $1 AND user_id = $2
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Emit socket event
    if (req.io) {
      req.io.to(`chatroom_${chatroomId}`).emit('member_updated', result.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update member error:', err);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// REMOVE MEMBER
router.delete('/:chatroomId/members/:memberId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { chatroomId, memberId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if requester is admin or moderator
    const authorityCheck = await db.query(
      `SELECT role FROM chatroom_members 
       WHERE chatroom_id = $1 AND user_id = $2 AND role IN ('admin', 'moderator')`,
      [chatroomId, userId]
    );

    if (authorityCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Delete member
    const result = await db.query(
      `DELETE FROM chatroom_members 
       WHERE chatroom_id = $1 AND user_id = $2
       RETURNING user_id`,
      [chatroomId, memberId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Create system message
    await db.query(
      `INSERT INTO chatroom_messages (chatroom_id, from_user_id, message, message_type)
       VALUES ($1, $2, $3, 'system')`,
      [chatroomId, userId, 'User was removed from the group']
    );

    // Emit socket event
    if (req.io) {
      req.io.to(`chatroom_${chatroomId}`).emit('member_removed', {
        chatroomId,
        userId: memberId
      });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;
