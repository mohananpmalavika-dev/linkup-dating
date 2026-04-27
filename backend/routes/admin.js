const express = require('express');
const router = express.Router();
const db = require('../config/database');
const spamFraudService = require('../services/spamFraudService');
const userNotificationService = require('../services/userNotificationService');
const {
  createModerationFlag,
  normalizeBanRow,
  parseInteger,
  recordAdminAction
} = require('../utils/moderation');

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

const clampLimit = (value, fallbackValue = 20, maxValue = 100) => {
  const parsedValue = parseInteger(value, fallbackValue);
  return Math.max(1, Math.min(parsedValue || fallbackValue, maxValue));
};

const getOffset = (page, limit) => {
  const normalizedPage = Math.max(parseInteger(page, 1), 1);
  return (normalizedPage - 1) * limit;
};

const toCount = (value) => Number.parseInt(value, 10) || 0;

const severityWeight = (severity = 'low') => {
  switch (String(severity || '').toLowerCase()) {
    case 'critical':
      return 400;
    case 'high':
      return 300;
    case 'medium':
      return 200;
    case 'low':
    default:
      return 100;
  }
};

const parseDecimal = (value, fallbackValue = 0) => {
  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
};

const buildQueuePriority = ({ severity, confidenceScore = 0, riskScore = 0, status = '' }) => {
  let priority = severityWeight(severity);
  priority += Math.round(parseDecimal(confidenceScore, 0) * 100);
  priority += parseInteger(riskScore, 0) || 0;

  if (status === 'escalated') {
    priority += 120;
  }

  if (status === 'pending') {
    priority += 40;
  }

  return priority;
};

const applyBanProfileState = async (userId, isActive) => {
  await db.query(
    `UPDATE dating_profiles
     SET is_active = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $2`,
    [Boolean(isActive), userId]
  );
};

const expireActiveBans = async () => {
  await db.query(
    `UPDATE user_bans
     SET status = 'expired'
     WHERE status = 'active'
       AND expires_at IS NOT NULL
       AND expires_at <= CURRENT_TIMESTAMP`
  );
};

const getLatestSystemMetric = async () => {
  const result = await db.query(
    `SELECT *
     FROM system_metrics
     WHERE metric_date = CURRENT_DATE
     LIMIT 1`
  );

  return result.rows[0] || {
    daily_active_users: 0,
    monthly_active_users: 0,
    total_messages: 0,
    total_matches: 0,
    new_users: 0,
    reported_users: 0,
    spam_flagged_users: 0,
    fraud_flagged_users: 0,
    pending_photo_reviews: 0,
    pending_appeals: 0,
    active_bans: 0
  };
};

const buildBanNotificationBody = (banType, reason, expiresAt) => {
  const restrictionLabel =
    banType === 'permanent' ? 'permanently restricted' : 'temporarily restricted';

  if (!expiresAt) {
    return `Your account has been ${restrictionLabel}. Reason: ${reason}`;
  }

  return `Your account has been ${restrictionLabel} until ${new Date(expiresAt).toLocaleString()}. Reason: ${reason}`;
};

const issueUserBan = async ({
  adminUserId,
  userId,
  banType = 'suspension',
  reason,
  notes = null,
  durationDays = 7,
  origin = 'manual',
  details = {}
}) => {
  const normalizedDurationDays = Math.max(parseInteger(durationDays, 7) || 7, 1);
  const expiresAt =
    banType === 'permanent'
      ? null
      : new Date(Date.now() + normalizedDurationDays * 24 * 60 * 60 * 1000).toISOString();

  await db.query(
    `UPDATE user_bans
     SET status = 'revoked',
         revoked_by_admin_id = $1,
         revoked_at = CURRENT_TIMESTAMP,
         revoke_reason = 'Superseded by a newer moderation action'
     WHERE user_id = $2
       AND status = 'active'`,
    [adminUserId, userId]
  );

  const result = await db.query(
    `INSERT INTO user_bans (
       user_id,
       ban_type,
       status,
       reason,
       notes,
       origin,
       details,
       issued_by_admin_id,
       expires_at
     )
     VALUES ($1, $2, 'active', $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      banType,
      reason,
      notes,
      origin,
      JSON.stringify(details || {}),
      adminUserId,
      expiresAt
    ]
  );

  await applyBanProfileState(userId, false);

  await recordAdminAction({
    adminUserId,
    actionType: banType === 'permanent' ? 'user_ban' : 'user_suspend',
    targetUserId: userId,
    reason,
    details: {
      banId: result.rows[0]?.id || null,
      banType,
      durationDays: banType === 'permanent' ? null : normalizedDurationDays,
      origin,
      notes
    }
  });

  await userNotificationService.createNotification(userId, {
    type: 'account_restricted',
    title: 'Account Restricted',
    body: buildBanNotificationBody(banType, reason, expiresAt),
    metadata: {
      banId: result.rows[0]?.id || null,
      banType,
      expiresAt
    }
  });

  await spamFraudService.refreshSystemMetrics();

  return normalizeBanRow(result.rows[0] || {});
};

const revokeUserBan = async ({ banId, adminUserId, revokeReason }) => {
  const banResult = await db.query(
    `UPDATE user_bans
     SET status = 'revoked',
         revoked_by_admin_id = $1,
         revoked_at = CURRENT_TIMESTAMP,
         revoke_reason = $2
     WHERE id = $3
       AND status = 'active'
     RETURNING *`,
    [adminUserId, revokeReason, banId]
  );

  if (banResult.rows.length === 0) {
    return null;
  }

  const ban = banResult.rows[0];

  const remainingActiveBans = await db.query(
    `SELECT COUNT(*) as count
     FROM user_bans
     WHERE user_id = $1
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
    [ban.user_id]
  );

  if (toCount(remainingActiveBans.rows[0]?.count) === 0) {
    await applyBanProfileState(ban.user_id, true);
  }

  await recordAdminAction({
    adminUserId,
    actionType: 'user_unban',
    targetUserId: ban.user_id,
    reason: revokeReason,
    details: {
      banId,
      previousBanType: ban.ban_type
    }
  });

  await userNotificationService.createNotification(ban.user_id, {
    type: 'account_restored',
    title: 'Account Restriction Lifted',
    body: 'Your account restriction has been lifted. Please continue following the community guidelines.',
    metadata: {
      banId,
      revokeReason
    }
  });

  await spamFraudService.refreshSystemMetrics();

  return normalizeBanRow(ban);
};

