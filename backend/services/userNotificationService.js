const db = require('../config/database');

const parseInteger = (value, fallbackValue = 0) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
};

const normalizeNotificationRow = (row = {}) => ({
  id: row.id,
  userId: row.user_id,
  type: row.notification_type,
  title: row.title,
  body: row.body,
  metadata: row.metadata || {},
  isRead: Boolean(row.is_read),
  createdAt: row.created_at,
  readAt: row.read_at || null
});

const userNotificationService = {
  createNotification: async (userId, payload = {}) => {
    if (!userId) {
      return null;
    }

    try {
      const result = await db.query(
        `INSERT INTO user_notifications (
           user_id,
           notification_type,
           title,
           body,
           metadata
         )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          userId,
          payload.type || 'general',
          payload.title || 'LinkUp update',
          payload.body || '',
          JSON.stringify(payload.metadata || {})
        ]
      );

      return normalizeNotificationRow(result.rows[0]);
    } catch (error) {
      console.error('Create notification error:', error);
      return null;
    }
  },

  getNotificationsForUser: async (userId, options = {}) => {
    const limit = Math.min(parseInteger(options.limit, 25), 100);

    const result = await db.query(
      `SELECT *
       FROM user_notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(normalizeNotificationRow);
  },

  getUnreadCount: async (userId) => {
    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM user_notifications
       WHERE user_id = $1
         AND is_read = FALSE`,
      [userId]
    );

    return parseInteger(result.rows[0]?.count, 0);
  },

  markAsRead: async (userId, notificationId) => {
    const result = await db.query(
      `UPDATE user_notifications
       SET is_read = TRUE,
           read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
         AND id = $2
       RETURNING *`,
      [userId, notificationId]
    );

    return result.rows[0] ? normalizeNotificationRow(result.rows[0]) : null;
  },

  markAllAsRead: async (userId) => {
    await db.query(
      `UPDATE user_notifications
       SET is_read = TRUE,
           read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
         AND is_read = FALSE`,
      [userId]
    );
  }
};

module.exports = userNotificationService;
