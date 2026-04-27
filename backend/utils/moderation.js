const db = require('../config/database');

const parseInteger = (value, fallbackValue = null) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
};

const normalizeJson = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
};

const expireActiveBans = async (userId = null) => {
  const params = [];
  let userCondition = '';

  if (userId) {
    params.push(userId);
    userCondition = ` AND user_id = $${params.length}`;
  }

  await db.query(
    `UPDATE user_bans
     SET status = 'expired'
     WHERE status = 'active'
       AND expires_at IS NOT NULL
       AND expires_at <= CURRENT_TIMESTAMP${userCondition}`,
    params
  );
};

const normalizeBanRow = (row = {}) => ({
  id: row.id,
  userId: row.user_id,
  banType: row.ban_type,
  status: row.status,
  reason: row.reason,
  notes: row.notes || '',
  origin: row.origin || 'manual',
  details: row.details || {},
  issuedByAdminId: row.issued_by_admin_id || null,
  issuedByAdminEmail: row.issued_by_admin_email || null,
  issuedAt: row.issued_at || row.created_at || null,
  expiresAt: row.expires_at || null,
  revokedByAdminId: row.revoked_by_admin_id || null,
  revokedAt: row.revoked_at || null,
  revokeReason: row.revoke_reason || null
});

const getActiveBanForUser = async (userId) => {
  if (!userId) {
    return null;
  }

  await expireActiveBans(userId);

  const result = await db.query(
    `SELECT ub.*, admin.email as issued_by_admin_email
     FROM user_bans ub
     LEFT JOIN users admin ON admin.id = ub.issued_by_admin_id
     WHERE ub.user_id = $1
       AND ub.status = 'active'
       AND (ub.expires_at IS NULL OR ub.expires_at > CURRENT_TIMESTAMP)
     ORDER BY ub.issued_at DESC, ub.id DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] ? normalizeBanRow(result.rows[0]) : null;
};

const recordAdminAction = async ({
  adminUserId,
  actionType,
  targetUserId = null,
  reason = null,
  details = {},
  status = 'completed'
}) => {
  if (!adminUserId || !actionType) {
    return null;
  }

  const result = await db.query(
    `INSERT INTO admin_actions (
       admin_user_id,
       action_type,
       target_user_id,
       reason,
       details,
       status
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      adminUserId,
      actionType,
      targetUserId,
      reason,
      JSON.stringify(normalizeJson(details)),
      status
    ]
  );

  return result.rows[0] || null;
};

const createModerationFlag = async ({
  userId,
  sourceType = 'admin_manual',
  flagCategory = 'behavior',
  severity = 'medium',
  title = null,
  reason,
  metadata = {},
  flaggedByAdminId = null,
  status = 'pending'
}) => {
  if (!userId || !reason) {
    return null;
  }

  const result = await db.query(
    `INSERT INTO moderation_flags (
       user_id,
       flagged_by_admin_id,
       source_type,
       flag_category,
       severity,
       title,
       reason,
       status,
       metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId,
      flaggedByAdminId,
      sourceType,
      flagCategory,
      severity,
      title,
      reason,
      status,
      JSON.stringify(normalizeJson(metadata))
    ]
  );

  return result.rows[0] || null;
};

module.exports = {
  createModerationFlag,
  expireActiveBans,
  getActiveBanForUser,
  normalizeBanRow,
  parseInteger,
  recordAdminAction
};
