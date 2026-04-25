const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET MESSAGES FOR A MATCH
router.get('/matches/:matchId/messages', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;

    // Verify user is part of this match
    const matchCheck = await db.query(
      'SELECT * FROM matches WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)',
      [matchId, userId]
    );

    if (matchCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await db.query(
      `SELECT * FROM messages 
       WHERE match_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [matchId, limit, offset]
    );

    // Mark messages as read
    await db.query(
      `UPDATE messages 
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE match_id = $1 AND to_user_id = $2 AND is_read = false`,
      [matchId, userId]
    );

    res.json(result.rows.reverse());
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// SEND MESSAGE
router.post('/matches/:matchId/messages', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message text required' });
    }

    // Get match details
    const matchResult = await db.query(
      'SELECT * FROM matches WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)',
      [matchId, userId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const match = matchResult.rows[0];
    const toUserId = match.user_id_1 === userId ? match.user_id_2 : match.user_id_1;

    // Save message to database
    const result = await db.query(
      `INSERT INTO messages (match_id, from_user_id, to_user_id, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [matchId, userId, toUserId, message]
    );

    // Update match last message
    await db.query(
      `UPDATE matches 
       SET last_message_at = CURRENT_TIMESTAMP, message_count = message_count + 1
       WHERE id = $1`,
      [matchId]
    );

    // Emit real-time notification via WebSocket
    if (req.io) {
      const receiverSocketId = req.activeUsers.get(toUserId);
      if (receiverSocketId) {
        req.io.to(receiverSocketId).emit('new_message', {
          matchId,
          fromUserId: userId,
          message,
          timestamp: result.rows[0].created_at
        });
      }
    }

    res.json({ message: 'Message sent', data: result.rows[0] });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// DELETE MESSAGE
router.delete('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `DELETE FROM messages 
       WHERE id = $1 AND from_user_id = $2
       RETURNING *`,
      [messageId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// GET UNREAD MESSAGE COUNT
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT COUNT(*) as unread_count FROM messages 
       WHERE to_user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({ unreadCount: parseInt(result.rows[0].unread_count) });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

module.exports = router;
