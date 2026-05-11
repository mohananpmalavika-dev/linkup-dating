const express = require('express');
const router = express.Router();
const db = require('../config/database');
const spamFraudService = require('../services/spamFraudService');
const userNotificationService = require('../services/userNotificationService');
const streakService = require('../services/streakService');
const contentModerationService = require('../services/contentModerationService');
const MISSING_COLUMN_ERROR_CODE = '42703';

const ALLOWED_MESSAGE_REACTIONS = new Set(['❤️', '👍', '😂', '🔥', '👏']);

const getRequestMetadata = (req) => ({
  ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null,
  userAgent: req.headers['user-agent'] || null
});

const isMissingColumnError = (error) =>
  (error?.code || error?.parent?.code || error?.original?.code) === MISSING_COLUMN_ERROR_CODE;

const isMissingMessageTypeColumnError = (error) =>
  isMissingColumnError(error) && String(error.message || '').includes('message_type');

const insertTextMessage = async (matchId, userId, toUserId, normalizedMessage, messageType = 'text') => {
  const normalizedType = ['text', 'sticker'].includes(messageType) ? messageType : 'text';

  try {
    return await db.query(
      `INSERT INTO messages (match_id, from_user_id, to_user_id, message, message_type, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [matchId, userId, toUserId, normalizedMessage, normalizedType]
    );
  } catch (error) {
    if (!isMissingMessageTypeColumnError(error)) {
      throw error;
    }

    console.warn('messages.message_type column missing; sending text message without message_type metadata');

    return db.query(
      `INSERT INTO messages (match_id, from_user_id, to_user_id, message, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [matchId, userId, toUserId, normalizedMessage]
    );
  }
};

const insertMediaMessage = async ({
  matchId,
  userId,
  toUserId,
  mediaType,
  mediaUrl,
  duration,
  messageType
}) => {
  try {
    return await db.query(
      `INSERT INTO messages (match_id, from_user_id, to_user_id, message, media_type, media_url, duration, message_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        matchId,
        userId,
        toUserId,
        `[${mediaType}]`,
        mediaType,
        mediaUrl,
        duration,
        messageType
      ]
    );
  } catch (error) {
    if (!isMissingMessageTypeColumnError(error)) {
      throw error;
    }

    console.warn('messages.message_type column missing; sending media message without message_type metadata');

    return db.query(
      `INSERT INTO messages (match_id, from_user_id, to_user_id, message, media_type, media_url, duration, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [matchId, userId, toUserId, `[${mediaType}]`, mediaType, mediaUrl, duration]
    );
  }
};

const updateMatchMessageSummary = async (matchId) => {
  try {
    await db.query(
      `UPDATE matches
       SET last_message_at = CURRENT_TIMESTAMP,
           message_count = COALESCE(message_count, 0) + 1
       WHERE id = $1`,
      [matchId]
    );
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }

    console.warn('matches message summary columns missing; message was saved without updating match summary');
  }
};

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
    const requestMetadata = getRequestMetadata(req);
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
         AND COALESCE(m.is_deleted, FALSE) = FALSE
         AND (
           COALESCE(m.is_disappearing, FALSE) = FALSE
           OR m.disappears_at IS NULL
           OR m.disappears_at > CURRENT_TIMESTAMP
         )
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

    spamFraudService.trackUserActivity({
      userId,
      action: 'conversation_view',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent
    });

    res.json(result.rows.reverse());
  } catch (err) {
    console.error('Get messages error:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      stack: err.stack
    });
    res.status(500).json({ 
      error: 'Failed to get messages',
      details: err.message 
    });
  }
});