const fetchModerationQueue = async ({ limit = 25 } = {}) => {
  const normalizedLimit = clampLimit(limit, 25, 100);

  const [
    reportsResult,
    spamFlagsResult,
    fraudFlagsResult,
    manualFlagsResult,
    photoReviewsResult,
    appealsResult
  ] = await Promise.all([
    db.query(
      `SELECT ur.id, ur.reason, ur.description, ur.status, ur.created_at,
              ur.reported_user_id as user_id,
              reported_user.email as user_email,
              reported_profile.first_name as user_name,
              reporter.email as source_actor_email
       FROM user_reports ur
       LEFT JOIN users reported_user ON reported_user.id = ur.reported_user_id
       LEFT JOIN dating_profiles reported_profile ON reported_profile.user_id = ur.reported_user_id
       LEFT JOIN users reporter ON reporter.id = ur.reporting_user_id
       WHERE ur.status IN ('pending', 'investigating')
       ORDER BY ur.created_at DESC
       LIMIT $1`,
      [normalizedLimit]
    ),
    db.query(
      `SELECT sf.id, sf.reason, sf.description, sf.severity, sf.created_at,
              sf.user_id, u.email as user_email, dp.first_name as user_name
       FROM spam_flags sf
       LEFT JOIN users u ON u.id = sf.user_id
       LEFT JOIN dating_profiles dp ON dp.user_id = sf.user_id
       WHERE sf.is_resolved = FALSE
       ORDER BY sf.created_at DESC
       LIMIT $1`,
      [normalizedLimit]
    ),
    db.query(
      `SELECT ff.id, ff.flag_type, ff.description, ff.confidence_score, ff.created_at,
              ff.user_id, u.email as user_email, dp.first_name as user_name
       FROM fraud_flags ff
       LEFT JOIN users u ON u.id = ff.user_id
       LEFT JOIN dating_profiles dp ON dp.user_id = ff.user_id
       WHERE ff.is_resolved = FALSE
       ORDER BY ff.confidence_score DESC, ff.created_at DESC
       LIMIT $1`,
      [normalizedLimit]
    ),
    db.query(
      `SELECT mf.id, mf.source_type, mf.flag_category, mf.severity, mf.title, mf.reason,
              mf.status, mf.metadata, mf.created_at, mf.user_id,
              u.email as user_email, dp.first_name as user_name
       FROM moderation_flags mf
       LEFT JOIN users u ON u.id = mf.user_id
       LEFT JOIN dating_profiles dp ON dp.user_id = mf.user_id
       WHERE mf.status IN ('pending', 'under_review')
       ORDER BY mf.created_at DESC
       LIMIT $1`,
      [normalizedLimit]
    ),
    db.query(
      `SELECT pmq.id, pmq.source_type, pmq.status, pmq.automated_risk_score,
              pmq.automated_reasons, pmq.submitted_at, pmq.user_id, pmq.profile_photo_id,
              u.email as user_email, dp.first_name as user_name
       FROM photo_moderation_queue pmq
       LEFT JOIN users u ON u.id = pmq.user_id
       LEFT JOIN dating_profiles dp ON dp.user_id = pmq.user_id
       WHERE pmq.status IN ('pending', 'escalated')
       ORDER BY pmq.automated_risk_score DESC, pmq.submitted_at DESC
       LIMIT $1`,
      [normalizedLimit]
    ),
    db.query(
      `SELECT ma.id, ma.subject, ma.message, ma.status, ma.created_at, ma.user_id, ma.ban_id,
              u.email as user_email, dp.first_name as user_name
       FROM moderation_appeals ma
       LEFT JOIN users u ON u.id = ma.user_id
       LEFT JOIN dating_profiles dp ON dp.user_id = ma.user_id
       WHERE ma.status = 'pending'
       ORDER BY ma.created_at DESC
       LIMIT $1`,
      [normalizedLimit]
    )
  ]);

  const queueItems = [
    ...reportsResult.rows.map((row) => ({
      id: `report-${row.id}`,
      sourceId: row.id,
      type: 'report',
      status: row.status,
      severity: ['harassment', 'spam', 'inappropriate_photos'].includes(row.reason) ? 'high' : 'medium',
      title: `User report: ${row.reason}`,
      summary: row.description || 'A user report is waiting for moderation review.',
      createdAt: row.created_at,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      sourceActorEmail: row.source_actor_email || null,
      metadata: {
        reportId: row.id
      },
      priority: buildQueuePriority({ severity: ['harassment', 'spam', 'inappropriate_photos'].includes(row.reason) ? 'high' : 'medium', status: row.status })
    })),
    ...spamFlagsResult.rows.map((row) => ({
      id: `spam-${row.id}`,
      sourceId: row.id,
      type: 'spam',
      status: 'pending',
      severity: row.severity || 'medium',
      title: `Automated spam flag: ${row.reason || 'suspected spam'}`,
      summary: row.description || 'Spam detection flagged this account for review.',
      createdAt: row.created_at,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      metadata: {
        spamFlagId: row.id
      },
      priority: buildQueuePriority({ severity: row.severity, status: 'pending' })
    })),
    ...fraudFlagsResult.rows.map((row) => ({
      id: `fraud-${row.id}`,
      sourceId: row.id,
      type: 'fraud',
      status: 'pending',
      severity: parseDecimal(row.confidence_score, 0) >= 0.8 ? 'critical' : 'high',
      title: `Fraud signal: ${row.flag_type}`,
      summary: row.description || 'Fraud detection flagged this account for review.',
      createdAt: row.created_at,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      metadata: {
        fraudFlagId: row.id,
        confidenceScore: parseDecimal(row.confidence_score, 0)
      },
      priority: buildQueuePriority({
        severity: parseDecimal(row.confidence_score, 0) >= 0.8 ? 'critical' : 'high',
        confidenceScore: row.confidence_score,
        status: 'pending'
      })
    })),
    ...manualFlagsResult.rows.map((row) => ({
      id: `manual-flag-${row.id}`,
      sourceId: row.id,
      type: 'manual_flag',
      status: row.status,
      severity: row.severity || 'medium',
      title: row.title || `Manual ${row.flag_category || 'moderation'} flag`,
      summary: row.reason,
      createdAt: row.created_at,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      metadata: row.metadata || {},
      priority: buildQueuePriority({ severity: row.severity, status: row.status })
    })),
    ...photoReviewsResult.rows.map((row) => ({
      id: `photo-${row.id}`,
      sourceId: row.id,
      type: 'photo',
      status: row.status,
      severity: parseInteger(row.automated_risk_score, 0) >= 70 ? 'critical' : parseInteger(row.automated_risk_score, 0) >= 45 ? 'high' : 'medium',
      title: row.source_type === 'verification_photo' ? 'Verification photo review' : 'Profile photo review',
      summary: Array.isArray(row.automated_reasons) && row.automated_reasons.length
        ? row.automated_reasons.join(', ')
        : 'Photo queued for moderator review.',
      createdAt: row.submitted_at,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      metadata: {
        queueId: row.id,
        profilePhotoId: row.profile_photo_id,
        sourceType: row.source_type,
        automatedRiskScore: parseInteger(row.automated_risk_score, 0)
      },
      priority: buildQueuePriority({
        severity: parseInteger(row.automated_risk_score, 0) >= 70 ? 'critical' : parseInteger(row.automated_risk_score, 0) >= 45 ? 'high' : 'medium',
        riskScore: row.automated_risk_score,
        status: row.status
      })
    })),
    ...appealsResult.rows.map((row) => ({
      id: `appeal-${row.id}`,
      sourceId: row.id,
      type: 'appeal',
      status: row.status,
      severity: 'medium',
      title: row.subject || 'Moderation appeal',
      summary: row.message,
      createdAt: row.created_at,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      metadata: {
        appealId: row.id,
        banId: row.ban_id
      },
      priority: buildQueuePriority({ severity: 'medium', status: row.status, riskScore: 35 })
    }))
  ];

  return queueItems
    .sort((leftItem, rightItem) => {
      if (rightItem.priority !== leftItem.priority) {
        return rightItem.priority - leftItem.priority;
      }

      return new Date(rightItem.createdAt).getTime() - new Date(leftItem.createdAt).getTime();
    })
    .slice(0, normalizedLimit);
};

