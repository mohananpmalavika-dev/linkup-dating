/**
 * Message Export Service
 * Handles chat backup, export, and archive functionality
 */
const db = require('../config/database');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');

class MessageExportService {
  /**
   * Export messages to JSON format
   */
  static async exportToJSON(userId, matchId, options = {}) {
    try {
      const messages = await this.getMessagesForExport(userId, matchId, options);

      const exportData = {
        exportDate: new Date().toISOString(),
        userId: userId,
        matchId: matchId,
        messageCount: messages.length,
        dateRange: {
          start: options.startDate || null,
          end: options.endDate || null
        },
        messages: messages
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

      const csvData = messages.map((msg) => ({
        id: msg.id,
        timestamp: msg.created_at,
        sender: msg.from_user_id === userId ? 'You' : 'Them',
        message: msg.message,
        type: msg.message_type,
        isRead: msg.is_read ? 'Yes' : 'No',
        readAt: msg.read_at || '',
        hasAttachment: msg.attachments?.length > 0 ? 'Yes' : 'No',
        hasLocation: msg.has_location ? 'Yes' : 'No'
      }));

      const csv = new Parser().parse(csvData);
      return csv;
    } catch (error) {
      console.error('CSV export error:', error);
      throw new Error('Failed to export messages to CSV');
    }
  }

  /**
   * Export messages to PDF format
   */
  static async exportToPDF(userId, matchId, options = {}) {
    try {
      const messages = await this.getMessagesForExport(userId, matchId, options);

      return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        let pdfBuffer = Buffer.alloc(0);

        doc.on('data', (chunk) => {
          pdfBuffer = Buffer.concat([pdfBuffer, chunk]);
        });

        doc.on('end', () => {
          resolve(pdfBuffer);
        });

        doc.on('error', reject);

        // Header
        doc.fontSize(16).text('Chat Export', { align: 'center' });
        doc.fontSize(10).text(`Exported: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.fontSize(10).text(`Messages: ${messages.length}`, { align: 'center' });
        doc.moveDown();

        // Messages
        messages.forEach((msg) => {
          const sender = msg.from_user_id === userId ? 'You' : 'Them';
          const time = new Date(msg.created_at).toLocaleString();
          doc.fontSize(9).text(`${sender} (${time}):`, { width: 500 });
          doc.fontSize(9).text(msg.message || '[Attachment]', { width: 500, indent: 20 });
          doc.moveDown(0.5);
        });

        doc.end();
      });
    } catch (error) {
      console.error('PDF export error:', error);
      throw new Error('Failed to export messages to PDF');
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
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ccc; padding-bottom: 15px; }
    .message { margin: 10px 0; padding: 10px; border-radius: 5px; }
    .message.sent { background-color: #e3f2fd; text-align: right; }
    .message.received { background-color: #f5f5f5; }
    .message-time { font-size: 0.8em; color: #999; margin-top: 5px; }
    .message-meta { font-size: 0.9em; font-weight: bold; margin-bottom: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Chat Export</h1>
    <p>Exported: ${new Date().toLocaleString()}</p>
    <p>Messages: ${messages.length}</p>
    <p>Other User: ${otherUser || 'Unknown'}</p>
  </div>
  <div class="messages">
`;

      messages.forEach((msg) => {
        const isOwn = msg.from_user_id === userId;
        const senderName = isOwn ? 'You' : otherUser;
        const messageClass = isOwn ? 'sent' : 'received';
        const messageText = this.escapeHtml(msg.message || '[Attachment]');
        const time = new Date(msg.created_at).toLocaleString();

        html += `
    <div class="message ${messageClass}">
      <div class="message-meta">${senderName}</div>
      <div>${messageText}</div>
      <div class="message-time">${time}</div>
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
      const { Message } = db.models;
      const where = {
        match_id: matchId,
        is_deleted: false
      };

      if (options.startDate) {
        where.created_at = { [db.Sequelize.Op.gte]: new Date(options.startDate) };
      }

      if (options.endDate) {
        if (!where.created_at) where.created_at = {};
        where.created_at[db.Sequelize.Op.lte] = new Date(options.endDate);
      }

      const messages = await Message.findAll({
        where,
        include: [
          {
            model: db.models.MessageAttachment,
            as: 'attachments',
            attributes: ['id', 'file_name', 'attachment_type']
          }
        ],
        order: [['created_at', 'ASC']],
        limit: options.limit || 10000
      });

      return messages;
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
      const { ChatBackup } = db.models;
      const fileName = `backup-${userId}-${matchId}-${Date.now()}.json`;
      const filePath = path.join(process.env.BACKUP_DIR || './backups', fileName);

      // Create backup directory if it doesn't exist
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      const jsonData = await this.exportToJSON(userId, matchId);
      await fs.writeFile(filePath, jsonData);

      const fileSize = Buffer.byteLength(jsonData);
      const messages = JSON.parse(jsonData);

      const backup = await ChatBackup.create({
        user_id: userId,
        match_id: matchId,
        backup_type: 'auto',
        format: 'json',
        file_path: filePath,
        file_size: fileSize,
        message_count: messages.messages.length,
        is_encrypted: false
      });

      return backup;
    } catch (error) {
      console.error('Auto backup error:', error);
      throw new Error('Failed to create auto backup');
    }
  }

  /**
   * Get other user's name in match
   */
  static async getOtherUserName(userId, matchId) {
    try {
      const { Match } = db.models;
      const match = await Match.findByPk(matchId, {
        include: [
          {
            model: db.models.User,
            as: 'user1',
            attributes: ['id', 'first_name']
          },
          {
            model: db.models.User,
            as: 'user2',
            attributes: ['id', 'first_name']
          }
        ]
      });

      if (!match) return null;

      const otherUser = match.user_1_id === userId ? match.user2 : match.user1;
      return otherUser?.first_name || 'User';
    } catch (error) {
      console.error('Get other user error:', error);
      return null;
    }
  }

  /**
   * Escape HTML characters
   */
  static escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * List all backups for user
   */
  static async listBackups(userId, matchId = null) {
    try {
      const { ChatBackup } = db.models;
      const where = { user_id: userId };

      if (matchId) {
        where.match_id = matchId;
      }

      const backups = await ChatBackup.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit: 100
      });

      return backups;
    } catch (error) {
      console.error('List backups error:', error);
      throw new Error('Failed to list backups');
    }
  }

  /**
   * Delete old backups
   */
  static async deleteOldBackups(daysOld = 30) {
    try {
      const { ChatBackup } = db.models;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const oldBackups = await ChatBackup.findAll({
        where: {
          created_at: { [db.Sequelize.Op.lt]: cutoffDate }
        }
      });

      for (const backup of oldBackups) {
        try {
          await fs.unlink(backup.file_path);
        } catch (err) {
          console.warn('Could not delete backup file:', backup.file_path);
        }
        await backup.destroy();
      }

      return oldBackups.length;
    } catch (error) {
      console.error('Delete old backups error:', error);
      throw new Error('Failed to delete old backups');
    }
  }
}

module.exports = MessageExportService;