// SEND MESSAGE
router.post('/matches/:matchId/messages', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;
    const normalizedMessage = String(req.body.message || '').trim();
    const messageType = String(req.body.messageType || 'text').trim().toLowerCase();
    const requestMetadata = getRequestMetadata(req);

    if (!normalizedMessage) {
      return res.status(400).json({ error: 'Message text required' });
    }

    const match = await getMatchForUser(matchId, userId);

    if (!match) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const spamEvaluation = await spamFraudService.evaluateMessageForSpam(userId, normalizedMessage);

    if (spamEvaluation.blocked) {
      await spamFraudService.refreshSystemMetrics();

      return res.status(422).json({
        error: spamEvaluation.message || 'Message blocked by spam filter',
        reason: spamEvaluation.reasons?.join(', ') || 'spam_detected'
      });
    }

const toUserId = Number(match.user_id_1) === Number(userId) ? match.user_id_2 : match.user_id_1;

    // Content moderation:scan text before sending
    const moderationResult = await contentModerationService.scanText(normalizedMessage);
    if (!moderationResult.clean) {
      // Log the violation but don't block - just flag for review
      await contentModerationService.flagContent(
        userId,
        'message',
        null,
        moderationResult.issues[0]?.type || 'inappropriate_content',
        { message: normalizedMessage, issues: moderationResult.issues }
      );
      // Optionally block high severity content
      if (moderationResult.severity === 'high') {
        return res.status(422).json({
          error: 'Message contains inappropriate content',
          reason: moderationResult.issues[0]?.message || 'content_blocked'
        });
      }
    }

    const result = await insertTextMessage(matchId, userId, toUserId, normalizedMessage, messageType);

    await updateMatchMessageSummary(matchId);

    const senderProfile = await db.query(
      `SELECT COALESCE(NULLIF(first_name, ''), 'Someone') AS display_name
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
        messageType,
        timestamp: createdMessage.created_at,
        reactions: []
      });
    }

    await userNotificationService.createNotification(toUserId, {
      type: 'new_message',
      title: `New message from ${fromUserName}`,
      body: normalizedMessage.length > 90
        ? `${normalizedMessage.slice(0, 87)}...`
        : normalizedMessage,
      metadata: {
        matchId: Number.parseInt(matchId, 10),
        messageId: createdMessage.id,
        fromUserId: userId,
        fromUserName
      }
    });

    // Update streak tracking
    try {
      const streakResult = await streakService.updateStreakOnMessage(
        matchId,
        userId,
        toUserId
      );

      // Emit streak update event
      if (req.io && streakResult) {
        req.io.to(`match_${matchId}`).emit('streak:updated', {
          matchId: Number.parseInt(matchId, 10),
          streakDays: streakResult.streak?.streakDays || 0,
          isNew: streakResult.isNew || false,
          milestoneTrigger: streakResult.milestoneTrigger || null
        });
      }
    } catch (err) {
      console.error('Error updating streak:', err);
      // Don't fail the message if streak update fails
    }

    spamFraudService.trackUserActivity({
      userId,
      action: 'message_sent',
      analyticsUpdates: { messages_sent: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

    res.json({ message: 'Message sent', data: createdMessage });
  } catch (err) {
    console.error('Send message error:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      stack: err.stack
    });
    res.status(500).json({ 
      error: 'Failed to send message',
      details: err.message 
    });
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
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      stack: err.stack
    });
    res.status(500).json({ 
      error: 'Failed to update reaction',
      details: err.message 
    });
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
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      stack: err.stack
    });
    res.status(500).json({ 
      error: 'Failed to delete message',
      details: err.message 
    });
  }
});

// GET UNREAD MESSAGE COUNT
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT COUNT(*) as unread_count FROM messages
       WHERE to_user_id = $1
         AND is_read = false
         AND COALESCE(is_deleted, FALSE) = FALSE
         AND (
           COALESCE(is_disappearing, FALSE) = FALSE
           OR disappears_at IS NULL
           OR disappears_at > CURRENT_TIMESTAMP
         )`,
      [userId]
    );

    res.json({ unreadCount: Number.parseInt(result.rows[0].unread_count, 10) || 0 });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// SEND MEDIA MESSAGE (image or voice)
router.post('/matches/:matchId/media', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;
    const mediaType = String(req.body.mediaType || req.query.mediaType || 'image');
    const duration = Number.parseInt(req.body.duration, 10) || null;
    const requestMetadata = getRequestMetadata(req);

    if (!['image', 'voice', 'audio', 'video', 'document'].includes(mediaType)) {
      return res.status(400).json({ error: 'Invalid media type' });
    }

    const match = await getMatchForUser(matchId, userId);

    if (!match) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const toUserId = Number(match.user_id_1) === Number(userId) ? match.user_id_2 : match.user_id_1;

    // Handle file upload - collect from multipart or base64
    const MAX_MEDIA_BYTES = mediaType === 'image' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
    let mediaUrl = null;

    if (req.body?.mediaBase64) {
      mediaUrl = req.body.mediaBase64;
    } else if (req.files?.media || req.file) {
      const file = req.files?.media || req.file;
      const base64Data = file.data?.toString('base64') || file.buffer?.toString('base64');
      if (base64Data) {
        mediaUrl = `data:${file.mimetype || 'application/octet-stream'};base64,${base64Data}`;
      }
    }

if (!mediaUrl) {
      return res.status(400).json({ error: 'Media file required' });
    }

    // Content moderation: scan images before sending (only for images, not voice/video)
    if (mediaType === 'image') {
      const imageModerationResult = await contentModerationService.scanImage(mediaUrl);
      if (!imageModerationResult.clean) {
        // Flag for review but don't block unless high severity
        await contentModerationService.flagContent(
          userId,
          'media',
          null,
          imageModerationResult.issues[0]?.type || 'inappropriate_image',
          { mediaUrl, issues: imageModerationResult.issues }
        );
        if (imageModerationResult.nsfw || imageModerationResult.severity === 'high') {
          return res.status(422).json({
            error: 'Image contains inappropriate content',
            reason: imageModerationResult.issues[0]?.message || 'content_blocked'
          });
        }
      }
    }

    // Limit base64 size
    const base64Size = mediaUrl.length * 0.75;
    if (base64Size > MAX_MEDIA_BYTES) {
      return res.status(413).json({ error: `Media too large. Max ${mediaType === 'image' ? '5MB' : '10MB'}` });
    }

    const result = await insertMediaMessage({
      matchId,
      userId,
      toUserId,
      mediaType,
      mediaUrl,
      duration,
      messageType: mediaType === 'voice' ? 'audio' : mediaType
    });

    await updateMatchMessageSummary(matchId);

    const senderProfile = await db.query(
      `SELECT COALESCE(NULLIF(first_name, ''), 'Someone') AS display_name
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
        message: `[${mediaType}]`,
        timestamp: createdMessage.created_at,
        mediaType,
        mediaUrl,
        duration,
        reactions: []
      });
    }

    const mediaNotificationCopy = {
      image: {
        title: `New image from ${fromUserName}`,
        body: 'Shared an image'
      },
      voice: {
        title: `New voice note from ${fromUserName}`,
        body: 'Voice message'
      },
      audio: {
        title: `New audio from ${fromUserName}`,
        body: 'Shared an audio file'
      },
      video: {
        title: `New video from ${fromUserName}`,
        body: 'Shared a video'
      },
      document: {
        title: `New document from ${fromUserName}`,
        body: 'Shared a document'
      }
    }[mediaType] || {
      title: `New attachment from ${fromUserName}`,
      body: 'Shared an attachment'
    };

    await userNotificationService.createNotification(toUserId, {
      type: 'new_message',
      title: mediaNotificationCopy.title,
      body: mediaNotificationCopy.body,
      metadata: {
        matchId: Number.parseInt(matchId, 10),
        messageId: createdMessage.id,
        fromUserId: userId,
        fromUserName,
        mediaType
      }
    });

    spamFraudService.trackUserActivity({
      userId,
      action: `${mediaType}_sent`,
      analyticsUpdates: { messages_sent: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

    res.json({ message: 'Media sent', data: createdMessage });
  } catch (err) {
    console.error('Send media error:', err);
    res.status(500).json({ error: 'Failed to send media' });
  }
});

// ============ CALL ENDPOINTS ============

// POST /messaging/calls/initiate - Start a call between matches
router.post('/calls/initiate', async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId, recipientId, callType } = req.body;
    const requestMetadata = getRequestMetadata(req);

    if (!chatId || !recipientId || !callType) {
      return res.status(400).json({ error: 'chatId, recipientId, and callType are required' });
    }

    // Verify it's a valid match between the two users
    const matchResult = await db.query(
      `SELECT id FROM matches 
       WHERE (user_id_1 = $1 AND user_id_2 = $2 OR user_id_1 = $2 AND user_id_2 = $1)
       AND status = 'active'`,
      [userId, recipientId]
    );

    if (!matchResult.rows[0]) {
      return res.status(403).json({ error: 'Invalid match or not authorized' });
    }

    const matchId = matchResult.rows[0].id;

    // Create call session
    const { v4: uuidv4 } = require('uuid');
    const callId = uuidv4();
    const callResult = await db.query(
      `INSERT INTO call_sessions (session_id, caller_id, receiver_id, call_type, status, created_at)
       VALUES ($1, $2, $3, $4, 'requested', NOW())
       RETURNING id, session_id, caller_id, receiver_id, call_type, status, created_at`,
      [callId, userId, recipientId, callType]
    );

    const call = callResult.rows[0];

    // Emit socket notification to recipient
    if (req.app.io) {
      req.app.io.to(`user_${recipientId}`).emit('call:incoming', {
        _id: call.id,
        callId: call.session_id,
        initiatorId: userId,
        callType: callType,
        matchId: matchId,
        createdAt: call.created_at
      });
    }

    // Send push notification to recipient
    try {
      await userNotificationService.sendNotification(
        recipientId,
        `Incoming ${callType} call`,
        'Someone is calling you',
        {
          type: 'call_incoming',
          callId: call.session_id,
          callType: callType,
          matchId: matchId,
          initiatorId: userId
        }
      );
    } catch (notificationError) {
      console.warn('Failed to send call notification:', notificationError.message);
    }

    // Track activity
    spamFraudService.trackUserActivity({
      userId,
      action: `call_initiated_${callType}`,
      analyticsUpdates: { calls_initiated: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: false
    });

    res.json({
      call: {
        _id: call.id,
        callId: call.session_id,
        initiatorId: call.caller_id,
        recipientId: call.receiver_id,
        callType: call.call_type,
        status: call.status,
        createdAt: call.created_at
      }
    });
  } catch (err) {
    console.error('Initiate call error:', err);
    res.status(500).json({ error: 'Failed to initiate call', details: err.message });
  }
});

// POST /messaging/calls/:callId/accept - Accept an incoming call
router.post('/calls/:callId/accept', async (req, res) => {
  try {
    const userId = req.user.id;
    const { callId } = req.params;

    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }

    // Find the call session
    const callResult = await db.query(
      `SELECT * FROM call_sessions WHERE id = $1 OR session_id = $1`,
      [callId]
    );

    if (!callResult.rows[0]) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const call = callResult.rows[0];

    // Verify the current user is the receiver
    if (call.receiver_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to accept this call' });
    }

    // Update call status to active
    const updateResult = await db.query(
      `UPDATE call_sessions 
       SET status = 'active', start_time = NOW()
       WHERE id = $1
       RETURNING *`,
      [call.id]
    );

    const updatedCall = updateResult.rows[0];

    // Emit socket event to both users
    if (req.app.io) {
      req.app.io.to(`user_${call.caller_id}`).emit('call:accepted', {
        _id: updatedCall.id,
        callId: updatedCall.session_id,
        status: 'active'
      });
      req.app.io.to(`user_${userId}`).emit('call:accepted', {
        _id: updatedCall.id,
        callId: updatedCall.session_id,
        status: 'active'
      });
    }

    res.json({
      call: {
        _id: updatedCall.id,
        callId: updatedCall.session_id,
        status: updatedCall.status,
        startTime: updatedCall.start_time
      }
    });
  } catch (err) {
    console.error('Accept call error:', err);
    res.status(500).json({ error: 'Failed to accept call', details: err.message });
  }
});

// POST /messaging/calls/:callId/decline - Decline an incoming call
router.post('/calls/:callId/decline', async (req, res) => {
  try {
    const userId = req.user.id;
    const { callId } = req.params;

    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }

    // Find the call session
    const callResult = await db.query(
      `SELECT * FROM call_sessions WHERE id = $1 OR session_id = $1`,
      [callId]
    );

    if (!callResult.rows[0]) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const call = callResult.rows[0];

    // Verify the current user is the receiver
    if (call.receiver_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to decline this call' });
    }

    // Update call status to declined
    const updateResult = await db.query(
      `UPDATE call_sessions 
       SET status = 'declined', ended_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [call.id]
    );

    const updatedCall = updateResult.rows[0];

    // Emit socket event to caller
    if (req.app.io) {
      req.app.io.to(`user_${call.caller_id}`).emit('call:declined', {
        _id: updatedCall.id,
        callId: updatedCall.session_id,
        status: 'declined'
      });
    }

    res.json({
      success: true,
      message: 'Call declined'
    });
  } catch (err) {
    console.error('Decline call error:', err);
    res.status(500).json({ error: 'Failed to decline call', details: err.message });
  }
});