const fetchReviewCandidates = async ({ limit = 20, page = 1, query = '' } = {}) => {
  const normalizedLimit = clampLimit(limit, 20, 100);
  const [
    reportCountsResult,
    spamCountsResult,
    fraudCountsResult,
    manualFlagCountsResult,
    banCountsResult,
    appealCountsResult
  ] = await Promise.all([
    db.query(
      `SELECT reported_user_id as user_id, COUNT(*) as count, MAX(created_at) as last_seen
       FROM user_reports
       WHERE status IN ('pending', 'investigating')
       GROUP BY reported_user_id`
    ),
    db.query(
      `SELECT user_id, COUNT(*) as count, MAX(created_at) as last_seen
       FROM spam_flags
       WHERE is_resolved = FALSE
       GROUP BY user_id`
    ),
    db.query(
      `SELECT user_id, COUNT(*) as count, MAX(created_at) as last_seen
       FROM fraud_flags
       WHERE is_resolved = FALSE
       GROUP BY user_id`
    ),
    db.query(
      `SELECT user_id, COUNT(*) as count, MAX(created_at) as last_seen
       FROM moderation_flags
       WHERE status IN ('pending', 'under_review')
       GROUP BY user_id`
    ),
    db.query(
      `SELECT user_id, COUNT(*) as count, MAX(issued_at) as last_seen
       FROM user_bans
       WHERE status = 'active'
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       GROUP BY user_id`
    ),
    db.query(
      `SELECT user_id, COUNT(*) as count, MAX(created_at) as last_seen
       FROM moderation_appeals
       WHERE status = 'pending'
       GROUP BY user_id`
    )
  ]);

  const userMap = new Map();

  const addAggregate = (rows, key) => {
    rows.forEach((row) => {
      const userId = parseInteger(row.user_id, 0);
      if (!userId) {
        return;
      }

      const existing = userMap.get(userId) || {
        userId,
        reportCount: 0,
        spamFlagCount: 0,
        fraudFlagCount: 0,
        manualFlagCount: 0,
        activeBanCount: 0,
        pendingAppealCount: 0,
        lastFlaggedAt: null
      };

      existing[key] = toCount(row.count);

      if (!existing.lastFlaggedAt || new Date(row.last_seen).getTime() > new Date(existing.lastFlaggedAt).getTime()) {
        existing.lastFlaggedAt = row.last_seen;
      }

      userMap.set(userId, existing);
    });
  };

  addAggregate(reportCountsResult.rows, 'reportCount');
  addAggregate(spamCountsResult.rows, 'spamFlagCount');
  addAggregate(fraudCountsResult.rows, 'fraudFlagCount');
  addAggregate(manualFlagCountsResult.rows, 'manualFlagCount');
  addAggregate(banCountsResult.rows, 'activeBanCount');
  addAggregate(appealCountsResult.rows, 'pendingAppealCount');

  const userIds = Array.from(userMap.keys());

  if (userIds.length === 0) {
    return {
      total: 0,
      page: Math.max(parseInteger(page, 1), 1),
      limit: normalizedLimit,
      reviews: []
    };
  }

  const usersResult = await db.query(
    `SELECT u.id, u.email, dp.first_name, dp.age, dp.is_active, dp.profile_verified, dp.updated_at
     FROM users u
     LEFT JOIN dating_profiles dp ON dp.user_id = u.id
     WHERE u.id = ANY($1::int[])`,
    [userIds]
  );

  const normalizedQuery = String(query || '').trim().toLowerCase();
  const enrichedReviews = usersResult.rows
    .map((row) => {
      const aggregate = userMap.get(row.id);

      return {
        userId: row.id,
        email: row.email,
        firstName: row.first_name || '',
        age: row.age || null,
        isActive: row.is_active !== false,
        profileVerified: Boolean(row.profile_verified),
        reportCount: aggregate?.reportCount || 0,
        spamFlagCount: aggregate?.spamFlagCount || 0,
        fraudFlagCount: aggregate?.fraudFlagCount || 0,
        manualFlagCount: aggregate?.manualFlagCount || 0,
        activeBanCount: aggregate?.activeBanCount || 0,
        pendingAppealCount: aggregate?.pendingAppealCount || 0,
        totalFlags:
          (aggregate?.reportCount || 0) +
          (aggregate?.spamFlagCount || 0) +
          (aggregate?.fraudFlagCount || 0) +
          (aggregate?.manualFlagCount || 0),
        lastFlaggedAt: aggregate?.lastFlaggedAt || row.updated_at || null
      };
    })
    .filter((review) => {
      if (!normalizedQuery) {
        return true;
      }

      return review.email.toLowerCase().includes(normalizedQuery) ||
        review.firstName.toLowerCase().includes(normalizedQuery);
    })
    .sort((leftItem, rightItem) => {
      if (rightItem.activeBanCount !== leftItem.activeBanCount) {
        return rightItem.activeBanCount - leftItem.activeBanCount;
      }

      if (rightItem.totalFlags !== leftItem.totalFlags) {
        return rightItem.totalFlags - leftItem.totalFlags;
      }

      return new Date(rightItem.lastFlaggedAt).getTime() - new Date(leftItem.lastFlaggedAt).getTime();
    });

  const normalizedPage = Math.max(parseInteger(page, 1), 1);
  const startIndex = (normalizedPage - 1) * normalizedLimit;
  const paginatedReviews = enrichedReviews.slice(startIndex, startIndex + normalizedLimit);

  return {
    total: enrichedReviews.length,
    page: normalizedPage,
    limit: normalizedLimit,
    reviews: paginatedReviews
  };
};

