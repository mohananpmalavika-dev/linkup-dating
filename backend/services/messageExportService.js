/**
 * Message Export Service
 * Handles chat backup, export, and archive functionality
 */
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');

const DEFAULT_EXPORT_LIMIT = 10000;

const resolveBackupDirectory = () => {
  if (process.env.BACKUP_DIR) {
    return path.resolve(process.env.BACKUP_DIR);
  }

  return path.resolve(__dirname, '..', 'backups');
};

const toInteger = (value, fallbackValue = 0) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
};

const csvEscape = (value) => {
  const normalizedValue = value === null || value === undefined ? '' : String(value);
  return `"${normalizedValue.replace(/"/g, '""')}"`;
};

class MessageExportService {
  static async assertUserCanAccessMatch(userId, matchId) {
    const result = await db.query(
      `SELECT id
       FROM matches
       WHERE id = $1
         AND (user_id_1 = $2 OR user_id_2 = $2)
       LIMIT 1`,
      [matchId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Unauthorized');
    }
  }

  /**
   * Export messages to JSON format
   */
  static async exportToJSON(userId, matchId, options = {}) {
    try {
      const messages = await this.getMessagesForExport(userId, matchId, options);

      const exportData = {
        exportDate: new Date().toISOString(),
        userId,
        matchId,
        messageCount: messages.length,
        dateRange: {
          start: options.startDate || null,
          end: options.endDate || null
        },
        messages
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('JSON export error:', error);
      throw new Error('Failed to export messages to JSON');
    }
  }

  /**
   * Export messages to CSV format
   */
  static async exportToCSV(userId, matchId, options = {}) {
    try {
      const messages = await this.getMessagesForExport(userId, matchId, options);
      const lines = [
        [
          'id',
          'timestamp',
          'sender',
          'message',
          'type',
          'isRead',
          'readAt',
          'hasAttachment',
          'locationName'
        ].join(',')
      ];

      messages.forEach((message) => {
        const sender = Number(message.from_user_id) === Number(userId) ? 'You' : 'Them';
        const type = message.message_type || message.media_type || 'text';
        const hasAttachment = Array.isArray(message.attachments) && message.attachments.length > 0 ? 'Yes' : 'No';

        lines.push([
          csvEscape(message.id),
          csvEscape(message.created_at),
          csvEscape(sender),
          csvEscape(message.message),
          csvEscape(type),
          csvEscape(message.is_read ? 'Yes' : 'No'),
          csvEscape(message.read_at || ''),
          csvEscape(hasAttachment),
          csvEscape(message.location_name || '')
        ].join(','));
      });

      return lines.join('\n');
    } catch (error) {
      console.error('CSV export error:', error);
      throw new Error('Failed to export messages to CSV');
    }
  }

  /**
   * Export messages to HTML format
   */
  static async exportToHTML(userId, matchId, options = {}) {
    try {
      const messages = await this.getMessagesForExport(userId, matchId, options);
      const otherUser = await this.getOtherUserName(userId, matchId);

      let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Chat Export</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 860px; margin: 24px auto; color: #1f2937; }
    .header { text-align: center; margin-bottom: 28px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; }
    .message { margin: 12px 0; padding: 12px 14px; border-radius: 10px; }
    .message.sent { background-color: #eef2ff; text-align: right; }
    .message.received { background-color: #f3f4f6; }
    .message-time { font-size: 0.8em; color: #6b7280; margin-top: 6px; }
    .message-meta { font-size: 0.92em; font-weight: bold; margin-bottom: 6px; }
    .message-badge { display: inline-block; margin-left: 8px; padding: 2px 6px; border-radius: 999px; background: #fde68a; color: #92400e; font-size: 0.75em; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Chat Export</h1>
    <p>Exported: ${new Date().toLocaleString()}</p>
    <p>Messages: ${messages.length}</p>
    <p>Other User: ${this.escapeHtml(otherUser || 'Unknown')}</p>
  </div>
  <div class="messages">
`;

      messages.forEach((message) => {
        const isOwnMessage = Number(message.from_user_id) === Number(userId);
        const senderName = isOwnMessage ? 'You' : otherUser || 'Match';
        const messageClass = isOwnMessage ? 'sent' : 'received';
        const messageText = this.escapeHtml(message.message || '[Attachment]');
        const time = new Date(message.created_at).toLocaleString();
        const type = message.message_type || message.media_type || 'text';
        const locationLabel = message.location_name ? `<div><strong>Location:</strong> ${this.escapeHtml(message.location_name)}</div>` : '';
        const badge = message.is_disappearing ? '<span class="message-badge">Disappearing</span>' : '';

        html += `
    <div class="message ${messageClass}">
      <div class="message-meta">${this.escapeHtml(senderName)} ${badge}</div>
      <div><strong>Type:</strong> ${this.escapeHtml(type)}</div>
      ${locationLabel}
      <div>${messageText}</div>
      <div class="message-time">${this.escapeHtml(time)}</div>
    </div>
`;
      });

      html += `
  </div>
</body>
</html>`;

      return html;
    } catch (error) {
      console.error('HTML export error:', error);
      throw new Error('Failed to export messages to HTML');
    }
  }

  /**
   * Get messages for export
   */
  static async getMessagesForExport(userId, matchId, options = {}) {
    try {
      await this.assertUserCanAccessMatch(userId, matchId);

      const conditions = [
        'm.match_id = $1',
        'COALESCE(m.is_deleted, FALSE) = FALSE',
        'COALESCE(m.is_disappearing, FALSE) = FALSE'
      ];
      const params = [matchId];
      let paramIndex = params.length;

      if (options.startDate) {
        paramIndex += 1;
        conditions.push(`m.created_at >= $${paramIndex}`);
        params.push(new Date(options.startDate));
      }

      if (options.endDate) {
        paramIndex += 1;
        conditions.push(`m.created_at <= $${paramIndex}`);
        params.push(new Date(options.endDate));
      }

      paramIndex += 1;
      params.push(toInteger(options.limit, DEFAULT_EXPORT_LIMIT) || DEFAULT_EXPORT_LIMIT);

      const result = await db.query(
        `SELECT m.*,
                COALESCE((
                  SELECT json_agg(
                    json_build_object(
                      'id', ma.id,
                      'file_name', ma.file_name,
                      'file_type', ma.file_type,
                      'attachment_type', ma.attachment_type
                    )
                    ORDER BY ma.created_at ASC
                  )
                  FROM message_attachments ma
                  WHERE ma.message_id = m.id
                ), '[]'::json) AS attachments
         FROM messages m
         WHERE ${conditions.join(' AND ')}
         ORDER BY m.created_at ASC
         LIMIT $${paramIndex}`,
        params
      );

      return result.rows;
    } catch (error) {
      console.error('Get messages for export error:', error);
      throw new Error('Failed to retrieve messages for export');
    }
  }

  /**
   * Create automated backup
   */
  static async createAutoBackup(userId, matchId) {
    try {
      await this.assertUserCanAccessMatch(userId, matchId);

      const backupDirectory = resolveBackupDirectory();
      const fileName = `backup-${userId}-${matchId}-${Date.now()}.json`;
      const filePath = path.join(backupDirectory, fileName);

      await fs.mkdir(backupDirectory, { recursive: true });

      const jsonData = await this.exportToJSON(userId, matchId);
      await fs.writeFile(filePath, jsonData, 'utf8');

      const parsedData = JSON.parse(jsonData);
      const fileSize = Buffer.byteLength(jsonData);

      const result = await db.query(
        `INSERT INTO chat_backups (
           user_id,
           match_id,
           backup_type,
           format,
           file_path,
           file_size,
           message_count,
           is_encrypted,
           created_at,
           updated_at
         )
         VALUES ($1, $2, 'manual', 'json', $3, $4, $5, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [userId, matchId, filePath, fileSize, parsedData.messages?.length || 0]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Auto backup error:', error);
      throw new Error('Failed to create backup');
    }
  }

  /**
   * Get other user's name in match
   */
  static async getOtherUserName(userId, matchId) {
    try {
      const result = await db.query(
        `SELECT COALESCE(NULLIF(dp.first_name, ''), dp.username, u.email, 'Match') AS display_name
         FROM matches m
         JOIN users u
           ON u.id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END
         LEFT JOIN dating_profiles dp
           ON dp.user_id = u.id
         WHERE m.id = $2
           AND (m.user_id_1 = $1 OR m.user_id_2 = $1)
         LIMIT 1`,
        [userId, matchId]
      );

      return result.rows[0]?.display_name || null;
    } catch (error) {
      console.error('Get other user error:', error);
      return null;
    }
  }

  /**
   * Escape HTML characters
   */
  static escapeHtml(text) {
    const normalizedText = text === null || text === undefined ? '' : String(text);
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return normalizedText.replace(/[&<>"']/g, (match) => map[match]);
  }

  /**
   * List all backups for user
   */
  static async listBackups(userId, matchId = null) {
    try {
      const params = [userId];
      const conditions = ['user_id = $1'];

      if (matchId) {
        params.push(matchId);
        conditions.push(`match_id = $${params.length}`);
      }

      const result = await db.query(
        `SELECT *
         FROM chat_backups
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT 100`,
        params
      );

      return result.rows;
    } catch (error) {
      console.error('List backups error:', error);
      throw new Error('Failed to list backups');
    }
  }
}

module.exports = MessageExportService;
