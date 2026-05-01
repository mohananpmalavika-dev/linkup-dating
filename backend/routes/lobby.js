const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET LOBBY MESSAGES
router.get('/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await db.query(
      `SELECT lm.*, dp.first_name, dp.username, profile_photos.photo_url
       FROM lobby_messages lm
       JOIN dating_profiles dp ON lm.from_user_id = dp.user_id
       LEFT JOIN profile_photos ON lm.from_user_id = profile_photos.user_id AND profile_photos.is_primary = true
       ORDER BY lm.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(result.rows.reverse());
  } catch (err) {
    console.error('Get lobby messages error:', err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// SEND MESSAGE TO LOBBY
router.post('/messages', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { message } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required and must be a non-empty string' });
    }

    // Insert message
    const result = await db.query(
      `INSERT INTO lobby_messages (from_user_id, message)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, message.trim()]
    );

    if (!result.rows || result.rows.length === 0) {
      console.error('SEND LOBBY MESSAGE - No rows returned from INSERT');
      return res.status(500).json({ error: 'Failed to create message' });
    }

    // Get message details with user info
    const messageResult = await db.query(
      `SELECT lm.*, dp.first_name, dp.username, profile_photos.photo_url
       FROM lobby_messages lm
       LEFT JOIN dating_profiles dp ON lm.from_user_id = dp.user_id
       LEFT JOIN profile_photos ON lm.from_user_id = profile_photos.user_id AND profile_photos.is_primary = true
       WHERE lm.id = $1`,
      [result.rows[0].id]
    );

    if (!messageResult.rows || messageResult.rows.length === 0) {
      console.error('SEND LOBBY MESSAGE - Failed to retrieve message after insert');
      return res.status(500).json({ error: 'Failed to retrieve message' });
    }

    // Emit via WebSocket to all connected users
    if (req.io) {
      req.io.to('lobby').emit('new_lobby_message', messageResult.rows[0]);
    }

    res.status(201).json(messageResult.rows[0]);
  } catch (err) {
    console.error('Send lobby message error:', err);
    console.error('Send lobby message error details:', {
      code: err.code,
      message: err.message,
      detail: err.detail
    });
    
    let errorMessage = 'Failed to send message';
    let statusCode = 500;

    if (err.code === '23502') {
      errorMessage = 'Missing required fields';
      statusCode = 400;
    } else if (err.code === '23503') {
      errorMessage = 'User not found';
      statusCode = 400;
    }

    res.status(statusCode).json({ error: errorMessage });
  }
});

// GET LOBBY ONLINE STATUS
router.get('/online-users', async (req, res) => {
  try {
    res.json({
      onlineCount: typeof req.getOnlineUserCount === 'function'
        ? req.getOnlineUserCount()
        : 0
    });
  } catch (err) {
    console.error('Get online users error:', err);
    res.status(500).json({ error: 'Failed to get online status' });
  }
});

module.exports = router;