const fetchModerationAnalytics = async (days = 30) => {
  const normalizedDays = Math.max(parseInteger(days, 30), 1);

  const [metricsResult, reportReasonsResult, spamReasonsResult, fraudReasonsResult, flagCategoriesResult] = await Promise.all([
    db.query(
      `SELECT metric_date, reported_users, spam_flagged_users, fraud_flagged_users,
              pending_photo_reviews, pending_appeals, active_bans
       FROM system_metrics
       WHERE metric_date >= CURRENT_DATE - INTERVAL '1 day' * $1
       ORDER BY metric_date DESC`,
      [normalizedDays]
    ),
    db.query(
      `SELECT reason as label, COUNT(*) as count
       FROM user_reports
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY reason
       ORDER BY count DESC
       LIMIT 8`,
      [normalizedDays]
    ),
    db.query(
      `SELECT reason as label, COUNT(*) as count
       FROM spam_flags
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY reason
       ORDER BY count DESC
       LIMIT 8`,
      [normalizedDays]
    ),
    db.query(
      `SELECT flag_type as label, COUNT(*) as count
       FROM fraud_flags
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY flag_type
       ORDER BY count DESC
       LIMIT 8`,
      [normalizedDays]
    ),
    db.query(
      `SELECT flag_category as label, COUNT(*) as count
       FROM moderation_flags
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY flag_category
       ORDER BY count DESC
       LIMIT 8`,
      [normalizedDays]
    )
  ]);

  const metrics = metricsResult.rows;

  return {
    metrics,
    summary: {
      reports: metrics.reduce((sum, metric) => sum + toCount(metric.reported_users), 0),
      spamFlags: metrics.reduce((sum, metric) => sum + toCount(metric.spam_flagged_users), 0),
      fraudFlags: metrics.reduce((sum, metric) => sum + toCount(metric.fraud_flagged_users), 0),
      currentPendingPhotoReviews: toCount(metrics[0]?.pending_photo_reviews),
      currentPendingAppeals: toCount(metrics[0]?.pending_appeals),
      currentActiveBans: toCount(metrics[0]?.active_bans),
      periodDays: normalizedDays
    },
    breakdowns: {
      reportReasons: reportReasonsResult.rows.map((row) => ({ label: row.label || 'unspecified', count: toCount(row.count) })),
      spamReasons: spamReasonsResult.rows.map((row) => ({ label: row.label || 'unspecified', count: toCount(row.count) })),
      fraudTypes: fraudReasonsResult.rows.map((row) => ({ label: row.label || 'unspecified', count: toCount(row.count) })),
      manualFlagCategories: flagCategoriesResult.rows.map((row) => ({ label: row.label || 'unspecified', count: toCount(row.count) }))
    }
  };
};

const reviewPhotoQueueItem = async ({ queueId, action, notes, adminUserId }) => {
  const queueResult = await db.query(
    `SELECT *
     FROM photo_moderation_queue
     WHERE id = $1
     LIMIT 1`,
    [queueId]
  );

  if (queueResult.rows.length === 0) {
    return null;
  }

  const queueItem = queueResult.rows[0];
  const normalizedAction = String(action || '').trim().toLowerCase();
  let nextStatus = 'pending';

  if (normalizedAction === 'approve') {
    nextStatus = 'approved';
  } else if (normalizedAction === 'reject') {
    nextStatus = 'rejected';
  } else if (normalizedAction === 'escalate') {
    nextStatus = 'escalated';
  }

  if (nextStatus === 'approved' && queueItem.source_type === 'verification_photo') {
    await db.query(
      `UPDATE dating_profiles
       SET verification_status = 'approved',
           profile_verified = TRUE,
           verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [queueItem.user_id]
    );

    await userNotificationService.createNotification(queueItem.user_id, {
      type: 'verification_complete',
      title: 'Verification Approved',
      body: 'Your verification photo has been approved and your profile is now verified.',
      metadata: {
        moderationQueueId: queueId,
        status: 'approved'
      }
    });
  }

  if (nextStatus === 'reject') {
    if (queueItem.source_type === 'verification_photo') {
      await db.query(
        `UPDATE dating_profiles
         SET verification_status = 'rejected',
             profile_verified = FALSE,
             verified_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [queueItem.user_id]
      );
    } else if (queueItem.profile_photo_id) {
      await db.query(
        `DELETE FROM profile_photos
         WHERE id = $1
           AND user_id = $2`,
        [queueItem.profile_photo_id, queueItem.user_id]
      );

      const remainingPhotosResult = await db.query(
        `SELECT id
         FROM profile_photos
         WHERE user_id = $1
         ORDER BY position ASC, id ASC`,
        [queueItem.user_id]
      );

      if (remainingPhotosResult.rows.length > 0) {
        const nextPrimaryPhotoId = remainingPhotosResult.rows[0].id;
        await db.query(
          `UPDATE profile_photos
           SET is_primary = CASE WHEN id = $2 THEN TRUE ELSE FALSE END
           WHERE user_id = $1`,
          [queueItem.user_id, nextPrimaryPhotoId]
        );
      }
    }

    await userNotificationService.createNotification(queueItem.user_id, {
      type: 'photo_review_update',
      title: 'Photo Review Update',
      body: queueItem.source_type === 'verification_photo'
        ? 'Your verification photo was not approved. Please submit a clearer selfie and try again.'
        : 'One of your profile photos was removed during moderation review.',
      metadata: {
        moderationQueueId: queueId,
        status: 'rejected'
      }
    });
  }

  if (nextStatus === 'escalated') {
    await createModerationFlag({
      userId: queueItem.user_id,
      sourceType: 'photo_moderation',
      flagCategory: 'content',
      severity: 'high',
      title: queueItem.source_type === 'verification_photo' ? 'Escalated verification photo' : 'Escalated profile photo',
      reason: notes || 'Photo moderation item escalated for further review',
      metadata: {
        moderationQueueId: queueId,
        automatedRiskScore: queueItem.automated_risk_score || 0
      },
      flaggedByAdminId: adminUserId,
      status: 'under_review'
    });
  }

  const updateResult = await db.query(
    `UPDATE photo_moderation_queue
     SET status = $1,
         reviewed_by_admin_id = $2,
         review_notes = $3,
         review_action = $4,
         reviewed_at = CURRENT_TIMESTAMP
     WHERE id = $5
     RETURNING *`,
    [nextStatus, adminUserId, notes || null, normalizedAction, queueId]
  );

  await recordAdminAction({
    adminUserId,
    actionType: `photo_${normalizedAction}`,
    targetUserId: queueItem.user_id,
    reason: notes || `Photo moderation item ${normalizedAction}`,
    details: {
      moderationQueueId: queueId,
      sourceType: queueItem.source_type,
      profilePhotoId: queueItem.profile_photo_id
    }
  });

  await spamFraudService.refreshSystemMetrics();

  return updateResult.rows[0] || null;
};

router.use(requireAdmin);

