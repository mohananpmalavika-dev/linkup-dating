/**
 * Messaging Enhancement Routes
 * Handles templates, search, export, encryption setup, backup, and disappearing messages
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const EncryptionService = require('../services/encryptionService');
const MessageExportService = require('../services/messageExportService');

const parseInteger = (value, fallbackValue = 0) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
};

const getMatchForUser = async (matchId, userId) => {
  const result = await db.query(
    `SELECT *
     FROM matches
     WHERE id = $1
       AND (user_id_1 = $2 OR user_id_2 = $2)
     LIMIT 1`,
    [matchId, userId]
  );

  return result.rows[0] || null;
};

const buildSearchTypeClause = (type, params) => {
  if (!type) {
    return '';
  }

  params.push(type);
  const typeParam = `$${params.length}`;

  return ` AND COALESCE(
    NULLIF(m.message_type, ''),
    CASE
      WHEN m.media_type = 'voice' THEN 'audio'
      WHEN m.media_type IS NOT NULL AND m.media_type <> '' THEN m.media_type
      ELSE 'text'
    END
  ) = ${typeParam}`;
};

// GET /messaging/templates
router.get('/templates', async (req, res) => {
  try {
    const userId = req.user.id;
    const category = req.query.category ? String(req.query.category).trim() : null;
    const pinned = req.query.pinned === undefined ? null : String(req.query.pinned).toLowerCase() === 'true';
    const params = [userId];
    const conditions = ['user_id = $1'];

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    if (pinned !== null) {
      params.push(pinned);
      conditions.push(`is_pinned = $${params.length}`);
    }

    const result = await db.query(
      `SELECT *
       FROM message_templates
       WHERE ${conditions.join(' AND ')}
       ORDER BY is_pinned DESC, usage_count DESC, created_at DESC`,
      params
    );

    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /messaging/templates
router.post('/templates', async (req, res) => {
  try {
    const userId = req.user.id;
    const title = String(req.body.title || '').trim();
    const content = String(req.body.content || '').trim();
    const category = String(req.body.category || 'general').trim() || 'general';
    const emoji = String(req.body.emoji || '').trim() || null;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const result = await db.query(
      `INSERT INTO message_templates (
         user_id,
         title,
         content,
         category,
         emoji,
         is_pinned,
         usage_count,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, title, content, category, emoji]
    );

    res.status(201).json({ template: result.rows[0] });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /messaging/templates/:templateId
router.put('/templates/:templateId', async (req, res) => {
  try {
    const userId = req.user.id;
    const templateId = parseInteger(req.params.templateId);
    const existingTemplateResult = await db.query(
      `SELECT *
       FROM message_templates
       WHERE id = $1
         AND user_id = $2
       LIMIT 1`,
      [templateId, userId]
    );

    if (existingTemplateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const existingTemplate = existingTemplateResult.rows[0];
    const nextTitle = String(req.body.title ?? existingTemplate.title).trim();
    const nextContent = String(req.body.content ?? existingTemplate.content).trim();
    const nextCategory = String(
      req.body.category ?? existingTemplate.category ?? 'general'
    ).trim() || 'general';
    const nextEmoji = req.body.emoji === undefined ? existingTemplate.emoji : String(req.body.emoji || '').trim() || null;
    const nextPinned = req.body.isPinned === undefined ? existingTemplate.is_pinned : Boolean(req.body.isPinned);

    if (!nextTitle || !nextContent) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const result = await db.query(
      `UPDATE message_templates
       SET title = $1,
           content = $2,
           category = $3,
           emoji = $4,
           is_pinned = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
         AND user_id = $7
       RETURNING *`,
      [nextTitle, nextContent, nextCategory, nextEmoji, nextPinned, templateId, userId]
    );

    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /messaging/templates/:templateId
router.delete('/templates/:templateId', async (req, res) => {
  try {
    const userId = req.user.id;
    const templateId = parseInteger(req.params.templateId);
    const result = await db.query(
      `DELETE FROM message_templates
       WHERE id = $1
         AND user_id = $2
       RETURNING id`,
      [templateId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// POST /messaging/templates/:templateId/use
router.post('/templates/:templateId/use', async (req, res) => {
  try {
    const userId = req.user.id;
    const templateId = parseInteger(req.params.templateId);
    const result = await db.query(
      `UPDATE message_templates
       SET usage_count = COALESCE(usage_count, 0) + 1,
           last_used_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND user_id = $2
       RETURNING *`,
      [templateId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Use template error:', error);
    res.status(500).json({ error: 'Failed to log template usage' });
  }
});

// GET /messaging/search
router.get('/search', async (req, res) => {
  try {
    const userId = req.user.id;
    const query = String(req.query.q || '').trim();
    const matchId = req.query.matchId ? parseInteger(req.query.matchId) : null;
    const type = req.query.type ? String(req.query.type).trim() : null;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const limit = Math.min(parseInteger(req.query.limit, 50), 100);
    const offset = Math.max(parseInteger(req.query.offset, 0), 0);

    if (query.length < 2) {
      return res.status(400).json({ error: 'Search query too short' });
    }

    const conditions = [
      '(m.from_user_id = $1 OR m.to_user_id = $1)',
      'COALESCE(m.is_deleted, FALSE) = FALSE',
      '(COALESCE(m.is_disappearing, FALSE) = FALSE OR m.disappears_at IS NULL OR m.disappears_at > CURRENT_TIMESTAMP)',
      `m.message ILIKE $2`
    ];
    const params = [userId, `%${query}%`];

    if (matchId) {
      params.push(matchId);
      conditions.push(`m.match_id = $${params.length}`);
    }

    if (startDate && !Number.isNaN(startDate.getTime())) {
      params.push(startDate);
      conditions.push(`m.created_at >= $${params.length}`);
    }

    if (endDate && !Number.isNaN(endDate.getTime())) {
      params.push(endDate);
      conditions.push(`m.created_at <= $${params.length}`);
    }

    conditions.push(buildSearchTypeClause(type, params).replace(/^ AND /, ''));
    const normalizedConditions = conditions.filter(Boolean);

    const totalResult = await db.query(
      `SELECT COUNT(*) AS total
       FROM messages m
       WHERE ${normalizedConditions.join(' AND ')}`,
      params
    );

    params.push(limit);
    params.push(offset);

    const result = await db.query(
      `SELECT m.*,
              COALESCE(NULLIF(dp.first_name, ''), dp.username, 'User') AS from_user_name
       FROM messages m
       LEFT JOIN dating_profiles dp
         ON dp.user_id = m.from_user_id
       WHERE ${normalizedConditions.join(' AND ')}
       ORDER BY m.created_at DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params
    );

    res.json({
      results: result.rows.map((row) => ({
        ...row,
        fromUser: {
          first_name: row.from_user_name
        }
      })),
      total: parseInteger(totalResult.rows[0]?.total, 0),
      limit,
      offset
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ error: 'Failed to search messages' });
  }
});

// POST /messaging/encryption/init
router.post('/encryption/init', async (req, res) => {
  try {
    const userId = req.user.id;
    const matchId = parseInteger(req.body.matchId);

    if (!matchId) {
      return res.status(400).json({ error: 'Match ID required' });
    }

    const match = await getMatchForUser(matchId, userId);
    if (!match) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { publicKey, privateKey } = await EncryptionService.generateKeyPair(userId, matchId);
    const encryptionKey = await EncryptionService.storeEncryptionKey(
      userId,
      matchId,
      publicKey,
      privateKey
    );

    res.json({
      encryptionKey: {
        id: encryptionKey.id,
        publicKey: encryptionKey.public_key,
        keyVersion: encryptionKey.key_version
      },
      message: 'Secure chat keys initialized for this match'
    });
  } catch (error) {
    console.error('Encryption init error:', error);
    res.status(500).json({ error: 'Failed to initialize encryption' });
  }
});

// GET /messaging/export
router.get('/export', async (req, res) => {
  try {
    const userId = req.user.id;
    const matchId = parseInteger(req.query.matchId);
    const format = String(req.query.format || 'json').toLowerCase();
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

    if (!matchId) {
      return res.status(400).json({ error: 'Match ID required' });
    }

    const options = {
      startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : null,
      endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null
    };

    let exportData;
    let contentType = 'application/json';
    let fileName = `chat-export-${Date.now()}`;

    if (format === 'json') {
      exportData = await MessageExportService.exportToJSON(userId, matchId, options);
      fileName += '.json';
      contentType = 'application/json';
    } else if (format === 'csv') {
      exportData = await MessageExportService.exportToCSV(userId, matchId, options);
      fileName += '.csv';
      contentType = 'text/csv';
    } else if (format === 'html') {
      exportData = await MessageExportService.exportToHTML(userId, matchId, options);
      fileName += '.html';
      contentType = 'text/html';
    } else {
      return res.status(400).json({ error: 'Unsupported export format' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(exportData);
  } catch (error) {
    console.error('Export error:', error);
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    res.status(500).json({ error: 'Failed to export messages' });
  }
});

// GET /messaging/backups
router.get('/backups', async (req, res) => {
  try {
    const userId = req.user.id;
    const matchId = req.query.matchId ? parseInteger(req.query.matchId) : null;
    const backups = await MessageExportService.listBackups(userId, matchId);
    res.json({ backups });
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// POST /messaging/backups/create
router.post('/backups/create', async (req, res) => {
  try {
    const userId = req.user.id;
    const matchId = parseInteger(req.body.matchId);

    if (!matchId) {
      return res.status(400).json({ error: 'Match ID required' });
    }

    const backup = await MessageExportService.createAutoBackup(userId, matchId);
    res.status(201).json({ backup });
  } catch (error) {
    console.error('Create backup error:', error);
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// POST /messaging/disappearing
router.post('/disappearing', async (req, res) => {
  try {
    const userId = req.user.id;
    const matchId = parseInteger(req.body.matchId);
    const message = String(req.body.message || '').trim();
    const disappearAfterSeconds = Math.min(
      Math.max(parseInteger(req.body.disappearAfterSeconds, 3600), 60),
      7 * 24 * 60 * 60
    );

    if (!matchId || !message) {
      return res.status(400).json({ error: 'Match ID and message required' });
    }

    const match = await getMatchForUser(matchId, userId);
    if (!match) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const toUserId = Number(match.user_id_1) === Number(userId) ? match.user_id_2 : match.user_id_1;
    const disappearsAt = new Date(Date.now() + disappearAfterSeconds * 1000);

    const result = await db.query(
      `INSERT INTO messages (
         match_id,
         from_user_id,
         to_user_id,
         message,
         message_type,
         is_disappearing,
         disappears_at,
         disappear_after_seconds
       )
       VALUES ($1, $2, $3, $4, 'text', TRUE, $5, $6)
       RETURNING *`,
      [matchId, userId, toUserId, message, disappearsAt, disappearAfterSeconds]
    );

    await db.query(
      `UPDATE matches
       SET last_message_at = CURRENT_TIMESTAMP,
           message_count = message_count + 1
       WHERE id = $1`,
      [matchId]
    );

    const createdMessage = {
      ...result.rows[0],
      reactions: []
    };

    if (typeof req.emitToUser === 'function') {
      req.emitToUser(toUserId, 'new_message', {
        matchId,
        messageId: createdMessage.id,
        fromUserId: userId,
        message,
        timestamp: createdMessage.created_at,
        isDisappearing: true,
        disappearsAt: createdMessage.disappears_at,
        disappearAfterSeconds,
        reactions: []
      });
    }

    res.status(201).json({
      message: 'Disappearing message sent',
      data: createdMessage
    });
  } catch (error) {
    console.error('Send disappearing message error:', error);
    res.status(500).json({ error: 'Failed to send disappearing message' });
  }
});

// ============================================
// CHATROOM ENDPOINTS (for group messaging)
// ============================================

// POST /messaging/chatrooms - Create a new chatroom
router.post('/chatrooms', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      console.warn('CREATE CHATROOM - No user ID in request');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description, isPublic, maxMembers, initialMembers, tags, settings } = req.body;

    if (!name || !name.trim()) {
      console.warn('CREATE CHATROOM - No name provided');
      return res.status(400).json({ error: 'Chatroom name is required' });
    }

    console.log('CREATE CHATROOM - Creating with:', { userId, name, isPublic, maxMembers });

    const result = await db.query(
      `INSERT INTO chatrooms (created_by_user_id, name, description, is_public, max_members)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, name.trim(), description || '', isPublic !== false, maxMembers || 100]
    );

    const chatroomId = result.rows[0].id;
    console.log('CREATE CHATROOM - Created with ID:', chatroomId);

    // Add creator as first member
    await db.query(
      `INSERT INTO chatroom_members (chatroom_id, user_id)
       VALUES ($1, $2)`,
      [chatroomId, userId]
    );

    // Add initial members if provided
    if (Array.isArray(initialMembers) && initialMembers.length > 0) {
      for (const memberId of initialMembers) {
        try {
          await db.query(
            `INSERT INTO chatroom_members (chatroom_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [chatroomId, memberId]
          );
        } catch (memberError) {
          console.warn(`Failed to add member ${memberId}:`, memberError.message);
        }
      }
    }

    console.log('CREATE CHATROOM - Success');
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

module.exports = router;
