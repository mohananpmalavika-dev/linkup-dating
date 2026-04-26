/**
 * Messaging Enhancement Routes
 * Handles templates, attachments, encryption, search, export, and disappearing messages
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const EncryptionService = require('../services/encryptionService');
const MessageExportService = require('../services/messageExportService');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

// ============================================
// MESSAGE TEMPLATES
// ============================================

/**
 * GET /messaging/templates - Get user's message templates
 */
router.get('/templates', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, pinned } = req.query;

    const where = { user_id: userId };
    if (category) where.category = category;
    if (pinned === 'true') where.is_pinned = true;

    const templates = await db.models.MessageTemplate.findAll({
      where,
      order: [['is_pinned', 'DESC'], ['usage_count', 'DESC'], ['created_at', 'DESC']]
    });

    res.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * POST /messaging/templates - Create a new message template
 */
router.post('/templates', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, content, category, emoji } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const template = await db.models.MessageTemplate.create({
      user_id: userId,
      title,
      content,
      category: category || 'general',
      emoji: emoji || null,
      is_pinned: false
    });

    res.status(201).json({ template });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * PUT /messaging/templates/:templateId - Update a message template
 */
router.put('/templates/:templateId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { templateId } = req.params;
    const { title, content, category, emoji, isPinned } = req.body;

    const template = await db.models.MessageTemplate.findOne({
      where: { id: templateId, user_id: userId }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (title) template.title = title;
    if (content) template.content = content;
    if (category) template.category = category;
    if (emoji !== undefined) template.emoji = emoji;
    if (isPinned !== undefined) template.is_pinned = isPinned;

    await template.save();
    res.json({ template });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

/**
 * DELETE /messaging/templates/:templateId - Delete a message template
 */
router.delete('/templates/:templateId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { templateId } = req.params;

    const template = await db.models.MessageTemplate.findOne({
      where: { id: templateId, user_id: userId }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await template.destroy();
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * POST /messaging/templates/:templateId/use - Log template usage
 */
router.post('/templates/:templateId/use', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { templateId } = req.params;

    const template = await db.models.MessageTemplate.findOne({
      where: { id: templateId, user_id: userId }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    template.usage_count = (template.usage_count || 0) + 1;
    template.last_used_at = new Date();
    await template.save();

    res.json({ template });
  } catch (error) {
    console.error('Use template error:', error);
    res.status(500).json({ error: 'Failed to log template usage' });
  }
});

// ============================================
// MESSAGE SEARCH & FILTERING
// ============================================

/**
 * GET /messaging/search - Search messages
 */
router.get('/search', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { q, matchId, startDate, endDate, type, limit = 50, offset = 0 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query too short' });
    }

    const where = {
      [db.Sequelize.Op.or]: [
        { from_user_id: userId },
        { to_user_id: userId }
      ],
      is_deleted: false
    };

    if (matchId) where.match_id = matchId;
    if (type) where.message_type = type;

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at[db.Sequelize.Op.gte] = new Date(startDate);
      if (endDate) where.created_at[db.Sequelize.Op.lte] = new Date(endDate);
    }

    // Search using LIKE for simplicity (in production, use full-text search)
    where.message = { [db.Sequelize.Op.iLike]: `%${q}%` };

    const messages = await db.models.Message.findAll({
      where,
      include: [
        {
          model: db.models.MessageAttachment,
          as: 'attachments',
          required: false
        },
        {
          model: db.models.User,
          as: 'fromUser',
          attributes: ['id', 'first_name', 'username']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const total = await db.models.Message.count({ where });

    res.json({
      results: messages,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ error: 'Failed to search messages' });
  }
});

// ============================================
// MESSAGE ENCRYPTION & SECURITY
// ============================================

/**
 * POST /messaging/encryption/init - Initialize encryption for a match
 */
router.post('/encryption/init', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { matchId } = req.body;

    if (!matchId) {
      return res.status(400).json({ error: 'Match ID required' });
    }

    // Verify user is part of the match
    const match = await db.models.Match.findByPk(matchId);
    if (!match || (match.user_1_id !== userId && match.user_2_id !== userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Generate key pair
    const { publicKey, privateKey } = await EncryptionService.generateKeyPair(userId, matchId);

    // Encrypt private key with user's password (simplified - use proper key derivation in production)
    const encryptedPrivateKey = privateKey; // In production, encrypt with user password

    // Store encryption key
    const encryptionKey = await EncryptionService.storeEncryptionKey(
      userId,
      matchId,
      publicKey,
      encryptedPrivateKey
    );

    res.json({
      encryptionKey: {
        id: encryptionKey.id,
        publicKey: encryptionKey.public_key,
        keyVersion: encryptionKey.key_version
      },
      message: 'Encryption initialized for this match'
    });
  } catch (error) {
    console.error('Encryption init error:', error);
    res.status(500).json({ error: 'Failed to initialize encryption' });
  }
});

/**
 * POST /messaging/encryption/decrypt - Decrypt encrypted messages
 */
router.post('/encryption/decrypt', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId, encryptionKey } = req.body;

    if (!messageId || !encryptionKey) {
      return res.status(400).json({ error: 'Message ID and encryption key required' });
    }

    const message = await db.models.Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (!message.is_encrypted) {
      return res.status(400).json({ error: 'Message is not encrypted' });
    }

    const decrypted = EncryptionService.decryptMessage(
      message.encrypted_content,
      message.encryption_nonce,
      message.auth_tag,
      encryptionKey
    );

    res.json({ message: decrypted });
  } catch (error) {
    console.error('Decryption error:', error);
    res.status(500).json({ error: 'Failed to decrypt message' });
  }
});

// ============================================
// MESSAGE EXPORT & BACKUP
// ============================================

/**
 * GET /messaging/export - Export messages
 */
router.get('/export', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { matchId, format = 'json', startDate, endDate } = req.query;

    if (!matchId) {
      return res.status(400).json({ error: 'Match ID required' });
    }

    const options = {
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    };

    let exportData;
    let contentType = 'application/json';
    let fileName = `chat-export-${Date.now()}`;

    switch (format) {
      case 'json':
        exportData = await MessageExportService.exportToJSON(userId, matchId, options);
        fileName += '.json';
        contentType = 'application/json';
        break;
      case 'csv':
        exportData = await MessageExportService.exportToCSV(userId, matchId, options);
        fileName += '.csv';
        contentType = 'text/csv';
        break;
      case 'pdf':
        exportData = await MessageExportService.exportToPDF(userId, matchId, options);
        fileName += '.pdf';
        contentType = 'application/pdf';
        break;
      case 'html':
        exportData = await MessageExportService.exportToHTML(userId, matchId, options);
        fileName += '.html';
        contentType = 'text/html';
        break;
      default:
        return res.status(400).json({ error: 'Invalid export format' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export messages' });
  }
});

/**
 * GET /messaging/backups - List chat backups
 */
router.get('/backups', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { matchId } = req.query;

    const backups = await MessageExportService.listBackups(userId, matchId);
    res.json({ backups });
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

/**
 * POST /messaging/backups/create - Create manual backup
 */
router.post('/backups/create', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { matchId } = req.body;

    if (!matchId) {
      return res.status(400).json({ error: 'Match ID required' });
    }

    const backup = await MessageExportService.createAutoBackup(userId, matchId);
    res.status(201).json({ backup });
  } catch (error) {
    console.error('Create backup error:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// ============================================
// DISAPPEARING MESSAGES
// ============================================

/**
 * POST /messaging/disappearing - Send disappearing message
 */
router.post('/disappearing', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { matchId, message, disappearAfterSeconds = 3600 } = req.body;

    if (!matchId || !message) {
      return res.status(400).json({ error: 'Match ID and message required' });
    }

    const match = await db.models.Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const otherUserId = match.user_1_id === userId ? match.user_2_id : match.user_1_id;
    const disappearsAt = new Date(Date.now() + disappearAfterSeconds * 1000);

    const msg = await db.models.Message.create({
      match_id: matchId,
      from_user_id: userId,
      to_user_id: otherUserId,
      message: message,
      message_type: 'text',
      is_disappearing: true,
      disappears_at: disappearsAt,
      disappear_after_seconds: disappearAfterSeconds
    });

    res.status(201).json({ message: msg });
  } catch (error) {
    console.error('Send disappearing message error:', error);
    res.status(500).json({ error: 'Failed to send disappearing message' });
  }
});

module.exports = router;
