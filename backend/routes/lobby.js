const express = require('express');
const router = express.Router();
const db = require('../config/database');

const getMessageText = (body = {}) =>
  String(body.message ?? body.content ?? body.text ?? '').trim();

// GET LOBBY MESSAGES
router.get('/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await db.query(
      `SELECT lm.*,
              COALESCE(NULLIF(dp.first_name, ''), dp.username, SPLIT_PART(u.email, '@', 1), 'Member') AS first_name,
              dp.username,
              profile_photos.photo_url
       FROM lobby_messages lm
       LEFT JOIN dating_profiles dp ON lm.from_user_id = dp.user_id
       LEFT JOIN users u ON lm.from_user_id = u.id
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
    const message = getMessageText(req.body);

    console.log('LOBBY MESSAGE - Request received:', {
      userId,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : 'none',
      messageType: typeof message,
      messageValue: message,
      contentType: req.headers['content-type']
    });

    // Validate user authentication first
    if (!userId) {
      console.warn('LOBBY MESSAGE - No user ID from request:', {
        hasUser: !!req.user,
        userKeys: req.user ? Object.keys(req.user) : 'none',
        authHeader: req.headers['authorization'] ? 'present' : 'missing'
      });
      return res.status(401).json({ 
        error: 'Unauthorized',
        code: 'NO_USER_ID'
      });
    }

    // Validate message - log detailed diagnostics
    if (!message) {
      console.warn('LOBBY MESSAGE - No message provided:', {
        body: req.body,
        messageField: message,
        messageUndefined: message === undefined,
        messageNull: message === null,
        messageFalsy: !message
      });
      return res.status(400).json({ 
        error: 'Message is required',
        code: 'NO_MESSAGE',
        hint: 'Include a "message" field in the request body with text content'
      });
    }

    if (message.length > 5000) {
      console.warn('LOBBY MESSAGE - Message too long:', message.length);
      return res.status(400).json({ 
        error: 'Message cannot exceed 5000 characters',
        code: 'MESSAGE_TOO_LONG',
        length: message.length
      });
    }

    // Verify user exists in database
    const userCheck = await db.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      console.warn('LOBBY MESSAGE - User not found in database:', userId);
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Insert message
    const result = await db.query(
      `INSERT INTO lobby_messages (from_user_id, message, message_type, created_at)
       VALUES ($1, $2, 'text', NOW())
       RETURNING *`,
      [userId, message]
    );

    if (!result.rows || result.rows.length === 0) {
      console.error('SEND LOBBY MESSAGE - No rows returned from INSERT');
      return res.status(500).json({ error: 'Failed to create message' });
    }

    // Get message details with user info
    const messageResult = await db.query(
      `SELECT lm.*,
              COALESCE(NULLIF(dp.first_name, ''), dp.username, SPLIT_PART(u.email, '@', 1), 'Member') AS first_name,
              dp.username,
              profile_photos.photo_url
       FROM lobby_messages lm
       LEFT JOIN dating_profiles dp ON lm.from_user_id = dp.user_id
       LEFT JOIN users u ON lm.from_user_id = u.id
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
      detail: err.detail,
      severity: err.severity
    });
    
    let errorMessage = 'Failed to send message';
    let errorCode = 'UNKNOWN_ERROR';
    let statusCode = 500;

    if (err.code === '23502') {
      // NOT NULL constraint violation - determine which field
      if (err.detail && err.detail.includes('from_user_id')) {
        errorMessage = 'User information is missing';
        errorCode = 'MISSING_USER_ID';
      } else if (err.detail && err.detail.includes('message')) {
        errorMessage = 'Message content is missing';
        errorCode = 'MISSING_MESSAGE';
      } else {
        errorMessage = 'Missing required fields';
        errorCode = 'MISSING_REQUIRED_FIELD';
      }
      statusCode = 400;
    } else if (err.code === '23503') {
      errorMessage = 'User not found';
      errorCode = 'USER_NOT_FOUND';
      statusCode = 400;
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      errorMessage = 'Database connection failed';
      errorCode = 'DB_CONNECTION_ERROR';
      statusCode = 503;
    }

    res.status(statusCode).json({ 
      error: errorMessage,
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
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