// POST /messaging/calls/:callId/end - End an active call
router.post('/calls/:callId/end', async (req, res) => {
  try {
    const userId = req.user.id;
    const { callId } = req.params;
    const requestMetadata = getRequestMetadata(req);

    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }

    // Find the call session
    const callResult = await db.query(
      `SELECT * FROM call_sessions WHERE id = $1 OR session_id = $1`,
      [callId]
    );

    if (!callResult.rows[0]) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const call = callResult.rows[0];

    // Verify the current user is part of the call
    if (call.caller_id !== userId && call.receiver_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Calculate call duration if call was active
    let durationSeconds = 0;
    if (call.start_time) {
      durationSeconds = Math.floor((Date.now() - new Date(call.start_time).getTime()) / 1000);
    }

    // Update call status to completed
    const updateResult = await db.query(
      `UPDATE call_sessions 
       SET status = 'completed', 
           end_time = NOW(),
           duration_seconds = $2
       WHERE id = $1
       RETURNING *`,
      [call.id, durationSeconds]
    );

    const updatedCall = updateResult.rows[0];

    // Emit socket event to both users
    const otherUserId = call.caller_id === userId ? call.receiver_id : call.caller_id;
    if (req.app.io) {
      req.app.io.to(`user_${otherUserId}`).emit('call:ended', {
        _id: updatedCall.id,
        callId: updatedCall.session_id,
        status: 'completed',
        durationSeconds: updatedCall.duration_seconds
      });
    }

    // Track activity
    spamFraudService.trackUserActivity({
      userId,
      action: `call_ended_${call.call_type}`,
      analyticsUpdates: { calls_completed: 1, call_minutes: Math.ceil(durationSeconds / 60) },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: false,
      runFraudCheck: false
    });

    res.json({
      success: true,
      message: 'Call ended',
      durationSeconds: updatedCall.duration_seconds
    });
  } catch (err) {
    console.error('End call error:', err);
    res.status(500).json({ error: 'Failed to end call', details: err.message });
  }
});

module.exports = router;
