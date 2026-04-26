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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description, isPublic, maxMembers } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Chatroom name required' });
    }

    const result = await db.query(
      `INSERT INTO chatrooms (created_by_user_id, name, description, is_public, max_members)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, name, description || '', isPublic !== false, maxMembers || 100]
    );

    const chatroomId = result.rows[0].id;

    // Add creator as first member
    await db.query(
      `INSERT INTO chatroom_members (chatroom_id, user_id)
       VALUES ($1, $2)`,
      [chatroomId, userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create chatroom error:', err);
    res.status(500).json({ error: 'Failed to create chatroom' });
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

// LEAVE CHATROOM
router.post('/:chatroomId/leave', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { chatroomId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await db.query(
      `DELETE FROM chatroom_members 
       WHERE chatroom_id = $1 AND user_id = $2`,
      [chatroomId, userId]
    );

    // Update member count
    await db.query(
      `UPDATE chatrooms 
       SET member_count = member_count - 1
       WHERE id = $1 AND member_count > 0`,
      [chatroomId]
    );

    res.json({ message: 'Left chatroom' });
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

module.exports = router;
