const express = require('express');
const router = express.Router();
const db = require('../config/database');

const ALLOWED_MESSAGE_REACTIONS = new Set(['❤️', '👍', '😂', '🔥', '👏']);

const getMatchForUser = async (matchId, userId) => {
  const matchCheck = await db.query(
    'SELECT * FROM matches WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)',
    [matchId, userId]
  );

  return matchCheck.rows[0] || null;
};

const getMessageForUser = async (messageId, userId) => {
  const result = await db.query(
    `SELECT m.*, mt.user_id_1, mt.user_id_2
     FROM messages m
     INNER JOIN matches mt ON mt.id = m.match_id
     WHERE m.id = $1
       AND (mt.user_id_1 = $2 OR mt.user_id_2 = $2)
     LIMIT 1`,
    [messageId, userId]
  );

  return result.rows[0] || null;
};

const getReactionsForMessage = async (messageId, currentUserId) => {
  const result = await db.query(
    `SELECT emoji,
            COUNT(*)::int AS count,
            BOOL_OR(user_id = $2) AS reacted_by_current_user,
            MIN(created_at) AS first_reacted_at
     FROM message_reactions
     WHERE message_id = $1
     GROUP BY emoji
     ORDER BY first_reacted_at ASC`,
    [messageId, currentUserId]
  );

  return result.rows.map((row) => ({
    emoji: row.emoji,
    count: Number.parseInt(row.count, 10) || 0,
    reactedByCurrentUser: Boolean(row.reacted_by_current_user)
  }));
};

// GET MESSAGES FOR A MATCH
router.get('/matches/:matchId/messages', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;
    const limit = Number.parseInt(req.query.limit, 10) || 50;
    const offset = Number.parseInt(req.query.offset, 10) || 0;

    const match = await getMatchForUser(matchId, userId);

    if (!match) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await db.query(
      `SELECT m.*,
              COALESCE((
                SELECT json_agg(
                  json_build_object(
                    'emoji', reaction_summary.emoji,
                    'count', reaction_summary.reaction_count,
                    'reactedByCurrentUser', reaction_summary.reacted_by_current_user
                  )
                  ORDER BY reaction_summary.first_reacted_at ASC
                )
                FROM (
                  SELECT emoji,
                         COUNT(*)::int AS reaction_count,
                         BOOL_OR(user_id = $4) AS reacted_by_current_user,
                         MIN(created_at) AS first_reacted_at
                  FROM message_reactions
                  WHERE message_id = m.id
                  GROUP BY emoji
                ) reaction_summary
              ), '[]'::json) AS reactions
       FROM messages m
       WHERE match_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [matchId, limit, offset, userId]
    );

    const readResult = await db.query(
      `UPDATE messages
       SET is_read = true,
           read_at = CURRENT_TIMESTAMP
       WHERE match_id = $1
         AND to_user_id = $2
         AND is_read = false
       RETURNING id, from_user_id, read_at`,
      [matchId, userId]
    );

    if (readResult.rows.length > 0 && typeof req.emitToUser === 'function') {
      const messageIds = readResult.rows.map((row) => row.id);
      const latestReadAt = readResult.rows[readResult.rows.length - 1]?.read_at || new Date().toISOString();
      const senderIds = [...new Set(readResult.rows.map((row) => row.from_user_id))];

      senderIds.forEach((senderId) => {
        req.emitToUser(senderId, 'messages_read', {
          matchId: Number.parseInt(matchId, 10),
          messageIds,
          readAt: latestReadAt,
          readByUserId: userId
        });
      });
    }

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
    const normalizedMessage = String(req.body.message || '').trim();

    if (!normalizedMessage) {
      return res.status(400).json({ error: 'Message text required' });
    }

    const match = await getMatchForUser(matchId, userId);

    if (!match) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const toUserId = Number(match.user_id_1) === Number(userId) ? match.user_id_2 : match.user_id_1;

    const result = await db.query(
      `INSERT INTO messages (match_id, from_user_id, to_user_id, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [matchId, userId, toUserId, normalizedMessage]
    );

    await db.query(
      `UPDATE matches
       SET last_message_at = CURRENT_TIMESTAMP,
           message_count = message_count + 1
       WHERE id = $1`,
      [matchId]
    );

    const senderProfile = await db.query(
      `SELECT COALESCE(NULLIF(first_name, ''), username, 'Someone') AS display_name
       FROM dating_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );
    const fromUserName = senderProfile.rows[0]?.display_name || 'Someone';

    const createdMessage = {
      ...result.rows[0],
      reactions: []
    };

    if (typeof req.emitToUser === 'function') {
      req.emitToUser(toUserId, 'new_message', {
        matchId: Number.parseInt(matchId, 10),
        messageId: createdMessage.id,
        fromUserId: userId,
        fromUserName,
        message: normalizedMessage,
        timestamp: createdMessage.created_at,
        reactions: []
      });
    }

    res.json({ message: 'Message sent', data: createdMessage });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// TOGGLE MESSAGE REACTION
router.post('/messages/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const emoji = String(req.body.emoji || '').trim();

    if (!ALLOWED_MESSAGE_REACTIONS.has(emoji)) {
      return res.status(400).json({ error: 'Unsupported reaction' });
    }

    const message = await getMessageForUser(messageId, userId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const existingReaction = await db.query(
      `SELECT id
       FROM message_reactions
       WHERE message_id = $1
         AND user_id = $2
         AND emoji = $3
       LIMIT 1`,
      [messageId, userId, emoji]
    );

    let reacted = false;

    if (existingReaction.rows.length > 0) {
      await db.query(
        `DELETE FROM message_reactions
         WHERE message_id = $1
           AND user_id = $2
           AND emoji = $3`,
        [messageId, userId, emoji]
      );
    } else {
      await db.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji)
         VALUES ($1, $2, $3)`,
        [messageId, userId, emoji]
      );
      reacted = true;
    }

    const reactions = await getReactionsForMessage(messageId, userId);
    const payload = {
      messageId: Number.parseInt(messageId, 10),
      matchId: message.match_id,
      reactions
    };

    if (typeof req.emitToUser === 'function') {
      const participantIds = [...new Set([message.user_id_1, message.user_id_2])];
      participantIds.forEach((participantId) => {
        req.emitToUser(participantId, 'message_reaction_updated', payload);
      });
    }

    res.json({
      message: reacted ? 'Reaction added' : 'Reaction removed',
      data: {
        ...payload,
        reacted
      }
    });
  } catch (err) {
    console.error('Toggle message reaction error:', err);
    res.status(500).json({ error: 'Failed to update reaction' });
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

    res.json({ unreadCount: Number.parseInt(result.rows[0].unread_count, 10) || 0 });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

module.exports = router;