router.get('/dashboard', async (req, res) => {
  try {
    await expireActiveBans();
    await spamFraudService.refreshSystemMetrics();

    const [metrics, backlogCountsResult, activeUsersResult, recentActionsResult, queuePreview, reviewCandidates] = await Promise.all([
      getLatestSystemMetric(),
      db.query(
        `SELECT
           (SELECT COUNT(*) FROM user_reports WHERE status IN ('pending', 'investigating')) as pending_reports,
           (SELECT COUNT(*) FROM spam_flags WHERE is_resolved = FALSE) as open_spam_flags,
           (SELECT COUNT(*) FROM fraud_flags WHERE is_resolved = FALSE) as open_fraud_flags,
           (SELECT COUNT(*) FROM moderation_flags WHERE status IN ('pending', 'under_review')) as open_manual_flags`
      ),
      db.query(
        `SELECT COUNT(DISTINCT user_id) as count
         FROM user_session_logs
         WHERE created_at > NOW() - INTERVAL '24 hours'`
      ),
      db.query(
        `SELECT aa.*, admin.email as email, target.email as target_email
         FROM admin_actions aa
         LEFT JOIN users admin ON admin.id = aa.admin_user_id
         LEFT JOIN users target ON target.id = aa.target_user_id
         ORDER BY aa.created_at DESC
         LIMIT 10`
      ),
      fetchModerationQueue({ limit: 8 }),
      fetchReviewCandidates({ limit: 5, page: 1 })
    ]);

    const backlogCounts = backlogCountsResult.rows[0] || {};
    const pendingQueueTotal =
      toCount(backlogCounts.pending_reports) +
      toCount(backlogCounts.open_spam_flags) +
      toCount(backlogCounts.open_fraud_flags) +
      toCount(backlogCounts.open_manual_flags) +
      toCount(metrics.pending_photo_reviews) +
      toCount(metrics.pending_appeals);

    res.json({
      metrics,
      pendingReports: toCount(backlogCounts.pending_reports),
      spamFlags: toCount(backlogCounts.open_spam_flags),
      fraudFlags: toCount(backlogCounts.open_fraud_flags),
      activeUsers: toCount(activeUsersResult.rows[0]?.count),
      moderation: {
        pendingPhotoReviews: toCount(metrics.pending_photo_reviews),
        pendingAppeals: toCount(metrics.pending_appeals),
        activeBans: toCount(metrics.active_bans),
        openManualFlags: toCount(backlogCounts.open_manual_flags),
        pendingQueue: pendingQueueTotal,
        reviewCandidates: reviewCandidates.total
      },
      queuePreview,
      recentActions: recentActionsResult.rows,
      flaggedUsers: reviewCandidates.reviews
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

router.get('/moderation/queue', async (req, res) => {
  try {
    const queue = await fetchModerationQueue({ limit: req.query.limit || 50 });
    res.json({ queue });
  } catch (err) {
    console.error('Moderation queue error:', err);
    res.status(500).json({ error: 'Failed to fetch moderation queue' });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const status = String(req.query.status || 'pending');
    const limit = clampLimit(req.query.limit, 20, 100);
    const page = Math.max(parseInteger(req.query.page, 1), 1);
    const offset = getOffset(page, limit);

    const reportsResult = await db.query(
      `SELECT ur.*, reporter.email as reporting_user_email,
              reported.email as reported_user_email,
              reporter_profile.first_name as reporting_user_name,
              reported_profile.first_name as reported_user_name
       FROM user_reports ur
       LEFT JOIN users reporter ON reporter.id = ur.reporting_user_id
       LEFT JOIN users reported ON reported.id = ur.reported_user_id
       LEFT JOIN dating_profiles reporter_profile ON reporter_profile.user_id = ur.reporting_user_id
       LEFT JOIN dating_profiles reported_profile ON reported_profile.user_id = ur.reported_user_id
       WHERE ur.status = $1
       ORDER BY ur.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as count
       FROM user_reports
       WHERE status = $1`,
      [status]
    );

    res.json({
      reports: reportsResult.rows,
      total: toCount(countResult.rows[0]?.count),
      page,
      limit
    });
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.put('/reports/:reportId/resolve', async (req, res) => {
  try {
    const reportId = parseInteger(req.params.reportId, 0);
    const nextStatus = String(req.body?.status || '').trim();
    const action = String(req.body?.action || 'review').trim();
    const notes = String(req.body?.notes || '').trim();

    if (!reportId || !nextStatus) {
      return res.status(400).json({ error: 'A report status is required' });
    }

    const updateResult = await db.query(
      `UPDATE user_reports
       SET status = $1,
           resolved_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [nextStatus, reportId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = updateResult.rows[0];

    await db.query(
      `UPDATE moderation_flags
       SET status = $1,
           reviewed_by_admin_id = $2,
           review_notes = $3,
           reviewed_at = CURRENT_TIMESTAMP
       WHERE source_type = 'user_report'
         AND metadata ->> 'reportId' = $4`,
      [nextStatus === 'dismissed' ? 'dismissed' : 'resolved', req.user.id, notes || null, String(reportId)]
    );

    await recordAdminAction({
      adminUserId: req.user.id,
      actionType: `report_${action}`,
      targetUserId: report.reported_user_id,
      reason: notes || `Report #${reportId} marked ${nextStatus}`,
      details: {
        reportId,
        status: nextStatus,
        action
      }
    });

    await spamFraudService.refreshSystemMetrics();

    res.json({ success: true, report: updateResult.rows[0] });
  } catch (err) {
    console.error('Resolve report error:', err);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

router.get('/spam-flags', async (req, res) => {
  try {
    const resolved = String(req.query.resolved || 'false') === 'true';
    const limit = clampLimit(req.query.limit, 20, 100);
    const page = Math.max(parseInteger(req.query.page, 1), 1);
    const offset = getOffset(page, limit);

    const flagsResult = await db.query(
      `SELECT sf.*, u.email, dp.first_name, dp.age
       FROM spam_flags sf
       LEFT JOIN users u ON u.id = sf.user_id
       LEFT JOIN dating_profiles dp ON dp.user_id = sf.user_id
       WHERE sf.is_resolved = $1
       ORDER BY sf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [resolved, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as count
       FROM spam_flags
       WHERE is_resolved = $1`,
      [resolved]
    );

    res.json({
      flags: flagsResult.rows,
      total: toCount(countResult.rows[0]?.count),
      page,
      limit
    });
  } catch (err) {
    console.error('Get spam flags error:', err);
    res.status(500).json({ error: 'Failed to fetch spam flags' });
  }
});

router.put('/spam-flags/:flagId/resolve', async (req, res) => {
  try {
    const flagId = parseInteger(req.params.flagId, 0);
    const action = String(req.body?.action || 'resolve').trim();
    const notes = String(req.body?.notes || '').trim();

    const updateResult = await db.query(
      `UPDATE spam_flags
       SET is_resolved = TRUE,
           resolved_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [flagId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Spam flag not found' });
    }

    await recordAdminAction({
      adminUserId: req.user.id,
      actionType: `spam_${action}`,
      targetUserId: updateResult.rows[0].user_id,
      reason: notes || `Spam flag #${flagId} marked resolved`,
      details: {
        flagId,
        action
      }
    });

    await spamFraudService.refreshSystemMetrics();

    res.json({ success: true, flag: updateResult.rows[0] });
  } catch (err) {
    console.error('Resolve spam flag error:', err);
    res.status(500).json({ error: 'Failed to resolve spam flag' });
  }
});

router.get('/fraud-flags', async (req, res) => {
  try {
    const resolved = String(req.query.resolved || 'false') === 'true';
    const limit = clampLimit(req.query.limit, 20, 100);
    const page = Math.max(parseInteger(req.query.page, 1), 1);
    const offset = getOffset(page, limit);

    const flagsResult = await db.query(
      `SELECT ff.*, u.email, dp.first_name, dp.age
       FROM fraud_flags ff
       LEFT JOIN users u ON u.id = ff.user_id
       LEFT JOIN dating_profiles dp ON dp.user_id = ff.user_id
       WHERE ff.is_resolved = $1
       ORDER BY ff.confidence_score DESC, ff.created_at DESC
       LIMIT $2 OFFSET $3`,
      [resolved, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as count
       FROM fraud_flags
       WHERE is_resolved = $1`,
      [resolved]
    );

    res.json({
      flags: flagsResult.rows,
      total: toCount(countResult.rows[0]?.count),
      page,
      limit
    });
  } catch (err) {
    console.error('Get fraud flags error:', err);
    res.status(500).json({ error: 'Failed to fetch fraud flags' });
  }
});

router.put('/fraud-flags/:flagId/resolve', async (req, res) => {
  try {
    const flagId = parseInteger(req.params.flagId, 0);
    const action = String(req.body?.action || 'resolve').trim();
    const notes = String(req.body?.notes || '').trim();

    const updateResult = await db.query(
      `UPDATE fraud_flags
       SET is_resolved = TRUE,
           action_taken = $1
       WHERE id = $2
       RETURNING *`,
      [action, flagId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Fraud flag not found' });
    }

    await recordAdminAction({
      adminUserId: req.user.id,
      actionType: `fraud_${action}`,
      targetUserId: updateResult.rows[0].user_id,
      reason: notes || `Fraud flag #${flagId} marked ${action}`,
      details: {
        flagId,
        action
      }
    });

    await spamFraudService.refreshSystemMetrics();

    res.json({ success: true, flag: updateResult.rows[0] });
  } catch (err) {
    console.error('Resolve fraud flag error:', err);
    res.status(500).json({ error: 'Failed to resolve fraud flag' });
  }
});

router.get('/moderation-flags', async (req, res) => {
  try {
    const status = String(req.query.status || 'pending');
    const limit = clampLimit(req.query.limit, 20, 100);
    const page = Math.max(parseInteger(req.query.page, 1), 1);
    const offset = getOffset(page, limit);

    const flagsResult = await db.query(
      `SELECT mf.*, u.email, dp.first_name
       FROM moderation_flags mf
       LEFT JOIN users u ON u.id = mf.user_id
       LEFT JOIN dating_profiles dp ON dp.user_id = mf.user_id
       WHERE mf.status = $1
       ORDER BY mf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as count
       FROM moderation_flags
       WHERE status = $1`,
      [status]
    );

    res.json({
      flags: flagsResult.rows,
      total: toCount(countResult.rows[0]?.count),
      page,
      limit
    });
  } catch (err) {
    console.error('Get moderation flags error:', err);
    res.status(500).json({ error: 'Failed to fetch moderation flags' });
  }
});

router.put('/moderation-flags/:flagId/review', async (req, res) => {
  try {
    const flagId = parseInteger(req.params.flagId, 0);
    const status = String(req.body?.status || 'resolved').trim();
    const notes = String(req.body?.notes || '').trim();

    const updateResult = await db.query(
      `UPDATE moderation_flags
       SET status = $1,
           reviewed_by_admin_id = $2,
           review_notes = $3,
           reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, req.user.id, notes || null, flagId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Moderation flag not found' });
    }

    await recordAdminAction({
      adminUserId: req.user.id,
      actionType: `manual_flag_${status}`,
      targetUserId: updateResult.rows[0].user_id,
      reason: notes || `Manual moderation flag ${status}`,
      details: {
        moderationFlagId: flagId
      }
    });

    res.json({ success: true, flag: updateResult.rows[0] });
  } catch (err) {
    console.error('Review moderation flag error:', err);
    res.status(500).json({ error: 'Failed to review moderation flag' });
  }
});

router.get('/users/review', async (req, res) => {
  try {
    const reviewCandidates = await fetchReviewCandidates({
      limit: req.query.limit || 20,
      page: req.query.page || 1,
      query: req.query.q || ''
    });

    res.json(reviewCandidates);
  } catch (err) {
    console.error('Get user review list error:', err);
    res.status(500).json({ error: 'Failed to fetch review candidates' });
  }
});

router.get('/users/:userId/review', async (req, res) => {
  try {
    const userId = parseInteger(req.params.userId, 0);

    const [
      userResult,
      reportsResult,
      spamFlagsResult,
      fraudFlagsResult,
      manualFlagsResult,
      activeBansResult,
      appealsResult,
      actionsResult,
      analyticsResult
    ] = await Promise.all([
      db.query(
        `SELECT u.id, u.email, u.created_at, dp.first_name, dp.age, dp.bio, dp.is_active,
                dp.profile_verified, dp.verification_status, dp.profile_completion_percent
         FROM users u
         LEFT JOIN dating_profiles dp ON dp.user_id = u.id
         WHERE u.id = $1
         LIMIT 1`,
        [userId]
      ),
      db.query(
        `SELECT *
         FROM user_reports
         WHERE reported_user_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [userId]
      ),
      db.query(
        `SELECT *
         FROM spam_flags
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [userId]
      ),
      db.query(
        `SELECT *
         FROM fraud_flags
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [userId]
      ),
      db.query(
        `SELECT *
         FROM moderation_flags
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [userId]
      ),
      db.query(
        `SELECT ub.*, admin.email as issued_by_admin_email
         FROM user_bans ub
         LEFT JOIN users admin ON admin.id = ub.issued_by_admin_id
         WHERE ub.user_id = $1
         ORDER BY ub.issued_at DESC, ub.id DESC
         LIMIT 20`,
        [userId]
      ),
      db.query(
        `SELECT *
         FROM moderation_appeals
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [userId]
      ),
      db.query(
        `SELECT aa.*, admin.email as admin_email
         FROM admin_actions aa
         LEFT JOIN users admin ON admin.id = aa.admin_user_id
         WHERE aa.target_user_id = $1
         ORDER BY aa.created_at DESC
         LIMIT 20`,
        [userId]
      ),
      db.query(
        `SELECT *
         FROM user_analytics
         WHERE user_id = $1
         ORDER BY activity_date DESC
         LIMIT 14`,
        [userId]
      )
    ]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: userResult.rows[0],
      reports: reportsResult.rows,
      spamFlags: spamFlagsResult.rows,
      fraudFlags: fraudFlagsResult.rows,
      manualFlags: manualFlagsResult.rows,
      bans: activeBansResult.rows.map((row) => normalizeBanRow(row)),
      appeals: appealsResult.rows,
      actions: actionsResult.rows,
      analytics: analyticsResult.rows
    });
  } catch (err) {
    console.error('Get user review detail error:', err);
    res.status(500).json({ error: 'Failed to fetch user review data' });
  }
});

router.post('/users/:userId/flag', async (req, res) => {
  try {
    const userId = parseInteger(req.params.userId, 0);
    const flagCategory = String(req.body?.flagCategory || 'behavior').trim();
    const severity = String(req.body?.severity || 'medium').trim();
    const title = String(req.body?.title || '').trim();
    const reason = String(req.body?.reason || '').trim();

    if (!userId || !reason) {
      return res.status(400).json({ error: 'A flag reason is required' });
    }

    const flag = await createModerationFlag({
      userId,
      sourceType: 'admin_manual',
      flagCategory,
      severity,
      title: title || `Manual ${flagCategory} flag`,
      reason,
      metadata: req.body?.metadata || {},
      flaggedByAdminId: req.user.id
    });

    await recordAdminAction({
      adminUserId: req.user.id,
      actionType: 'manual_flag_create',
      targetUserId: userId,
      reason,
      details: {
        moderationFlagId: flag?.id || null,
        flagCategory,
        severity
      }
    });

    res.status(201).json({ success: true, flag });
  } catch (err) {
    console.error('Create manual flag error:', err);
    res.status(500).json({ error: 'Failed to create manual moderation flag' });
  }
});

router.post('/users/:userId/suspend', async (req, res) => {
  try {
    const userId = parseInteger(req.params.userId, 0);
    const reason = String(req.body?.reason || '').trim();
    const durationDays = parseInteger(req.body?.duration_days, 7) || 7;
    const notes = String(req.body?.notes || '').trim();

    if (!userId || !reason) {
      return res.status(400).json({ error: 'A suspension reason is required' });
    }

    const ban = await issueUserBan({
      adminUserId: req.user.id,
      userId,
      banType: 'suspension',
      reason,
      notes,
      durationDays,
      origin: 'manual'
    });

    res.json({
      success: true,
      message: 'User suspended successfully',
      ban
    });
  } catch (err) {
    console.error('Suspend user error:', err);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

router.post('/users/:userId/ban', async (req, res) => {
  try {
    const userId = parseInteger(req.params.userId, 0);
    const reason = String(req.body?.reason || '').trim();
    const notes = String(req.body?.notes || '').trim();
    const banType = String(req.body?.banType || 'permanent').trim();
    const durationDays = parseInteger(req.body?.durationDays, 30) || 30;

    if (!userId || !reason) {
      return res.status(400).json({ error: 'A ban reason is required' });
    }

    const ban = await issueUserBan({
      adminUserId: req.user.id,
      userId,
      banType,
      reason,
      notes,
      durationDays,
      origin: 'manual'
    });

    res.json({
      success: true,
      message: 'User banned successfully',
      ban
    });
  } catch (err) {
    console.error('Ban user error:', err);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

router.post('/users/:userId/delete', async (req, res) => {
  try {
    const userId = parseInteger(req.params.userId, 0);
    const reason = String(req.body?.reason || '').trim();

    if (!userId) {
      return res.status(400).json({ error: 'A user id is required' });
    }

    const userResult = await db.query(
      `SELECT id, email
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await recordAdminAction({
      adminUserId: req.user.id,
      actionType: 'user_delete',
      targetUserId: userId,
      reason: reason || `User ${userResult.rows[0].email} deleted by admin`,
      details: {
        deletedUserEmail: userResult.rows[0].email
      }
    });

    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await spamFraudService.refreshSystemMetrics();

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.get('/photo-moderation', async (req, res) => {
  try {
    const status = String(req.query.status || 'pending');
    const limit = clampLimit(req.query.limit, 20, 100);
    const page = Math.max(parseInteger(req.query.page, 1), 1);
    const offset = getOffset(page, limit);

    const itemsResult = await db.query(
      `SELECT pmq.*, u.email, dp.first_name, dp.profile_verified
       FROM photo_moderation_queue pmq
       LEFT JOIN users u ON u.id = pmq.user_id
       LEFT JOIN dating_profiles dp ON dp.user_id = pmq.user_id
       WHERE pmq.status = $1
       ORDER BY pmq.automated_risk_score DESC, pmq.submitted_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as count
       FROM photo_moderation_queue
       WHERE status = $1`,
      [status]
    );

    res.json({
      items: itemsResult.rows,
      total: toCount(countResult.rows[0]?.count),
      page,
      limit
    });
  } catch (err) {
    console.error('Get photo moderation queue error:', err);
    res.status(500).json({ error: 'Failed to fetch photo moderation queue' });
  }
});

router.put('/photo-moderation/:queueId/review', async (req, res) => {
  try {
    const queueId = parseInteger(req.params.queueId, 0);
    const action = String(req.body?.action || '').trim();
    const notes = String(req.body?.notes || '').trim();

    if (!queueId || !action) {
      return res.status(400).json({ error: 'A moderation action is required' });
    }

    const reviewResult = await reviewPhotoQueueItem({
      queueId,
      action,
      notes,
      adminUserId: req.user.id
    });

    if (!reviewResult) {
      return res.status(404).json({ error: 'Photo moderation item not found' });
    }

    res.json({ success: true, item: reviewResult });
  } catch (err) {
    console.error('Review photo moderation item error:', err);
    res.status(500).json({ error: 'Failed to review photo moderation item' });
  }
});

router.get('/bans', async (req, res) => {
  try {
    await expireActiveBans();

    const status = String(req.query.status || 'active');
    const limit = clampLimit(req.query.limit, 20, 100);
    const page = Math.max(parseInteger(req.query.page, 1), 1);
    const offset = getOffset(page, limit);

    let whereClause = `WHERE ub.status = $1`;
    const params = [status, limit, offset];

    if (status === 'active') {
      whereClause += ` AND (ub.expires_at IS NULL OR ub.expires_at > CURRENT_TIMESTAMP)`;
    }

    const bansResult = await db.query(
      `SELECT ub.*, u.email, dp.first_name, admin.email as issued_by_admin_email,
              (
                SELECT COUNT(*)
                FROM moderation_appeals ma
                WHERE ma.ban_id = ub.id
              ) as appeal_count
       FROM user_bans ub
       LEFT JOIN users u ON u.id = ub.user_id
       LEFT JOIN dating_profiles dp ON dp.user_id = ub.user_id
       LEFT JOIN users admin ON admin.id = ub.issued_by_admin_id
       ${whereClause}
       ORDER BY ub.issued_at DESC, ub.id DESC
       LIMIT $2 OFFSET $3`,
      params
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as count
       FROM user_bans ub
       ${whereClause}`,
      params.slice(0, 1)
    );

    res.json({
      bans: bansResult.rows.map((row) => ({
        ...normalizeBanRow(row),
        userEmail: row.email,
        userName: row.first_name,
        appealCount: toCount(row.appeal_count)
      })),
      total: toCount(countResult.rows[0]?.count),
      page,
      limit
    });
  } catch (err) {
    console.error('Get bans error:', err);
    res.status(500).json({ error: 'Failed to fetch bans' });
  }
});

router.post('/bans/:banId/revoke', async (req, res) => {
  try {
    const banId = parseInteger(req.params.banId, 0);
    const revokeReason = String(req.body?.reason || 'Moderation action revoked').trim();

    const ban = await revokeUserBan({
      banId,
      adminUserId: req.user.id,
      revokeReason
    });

    if (!ban) {
      return res.status(404).json({ error: 'Active ban not found' });
    }

    res.json({
      success: true,
      message: 'Ban revoked successfully',
      ban
    });
  } catch (err) {
    console.error('Revoke ban error:', err);
    res.status(500).json({ error: 'Failed to revoke ban' });
  }
});

router.get('/appeals', async (req, res) => {
  try {
    const status = String(req.query.status || 'pending');
    const limit = clampLimit(req.query.limit, 20, 100);
    const page = Math.max(parseInteger(req.query.page, 1), 1);
    const offset = getOffset(page, limit);

    const appealsResult = await db.query(
      `SELECT ma.*, u.email, dp.first_name, ub.ban_type, ub.reason as ban_reason
       FROM moderation_appeals ma
       LEFT JOIN users u ON u.id = ma.user_id
       LEFT JOIN dating_profiles dp ON dp.user_id = ma.user_id
       LEFT JOIN user_bans ub ON ub.id = ma.ban_id
       WHERE ma.status = $1
       ORDER BY ma.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as count
       FROM moderation_appeals
       WHERE status = $1`,
      [status]
    );

    res.json({
      appeals: appealsResult.rows,
      total: toCount(countResult.rows[0]?.count),
      page,
      limit
    });
  } catch (err) {
    console.error('Get appeals error:', err);
    res.status(500).json({ error: 'Failed to fetch appeals' });
  }
});

router.post('/appeals/:appealId/review', async (req, res) => {
  try {
    const appealId = parseInteger(req.params.appealId, 0);
    const action = String(req.body?.action || '').trim().toLowerCase();
    const reviewNotes = String(req.body?.reviewNotes || '').trim();

    if (!appealId || !action) {
      return res.status(400).json({ error: 'An appeal action is required' });
    }

    const appealResult = await db.query(
      `SELECT *
       FROM moderation_appeals
       WHERE id = $1
       LIMIT 1`,
      [appealId]
    );

    if (appealResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appeal not found' });
    }

    const appeal = appealResult.rows[0];
    let nextStatus = 'pending';
    let resolutionAction = null;

    if (action === 'approve') {
      nextStatus = 'approved';
      resolutionAction = 'lift_ban';

      if (appeal.ban_id) {
        await revokeUserBan({
          banId: appeal.ban_id,
          adminUserId: req.user.id,
          revokeReason: reviewNotes || 'Ban revoked after appeal review'
        });
      }
    } else if (action === 'deny') {
      nextStatus = 'denied';
      resolutionAction = 'uphold_ban';
    } else if (action === 'reopen') {
      nextStatus = 'pending';
      resolutionAction = 'reopened';
    } else {
      return res.status(400).json({ error: 'Unsupported appeal action' });
    }

    const updateResult = await db.query(
      `UPDATE moderation_appeals
       SET status = $1,
           review_notes = $2,
           resolution_action = $3,
           reviewed_by_admin_id = $4,
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [nextStatus, reviewNotes || null, resolutionAction, req.user.id, appealId]
    );

    await recordAdminAction({
      adminUserId: req.user.id,
      actionType: `appeal_${action}`,
      targetUserId: appeal.user_id,
      reason: reviewNotes || `Appeal ${action}`,
      details: {
        appealId,
        banId: appeal.ban_id,
        resolutionAction
      }
    });

    await userNotificationService.createNotification(appeal.user_id, {
      type: 'appeal_update',
      title: 'Appeal Review Update',
      body:
        action === 'approve'
          ? 'Your appeal has been approved and the moderation action has been lifted.'
          : action === 'deny'
            ? 'Your appeal has been reviewed and the moderation action remains in place.'
            : 'Your appeal has been reopened for another review.',
      metadata: {
        appealId,
        status: nextStatus,
        resolutionAction
      }
    });

    await spamFraudService.refreshSystemMetrics();

    res.json({ success: true, appeal: updateResult.rows[0] });
  } catch (err) {
    console.error('Review appeal error:', err);
    res.status(500).json({ error: 'Failed to review appeal' });
  }
});

router.get('/analytics/users/:userId', async (req, res) => {
  try {
    const userId = parseInteger(req.params.userId, 0);
    const days = Math.max(parseInteger(req.query.days, 30), 1);

    const analyticsResult = await db.query(
      `SELECT *
       FROM user_analytics
       WHERE user_id = $1
         AND activity_date >= CURRENT_DATE - INTERVAL '1 day' * $2
       ORDER BY activity_date DESC`,
      [userId, days]
    );

    const userResult = await db.query(
      `SELECT u.id, u.email, dp.first_name, dp.age, u.created_at as account_created_at
       FROM users u
       LEFT JOIN dating_profiles dp ON dp.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [userId]
    );

    res.json({
      user: userResult.rows[0] || null,
      analytics: analyticsResult.rows
    });
  } catch (err) {
    console.error('Get user analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
});

router.get('/analytics/platform', async (req, res) => {
  try {
    const days = Math.max(parseInteger(req.query.days, 30), 1);
    await spamFraudService.refreshSystemMetrics();

    const metricsResult = await db.query(
      `SELECT *
       FROM system_metrics
       WHERE metric_date >= CURRENT_DATE - INTERVAL '1 day' * $1
       ORDER BY metric_date DESC`,
      [days]
    );

    const metrics = metricsResult.rows;

    res.json({
      metrics,
      summary: {
        dau: toCount(metrics[0]?.daily_active_users),
        totalMessages: metrics.reduce((sum, metric) => sum + toCount(metric.total_messages), 0),
        totalMatches: metrics.reduce((sum, metric) => sum + toCount(metric.total_matches), 0),
        newUsers: metrics.reduce((sum, metric) => sum + toCount(metric.new_users), 0),
        totalReports: metrics.reduce((sum, metric) => sum + toCount(metric.reported_users), 0),
        totalSpamFlags: metrics.reduce((sum, metric) => sum + toCount(metric.spam_flagged_users), 0),
        totalFraudFlags: metrics.reduce((sum, metric) => sum + toCount(metric.fraud_flagged_users), 0),
        pendingPhotoReviews: toCount(metrics[0]?.pending_photo_reviews),
        pendingAppeals: toCount(metrics[0]?.pending_appeals),
        activeBans: toCount(metrics[0]?.active_bans),
        periodDays: days
      }
    });
  } catch (err) {
    console.error('Get platform analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch platform analytics' });
  }
});

router.get('/analytics/moderation', async (req, res) => {
  try {
    await spamFraudService.refreshSystemMetrics();
    const analytics = await fetchModerationAnalytics(req.query.days || 30);
    res.json(analytics);
  } catch (err) {
    console.error('Get moderation analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch moderation analytics' });
  }
});

router.get('/actions-log', async (req, res) => {
  try {
    const limit = clampLimit(req.query.limit, 50, 200);
    const page = Math.max(parseInteger(req.query.page, 1), 1);
    const offset = getOffset(page, limit);
    const actionType = String(req.query.action_type || '').trim();

    let query = `SELECT aa.*, admin.email as admin_email
                 FROM admin_actions aa
                 LEFT JOIN users admin ON admin.id = aa.admin_user_id`;
    let params = [];

    if (actionType) {
      query += ` WHERE aa.action_type = $1
                 ORDER BY aa.created_at DESC
                 LIMIT $2 OFFSET $3`;
      params = [actionType, limit, offset];
    } else {
      query += ` ORDER BY aa.created_at DESC
                 LIMIT $1 OFFSET $2`;
      params = [limit, offset];
    }

    const actionsResult = await db.query(query, params);
    const countResult = await db.query(
      actionType
        ? `SELECT COUNT(*) as count FROM admin_actions WHERE action_type = $1`
        : `SELECT COUNT(*) as count FROM admin_actions`,
      actionType ? [actionType] : []
    );

    res.json({
      actions: actionsResult.rows,
      total: toCount(countResult.rows[0]?.count),
      page,
      limit
    });
  } catch (err) {
    console.error('Get actions log error:', err);
    res.status(500).json({ error: 'Failed to fetch actions log' });
  }
});

module.exports = router;
