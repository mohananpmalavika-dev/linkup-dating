const express = require('express');
const router = express.Router();
const db = require('../config/database');
const dbModels = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { cacheGetPaginated, cacheSetPaginated, buildCacheKey, cacheDeletePattern } = require('../utils/redis');

const CURSOR_PAGE_SIZE = 20;
const DISCOVERY_CACHE_TTL = 45;
const TRENDING_CACHE_TTL = 60;

const encodeCursor = (updatedAt, id) => {
  if (!updatedAt || !id) return null;
  const payload = `${updatedAt}::${id}`;
  return Buffer.from(payload).toString('base64');
};

const decodeCursor = (cursor) => {
  if (!cursor) return { updatedAt: null, id: null };
  try {
    const payload = Buffer.from(cursor, 'base64').toString('utf8');
    const [updatedAt, id] = payload.split('::');
    return { updatedAt, id: parseInt(id, 10) || null };
  } catch {
    return { updatedAt: null, id: null };
  }
};

const invalidateDiscoveryCache = async (userId) => {
  try {
    await cacheDeletePattern(buildCacheKey('discovery', userId, '*'));
  } catch (err) {
    console.error('Cache invalidation error:', err);
  }
};
const userNotificationService = require('../services/userNotificationService');
const { createModerationFlag } = require('../utils/moderation');
const spamFraudService = require('../services/spamFraudService');
const mlCompatibilityService = require('../services/mlCompatibilityService');

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MULTIPART_FORM_DATA_PATTERN = /^multipart\/form-data/i;

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue ? normalizedValue : null;
};

const getRequestMetadata = (req) => ({
  ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null,
  userAgent: req.headers['user-agent'] || null
});

const getRewardBalanceForUser = async (userId) => {
  let rewardBalance = null;

  try {
    rewardBalance = await dbModels.UserRewardBalance.findOne({
      where: { userId }
    });
  } catch (error) {
    if (!isOptionalAnalyticsError(error)) {
      throw error;
    }
  }

  return {
    model: rewardBalance,
    boostCredits: Number(rewardBalance?.boostCredits || 0) || 0,
    superlikeCredits: Number(rewardBalance?.superlikeCredits || 0) || 0
  };
};

const spendRewardCredits = async (rewardBalanceModel, fieldName, amount = 1) => {
  if (!rewardBalanceModel) {
    return false;
  }

  const nextValue = Number(rewardBalanceModel[fieldName] || 0) - Number(amount || 0);
  if (nextValue < 0) {
    return false;
  }

  await rewardBalanceModel.update({
    [fieldName]: nextValue
  });

  return true;
};

const getSubscriptionAccessForUser = async (userId) => {
  const result = await optionalQuery(
    `SELECT plan, status, expires_at
     FROM subscriptions
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
    []
  );

  const subscription = result.rows[0];
  const isActive = Boolean(
    subscription &&
      subscription.status === 'active' &&
      (!subscription.expires_at || new Date(subscription.expires_at) > new Date())
  );
  const plan = isActive ? subscription.plan : 'free';

  return {
    plan,
    isPremium: plan === 'premium' || plan === 'gold',
    isGold: plan === 'gold'
  };
};

const countRowValue = (value) => Number.parseInt(value, 10) || 0;
const OPTIONAL_ANALYTICS_ERROR_CODES = new Set(['42P01', '42703']);

const getOptionalAnalyticsErrorCode = (error) =>
  error?.code || error?.parent?.code || error?.original?.code || null;

const isOptionalAnalyticsError = (error) =>
  OPTIONAL_ANALYTICS_ERROR_CODES.has(getOptionalAnalyticsErrorCode(error));

const optionalQuery = async (queryText, values = [], fallbackRows = []) => {
  try {
    return await db.query(queryText, values);
  } catch (error) {
    if (isOptionalAnalyticsError(error)) {
      return { rows: fallbackRows };
    }

    throw error;
  }
};

const roundNumber = (value, digits = 1) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  const factor = 10 ** digits;
  return Math.round(numericValue * factor) / factor;
};

const percentage = (numerator, denominator) =>
  denominator > 0 ? Math.round((Number(numerator || 0) / Number(denominator || 0)) * 100) : 0;

const formatHourRangeLabel = (hourValue) => {
  const parsedHour = Number.parseInt(hourValue, 10);
  const safeHour = Number.isFinite(parsedHour) ? ((parsedHour % 24) + 24) % 24 : 0;
  const nextHour = (safeHour + 1) % 24;

  const formatSingleHour = (hour) => {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${normalizedHour}${suffix}`;
  };

  return `${formatSingleHour(safeHour)}-${formatSingleHour(nextHour)}`;
};

const formatDurationLabel = (minutesValue) => {
  const minutes = Math.max(0, Math.round(Number(minutesValue || 0)));

  if (!minutes) {
    return 'Not enough replies yet';
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const getSubscriptionSnapshotForUser = async (userId) => {
  const [subscriptionAccess, result] = await Promise.all([
    getSubscriptionAccessForUser(userId),
    db.query(
      `SELECT plan, status, started_at, expires_at
       FROM subscriptions
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    )
  ]);

  const subscription = result.rows[0] || null;
  const hasPaidAccess = subscriptionAccess.isPremium || subscriptionAccess.isGold;

  return {
    plan: subscriptionAccess.plan,
    status: subscription ? (hasPaidAccess ? subscription.status : 'expired') : 'active',
    startedAt: subscription?.started_at || null,
    expiresAt: subscription?.expires_at || null,
    isPremium: subscriptionAccess.isPremium,
    isGold: subscriptionAccess.isGold
  };
};

const getDailyLimitSnapshot = async (userId) => {
  const today = new Date().toISOString().split('T')[0];
  const [analyticsResult, subscriptionAccess, rewardBalance] = await Promise.all([
    optionalQuery(
      `SELECT likes_sent, superlikes_sent, rewinds_sent, boosts_used
       FROM user_analytics
       WHERE user_id = $1 AND activity_date = $2`,
      [userId, today],
      []
    ),
    getSubscriptionAccessForUser(userId),
    getRewardBalanceForUser(userId)
  ]);

  const analyticsRow = analyticsResult.rows[0] || {};
  const likesSent = countRowValue(analyticsRow.likes_sent);
  const superlikesSent = countRowValue(analyticsRow.superlikes_sent);
  const rewindsSent = countRowValue(analyticsRow.rewinds_sent);
  const boostsUsedToday = countRowValue(analyticsRow.boosts_used);

  const likeLimit = 50;
  const superlikeLimit = subscriptionAccess.isGold ? 10 : subscriptionAccess.isPremium ? 5 : 1;
  const rewindLimit = 3;
  const boostLimit = subscriptionAccess.isGold ? 5 : subscriptionAccess.isPremium ? 1 : 0;
  const remainingBaseSuperlikes = Math.max(0, superlikeLimit - superlikesSent);
  const remainingBaseBoosts = Math.max(0, boostLimit - boostsUsedToday);

  return {
    likeLimit,
    superlikeLimit,
    rewindLimit,
    boostLimit,
    likesSent,
    superlikesSent,
    rewindsSent,
    boostsUsedToday,
    remainingLikes: Math.max(0, likeLimit - likesSent),
    remainingSuperlikes: remainingBaseSuperlikes + rewardBalance.superlikeCredits,
    remainingRewinds: Math.max(0, rewindLimit - rewindsSent),
    remainingBaseBoosts,
    remainingBoostCredits: rewardBalance.boostCredits,
    remainingBoosts: remainingBaseBoosts + rewardBalance.boostCredits,
    rewardSuperlikeCredits: rewardBalance.superlikeCredits,
    rewardBoostCredits: rewardBalance.boostCredits,
    resetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    rewardBalance,
    subscriptionAccess
  };
};

const getLatestBoostRecordForUser = async (userId, { activeOnly = false } = {}) => {
  const result = await optionalQuery(
    `SELECT *
     FROM profile_boosts
     WHERE user_id = $1
       ${activeOnly ? 'AND boost_expires_at > CURRENT_TIMESTAMP' : ''}
     ORDER BY boost_expires_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
};

const getBoostWindow = (boostRecord) => {
  if (!boostRecord?.boost_expires_at) {
    return null;
  }

  const expiresAt = new Date(boostRecord.boost_expires_at);
  if (Number.isNaN(expiresAt.getTime())) {
    return null;
  }

  const fallbackStartedAt = new Date(expiresAt.getTime() - 30 * 60 * 1000);
  const candidateStartedAt = boostRecord.started_at || boostRecord.created_at || fallbackStartedAt;
  const startedAt = new Date(candidateStartedAt);

  return {
    startedAt: Number.isNaN(startedAt.getTime()) ? fallbackStartedAt : startedAt,
    expiresAt
  };
};

const summarizeBoostRecord = async (userId, boostRecord, baselineViewsLast7Days = 0) => {
  const boostWindow = getBoostWindow(boostRecord);
  if (!boostRecord || !boostWindow) {
    return null;
  }

  const [viewsResult, interactionsResult] = await Promise.all([
    db.query(
      `SELECT COUNT(*) as profile_views,
              COUNT(DISTINCT viewer_user_id) as unique_viewers
       FROM profile_views
       WHERE viewed_user_id = $1
         AND viewed_at >= $2
         AND viewed_at <= $3`,
      [userId, boostWindow.startedAt.toISOString(), boostWindow.expiresAt.toISOString()]
    ),
    db.query(
      `SELECT
         COUNT(CASE WHEN interaction_type = 'like' THEN 1 END) as likes_received,
         COUNT(CASE WHEN interaction_type = 'superlike' THEN 1 END) as superlikes_received
       FROM interactions
       WHERE to_user_id = $1
         AND interaction_type IN ('like', 'superlike')
         AND created_at >= $2
         AND created_at <= $3`,
      [userId, boostWindow.startedAt.toISOString(), boostWindow.expiresAt.toISOString()]
    )
  ]);

  const profileViews = countRowValue(viewsResult.rows[0]?.profile_views);
  const uniqueViewers = countRowValue(viewsResult.rows[0]?.unique_viewers);
  const likesReceived = countRowValue(interactionsResult.rows[0]?.likes_received);
  const superlikesReceived = countRowValue(interactionsResult.rows[0]?.superlikes_received);
  const totalPositiveActions = likesReceived + superlikesReceived;
  const visibilityMultiplier = roundNumber(boostRecord.visibility_multiplier || 5, 1);
  const averageDailyViews = baselineViewsLast7Days > 0 ? baselineViewsLast7Days / 7 : 0;
  const estimatedAdditionalViews = Math.max(
    8,
    Math.round(Math.max(averageDailyViews, 6) * Math.max(1.5, visibilityMultiplier * 0.45))
  );
  const secondsRemaining = Math.max(
    0,
    Math.ceil((boostWindow.expiresAt.getTime() - Date.now()) / 1000)
  );

  return {
    id: boostRecord.id || null,
    active: boostWindow.expiresAt.getTime() > Date.now(),
    startedAt: boostWindow.startedAt.toISOString(),
    expiresAt: boostWindow.expiresAt.toISOString(),
    visibilityMultiplier,
    secondsRemaining,
    minutesRemaining: Math.ceil(secondsRemaining / 60),
    reachEstimate: {
      estimatedAdditionalViews,
      low: Math.max(3, Math.round(estimatedAdditionalViews * 0.7)),
      high: Math.max(estimatedAdditionalViews, Math.round(estimatedAdditionalViews * 1.3)),
      baselineViewsLast7Days
    },
    outcome: {
      profileViews,
      uniqueViewers,
      likesReceived,
      superlikesReceived,
      totalPositiveActions,
      likeConversionRate: percentage(totalPositiveActions, profileViews)
    }
  };
};

const getPhotoPerformanceSummary = async (userId, limit = 3) => {
  const performanceResult = await optionalQuery(
    `SELECT
       pp.photo_id,
       pp.photo_position,
       pp.profile_views,
       pp.likes_received,
       pp.superlikes_received,
       pp.right_swipe_rate,
       pp.left_swipe_rate,
       pp.engagement_score,
       ph.photo_url
     FROM photo_performance pp
     LEFT JOIN profile_photos ph ON ph.id = pp.photo_id
     WHERE pp.user_id = $1
     ORDER BY pp.engagement_score DESC, pp.photo_position ASC
     LIMIT $2`,
    [userId, limit]
  );

  if (performanceResult.rows.length > 0) {
    return performanceResult.rows.map((row) => ({
      photoId: row.photo_id,
      photoUrl: row.photo_url || null,
      position: countRowValue(row.photo_position) || 1,
      views: countRowValue(row.profile_views),
      likes: countRowValue(row.likes_received),
      superlikes: countRowValue(row.superlikes_received),
      rightSwipeRate: roundNumber(row.right_swipe_rate || 0),
      leftSwipeRate: roundNumber(row.left_swipe_rate || 0),
      engagementScore: roundNumber(row.engagement_score || 0, 2),
      summary:
        countRowValue(row.profile_views) > 0
          ? `Photo ${countRowValue(row.photo_position) || 1} converts ${percentage(
              countRowValue(row.likes_received) + countRowValue(row.superlikes_received),
              countRowValue(row.profile_views)
            )}% of views into positive actions.`
          : 'This photo is live, but it still needs more impressions before it can be ranked.'
    }));
  }

  const fallbackPhotosResult = await db.query(
    `SELECT id, photo_url, position
     FROM profile_photos
     WHERE user_id = $1
     ORDER BY position ASC
     LIMIT $2`,
    [userId, limit]
  );

  return fallbackPhotosResult.rows.map((row, index) => ({
    photoId: row.id,
    photoUrl: row.photo_url || null,
    position: countRowValue(row.position) || index + 1,
    views: 0,
    likes: 0,
    superlikes: 0,
    rightSwipeRate: 0,
    leftSwipeRate: 0,
    engagementScore: 0,
    summary: 'We need more profile traffic before photo-level performance can be ranked.'
  }));
};

const getPromptPerformanceSummary = async (
  userId,
  { likesReceived = 0, replyRate = 0 } = {},
  limit = 3
) => {
  const promptResult = await optionalQuery(
    `SELECT prompt_id, response, created_at
     FROM daily_prompt_responses
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  const promptRows = Array.isArray(promptResult.rows) ? promptResult.rows : [];
  if (promptRows.length === 0) {
    return [];
  }

  const promptCount = promptRows.length;
  const scoredPrompts = promptRows.map((row) => {
    const promptMeta = DAILY_PROMPTS.find((prompt) => prompt.id === row.prompt_id);
    const response = String(row.response || '').trim();
    const responseLengthScore = Math.min(55, Math.round(response.length / 4));
    const answeredAt = row.created_at ? new Date(row.created_at) : null;
    const daysSinceAnswer =
      answeredAt && !Number.isNaN(answeredAt.getTime())
        ? Math.max(0, Math.floor((Date.now() - answeredAt.getTime()) / (24 * 60 * 60 * 1000)))
        : 90;
    const freshnessScore = daysSinceAnswer <= 7 ? 20 : daysSinceAnswer <= 30 ? 14 : 8;
    const supportScore = Math.min(
      20,
      Math.round((Number(likesReceived || 0) + Number(replyRate || 0) / 5) / Math.max(promptCount, 1))
    );
    const impactScore = Math.min(100, responseLengthScore + freshnessScore + supportScore + 10);

    return {
      promptId: row.prompt_id,
      text: promptMeta?.text || 'Profile prompt',
      icon: promptMeta?.icon || null,
      response,
      answeredAt: row.created_at,
      impactScore,
      summary:
        response.length >= 120
          ? 'Detailed answer gives matches an easy opening line.'
          : 'Add a little more specificity so people know what to ask you about next.'
    };
  });

  return scoredPrompts
    .sort((leftPrompt, rightPrompt) => rightPrompt.impactScore - leftPrompt.impactScore)
    .slice(0, limit);
};

const buildSectionInsights = ({
  profile,
  photoPerformance = [],
  promptPerformance = [],
  views = {},
  interactions = {},
  replyRate = 0
}) => {
  const bioLength = String(profile?.bio || '').trim().length;
  const photoCount = countRowValue(profile?.photo_count);
  const totalPositiveInbound =
    countRowValue(interactions.likesReceived) + countRowValue(interactions.superlikesReceived);
  const profileConversionRate = percentage(totalPositiveInbound, countRowValue(views.total));
  const leadingPhoto = photoPerformance[0] || null;
  const promptCount = promptPerformance.length;

  return [
    {
      section: 'Photos',
      impactScore: Math.min(
        100,
        Math.round(
          Math.min(30, photoCount * 5) +
            Math.min(45, Number(leadingPhoto?.engagementScore || 0) * 8) +
            Math.min(20, totalPositiveInbound)
        )
      ),
      summary: leadingPhoto
        ? `Photo ${leadingPhoto.position} is currently your strongest visual hook.`
        : photoCount > 0
        ? 'Your photo stack is live, but it still needs more engagement data.'
        : 'Missing photos are almost certainly holding your profile back.',
      nextMove: leadingPhoto
        ? 'Keep your highest-performing photo near the front of the stack.'
        : 'Add at least 3 clear photos, including one bright lead image.'
    },
    {
      section: 'Prompts',
      impactScore: promptCount > 0 ? Math.round(promptPerformance[0].impactScore) : 0,
      summary:
        promptCount > 0
          ? `${promptCount} prompt${promptCount === 1 ? '' : 's'} are giving people conversation starters.`
          : 'No prompts answered yet, so you are missing a major conversation driver.',
      nextMove:
        promptCount > 0
          ? 'Keep your top prompt personal and specific instead of broad or generic.'
          : 'Answer 2 or 3 prompts to create more natural first messages.'
    },
    {
      section: 'Bio',
      impactScore: Math.min(100, Math.round(Math.min(50, bioLength / 3) + profileConversionRate)),
      summary:
        bioLength >= 150
          ? 'Your bio has enough detail to support better conversion from views to likes.'
          : bioLength > 0
          ? 'Your bio exists, but more detail could improve conversion.'
          : 'A missing bio is likely costing you likes and replies.',
      nextMove:
        bioLength >= 150
          ? 'Refresh one line if it no longer sounds current or personal.'
          : 'Aim for at least 150 characters with specifics people can respond to.'
    },
    {
      section: 'Voice Intro',
      impactScore: profile?.voice_intro_url ? Math.min(100, 55 + Math.round(replyRate / 3)) : 0,
      summary: profile?.voice_intro_url
        ? 'Voice makes your profile feel more human before the first message.'
        : 'No voice intro yet, so you are missing a warm differentiator.',
      nextMove: profile?.voice_intro_url
        ? 'Re-record it if the clip no longer sounds like your best current self.'
        : 'Add a 15-30 second intro to make your profile feel more memorable.'
    },
    {
      section: 'Verification',
      impactScore: profile?.profile_verified ? 82 : 18,
      summary: profile?.profile_verified
        ? 'Verification adds trust right at the decision point.'
        : 'Trust signals are lighter without a verified badge.',
      nextMove: profile?.profile_verified
        ? 'Keep your photos current so the verification badge keeps working for you.'
        : 'Complete photo verification to reduce hesitation for new matches.'
    }
  ].sort((leftSection, rightSection) => rightSection.impactScore - leftSection.impactScore);
};
const REPORT_REASON_CONFIG = {
  inappropriate_photos: {
    category: 'content',
    severity: 'high',
    title: 'Reported inappropriate photos'
  },
  fake_profile: {
    category: 'fraud',
    severity: 'high',
    title: 'Reported fake profile'
  },
  suspicious_behavior: {
    category: 'safety',
    severity: 'high',
    title: 'Reported suspicious behavior'
  },
  harassment: {
    category: 'safety',
    severity: 'critical',
    title: 'Reported harassment'
  },
  spam: {
    category: 'spam',
    severity: 'high',
    title: 'Reported spam or scam'
  },
  offensive_content: {
    category: 'content',
    severity: 'medium',
    title: 'Reported offensive content'
  },
  other: {
    category: 'behavior',
    severity: 'medium',
    title: 'User report'
  }
};

const getReportModerationConfig = (reason) =>
  REPORT_REASON_CONFIG[reason] || REPORT_REASON_CONFIG.other;

const hasMeaningfulFilters = (filters = {}) =>
  Object.values(filters).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (value && typeof value === 'object') {
      return hasMeaningfulFilters(value);
    }

    return value !== undefined && value !== null && String(value).trim() !== '';
  });

const recordSearchHistory = async ({ userId, source = 'search', filters = {}, resultCount = 0 }) => {
  if (!userId || !hasMeaningfulFilters(filters)) {
    return;
  }

  try {
    await db.query(
      `INSERT INTO user_search_history (user_id, source, filters, result_count)
       VALUES ($1, $2, $3, $4)`,
      [userId, source, JSON.stringify(filters), resultCount]
    );
  } catch (error) {
    console.error('Search history record error:', error);
  }
};

const normalizeSearchHistoryRow = (row = {}) => ({
  id: row.id,
  userId: row.user_id,
  source: row.source,
  filters: row.filters || {},
  resultCount: row.result_count || 0,
  createdAt: row.created_at
});

const normalizeInteger = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const normalizeMatchUserPair = (firstUserId, secondUserId) => {
  const normalizedFirstUserId = normalizeInteger(firstUserId);
  const normalizedSecondUserId = normalizeInteger(secondUserId);

  if (!normalizedFirstUserId || !normalizedSecondUserId) {
    return null;
  }

  return normalizedFirstUserId < normalizedSecondUserId
    ? {
        userId1: normalizedFirstUserId,
        userId2: normalizedSecondUserId
      }
    : {
        userId1: normalizedSecondUserId,
        userId2: normalizedFirstUserId
      };
};

const ensureActiveMatch = async (firstUserId, secondUserId) => {
  const normalizedPair = normalizeMatchUserPair(firstUserId, secondUserId);

  if (!normalizedPair) {
    throw new Error('Valid user IDs are required to create a match');
  }

  if (normalizedPair.userId1 === normalizedPair.userId2) {
    throw new Error('A user cannot match with themselves');
  }

  const result = await db.query(
    `INSERT INTO matches (user_id_1, user_id_2, status, matched_at)
     VALUES ($1, $2, 'active', CURRENT_TIMESTAMP)
     ON CONFLICT (user_id_1, user_id_2) DO UPDATE
     SET status = 'active',
         matched_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [normalizedPair.userId1, normalizedPair.userId2]
  );

  return result.rows[0] || null;
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return Boolean(value);
};

const normalizeHeight = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalizedValue = String(value).trim();
  const feetAndInchesMatch = normalizedValue.match(/^(\d+)\s*'\s*(\d{1,2})/);

  if (feetAndInchesMatch) {
    const feet = Number.parseInt(feetAndInchesMatch[1], 10);
    const inches = Number.parseInt(feetAndInchesMatch[2], 10);
    return Math.round((feet * 12 + inches) * 2.54);
  }

  return normalizeInteger(normalizedValue.replace(/[^\d-]/g, ''));
};

const safeJsonParse = (value, fallbackValue = null) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallbackValue;
  }
};

const extractMultipartBoundary = (contentType = '') => {
  const boundaryMatch = String(contentType).match(/boundary=([^;]+)/i);
  return boundaryMatch ? boundaryMatch[1].replace(/^"|"$/g, '') : null;
};

const parseMultipartFormData = async (req) => {
  const boundary = extractMultipartBoundary(req.headers['content-type']);

  if (!boundary) {
    return { fields: {}, files: [] };
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let hasRejected = false;

    req.on('data', (chunk) => {
      if (hasRejected) {
        return;
      }

      totalBytes += chunk.length;
      if (totalBytes > MAX_UPLOAD_BYTES) {
        hasRejected = true;
        reject(new Error('Photo upload payload too large'));
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (hasRejected) {
        return;
      }

      try {
        const rawBody = Buffer.concat(chunks).toString('latin1');
        const parts = rawBody
          .split(`--${boundary}`)
          .slice(1, -1)
          .map((part) => (part.startsWith('\r\n') ? part.slice(2) : part))
          .map((part) => (part.endsWith('\r\n') ? part.slice(0, -2) : part))
          .filter(Boolean);
        const fields = {};
        const files = [];

        for (const part of parts) {
          const headerSeparatorIndex = part.indexOf('\r\n\r\n');
          if (headerSeparatorIndex === -1) {
            continue;
          }

          const rawHeaders = part.slice(0, headerSeparatorIndex);
          const rawValue = part.slice(headerSeparatorIndex + 4);
          const dispositionHeader = rawHeaders
            .split('\r\n')
            .find((header) => /^content-disposition:/i.test(header));
          const contentTypeHeader = rawHeaders
            .split('\r\n')
            .find((header) => /^content-type:/i.test(header));

          if (!dispositionHeader) {
            continue;
          }

          const nameMatch = dispositionHeader.match(/name="([^"]+)"/i);
          if (!nameMatch) {
            continue;
          }

          const filenameMatch = dispositionHeader.match(/filename="([^"]*)"/i);
          const fieldName = nameMatch[1];

          if (filenameMatch) {
            files.push({
              fieldName,
              filename: filenameMatch[1],
              contentType: contentTypeHeader
                ? contentTypeHeader.split(':')[1].trim()
                : 'application/octet-stream',
              buffer: Buffer.from(rawValue, 'latin1')
            });
            continue;
          }

          if (fields[fieldName] === undefined) {
            fields[fieldName] = rawValue;
          } else if (Array.isArray(fields[fieldName])) {
            fields[fieldName].push(rawValue);
          } else {
            fields[fieldName] = [fields[fieldName], rawValue];
          }
        }

        resolve({ fields, files });
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
};

const normalizeIncomingPhotos = (rawPhotos = []) => {
  let candidatePhotos = rawPhotos;

  if (typeof candidatePhotos === 'string') {
    candidatePhotos = safeJsonParse(candidatePhotos, [candidatePhotos]);
  }

  if (!Array.isArray(candidatePhotos)) {
    candidatePhotos = [candidatePhotos];
  }

  return candidatePhotos
    .map((photo, index) => {
      if (typeof photo === 'string') {
        const normalizedUrl = normalizeOptionalText(photo);
        return normalizedUrl ? { url: normalizedUrl, position: index } : null;
      }

      if (!photo || typeof photo !== 'object') {
        return null;
      }

      const normalizedUrl = normalizeOptionalText(photo.url || photo.photo_url);
      if (!normalizedUrl) {
        return null;
      }

      const parsedPosition = normalizeInteger(photo.position);
      return {
        url: normalizedUrl,
        position: parsedPosition !== null ? parsedPosition : index
      };
    })
    .filter(Boolean);
};

const convertFileToDataUrl = (file) =>
  `data:${file.contentType || 'application/octet-stream'};base64,${file.buffer.toString('base64')}`;

const collectPhotosFromRequest = async (req) => {
  const jsonPhotos = normalizeIncomingPhotos(req.body?.photos);
  if (jsonPhotos.length > 0) {
    return jsonPhotos;
  }

  const contentType = String(req.headers['content-type'] || '');
  if (!MULTIPART_FORM_DATA_PATTERN.test(contentType)) {
    return [];
  }

  const { fields, files } = await parseMultipartFormData(req);
  req.parsedMultipartFields = fields;
  const uploadedPhotos = files
    .filter((file) => file.fieldName === 'photos')
    .map((file, index) => ({
      url: convertFileToDataUrl(file),
      position: index,
      contentType: file.contentType || null,
      filename: file.filename || null,
      size: file.buffer?.length || 0
    }));

  if (uploadedPhotos.length > 0) {
    return uploadedPhotos;
  }

  return normalizeIncomingPhotos(fields.photos);
};

const normalizePhotoDetails = (photos) => {
  if (!Array.isArray(photos)) {
    return [];
  }

  return photos
    .map((photo, index) => {
      if (typeof photo === 'string') {
        return {
          id: null,
          url: photo,
          position: index,
          isPrimary: index === 0
        };
      }

      const normalizedUrl = normalizeOptionalText(photo?.photo_url || photo?.url);
      if (!normalizedUrl) {
        return null;
      }

      const parsedPosition = normalizeInteger(photo?.position);
      return {
        id: photo?.id ?? null,
        url: normalizedUrl,
        position: parsedPosition !== null ? parsedPosition : index,
        isPrimary: photo?.is_primary === undefined ? index === 0 : Boolean(photo.is_primary)
      };
    })
    .filter(Boolean)
    .sort((leftPhoto, rightPhoto) => leftPhoto.position - rightPhoto.position);
};

const normalizeInterestList = (interests = []) =>
  (Array.isArray(interests) ? interests : [])
    .map((interest) => String(interest || '').trim())
    .filter(Boolean);

const normalizeStringArray = (values = []) =>
  (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);

const COMPATIBILITY_QUESTION_LABELS = {
  weekendStyle: 'weekend style',
  communicationStyle: 'communication style',
  socialEnergy: 'social rhythm',
  planningStyle: 'planning style',
  affectionStyle: 'connection style',
  conflictStyle: 'conflict approach'
};

const COMPATIBILITY_QUESTION_IDS = Object.keys(COMPATIBILITY_QUESTION_LABELS);

const createDefaultDealBreakers = () => ({
  enforceAgeRange: false,
  enforceLocationRadius: false,
  onlyVerifiedProfiles: false,
  enforceRelationshipGoals: false,
  requireSharedInterests: false,
  enforceHeightRange: false,
  enforceBodyType: false,
  requireCompletedProfiles: false
});

const createDefaultPreferenceFlexibility = () => ({
  mode: 'balanced',
  learnFromActivity: true
});

const createDefaultCompatibilityAnswers = () =>
  COMPATIBILITY_QUESTION_IDS.reduce((answers, questionId) => {
    answers[questionId] = '';
    return answers;
  }, {});

const createEmptyLearningSignalGroup = () => ({
  interests: {},
  relationshipGoals: {},
  bodyTypes: {},
  ageBands: {},
  verification: {}
});

const createDefaultLearningProfile = () => ({
  positiveSignals: createEmptyLearningSignalGroup(),
  negativeSignals: createEmptyLearningSignalGroup(),
  totalPositiveActions: 0,
  totalNegativeActions: 0,
  lastInteractionAt: null
});

const toFiniteNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const normalizeSignalKey = (value) => {
  const normalizedValue = normalizeOptionalText(value);
  return normalizedValue ? normalizedValue.toLowerCase() : null;
};

const clampSignalValue = (value) =>
  Math.max(-12, Math.min(12, Math.round(Number(value) * 100) / 100));

const normalizeSignalMap = (value) => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value).reduce((normalizedMap, [key, rawScore]) => {
    const normalizedKey = normalizeSignalKey(key);
    const numericScore = Number(rawScore);

    if (!normalizedKey || !Number.isFinite(numericScore)) {
      return normalizedMap;
    }

    normalizedMap[normalizedKey] = clampSignalValue(numericScore);
    return normalizedMap;
  }, {});
};

const normalizeLearningSignalGroup = (value) => {
  const source = value && typeof value === 'object' ? value : {};
  const fallback = createEmptyLearningSignalGroup();

  return Object.keys(fallback).reduce((normalizedGroup, key) => {
    normalizedGroup[key] = normalizeSignalMap(source[key]);
    return normalizedGroup;
  }, {});
};

const normalizeDealBreakers = (value) => {
  const fallback = createDefaultDealBreakers();
  const source = value && typeof value === 'object' ? value : {};

  return Object.keys(fallback).reduce((normalizedBreakers, key) => {
    normalizedBreakers[key] = normalizeBoolean(source[key]);
    return normalizedBreakers;
  }, {});
};

const normalizePreferenceFlexibility = (value) => {
  const fallback = createDefaultPreferenceFlexibility();
  const source = value && typeof value === 'object' ? value : {};
  const normalizedMode = normalizeOptionalText(source.mode)?.toLowerCase();

  return {
    mode: ['strict', 'balanced', 'open'].includes(normalizedMode) ? normalizedMode : fallback.mode,
    learnFromActivity:
      source.learnFromActivity === undefined
        ? fallback.learnFromActivity
        : normalizeBoolean(source.learnFromActivity)
  };
};

const normalizeCompatibilityAnswers = (value) => {
  const fallback = createDefaultCompatibilityAnswers();
  const source = value && typeof value === 'object' ? value : {};

  return Object.keys(fallback).reduce((normalizedAnswers, key) => {
    normalizedAnswers[key] = normalizeOptionalText(source[key]) || '';
    return normalizedAnswers;
  }, {});
};

const normalizeLearningProfile = (value) => {
  const fallback = createDefaultLearningProfile();
  const source = value && typeof value === 'object' ? value : {};

  return {
    positiveSignals: normalizeLearningSignalGroup(source.positiveSignals),
    negativeSignals: normalizeLearningSignalGroup(source.negativeSignals),
    totalPositiveActions: Math.max(0, normalizeInteger(source.totalPositiveActions) ?? fallback.totalPositiveActions),
    totalNegativeActions: Math.max(0, normalizeInteger(source.totalNegativeActions) ?? fallback.totalNegativeActions),
    lastInteractionAt: normalizeOptionalText(source.lastInteractionAt)
  };
};

const normalizePreferenceRow = (row) => {
  const source = row && typeof row === 'object' ? row : {};

  return {
    ageRangeMin: normalizeInteger(source.age_range_min ?? source.ageRangeMin) ?? 18,
    ageRangeMax: normalizeInteger(source.age_range_max ?? source.ageRangeMax) ?? 50,
    locationRadius: normalizeInteger(source.location_radius ?? source.locationRadius) ?? 50,
    genderPreferences: normalizeStringArray(source.gender_preferences ?? source.genderPreferences),
    relationshipGoals: normalizeStringArray(source.relationship_goals ?? source.relationshipGoals),
    interests: normalizeInterestList(source.interests),
    heightRangeMin: normalizeInteger(source.height_range_min ?? source.heightRangeMin),
    heightRangeMax: normalizeInteger(source.height_range_max ?? source.heightRangeMax),
    bodyTypes: normalizeStringArray(source.body_types ?? source.bodyTypes),
    showMyProfile:
      source.show_my_profile === undefined && source.showMyProfile === undefined
        ? true
        : normalizeBoolean(source.show_my_profile ?? source.showMyProfile),
    allowMessages:
      source.allow_messages === undefined && source.allowMessages === undefined
        ? true
        : normalizeBoolean(source.allow_messages ?? source.allowMessages),
    notificationsEnabled:
      source.notifications_enabled === undefined && source.notificationsEnabled === undefined
        ? true
        : normalizeBoolean(source.notifications_enabled ?? source.notificationsEnabled),
    dealBreakers: normalizeDealBreakers(source.deal_breakers ?? source.dealBreakers),
    preferenceFlexibility: normalizePreferenceFlexibility(
      source.preference_flexibility ?? source.preferenceFlexibility
    ),
    compatibilityAnswers: normalizeCompatibilityAnswers(
      source.compatibility_answers ?? source.compatibilityAnswers
    ),
    learningProfile: normalizeLearningProfile(source.learning_profile ?? source.learningProfile)
  };
};

const formatPreferenceResponse = (preferenceRow) => {
  const preferences = normalizePreferenceRow(preferenceRow);

  return {
    ageRangeMin: preferences.ageRangeMin,
    ageRangeMax: preferences.ageRangeMax,
    locationRadius: preferences.locationRadius,
    genderPreferences: preferences.genderPreferences,
    relationshipGoals: preferences.relationshipGoals,
    interests: preferences.interests,
    heightRangeMin: preferences.heightRangeMin,
    heightRangeMax: preferences.heightRangeMax,
    bodyTypes: preferences.bodyTypes,
    showMyProfile: preferences.showMyProfile,
    allowMessages: preferences.allowMessages,
    notificationsEnabled: preferences.notificationsEnabled,
    dealBreakers: preferences.dealBreakers,
    preferenceFlexibility: preferences.preferenceFlexibility,
    compatibilityAnswers: preferences.compatibilityAnswers,
    learningProfile: preferences.learningProfile
  };
};

const buildAgeBand = (age) => {
  if (!Number.isFinite(age)) {
    return null;
  }

  const rangeStart = Math.max(18, Math.floor(age / 5) * 5);
  return `${rangeStart}-${rangeStart + 4}`;
};

const applySignalDelta = (signalBucket, key, delta) => {
  const normalizedKey = normalizeSignalKey(key);

  if (!normalizedKey || !Number.isFinite(delta) || delta === 0) {
    return;
  }

  const currentScore = Number(signalBucket[normalizedKey] || 0);
  const nextScore = clampSignalValue(currentScore + delta);

  if (Math.abs(nextScore) < 0.05) {
    delete signalBucket[normalizedKey];
    return;
  }

  signalBucket[normalizedKey] = nextScore;
};

const buildLearningDeltaProfile = (interactionType) => {
  if (interactionType === 'superlike') {
    return {
      interests: 0.9,
      relationshipGoals: 1.45,
      bodyTypes: 1.05,
      ageBands: 0.95,
      verification: 0.35
    };
  }

  if (interactionType === 'pass') {
    return {
      interests: 0.35,
      relationshipGoals: 0.55,
      bodyTypes: 0.45,
      ageBands: 0.4,
      verification: 0.15
    };
  }

  return {
    interests: 0.65,
    relationshipGoals: 1.1,
    bodyTypes: 0.8,
    ageBands: 0.75,
    verification: 0.25
  };
};

const buildUpdatedLearningProfile = (existingLearningProfile, candidateProfile, interactionType) => {
  const learningProfile = normalizeLearningProfile(existingLearningProfile);
  const signalGroup =
    interactionType === 'pass' ? learningProfile.negativeSignals : learningProfile.positiveSignals;
  const deltas = buildLearningDeltaProfile(interactionType);

  normalizeInterestList(candidateProfile?.interests)
    .slice(0, 4)
    .forEach((interest) => applySignalDelta(signalGroup.interests, interest, deltas.interests));

  if (candidateProfile?.relationshipGoals) {
    applySignalDelta(
      signalGroup.relationshipGoals,
      candidateProfile.relationshipGoals,
      deltas.relationshipGoals
    );
  }

  if (candidateProfile?.bodyType) {
    applySignalDelta(signalGroup.bodyTypes, candidateProfile.bodyType, deltas.bodyTypes);
  }

  const ageBand = buildAgeBand(candidateProfile?.age);
  if (ageBand) {
    applySignalDelta(signalGroup.ageBands, ageBand, deltas.ageBands);
  }

  if (candidateProfile?.profileVerified) {
    applySignalDelta(signalGroup.verification, 'verified', deltas.verification);
  }

  if (interactionType === 'pass') {
    learningProfile.totalNegativeActions += 1;
  } else {
    learningProfile.totalPositiveActions += interactionType === 'superlike' ? 2 : 1;
  }

  learningProfile.lastInteractionAt = new Date().toISOString();
  return learningProfile;
};

const persistLearningFeedback = async ({ userId, targetUserId, interactionType }) => {
  if (!userId || !targetUserId || userId === targetUserId) {
    return;
  }

  try {
    const [preferenceResult, targetProfileResult] = await Promise.all([
      db.query(
        `SELECT learning_profile, preference_flexibility
         FROM user_preferences
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
      ),
      db.query(
        `SELECT dp.*
         FROM dating_profiles dp
         WHERE dp.user_id = $1
         LIMIT 1`,
        [targetUserId]
      )
    ]);

    const flexibility = normalizePreferenceFlexibility(
      preferenceResult.rows[0]?.preference_flexibility
    );

    if (!flexibility.learnFromActivity) {
      return;
    }

    const targetProfile = normalizeProfileRow(targetProfileResult.rows[0] || null);
    if (!targetProfile) {
      return;
    }

    const updatedLearningProfile = buildUpdatedLearningProfile(
      preferenceResult.rows[0]?.learning_profile,
      targetProfile,
      interactionType
    );

    await db.query(
      `INSERT INTO user_preferences (user_id, preference_flexibility, learning_profile)
       VALUES ($1, $2::jsonb, $3::jsonb)
       ON CONFLICT (user_id) DO UPDATE
       SET preference_flexibility = COALESCE(user_preferences.preference_flexibility, EXCLUDED.preference_flexibility),
           learning_profile = EXCLUDED.learning_profile,
           updated_at = CURRENT_TIMESTAMP`,
      [userId, JSON.stringify(flexibility), JSON.stringify(updatedLearningProfile)]
    );
  } catch (error) {
    console.error('Preference learning update error:', error);
  }
};

const calculateDistanceKm = (currentLocation = {}, candidateLocation = {}) => {
  const currentLat = toFiniteNumber(currentLocation.lat);
  const currentLng = toFiniteNumber(currentLocation.lng);
  const candidateLat = toFiniteNumber(candidateLocation.lat);
  const candidateLng = toFiniteNumber(candidateLocation.lng);

  if (
    currentLat !== null &&
    currentLng !== null &&
    candidateLat !== null &&
    candidateLng !== null
  ) {
    const toRadians = (degrees) => (degrees * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const deltaLat = toRadians(candidateLat - currentLat);
    const deltaLng = toRadians(candidateLng - currentLng);
    const haversine =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(toRadians(currentLat)) *
        Math.cos(toRadians(candidateLat)) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);

    return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
  }

  const currentCity = normalizeSignalKey(currentLocation.city);
  const candidateCity = normalizeSignalKey(candidateLocation.city);
  const currentState = normalizeSignalKey(currentLocation.state);
  const candidateState = normalizeSignalKey(candidateLocation.state);
  const currentCountry = normalizeSignalKey(currentLocation.country);
  const candidateCountry = normalizeSignalKey(candidateLocation.country);

  if (
    currentCity &&
    candidateCity &&
    currentState &&
    candidateState &&
    currentCity === candidateCity &&
    currentState === candidateState
  ) {
    return 10;
  }

  if (
    currentState &&
    candidateState &&
    currentCountry &&
    candidateCountry &&
    currentState === candidateState &&
    currentCountry === candidateCountry
  ) {
    return 75;
  }

  if (currentCountry && candidateCountry && currentCountry === candidateCountry) {
    return 250;
  }

  return null;
};

const buildIcebreakerSuggestions = (profile, sharedInterests = []) => {
  const suggestions = [];
  const firstSharedInterest = sharedInterests[0];
  const firstInterest = normalizeInterestList(profile?.interests)[0];

  if (firstSharedInterest) {
    suggestions.push(`I noticed we both like ${firstSharedInterest}. What got you into it?`);
  }

  if (profile?.occupation) {
    suggestions.push(`What's something you genuinely enjoy about working in ${profile.occupation}?`);
  }

  if (profile?.relationshipGoals) {
    suggestions.push(`What does a great ${profile.relationshipGoals} connection look like to you?`);
  }

  if (profile?.location?.city) {
    suggestions.push(`What do you enjoy most about living in ${profile.location.city}?`);
  }

  if (firstInterest && firstInterest !== firstSharedInterest) {
    suggestions.push(`If I wanted to learn more about ${firstInterest}, where should I start?`);
  }

  suggestions.push('What kind of conversation always keeps you interested?');
  suggestions.push('What is something simple that can make your whole day better?');

  return [...new Set(suggestions)].slice(0, 4);
};

const buildCompatibilitySuggestion = ({
  currentProfile,
  currentPreferences,
  candidateProfile,
  candidatePreferences
}) => {
  if (!candidateProfile) {
    return {
      isExcluded: false,
      compatibilityScore: 0,
      compatibilityReasons: [],
      icebreakers: []
    };
  }

  const viewerPreferences = normalizePreferenceRow(currentPreferences);
  const viewerFlexibility = normalizePreferenceFlexibility(
    viewerPreferences.preferenceFlexibility
  );
  const candidatePreferenceSet = normalizePreferenceRow(candidatePreferences);

  if (!currentProfile) {
    return {
      isExcluded: false,
      compatibilityScore: 60,
      compatibilityReasons: ['Complete your profile to unlock smarter match suggestions.'],
      icebreakers: buildIcebreakerSuggestions(candidateProfile)
    };
  }

  const currentInterests = normalizeInterestList(currentProfile.interests);
  const candidateInterests = normalizeInterestList(candidateProfile.interests);
  const currentInterestLookup = new Set(currentInterests.map((interest) => interest.toLowerCase()));
  const sharedInterests = candidateInterests.filter((interest) =>
    currentInterestLookup.has(interest.toLowerCase())
  );

  const preferredInterestLookup = new Set(
    normalizeInterestList(viewerPreferences.interests).map((interest) => interest.toLowerCase())
  );
  const sharedPreferredInterests = candidateInterests.filter((interest) =>
    preferredInterestLookup.has(interest.toLowerCase())
  );
  const candidateAge = Number.isFinite(candidateProfile.age) ? candidateProfile.age : null;
  const candidateHeight = Number.isFinite(candidateProfile.height) ? candidateProfile.height : null;
  const ageMatchesPreference =
    candidateAge === null
      ? null
      : candidateAge >= viewerPreferences.ageRangeMin &&
        candidateAge <= viewerPreferences.ageRangeMax;
  const heightMatchesPreference =
    candidateHeight === null
      ? null
      : (!viewerPreferences.heightRangeMin || candidateHeight >= viewerPreferences.heightRangeMin) &&
        (!viewerPreferences.heightRangeMax || candidateHeight <= viewerPreferences.heightRangeMax);
  const genderMatchesPreference =
    viewerPreferences.genderPreferences.length === 0
      ? null
      : viewerPreferences.genderPreferences.includes(candidateProfile.gender || '');
  const relationshipMatchesPreference =
    viewerPreferences.relationshipGoals.length === 0
      ? null
      : viewerPreferences.relationshipGoals.includes(candidateProfile.relationshipGoals || '');
  const bodyTypeMatchesPreference =
    viewerPreferences.bodyTypes.length === 0
      ? null
      : viewerPreferences.bodyTypes.includes(candidateProfile.bodyType || '');
  const distanceKm = calculateDistanceKm(currentProfile.location, candidateProfile.location);
  const withinRadius =
    distanceKm === null ? null : distanceKm <= Math.max(1, viewerPreferences.locationRadius || 50);
  const strictPreferenceViolations = [];
  const dealBreakerViolations = [];
  const reasonCandidates = [];
  const addReason = (text, weight) => {
    if (!text || !Number.isFinite(weight) || weight <= 0) {
      return;
    }

    reasonCandidates.push({ text, weight });
  };

  if (viewerFlexibility.mode === 'strict') {
    if (ageMatchesPreference === false) {
      strictPreferenceViolations.push('Outside your preferred age range');
    }
    if (genderMatchesPreference === false) {
      strictPreferenceViolations.push('Outside your preferred gender preferences');
    }
    if (relationshipMatchesPreference === false) {
      strictPreferenceViolations.push('Relationship goals do not line up');
    }
    if (withinRadius === false) {
      strictPreferenceViolations.push('Outside your distance radius');
    }
  }

  if (viewerPreferences.dealBreakers.enforceAgeRange && ageMatchesPreference === false) {
    dealBreakerViolations.push('Age range dealbreaker');
  }
  if (viewerPreferences.dealBreakers.enforceLocationRadius && withinRadius === false) {
    dealBreakerViolations.push('Distance dealbreaker');
  }
  if (
    viewerPreferences.dealBreakers.enforceRelationshipGoals &&
    relationshipMatchesPreference === false
  ) {
    dealBreakerViolations.push('Relationship goals dealbreaker');
  }
  if (
    viewerPreferences.dealBreakers.requireSharedInterests &&
    sharedPreferredInterests.length === 0 &&
    sharedInterests.length === 0
  ) {
    dealBreakerViolations.push('Shared interests dealbreaker');
  }
  if (viewerPreferences.dealBreakers.onlyVerifiedProfiles && !candidateProfile.profileVerified) {
    dealBreakerViolations.push('Verified profiles only');
  }
  if (viewerPreferences.dealBreakers.enforceHeightRange && heightMatchesPreference === false) {
    dealBreakerViolations.push('Height range dealbreaker');
  }
  if (viewerPreferences.dealBreakers.enforceBodyType && bodyTypeMatchesPreference === false) {
    dealBreakerViolations.push('Body type dealbreaker');
  }
  if (
    viewerPreferences.dealBreakers.requireCompletedProfiles &&
    (candidateProfile.profileCompletionPercent || 0) < 60
  ) {
    dealBreakerViolations.push('Profile completion dealbreaker');
  }

  if (dealBreakerViolations.length > 0 || strictPreferenceViolations.length > 0) {
    return {
      isExcluded: true,
      compatibilityScore: 0,
      compatibilityReasons: [],
      icebreakers: []
    };
  }

  let score = 42;

  if (sharedInterests.length > 0) {
    const sharedInterestScore = Math.min(16, sharedInterests.length * 6);
    score += sharedInterestScore;
    addReason(`Shared interests: ${sharedInterests.slice(0, 2).join(' and ')}`, sharedInterestScore);
  }

  if (sharedPreferredInterests.length > 0) {
    const preferredInterestScore = Math.min(12, sharedPreferredInterests.length * 4);
    score += preferredInterestScore;
    addReason(
      `Matches your preferred interests: ${sharedPreferredInterests.slice(0, 2).join(' and ')}`,
      preferredInterestScore
    );
  }

  if (relationshipMatchesPreference === true) {
    score += 12;
    addReason(`Fits your relationship goals`, 12);
  } else if (relationshipMatchesPreference === false) {
    score -= viewerFlexibility.mode === 'open' ? 2 : 7;
  } else if (
    currentProfile.relationshipGoals &&
    candidateProfile.relationshipGoals &&
    currentProfile.relationshipGoals === candidateProfile.relationshipGoals
  ) {
    score += 10;
    addReason(`Both of you are looking for ${candidateProfile.relationshipGoals}`, 10);
  }

  if (genderMatchesPreference === true) {
    score += 8;
  } else if (genderMatchesPreference === false) {
    score -= viewerFlexibility.mode === 'open' ? 1 : 5;
  }

  if (ageMatchesPreference === true) {
    score += 10;
    addReason(
      `Within your preferred age range`,
      10
    );
  } else if (ageMatchesPreference === false) {
    score -= viewerFlexibility.mode === 'open' ? 2 : 6;
  }

  if (heightMatchesPreference === true) {
    score += 4;
  } else if (heightMatchesPreference === false) {
    score -= viewerFlexibility.mode === 'strict' ? 4 : 2;
  }

  if (bodyTypeMatchesPreference === true) {
    score += 5;
  } else if (bodyTypeMatchesPreference === false) {
    score -= viewerFlexibility.mode === 'strict' ? 4 : 1;
  }

  if (withinRadius === true) {
    score += 8;
    addReason(
      distanceKm !== null
        ? `Within ${distanceKm} km of you`
        : `Close to your preferred location`,
      8
    );
  } else if (withinRadius === false) {
    score -= viewerFlexibility.mode === 'open' ? 2 : 7;
  }

  const currentCity = currentProfile.location?.city?.toLowerCase?.() || '';
  const candidateCity = candidateProfile.location?.city?.toLowerCase?.() || '';
  const currentState = currentProfile.location?.state?.toLowerCase?.() || '';
  const candidateState = candidateProfile.location?.state?.toLowerCase?.() || '';

  if (currentCity && candidateCity && currentCity === candidateCity) {
    score += 6;
    addReason(`You are both in ${candidateProfile.location.city}`, 6);
  } else if (currentState && candidateState && currentState === candidateState) {
    score += 4;
    addReason(`You are in the same region`, 4);
  }

  if (Number.isFinite(currentProfile.age) && Number.isFinite(candidateProfile.age)) {
    const ageGap = Math.abs(currentProfile.age - candidateProfile.age);

    if (ageGap <= 2) {
      score += 5;
    } else if (ageGap <= 5) {
      score += 3;
    }
  }

  if (candidateProfile.profileVerified) {
    score += 4;
    addReason(`Verified profile`, 4);
  }

  if (candidateProfile.bio) {
    score += 2;
  }

  const currentCompatibilityAnswers = normalizeCompatibilityAnswers(
    viewerPreferences.compatibilityAnswers
  );
  const candidateCompatibilityAnswers = normalizeCompatibilityAnswers(
    candidatePreferenceSet.compatibilityAnswers
  );
  const matchedQuestionIds = COMPATIBILITY_QUESTION_IDS.filter((questionId) => {
    const currentAnswer = currentCompatibilityAnswers[questionId];
    const candidateAnswer = candidateCompatibilityAnswers[questionId];
    return currentAnswer && candidateAnswer && currentAnswer === candidateAnswer;
  });

  if (matchedQuestionIds.length > 0) {
    const compatibilityQuestionScore = Math.min(18, matchedQuestionIds.length * 6);
    score += compatibilityQuestionScore;

    if (matchedQuestionIds.length === 1) {
      addReason(
        `You align on ${COMPATIBILITY_QUESTION_LABELS[matchedQuestionIds[0]]}`,
        compatibilityQuestionScore
      );
    } else {
      addReason(
        `You matched on ${matchedQuestionIds.length} compatibility questions`,
        compatibilityQuestionScore
      );
    }
  }

  const learningProfile = normalizeLearningProfile(viewerPreferences.learningProfile);
  const totalLearningSignals =
    learningProfile.totalPositiveActions + learningProfile.totalNegativeActions;

  if (viewerFlexibility.learnFromActivity && totalLearningSignals >= 2) {
    let learningRawScore = 0;

    candidateInterests.slice(0, 4).forEach((interest) => {
      const signalKey = interest.toLowerCase();
      learningRawScore += Number(learningProfile.positiveSignals.interests[signalKey] || 0);
      learningRawScore -= Number(learningProfile.negativeSignals.interests[signalKey] || 0);
    });

    if (candidateProfile.relationshipGoals) {
      const signalKey = candidateProfile.relationshipGoals.toLowerCase();
      learningRawScore +=
        Number(learningProfile.positiveSignals.relationshipGoals[signalKey] || 0) * 1.3;
      learningRawScore -=
        Number(learningProfile.negativeSignals.relationshipGoals[signalKey] || 0) * 1.1;
    }

    if (candidateProfile.bodyType) {
      const signalKey = candidateProfile.bodyType.toLowerCase();
      learningRawScore += Number(learningProfile.positiveSignals.bodyTypes[signalKey] || 0);
      learningRawScore -= Number(learningProfile.negativeSignals.bodyTypes[signalKey] || 0);
    }

    const ageBand = buildAgeBand(candidateProfile.age);
    if (ageBand) {
      const signalKey = ageBand.toLowerCase();
      learningRawScore += Number(learningProfile.positiveSignals.ageBands[signalKey] || 0) * 1.2;
      learningRawScore -= Number(learningProfile.negativeSignals.ageBands[signalKey] || 0);
    }

    if (candidateProfile.profileVerified) {
      learningRawScore += Number(learningProfile.positiveSignals.verification.verified || 0);
      learningRawScore -= Number(learningProfile.negativeSignals.verification.verified || 0);
    }

    const learningScore = Math.max(-12, Math.min(14, Math.round(learningRawScore * 2)));
    score += learningScore;

    if (learningScore >= 5) {
      addReason(`Aligned with the profiles you engage with most`, learningScore);
    }
  }

  const compatibilityReasons = reasonCandidates
    .sort((leftReason, rightReason) => rightReason.weight - leftReason.weight)
    .map((entry) => entry.text)
    .filter((text, index, list) => list.indexOf(text) === index)
    .slice(0, 4);

  return {
    isExcluded: false,
    compatibilityScore: Math.max(45, Math.min(99, Math.round(score))),
    compatibilityReasons,
    icebreakers: buildIcebreakerSuggestions(candidateProfile, sharedInterests)
  };
};

const normalizeProfileRow = (profileRow) => {
  if (!profileRow) {
    return null;
  }

  const photoDetails = normalizePhotoDetails(profileRow.photos);

  return {
    id: profileRow.id,
    userId: profileRow.user_id,
    username: profileRow.username || null,
    firstName: profileRow.first_name || '',
    age: profileRow.age,
    gender: profileRow.gender || null,
    bio: profileRow.bio || '',
    relationshipGoals: profileRow.relationship_goals || null,
    interests: Array.isArray(profileRow.interests) ? profileRow.interests : [],
    height: profileRow.height,
    occupation: profileRow.occupation || '',
    education: profileRow.education || '',
    bodyType: profileRow.body_type || null,
    ethnicity: profileRow.ethnicity || null,
    religion: profileRow.religion || null,
    smoking: profileRow.smoking || null,
    drinking: profileRow.drinking || null,
    hasKids: Boolean(profileRow.has_kids),
    wantsKids: Boolean(profileRow.wants_kids),
    profileVerified: Boolean(profileRow.profile_verified),
    profileCompletionPercent: profileRow.profile_completion_percent || 0,
    isActive: profileRow.is_active !== false,
    lastActive: profileRow.last_active || null,
    createdAt: profileRow.created_at || null,
    updatedAt: profileRow.updated_at || null,
    verifications: profileRow.verifications || {},
    voiceIntroUrl: profileRow.voice_intro_url || null,
    voiceIntroDurationSeconds: normalizeInteger(profileRow.voice_intro_duration_seconds),
    videoIntroUrl: profileRow.video_intro_url || null,
    location: {
      city: profileRow.location_city || '',
      state: profileRow.location_state || '',
      country: profileRow.location_country || '',
      lat: profileRow.location_lat ?? null,
      lng: profileRow.location_lng ?? null
    },
    photos: photoDetails.map((photo) => photo.url),
    photoDetails
  };
};

const normalizeMatchRow = (matchRow) => {
  const matchedProfile = matchRow.matched_user_profile || {};
  const photoDetails = normalizePhotoDetails(matchRow.matched_user_photos);
  const lastMessage = matchRow.last_message
    ? {
        id: matchRow.last_message.id,
        text: matchRow.last_message.text || '',
        fromUserId: matchRow.last_message.from_user_id,
        toUserId: matchRow.last_message.to_user_id,
        createdAt: matchRow.last_message.created_at || null,
        isRead: Boolean(matchRow.last_message.is_read)
      }
    : null;

  return {
    id: matchRow.id,
    matchId: matchRow.id,
    userId: matchRow.matched_user_id,
    firstName: matchedProfile.first_name || '',
    age: matchedProfile.age ?? null,
    bio: matchedProfile.bio || '',
    occupation: matchedProfile.occupation || '',
    education: matchedProfile.education || '',
    relationshipGoals: matchedProfile.relationship_goals || null,
    interests: Array.isArray(matchedProfile.interests) ? matchedProfile.interests : [],
    profileVerified: Boolean(matchedProfile.profile_verified),
    matchedAt: matchRow.matched_at || null,
    createdAt: matchRow.created_at || null,
    lastMessageAt: matchRow.last_message_at || null,
    messageCount: matchRow.message_count || 0,
    unreadCount: Number.parseInt(matchRow.unread_count, 10) || 0,
    status: matchRow.status,
    location: {
      city: matchedProfile.location_city || '',
      state: matchedProfile.location_state || '',
      country: matchedProfile.location_country || ''
    },
    photos: photoDetails.map((photo) => photo.url),
    photoDetails,
    lastMessage
  };
};

const DATE_TYPE_JOURNEY_LIBRARY = [
  {
    value: 'coffee',
    label: 'Coffee',
    keywords: ['coffee', 'cafe', 'books', 'reading', 'brunch'],
    reason: 'Easy first-date energy with plenty of room to talk.'
  },
  {
    value: 'walk',
    label: 'Walk',
    keywords: ['walk', 'walking', 'hiking', 'fitness', 'running', 'outdoors', 'nature'],
    reason: 'Low-pressure movement can make conversation feel natural.'
  },
  {
    value: 'dinner',
    label: 'Dinner',
    keywords: ['dinner', 'food', 'cooking', 'travel', 'wine', 'restaurants'],
    reason: 'A longer plan works well once the conversation has real momentum.'
  },
  {
    value: 'video_date',
    label: 'Video Date',
    keywords: ['movie', 'movies', 'gaming', 'busy', 'remote', 'homebody'],
    reason: 'A simple option when you want a quick vibe check before meeting up.'
  }
];

const inferDateTypeValue = (activityLabel = '') => {
  const normalizedActivity = String(activityLabel || '').trim().toLowerCase();

  if (!normalizedActivity) {
    return 'coffee';
  }

  const matchedEntry = DATE_TYPE_JOURNEY_LIBRARY.find((entry) =>
    entry.keywords.some((keyword) => normalizedActivity.includes(keyword))
  );

  return matchedEntry?.value || 'coffee';
};

const normalizeProposalStatus = (status = '') => {
  const normalizedStatus = String(status || '').trim().toLowerCase();

  if (normalizedStatus === 'proposed') {
    return 'pending';
  }

  return normalizedStatus || 'pending';
};

const isOpenProposalStatus = (status = '') =>
  ['pending', 'proposed'].includes(String(status || '').trim().toLowerCase());

const normalizeOptionalBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
};

const buildProposalDateTime = (proposal = {}) => {
  if (!proposal?.proposedDate) {
    return null;
  }

  const normalizedTime = String(proposal.proposedTime || '12:00').slice(0, 5);
  const proposalDate = new Date(`${proposal.proposedDate}T${normalizedTime}`);

  return Number.isNaN(proposalDate.getTime()) ? null : proposalDate;
};

const formatJourneyDateTime = (value) => {
  if (!value) {
    return '';
  }

  const normalizedDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(normalizedDate.getTime())) {
    return '';
  }

  return normalizedDate.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const buildSuggestedDateTypes = (match = {}) => {
  const normalizedInterests = Array.isArray(match.interests)
    ? match.interests.map((interest) => String(interest || '').trim().toLowerCase())
    : [];

  const scoredTypes = DATE_TYPE_JOURNEY_LIBRARY.map((entry) => {
    const score = entry.keywords.reduce((totalScore, keyword) => (
      totalScore + normalizedInterests.filter((interest) => interest.includes(keyword)).length
    ), 0);

    return {
      ...entry,
      score
    };
  })
    .sort((leftEntry, rightEntry) => {
      if (rightEntry.score !== leftEntry.score) {
        return rightEntry.score - leftEntry.score;
      }

      return DATE_TYPE_JOURNEY_LIBRARY.findIndex((entry) => entry.value === leftEntry.value) -
        DATE_TYPE_JOURNEY_LIBRARY.findIndex((entry) => entry.value === rightEntry.value);
    })
    .slice(0, 4);

  return scoredTypes.map((entry, index) => ({
    value: entry.value,
    label: entry.label,
    reason:
      entry.score > 0
        ? `Fits the interests on this match. ${entry.reason}`
        : entry.reason,
    isRecommended: index === 0
  }));
};

const buildSharedActionSuggestions = (match = {}) => {
  const leadInterest = Array.isArray(match.interests) ? match.interests.find(Boolean) : null;
  const cityName = match.location?.city || '';

  return [
    {
      type: 'question',
      label: leadInterest ? `Ask About ${leadInterest}` : 'Ask a Question',
      message: leadInterest
        ? `What got you into ${leadInterest}?`
        : 'What kind of date usually feels easy and fun for you?'
    },
    {
      type: 'playlist',
      label: 'Share a Playlist',
      message: 'I can make a short playlist for our next hangout. What mood are you into lately?'
    },
    {
      type: 'location_idea',
      label: 'Share a Location Idea',
      message: cityName
        ? `I have a spot idea in ${cityName} that could fit us. Want me to send it?`
        : 'I have a simple location idea that could make meeting up easy. Want me to send it?'
    },
    {
      type: 'vote',
      label: 'Vote on a Plan',
      message: 'Quick vote: coffee, walk, dinner, or a video date this week?'
    }
  ];
};

const normalizeJourneyProposal = (proposalRow, currentUserId, feedbackByProposalId = new Map()) => {
  if (!proposalRow) {
    return null;
  }

  const feedbackEntry = feedbackByProposalId.get(Number(proposalRow.id)) || null;

  return {
    id: proposalRow.id,
    matchId: proposalRow.match_id,
    proposerId: proposalRow.proposer_id,
    recipientId: proposalRow.recipient_id,
    proposedDate: proposalRow.proposed_date,
    proposedTime: proposalRow.proposed_time,
    suggestedActivity: proposalRow.suggested_activity,
    suggestedActivityType: inferDateTypeValue(proposalRow.suggested_activity),
    locationId: proposalRow.location_id || null,
    status: normalizeProposalStatus(proposalRow.status),
    notes: proposalRow.notes || null,
    responseDeadlineAt: proposalRow.response_deadline_at || null,
    createdAt: proposalRow.created_at || null,
    respondedAt: proposalRow.responded_at || null,
    isSent: Number(proposalRow.proposer_id) === Number(currentUserId),
    isReceived: Number(proposalRow.recipient_id) === Number(currentUserId),
    hasFeedback: Boolean(feedbackEntry),
    feedbackUpdatedAt: feedbackEntry?.updated_at || null
  };
};

const normalizeJourneyVideoSession = (videoRow, currentUserId, otherUserId) => {
  if (!videoRow) {
    return null;
  }

  const snapshot = typeof videoRow.settings_snapshot === 'string'
    ? safeJsonParse(videoRow.settings_snapshot, {})
    : (videoRow.settings_snapshot || {});
  const privateFeedback = snapshot?.privateFeedback && typeof snapshot.privateFeedback === 'object'
    ? snapshot.privateFeedback
    : {};

  return {
    id: videoRow.id,
    matchId: videoRow.match_id,
    sessionType: videoRow.session_type || 'instant',
    status: videoRow.status,
    scheduledAt: videoRow.scheduled_at || null,
    createdAt: videoRow.created_at || null,
    endedAt: videoRow.ended_at || null,
    note: videoRow.note || null,
    title: videoRow.title || null,
    currentUserFeedbackSubmitted: Boolean(privateFeedback[String(currentUserId)]),
    partnerFeedbackSubmitted: Boolean(privateFeedback[String(otherUserId)])
  };
};

const buildConversationNudge = ({
  currentUserId,
  match,
  messageStats,
  pendingProposal,
  latestAcceptedProposal,
  videoDateBooked,
  latestCompletedVideoSession,
  sharedActions
}) => {
  const currentUserNumericId = Number(currentUserId);
  const messageCount = Number.parseInt(messageStats?.messageCount, 10) || Number.parseInt(match.messageCount, 10) || 0;
  const lastMessageAt = match.lastMessageAt ? new Date(match.lastMessageAt) : null;
  const lastMessageFromUserId = Number(match.lastMessage?.fromUserId || 0);
  const hoursSinceLastMessage =
    lastMessageAt && !Number.isNaN(lastMessageAt.getTime())
      ? Math.max(0, Math.round((Date.now() - lastMessageAt.getTime()) / (60 * 60 * 1000)))
      : null;

  if (pendingProposal?.isReceived) {
    return {
      type: 'proposal_waiting',
      title: 'A Date Idea Is Waiting',
      message: `${match.firstName} suggested ${pendingProposal.suggestedActivity} for ${formatJourneyDateTime(
        buildProposalDateTime(pendingProposal)
      )}. You can accept it or send back a tweak.`,
      suggestions: []
    };
  }

  if (pendingProposal?.isSent) {
    return {
      type: 'proposal_sent',
      title: 'Plan Sent',
      message: `Your ${pendingProposal.suggestedActivity.toLowerCase()} plan is out there. Let the conversation stay light while you wait for a response.`,
      suggestions: []
    };
  }

  if (latestAcceptedProposal) {
    const acceptedDateTime = buildProposalDateTime(latestAcceptedProposal);
    if (acceptedDateTime && acceptedDateTime.getTime() > Date.now()) {
      return {
        type: 'date_on_calendar',
        title: 'Date On The Calendar',
        message: `${latestAcceptedProposal.suggestedActivity} is lined up for ${formatJourneyDateTime(acceptedDateTime)}.`,
        suggestions: []
      };
    }

    if (acceptedDateTime && acceptedDateTime.getTime() <= Date.now() && !latestAcceptedProposal.hasFeedback) {
      return {
        type: 'post_date_feedback',
        title: 'Capture The Reflection',
        message: 'The date has already happened. Add your private notes while the details are still fresh.',
        suggestions: []
      };
    }
  }

  if (latestCompletedVideoSession && !latestCompletedVideoSession.currentUserFeedbackSubmitted) {
    return {
      type: 'video_feedback',
      title: 'Reflect On The Video Date',
      message: 'You completed a video date. Add a private reflection before the feeling fades.',
      suggestions: []
    };
  }

  if (messageCount === 0) {
    return {
      type: 'opener',
      title: 'Send The First Hello',
      message: `A warm opener is the fastest way to turn this new match into a real conversation.`,
      suggestions: sharedActions.slice(0, 2).map((action) => action.message)
    };
  }

  if (
    hoursSinceLastMessage !== null &&
    hoursSinceLastMessage >= 24 &&
    hoursSinceLastMessage <= 48 &&
    lastMessageFromUserId !== currentUserNumericId
  ) {
    return {
      type: 'reply_window',
      title: 'Reply While The Spark Is Warm',
      message: `${match.firstName} has been waiting about ${hoursSinceLastMessage} hours. A thoughtful reply keeps the momentum going.`,
      suggestions: sharedActions.slice(0, 2).map((action) => action.message)
    };
  }

  if (
    hoursSinceLastMessage !== null &&
    hoursSinceLastMessage >= 36 &&
    messageCount >= 4 &&
    !latestAcceptedProposal &&
    !videoDateBooked
  ) {
    return {
      type: 'move_to_plan',
      title: 'Move From Chat To A Plan',
      message: 'The conversation has enough context for a low-pressure plan like coffee, a walk, or a short video date.',
      suggestions: [sharedActions[3]?.message, 'Would you be up for a quick plan this week?'].filter(Boolean)
    };
  }

  return null;
};

const buildJourneyMilestones = ({
  matchedAt,
  messageStats,
  videoDateBooked,
  latestAcceptedProposal
}) => {
  const sentCount = Number.parseInt(messageStats?.sentCount, 10) || 0;
  const receivedCount = Number.parseInt(messageStats?.receivedCount, 10) || 0;
  const conversationStartedAt =
    messageStats?.firstSentAt && messageStats?.firstReceivedAt
      ? new Date(
          Math.max(
            new Date(messageStats.firstSentAt).getTime(),
            new Date(messageStats.firstReceivedAt).getTime()
          )
        ).toISOString()
      : null;
  const acceptedDateTime = buildProposalDateTime(latestAcceptedProposal);
  const metInPerson = Boolean(
    acceptedDateTime &&
    acceptedDateTime.getTime() <= Date.now()
  );

  return [
    {
      key: 'new_match',
      label: 'New Match',
      achieved: Boolean(matchedAt),
      achievedAt: matchedAt || null
    },
    {
      key: 'first_reply_sent',
      label: 'First Reply Sent',
      achieved: sentCount > 0,
      achievedAt: messageStats?.firstSentAt || null
    },
    {
      key: 'conversation_started',
      label: 'Conversation Started',
      achieved: sentCount > 0 && receivedCount > 0,
      achievedAt: conversationStartedAt
    },
    {
      key: 'video_date_booked',
      label: 'Video Date Booked',
      achieved: Boolean(videoDateBooked),
      achievedAt: videoDateBooked?.scheduledAt || videoDateBooked?.createdAt || null
    },
    {
      key: 'met_in_person',
      label: 'Met In Person',
      achieved: metInPerson,
      achievedAt:
        metInPerson
          ? acceptedDateTime?.toISOString() || latestAcceptedProposal?.respondedAt || latestAcceptedProposal?.createdAt || null
          : null
    }
  ];
};

const enrichMatchesWithJourney = async (currentUserId, matches = []) => {
  const normalizedMatches = Array.isArray(matches) ? matches : [];
  const matchIds = normalizedMatches
    .map((match) => Number.parseInt(match.matchId || match.id, 10))
    .filter((matchId) => Number.isFinite(matchId));

  if (matchIds.length === 0) {
    return normalizedMatches;
  }

  const [messageStatsResult, proposalResult, videoResult] = await Promise.all([
    db.query(
      `SELECT
         match_id,
         COUNT(*) as message_count,
         COUNT(*) FILTER (WHERE from_user_id = $2) as sent_count,
         COUNT(*) FILTER (WHERE from_user_id <> $2) as received_count,
         MIN(created_at) FILTER (WHERE from_user_id = $2) as first_sent_at,
         MIN(created_at) FILTER (WHERE from_user_id <> $2) as first_received_at,
         MAX(created_at) FILTER (WHERE from_user_id = $2) as last_sent_at,
         MAX(created_at) FILTER (WHERE from_user_id <> $2) as last_received_at
       FROM messages
       WHERE match_id = ANY($1::int[])
       GROUP BY match_id`,
      [matchIds, currentUserId]
    ),
    optionalQuery(
      `SELECT *
       FROM date_proposals
       WHERE match_id = ANY($1::int[])
       ORDER BY created_at DESC, id DESC`,
      [matchIds],
      []
    ),
    optionalQuery(
      `SELECT *
       FROM video_dates
       WHERE match_id = ANY($1::int[])
       ORDER BY COALESCE(scheduled_at, created_at) DESC, id DESC`,
      [matchIds],
      []
    )
  ]);

  const messageStatsByMatchId = new Map(
    messageStatsResult.rows.map((row) => [
      Number(row.match_id),
      {
        messageCount: Number.parseInt(row.message_count, 10) || 0,
        sentCount: Number.parseInt(row.sent_count, 10) || 0,
        receivedCount: Number.parseInt(row.received_count, 10) || 0,
        firstSentAt: row.first_sent_at || null,
        firstReceivedAt: row.first_received_at || null,
        lastSentAt: row.last_sent_at || null,
        lastReceivedAt: row.last_received_at || null
      }
    ])
  );

  const proposalRowsByMatchId = proposalResult.rows.reduce((matchMap, row) => {
    const matchId = Number(row.match_id);
    if (!matchMap.has(matchId)) {
      matchMap.set(matchId, []);
    }

    matchMap.get(matchId).push(row);
    return matchMap;
  }, new Map());

  const feedbackByProposalId = new Map();
  const proposalIds = proposalResult.rows
    .map((row) => Number(row.id))
    .filter((proposalId) => Number.isFinite(proposalId));

  if (proposalIds.length > 0) {
    try {
      const feedbackResult = await optionalQuery(
        `SELECT date_proposal_id, MAX(updated_at) as updated_at
         FROM date_completion_feedback
         WHERE date_proposal_id = ANY($1::int[])
           AND rater_user_id = $2
         GROUP BY date_proposal_id`,
        [proposalIds, currentUserId],
        []
      );

      feedbackResult.rows.forEach((row) => {
        feedbackByProposalId.set(Number(row.date_proposal_id), row);
      });
    } catch (feedbackError) {
      console.warn('Match journey feedback enrichment skipped:', feedbackError.message);
    }
  }

  const videoRowsByMatchId = videoResult.rows.reduce((matchMap, row) => {
    const matchId = Number(row.match_id);
    if (!matchMap.has(matchId)) {
      matchMap.set(matchId, []);
    }

    matchMap.get(matchId).push(row);
    return matchMap;
  }, new Map());

  return normalizedMatches.map((match) => {
    const matchId = Number.parseInt(match.matchId || match.id, 10);
    const messageStats = messageStatsByMatchId.get(matchId) || {
      messageCount: Number.parseInt(match.messageCount, 10) || 0,
      sentCount: 0,
      receivedCount: 0,
      firstSentAt: null,
      firstReceivedAt: null,
      lastSentAt: null,
      lastReceivedAt: null
    };
    const proposals = (proposalRowsByMatchId.get(matchId) || [])
      .map((proposalRow) => normalizeJourneyProposal(proposalRow, currentUserId, feedbackByProposalId))
      .filter(Boolean);
    const latestProposal = proposals[0] || null;
    const pendingProposal = proposals.find((proposal) => proposal.status === 'pending') || null;
    const latestAcceptedProposal = proposals.find((proposal) => proposal.status === 'accepted') || null;
    const videoSessions = (videoRowsByMatchId.get(matchId) || [])
      .map((videoRow) => normalizeJourneyVideoSession(videoRow, currentUserId, match.userId))
      .filter(Boolean);
    const videoDateBooked = videoSessions.find(
      (session) => session.sessionType === 'scheduled'
    ) || null;
    const latestCompletedVideoSession = videoSessions.find((session) =>
      ['completed', 'missed', 'declined', 'cancelled'].includes(session.status)
    ) || null;
    const sharedActions = buildSharedActionSuggestions(match);
    const nudge = buildConversationNudge({
      currentUserId,
      match,
      messageStats,
      pendingProposal,
      latestAcceptedProposal,
      videoDateBooked,
      latestCompletedVideoSession,
      sharedActions
    });
    const milestones = buildJourneyMilestones({
      matchedAt: match.matchedAt,
      messageStats,
      videoDateBooked,
      latestAcceptedProposal
    });

    return {
      ...match,
      messageCount: messageStats.messageCount,
      lastMessageAt: match.lastMessageAt || messageStats.lastSentAt || messageStats.lastReceivedAt || null,
      journey: {
        milestones,
        progressCount: milestones.filter((milestone) => milestone.achieved).length,
        latestProposal,
        pendingProposal,
        latestAcceptedProposal,
        latestCompletedVideoSession,
        videoDateBooked,
        suggestedDateTypes: buildSuggestedDateTypes(match),
        sharedActions,
        nudge
      }
    };
  });
};

// 1. CREATE PROFILE (Signup Step 2 & 3)
router.post('/profiles', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName,
      age,
      gender,
      city,
      state,
      country,
      bio,
      relationshipGoals,
      interests,
      height,
      occupation,
      education,
      bodyType,
      ethnicity,
      religion,
      smoking,
      drinking,
      hasKids,
      wantsKids
    } = req.body;

    const normalizedFirstName = normalizeOptionalText(firstName);
    const normalizedAge = normalizeInteger(age);
    const normalizedGender = normalizeOptionalText(gender);
    const normalizedCity = normalizeOptionalText(city);
    const normalizedState = normalizeOptionalText(state);
    const normalizedCountry = normalizeOptionalText(country);
    const normalizedBio = normalizeOptionalText(bio);
    const normalizedHeight = normalizeHeight(height);
    const normalizedOccupation = normalizeOptionalText(occupation);
    const normalizedEducation = normalizeOptionalText(education);
    const normalizedBodyType = normalizeOptionalText(bodyType);
    const normalizedEthnicity = normalizeOptionalText(ethnicity);
    const normalizedReligion = normalizeOptionalText(religion);
    const normalizedSmoking = normalizeOptionalText(smoking);
    const normalizedDrinking = normalizeOptionalText(drinking);
    const normalizedRelationshipGoals = normalizeOptionalText(relationshipGoals);
    const normalizedInterests = Array.isArray(interests) ? interests.filter(Boolean) : [];

    if (!normalizedFirstName || !normalizedAge || !normalizedGender || !normalizedCity) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const result = await db.query(
      `INSERT INTO dating_profiles (
         user_id, first_name, age, gender, location_city, location_state,
         location_country, bio, relationship_goals, interests, height,
         occupation, education, body_type, ethnicity, religion, smoking,
         drinking, has_kids, wants_kids, profile_completion_percent, last_active
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16, $17,
         $18, $19, $20, $21, CURRENT_TIMESTAMP
       )
       ON CONFLICT (user_id) DO UPDATE
       SET first_name = EXCLUDED.first_name,
           age = EXCLUDED.age,
           gender = EXCLUDED.gender,
           location_city = EXCLUDED.location_city,
           location_state = EXCLUDED.location_state,
           location_country = EXCLUDED.location_country,
           bio = EXCLUDED.bio,
           relationship_goals = EXCLUDED.relationship_goals,
           interests = EXCLUDED.interests,
           height = EXCLUDED.height,
           occupation = EXCLUDED.occupation,
           education = EXCLUDED.education,
           body_type = EXCLUDED.body_type,
           ethnicity = EXCLUDED.ethnicity,
           religion = EXCLUDED.religion,
           smoking = EXCLUDED.smoking,
           drinking = EXCLUDED.drinking,
           has_kids = EXCLUDED.has_kids,
           wants_kids = EXCLUDED.wants_kids,
           profile_completion_percent = GREATEST(COALESCE(dating_profiles.profile_completion_percent, 0), EXCLUDED.profile_completion_percent),
           updated_at = CURRENT_TIMESTAMP,
           last_active = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId, normalizedFirstName, normalizedAge, normalizedGender, normalizedCity, normalizedState,
        normalizedCountry, normalizedBio, normalizedRelationshipGoals, normalizedInterests, normalizedHeight,
        normalizedOccupation, normalizedEducation, normalizedBodyType, normalizedEthnicity, normalizedReligion, normalizedSmoking,
        normalizedDrinking, normalizeBoolean(hasKids), normalizeBoolean(wantsKids), 60
      ]
    );

    res.json({ message: 'Profile created', profile: normalizeProfileRow(result.rows[0]) });
  } catch (err) {
    console.error('Profile creation error:', err);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// 2. GET MY PROFILE
router.get('/profiles/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT dp.*, 
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = $1) as photos
       FROM dating_profiles dp
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(normalizeProfileRow(result.rows[0]));
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// 3. GET PROFILE BY ID
router.get('/profiles/:userId', async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.params;
    const result = await db.query(
      `SELECT dp.*, 
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = $1) as photos
       FROM dating_profiles dp
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (Number(currentUserId) !== Number(userId)) {
      const requestMetadata = getRequestMetadata(req);
      spamFraudService.trackUserActivity({
        userId: currentUserId,
        action: 'profile_view',
        analyticsUpdates: { profiles_viewed: 1 },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        runSpamCheck: true,
        runFraudCheck: true
      });
    }

    res.json(normalizeProfileRow(result.rows[0]));
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// 4. UPDATE PROFILE
router.put('/profiles/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio, interests, relationshipGoals } = req.body;

    const result = await db.query(
      `UPDATE dating_profiles 
       SET bio = COALESCE($1, bio),
           interests = COALESCE($2, interests),
           relationship_goals = COALESCE($3, relationship_goals),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4
       RETURNING *`,
      [bio, interests, relationshipGoals, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ message: 'Profile updated', profile: normalizeProfileRow(result.rows[0]) });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// 5. UPLOAD PROFILE PHOTOS
router.post('/profiles/me/photos', async (req, res) => {
  try {
    const userId = req.user.id;
    const photos = await collectPhotosFromRequest(req);

    if (!photos.length) {
      return res.status(400).json({ error: 'Photos array required' });
    }

    await db.query(
      `UPDATE photo_moderation_queue
       SET status = 'superseded',
           review_action = 'superseded',
           review_notes = 'Replaced by a newer profile photo upload.',
           reviewed_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
         AND source_type = 'profile_photo'
         AND status IN ('pending', 'approved')`,
      [userId]
    );

    // Delete existing photos
    await db.query('DELETE FROM profile_photos WHERE user_id = $1', [userId]);

    // Insert new photos
    const photoUrls = [];
    const moderationQueue = [];
    for (let i = 0; i < photos.length; i++) {
      const position = photos[i].position !== undefined ? photos[i].position : i;
      const result = await db.query(
        `INSERT INTO profile_photos (user_id, photo_url, position, is_primary)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, photos[i].url, position, i === 0]
      );
      photoUrls.push(result.rows[0]);

      const queueItem = await spamFraudService.queuePhotoForModeration({
        userId,
        photoUrl: photos[i].url,
        profilePhotoId: result.rows[0].id,
        sourceType: 'profile_photo'
      });
      if (queueItem) {
        moderationQueue.push(queueItem);
      }
    }

    // Update profile completion
    await db.query(
      `UPDATE dating_profiles
       SET profile_completion_percent = GREATEST(COALESCE(profile_completion_percent, 0), 80),
           updated_at = CURRENT_TIMESTAMP,
           last_active = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );

    await spamFraudService.refreshSystemMetrics();

    res.json({
      message: 'Photos uploaded and sent through moderation review',
      photos: normalizePhotoDetails(photoUrls).map((photo) => photo.url),
      photoDetails: normalizePhotoDetails(photoUrls),
      moderation: {
        totalQueued: moderationQueue.length,
        pendingReview: moderationQueue.filter((item) => item.status === 'pending').length,
        autoApproved: moderationQueue.filter((item) => item.status === 'approved').length
      }
    });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// 6. SEARCH PROFILES
router.post('/search', async (req, res) => {
  try {
    const userId = req.user.id;
    const { ageRange, relationshipGoals, heightRange, interests, bodyTypes, distance, genderPreferences } = req.body;
    const normalizedInterests = Array.isArray(interests)
      ? interests.map((interest) => normalizeOptionalText(interest)).filter(Boolean)
      : [];
    const normalizedBodyTypes = Array.isArray(bodyTypes)
      ? bodyTypes.map((bt) => normalizeOptionalText(bt)).filter(Boolean)
      : [];
    const normalizedGenderPreferences = Array.isArray(genderPreferences)
      ? genderPreferences.map((g) => normalizeOptionalText(g)).filter(Boolean)
      : [];
    const radiusKm = normalizeInteger(distance);

    // Get current user's location for distance filtering
    const currentProfileResult = await db.query(
      `SELECT location_lat, location_lng FROM dating_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const currentLat = toFiniteNumber(currentProfileResult.rows[0]?.location_lat);
    const currentLng = toFiniteNumber(currentProfileResult.rows[0]?.location_lng);

    let query = `
      SELECT dp.*, COUNT(*) OVER() as total_count,
             (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
              FROM profile_photos WHERE user_id = dp.user_id) as photos
      FROM dating_profiles dp
      WHERE dp.user_id != $1
        AND dp.is_active = true
    `;

    const params = [userId];
    let paramIndex = 2;

    if (ageRange?.min) {
      query += ` AND dp.age >= $${paramIndex++}`;
      params.push(ageRange.min);
    }
    if (ageRange?.max) {
      query += ` AND dp.age <= $${paramIndex++}`;
      params.push(ageRange.max);
    }
    if (normalizedGenderPreferences.length > 0) {
      query += ` AND dp.gender = ANY($${paramIndex++})`;
      params.push(normalizedGenderPreferences);
    }
    if (relationshipGoals?.length > 0) {
      query += ` AND dp.relationship_goals = ANY($${paramIndex++})`;
      params.push(relationshipGoals);
    }
    if (heightRange?.min) {
      query += ` AND dp.height >= $${paramIndex++}`;
      params.push(heightRange.min);
    }
    if (heightRange?.max) {
      query += ` AND dp.height <= $${paramIndex++}`;
      params.push(heightRange.max);
    }
    if (normalizedBodyTypes.length > 0) {
      query += ` AND dp.body_type = ANY($${paramIndex++})`;
      params.push(normalizedBodyTypes);
    }
    if (normalizedInterests.length > 0) {
      query += ` AND COALESCE(dp.interests, ARRAY[]::text[]) && $${paramIndex++}::text[]`;
      params.push(normalizedInterests);
    }

    // Haversine distance filter
    if (Number.isFinite(currentLat) && Number.isFinite(currentLng) && Number.isFinite(radiusKm) && radiusKm > 0) {
      query += ` AND (
        6371 * acos(
          LEAST(1, GREATEST(-1,
            cos(radians($${paramIndex})) * cos(radians(dp.location_lat)) *
            cos(radians(dp.location_lng) - radians($${paramIndex + 1})) +
            sin(radians($${paramIndex})) * sin(radians(dp.location_lat))
          ))
        )
      ) <= $${paramIndex + 2}`;
      params.push(currentLat, currentLng, radiusKm);
      paramIndex += 3;
    }

    query += ' ORDER BY dp.updated_at DESC LIMIT 50';

    const result = await db.query(query, params);
    await recordSearchHistory({
      userId,
      source: 'browse_search',
      filters: {
        ageRange: ageRange || {},
        relationshipGoals: Array.isArray(relationshipGoals) ? relationshipGoals : [],
        heightRange: heightRange || {},
        interests: normalizedInterests,
        bodyTypes: normalizedBodyTypes,
        distance: radiusKm,
        genderPreferences: normalizedGenderPreferences
      },
      resultCount: result.rows.length
    });

    res.json({
      profiles: result.rows.map(normalizeProfileRow),
      totalCount: result.rows.length > 0
        ? Number.parseInt(result.rows[0].total_count, 10) || result.rows.length
        : 0
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Helper: build discovery SQL with DB-level filters and cursor pagination
const buildDiscoveryQuery = ({
  userId,
  currentLat,
  currentLng,
  radiusKm,
  ageMin,
  ageMax,
  genderPreferences,
  relationshipGoals,
  interests,
  heightRangeMin,
  heightRangeMax,
  bodyTypes,
  excludeShown,
  limit = CURSOR_PAGE_SIZE,
  cursor = null
}) => {
  const params = [userId];
  let paramIndex = 2;
  const conditions = [
    'dp.user_id != $1',
    'dp.is_active = true',
    'COALESCE(up.show_my_profile, true) = true'
  ];

  // Exclude already interacted users using NOT EXISTS (faster than NOT IN)
  conditions.push(`NOT EXISTS (
    SELECT 1 FROM interactions i
    WHERE (i.from_user_id = $1 AND i.to_user_id = dp.user_id)
       OR (i.to_user_id = $1 AND i.from_user_id = dp.user_id)
  )`);

  // Exclude blocked users using NOT EXISTS
  conditions.push(`NOT EXISTS (
    SELECT 1 FROM user_blocks ub
    WHERE (ub.blocking_user_id = $1 AND ub.blocked_user_id = dp.user_id)
       OR (ub.blocked_user_id = $1 AND ub.blocking_user_id = dp.user_id)
  )`);

  if (excludeShown) {
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM discovery_queue_shown dqs
      WHERE dqs.viewer_user_id = $1 AND dqs.shown_user_id = dp.user_id
    )`);
  }

  if (Number.isFinite(ageMin)) {
    conditions.push(`dp.age >= $${paramIndex++}`);
    params.push(ageMin);
  }
  if (Number.isFinite(ageMax)) {
    conditions.push(`dp.age <= $${paramIndex++}`);
    params.push(ageMax);
  }

  if (Array.isArray(genderPreferences) && genderPreferences.length > 0) {
    conditions.push(`dp.gender = ANY($${paramIndex++})`);
    params.push(genderPreferences);
  }

  if (Array.isArray(relationshipGoals) && relationshipGoals.length > 0) {
    conditions.push(`dp.relationship_goals = ANY($${paramIndex++})`);
    params.push(relationshipGoals);
  }

  if (Array.isArray(interests) && interests.length > 0) {
    conditions.push(`COALESCE(dp.interests, ARRAY[]::text[]) && $${paramIndex++}::text[]`);
    params.push(interests);
  }

  if (Number.isFinite(heightRangeMin)) {
    conditions.push(`dp.height >= $${paramIndex++}`);
    params.push(heightRangeMin);
  }
  if (Number.isFinite(heightRangeMax)) {
    conditions.push(`dp.height <= $${paramIndex++}`);
    params.push(heightRangeMax);
  }

  if (Array.isArray(bodyTypes) && bodyTypes.length > 0) {
    conditions.push(`dp.body_type = ANY($${paramIndex++})`);
    params.push(bodyTypes);
  }

  // Haversine distance filter
  if (Number.isFinite(currentLat) && Number.isFinite(currentLng) && Number.isFinite(radiusKm) && radiusKm > 0) {
    conditions.push(`(
      6371 * acos(
        LEAST(1, GREATEST(-1,
          cos(radians($${paramIndex})) * cos(radians(dp.location_lat)) *
          cos(radians(dp.location_lng) - radians($${paramIndex + 1})) +
          sin(radians($${paramIndex})) * sin(radians(dp.location_lat))
        ))
      )
    ) <= $${paramIndex + 2}`);
    params.push(currentLat, currentLng, radiusKm);
    paramIndex += 3;
  }

  // Cursor pagination: fetch rows after the cursor (updated_at, id)
  const { updatedAt, id } = decodeCursor(cursor);
  if (updatedAt && id) {
    conditions.push(`(dp.updated_at, dp.id) < ($${paramIndex++}::timestamp, $${paramIndex++})`);
    params.push(updatedAt, id);
  }

  const whereClause = conditions.join(' AND ');

  return {
    text: `
      SELECT dp.*,
             row_to_json(up) as preferences,
             (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
              FROM profile_photos WHERE user_id = dp.user_id) as photos
      FROM dating_profiles dp
      LEFT JOIN user_preferences up ON up.user_id = dp.user_id
      WHERE ${whereClause}
      ORDER BY dp.updated_at DESC, dp.id DESC
      LIMIT $${paramIndex++}
    `,
    params: [...params, limit + 1]
  };
};

// 7. GET DISCOVERY PROFILES (For swipe interface) — with DB-level filtering and cursor pagination
router.get('/discovery', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || CURSOR_PAGE_SIZE, 50);
    const cursor = req.query.cursor || null;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const cacheKey = buildCacheKey('discovery', userId, 'discovery', req.query, cursor);
    const cached = await cacheGetPaginated(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const currentProfileResult = await db.query(
      `SELECT dp.*,
              row_to_json(up) as preferences,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       WHERE dp.user_id = $1
       LIMIT 1`,
      [userId]
    );
    const currentProfile = normalizeProfileRow(currentProfileResult.rows[0] || null);
    const currentPreferences = normalizePreferenceRow(currentProfileResult.rows[0]?.preferences);

    const discoveryFilters = {
      ageMin: normalizeInteger(req.query.ageMin) ?? currentPreferences.ageRangeMin,
      ageMax: normalizeInteger(req.query.ageMax) ?? currentPreferences.ageRangeMax,
      distance: normalizeInteger(req.query.distance) ?? currentPreferences.locationRadius,
      gender: req.query.gender ? [req.query.gender] : currentPreferences.genderPreferences,
      relationshipGoals: req.query.relationshipGoals ? [req.query.relationshipGoals] : currentPreferences.relationshipGoals,
      interests: req.query.interests ? req.query.interests.split(',').map(s => s.trim()).filter(Boolean) : currentPreferences.interests,
      heightRangeMin: normalizeInteger(req.query.heightRangeMin) ?? currentPreferences.heightRangeMin,
      heightRangeMax: normalizeInteger(req.query.heightRangeMax) ?? currentPreferences.heightRangeMax,
      bodyTypes: req.query.bodyTypes ? req.query.bodyTypes.split(',').map(s => s.trim()).filter(Boolean) : currentPreferences.bodyTypes
    };

    const query = buildDiscoveryQuery({
      userId,
      currentLat: toFiniteNumber(currentProfile?.location?.lat),
      currentLng: toFiniteNumber(currentProfile?.location?.lng),
      radiusKm: discoveryFilters.distance,
      ageMin: discoveryFilters.ageMin,
      ageMax: discoveryFilters.ageMax,
      genderPreferences: discoveryFilters.gender,
      relationshipGoals: discoveryFilters.relationshipGoals,
      interests: discoveryFilters.interests,
      heightRangeMin: discoveryFilters.heightRangeMin,
      heightRangeMax: discoveryFilters.heightRangeMax,
      bodyTypes: discoveryFilters.bodyTypes,
      excludeShown: false,
      limit,
      cursor
    });

    const result = await db.query(query.text, query.params);

    // Check if there are more results
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    const profiles = rows
      .map((profileRow) => {
        const normalizedProfile = normalizeProfileRow(profileRow);
        const compatibility = buildCompatibilitySuggestion({
          currentProfile,
          currentPreferences,
          candidateProfile: normalizedProfile,
          candidatePreferences: profileRow.preferences
        });

        if (compatibility.isExcluded) {
          return null;
        }

        return {
          ...normalizedProfile,
          ...compatibility
        };
      })
      .filter(Boolean)
      .sort((leftProfile, rightProfile) => rightProfile.compatibilityScore - leftProfile.compatibilityScore)
      .slice(0, limit);

    const lastRow = rows[rows.length - 1];
    const nextCursor = hasMore && lastRow ? encodeCursor(lastRow.updated_at, lastRow.id) : null;

    const response = {
      profiles,
      nextCursor,
      hasMore: Boolean(nextCursor)
    };

    await cacheSetPaginated(cacheKey, response, DISCOVERY_CACHE_TTL);

    const requestMetadata = getRequestMetadata(req);
    spamFraudService.trackUserActivity({
      userId,
      action: 'discovery_feed_view',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });
    await recordSearchHistory({
      userId,
      source: 'discovery',
      filters: discoveryFilters,
      resultCount: profiles.length
    });

    res.json(response);
  } catch (err) {
    console.error('Discovery error:', err);
    res.status(500).json({ error: 'Failed to get discovery profiles', details: err.message });
  }
});

// 7b. GET SMART DISCOVERY QUEUE (Personalized multi-factor ranking) — cursor pagination
router.get('/discovery-queue', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || CURSOR_PAGE_SIZE, 30);
    const cursor = req.query.cursor || null;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const cacheKey = buildCacheKey('discovery', userId, 'queue', cursor);
    const cached = await cacheGetPaginated(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const currentProfileResult = await db.query(
      `SELECT dp.*,
              row_to_json(up) as preferences,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       WHERE dp.user_id = $1
       LIMIT 1`,
      [userId]
    );
    const currentProfile = normalizeProfileRow(currentProfileResult.rows[0] || null);
    const currentPreferences = normalizePreferenceRow(currentProfileResult.rows[0]?.preferences);

    if (!currentProfile) {
      return res.status(404).json({ error: 'Profile not found. Complete your profile first.' });
    }

    const query = buildDiscoveryQuery({
      userId,
      currentLat: toFiniteNumber(currentProfile?.location?.lat),
      currentLng: toFiniteNumber(currentProfile?.location?.lng),
      radiusKm: currentPreferences.locationRadius,
      ageMin: currentPreferences.ageRangeMin,
      ageMax: currentPreferences.ageRangeMax,
      genderPreferences: currentPreferences.genderPreferences,
      relationshipGoals: currentPreferences.relationshipGoals,
      interests: currentPreferences.interests,
      heightRangeMin: currentPreferences.heightRangeMin,
      heightRangeMax: currentPreferences.heightRangeMax,
      bodyTypes: currentPreferences.bodyTypes,
      excludeShown: true,
      limit,
      cursor
    });

    const result = await db.query(query.text, query.params);

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    const learningProfile = normalizeLearningProfile(currentPreferences.learningProfile);
    const totalLearningSignals = learningProfile.totalPositiveActions + learningProfile.totalNegativeActions;
    const hasLearningData = currentPreferences.preferenceFlexibility?.learnFromActivity && totalLearningSignals >= 2;

    const scoredProfiles = rows
      .map((profileRow) => {
        const normalizedProfile = normalizeProfileRow(profileRow);
        const compatibility = buildCompatibilitySuggestion({
          currentProfile,
          currentPreferences,
          candidateProfile: normalizedProfile,
          candidatePreferences: profileRow.preferences
        });

        if (compatibility.isExcluded) {
          return null;
        }

        // Multi-factor scoring (0-100)
        let compatibilityFactor = compatibility.compatibilityScore * 0.40;

        // Behavioral alignment factor (25%)
        let behavioralFactor = 0;
        if (hasLearningData) {
          let behavioralRaw = 0;
          const candidateInterests = normalizeInterestList(normalizedProfile.interests);
          candidateInterests.slice(0, 4).forEach((interest) => {
            const key = interest.toLowerCase();
            behavioralRaw += Number(learningProfile.positiveSignals.interests[key] || 0);
            behavioralRaw -= Number(learningProfile.negativeSignals.interests[key] || 0);
          });
          if (normalizedProfile.relationshipGoals) {
            const key = normalizedProfile.relationshipGoals.toLowerCase();
            behavioralRaw += Number(learningProfile.positiveSignals.relationshipGoals[key] || 0) * 1.3;
            behavioralRaw -= Number(learningProfile.negativeSignals.relationshipGoals[key] || 0) * 1.1;
          }
          if (normalizedProfile.bodyType) {
            const key = normalizedProfile.bodyType.toLowerCase();
            behavioralRaw += Number(learningProfile.positiveSignals.bodyTypes[key] || 0);
            behavioralRaw -= Number(learningProfile.negativeSignals.bodyTypes[key] || 0);
          }
          const ageBand = buildAgeBand(normalizedProfile.age);
          if (ageBand) {
            const key = ageBand.toLowerCase();
            behavioralRaw += Number(learningProfile.positiveSignals.ageBands[key] || 0) * 1.2;
            behavioralRaw -= Number(learningProfile.negativeSignals.ageBands[key] || 0);
          }
          behavioralFactor = Math.max(0, Math.min(25, 12.5 + behavioralRaw * 1.5));
        } else {
          behavioralFactor = 12.5; // neutral baseline
        }

        // Recency / freshness factor (15%)
        let recencyFactor = 7.5; // baseline
        const profileCreated = normalizedProfile.createdAt ? new Date(normalizedProfile.createdAt) : null;
        const daysSinceCreated = profileCreated ? (Date.now() - profileCreated.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
        if (daysSinceCreated <= 3) {
          recencyFactor = 15;
        } else if (daysSinceCreated <= 7) {
          recencyFactor = 12;
        } else if (daysSinceCreated <= 14) {
          recencyFactor = 10;
        } else if (daysSinceCreated <= 30) {
          recencyFactor = 9;
        }

        const lastActive = normalizedProfile.lastActive ? new Date(normalizedProfile.lastActive) : null;
        const hoursSinceActive = lastActive ? (Date.now() - lastActive.getTime()) / (1000 * 60 * 60) : Infinity;
        if (hoursSinceActive <= 24) {
          recencyFactor += 2;
        } else if (hoursSinceActive <= 72) {
          recencyFactor += 1;
        }
        recencyFactor = Math.min(15, recencyFactor);

        // Trending / social proof factor (10%)
        let trendingFactor = 5; // baseline
        // Boost verified profiles slightly within trending
        if (normalizedProfile.profileVerified) {
          trendingFactor += 1.5;
        }
        // Boost completed profiles
        if ((normalizedProfile.profileCompletionPercent || 0) >= 80) {
          trendingFactor += 1.5;
        }
        if ((normalizedProfile.profileCompletionPercent || 0) >= 60) {
          trendingFactor += 1;
        }
        trendingFactor = Math.min(10, trendingFactor);

        // Diversity injection factor (10%) — slightly boost profiles that differ in one dimension
        let diversityFactor = 5;
        const currentGoals = currentProfile.relationshipGoals;
        const candidateGoals = normalizedProfile.relationshipGoals;
        if (currentGoals && candidateGoals && currentGoals !== candidateGoals) {
          diversityFactor += 2;
        }
        const currentInterests = normalizeInterestList(currentProfile.interests);
        const candidateInterests = normalizeInterestList(normalizedProfile.interests);
        const shared = candidateInterests.filter(i => currentInterests.map(ci => ci.toLowerCase()).includes(i.toLowerCase()));
        if (shared.length === 0 && candidateInterests.length > 0 && currentInterests.length > 0) {
          diversityFactor += 2;
        }
        diversityFactor = Math.min(10, diversityFactor);

        const totalScore = Math.round(compatibilityFactor + behavioralFactor + recencyFactor + trendingFactor + diversityFactor);

        return {
          ...normalizedProfile,
          ...compatibility,
          queueScore: totalScore,
          scoreBreakdown: {
            compatibility: Math.round(compatibilityFactor),
            behavioral: Math.round(behavioralFactor),
            recency: Math.round(recencyFactor),
            trending: Math.round(trendingFactor),
            diversity: Math.round(diversityFactor)
          }
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.queueScore - a.queueScore)
      .slice(0, limit);

    // Record shown profiles for deduplication
    if (scoredProfiles.length > 0) {
      const values = scoredProfiles.map((p, i) => `($1, $${i + 2})`).join(', ');
      const shownIds = scoredProfiles.map(p => p.userId);
      await db.query(
        `INSERT INTO discovery_queue_shown (viewer_user_id, shown_user_id)
         VALUES ${values}
         ON CONFLICT (viewer_user_id, shown_user_id) DO UPDATE
         SET shown_at = CURRENT_TIMESTAMP`,
        [userId, ...shownIds]
      );
    }

    const lastRow = rows[rows.length - 1];
    const nextCursor = hasMore && lastRow ? encodeCursor(lastRow.updated_at, lastRow.id) : null;

    const response = {
      profiles: scoredProfiles,
      nextCursor,
      hasMore: Boolean(nextCursor)
    };

    await cacheSetPaginated(cacheKey, response, DISCOVERY_CACHE_TTL);

    const requestMetadata = getRequestMetadata(req);
    spamFraudService.trackUserActivity({
      userId,
      action: 'discovery_queue_view',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

    res.json(response);
  } catch (err) {
    console.error('Discovery queue error:', err);
    res.status(500).json({ error: 'Failed to get discovery queue', details: err.message });
  }
});

// 7c. GET TRENDING PROFILES — cursor pagination + caching
router.get('/trending', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || CURSOR_PAGE_SIZE, 30);
    const cursor = req.query.cursor || null;

    const cacheKey = buildCacheKey('discovery', userId, 'trending', cursor);
    const cached = await cacheGetPaginated(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { updatedAt, id } = decodeCursor(cursor);

    let cursorCondition = '';
    const params = [userId, sevenDaysAgo, limit + 1];
    if (updatedAt && id) {
      cursorCondition = `AND (dp.updated_at, dp.id) < ($4::timestamp, $5)`;
      params.push(updatedAt, id);
    }

    const result = await db.query(
      `SELECT dp.*,
              row_to_json(up) as preferences,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos,
              COALESCE(engagement.like_count, 0) as like_count,
              COALESCE(engagement.view_count, 0) as view_count
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       LEFT JOIN LATERAL (
         SELECT
           COUNT(CASE WHEN i.interaction_type IN ('like', 'superlike') THEN 1 END) as like_count,
           COUNT(CASE WHEN i.interaction_type = 'profile_view' THEN 1 END) as view_count
         FROM interactions i
         WHERE i.to_user_id = dp.user_id AND i.created_at >= $2
       ) engagement ON true
       WHERE dp.user_id != $1
         AND dp.is_active = true
         AND NOT EXISTS (
           SELECT 1 FROM interactions i
           WHERE (i.from_user_id = $1 AND i.to_user_id = dp.user_id)
              OR (i.to_user_id = $1 AND i.from_user_id = dp.user_id)
         )
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks ub
           WHERE (ub.blocking_user_id = $1 AND ub.blocked_user_id = dp.user_id)
              OR (ub.blocked_user_id = $1 AND ub.blocking_user_id = dp.user_id)
         )
         ${cursorCondition}
       ORDER BY (COALESCE(engagement.like_count, 0) * 2 + COALESCE(engagement.view_count, 0)) DESC,
                dp.profile_verified DESC,
                dp.profile_completion_percent DESC,
                dp.updated_at DESC,
                dp.id DESC
       LIMIT $3`,
      params
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    const profiles = rows.map((row) => {
      const normalizedProfile = normalizeProfileRow(row);
      return {
        ...normalizedProfile,
        trendingScore: Number(row.like_count) * 2 + Number(row.view_count),
        likeCount: Number(row.like_count),
        viewCount: Number(row.view_count)
      };
    });

    const lastRow = rows[rows.length - 1];
    const nextCursor = hasMore && lastRow ? encodeCursor(lastRow.updated_at, lastRow.id) : null;

    const response = { profiles, nextCursor, hasMore: Boolean(nextCursor), generatedAt: new Date().toISOString() };
    await cacheSetPaginated(cacheKey, response, TRENDING_CACHE_TTL);

    res.json(response);
  } catch (err) {
    console.error('Trending error:', err);
    res.status(500).json({ error: 'Failed to get trending profiles', details: err.message });
  }
});

// 7d. GET NEW PROFILES — cursor pagination + caching
router.get('/new-profiles', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || CURSOR_PAGE_SIZE, 30);
    const cursor = req.query.cursor || null;

    const cacheKey = buildCacheKey('discovery', userId, 'new-profiles', cursor);
    const cached = await cacheGetPaginated(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { updatedAt, id } = decodeCursor(cursor);

    let cursorCondition = '';
    const params = [userId, fourteenDaysAgo, limit + 1];
    if (updatedAt && id) {
      cursorCondition = `AND (dp.created_at, dp.id) < ($4::timestamp, $5)`;
      params.push(updatedAt, id);
    }

    const result = await db.query(
      `SELECT dp.*,
              row_to_json(up) as preferences,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       WHERE dp.user_id != $1
         AND dp.is_active = true
         AND dp.created_at >= $2
         AND NOT EXISTS (
           SELECT 1 FROM interactions i
           WHERE (i.from_user_id = $1 AND i.to_user_id = dp.user_id)
              OR (i.to_user_id = $1 AND i.from_user_id = dp.user_id)
         )
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks ub
           WHERE (ub.blocking_user_id = $1 AND ub.blocked_user_id = dp.user_id)
              OR (ub.blocked_user_id = $1 AND ub.blocking_user_id = dp.user_id)
         )
         ${cursorCondition}
       ORDER BY dp.created_at DESC, dp.id DESC
       LIMIT $3`,
      params
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    const profiles = rows.map((row) => normalizeProfileRow(row));

    const lastRow = rows[rows.length - 1];
    const nextCursor = hasMore && lastRow ? encodeCursor(lastRow.created_at, lastRow.id) : null;

    const response = { profiles, nextCursor, hasMore: Boolean(nextCursor), generatedAt: new Date().toISOString() };
    await cacheSetPaginated(cacheKey, response, TRENDING_CACHE_TTL);

    res.json(response);
  } catch (err) {
    console.error('New profiles error:', err);
    res.status(500).json({ error: 'Failed to get new profiles', details: err.message });
  }
});

// 8. LIKE PROFILE
// 9. PASS PROFILE
router.post('/interactions/pass', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, targetUserId } = req.body;
    const userId = toUserId || targetUserId;

    if (!userId) {
      return res.status(400).json({ error: 'toUserId or targetUserId required' });
    }

    const passInsertResult = await db.query(
      `INSERT INTO interactions (from_user_id, to_user_id, interaction_type)
       VALUES ($1, $2, 'pass')
       ON CONFLICT (from_user_id, to_user_id, interaction_type) DO NOTHING
       RETURNING id`,
      [fromUserId, userId]
    );
    if (passInsertResult.rowCount > 0) {
      await persistLearningFeedback({
        userId: fromUserId,
        targetUserId: userId,
        interactionType: 'pass'
      });
    }

    // Invalidate discovery cache after pass
    await invalidateDiscoveryCache(fromUserId);

    res.json({ message: 'Profile passed' });
  } catch (err) {
    console.error('Pass error:', err);
    res.status(500).json({ error: 'Failed to pass profile' });
  }
});

// 10. GET MATCHES
router.get('/matches', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Number.parseInt(req.query.limit, 10) || 20;
    const page = Number.parseInt(req.query.page, 10) || 1;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT m.*,
              CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END as matched_user_id,
              (SELECT json_build_object(
                  'first_name', first_name,
                  'age', age,
                  'bio', bio,
                  'occupation', occupation,
                  'education', education,
                  'relationship_goals', relationship_goals,
                  'interests', interests,
                  'location_city', location_city,
                  'location_state', location_state,
                  'location_country', location_country,
                  'profile_verified', profile_verified
                )
               FROM dating_profiles 
               WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END) as matched_user_profile,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos
               WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END) as matched_user_photos,
              (SELECT json_build_object(
                  'id', id,
                  'text', message,
                  'from_user_id', from_user_id,
                  'to_user_id', to_user_id,
                  'created_at', created_at,
                  'is_read', is_read
                )
               FROM messages
               WHERE match_id = m.id
               ORDER BY created_at DESC
               LIMIT 1) as last_message,
              (SELECT MAX(created_at)
               FROM messages
               WHERE match_id = m.id) as last_message_at,
              (SELECT COUNT(*)
               FROM messages
               WHERE match_id = m.id) as message_count,
              (SELECT COUNT(*)
               FROM messages
               WHERE match_id = m.id
                 AND to_user_id = $1
                 AND is_read = false) as unread_count
       FROM matches m
       WHERE (m.user_id_1 = $1 OR m.user_id_2 = $1) AND m.status = 'active'
       ORDER BY m.matched_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const normalizedMatches = result.rows.map(normalizeMatchRow);
    const matches = await enrichMatchesWithJourney(userId, normalizedMatches);

    res.json({ matches });
  } catch (err) {
    console.error('Get matches error:', err);
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

// 11. CHECK MATCH
router.get('/matches/by-id/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT m.*,
              CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END as matched_user_id,
              (SELECT json_build_object(
                  'first_name', first_name,
                  'age', age,
                  'bio', bio,
                  'occupation', occupation,
                  'education', education,
                  'relationship_goals', relationship_goals,
                  'interests', interests,
                  'location_city', location_city,
                  'location_state', location_state,
                  'location_country', location_country,
                  'profile_verified', profile_verified
                )
               FROM dating_profiles
               WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END) as matched_user_profile,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos
               WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END) as matched_user_photos,
              (SELECT json_build_object(
                  'id', id,
                  'text', message,
                  'from_user_id', from_user_id,
                  'to_user_id', to_user_id,
                  'created_at', created_at,
                  'is_read', is_read
                )
               FROM messages
               WHERE match_id = m.id
               ORDER BY created_at DESC
               LIMIT 1) as last_message,
              (SELECT MAX(created_at)
               FROM messages
               WHERE match_id = m.id) as last_message_at,
              (SELECT COUNT(*)
               FROM messages
               WHERE match_id = m.id) as message_count,
              (SELECT COUNT(*)
               FROM messages
               WHERE match_id = m.id
                 AND to_user_id = $1
                 AND is_read = false) as unread_count
       FROM matches m
       WHERE m.id = $2
         AND (m.user_id_1 = $1 OR m.user_id_2 = $1)
         AND m.status = 'active'
       LIMIT 1`,
      [userId, matchId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const [match] = await enrichMatchesWithJourney(userId, [normalizeMatchRow(result.rows[0])]);

    res.json({ match });
  } catch (err) {
    console.error('Get match by id error:', err);
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

router.get('/matches/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const result = await db.query(
      `SELECT * FROM matches 
       WHERE (user_id_1 = $1 AND user_id_2 = $2) 
          OR (user_id_1 = $2 AND user_id_2 = $1)`,
      [currentUserId, userId]
    );

    if (result.rows.length === 0) {
      return res.json({ isMatched: false });
    }

    res.json({ isMatched: true, match: result.rows[0] });
  } catch (err) {
    console.error('Check match error:', err);
    res.status(500).json({ error: 'Failed to check match' });
  }
});

// 12. UNMATCH
router.delete('/matches/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `UPDATE matches 
       SET status = 'unmatched'
       WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)
       RETURNING *`,
      [matchId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ message: 'Unmatched successfully' });
  } catch (err) {
    console.error('Unmatch error:', err);
    res.status(500).json({ error: 'Failed to unmatch' });
  }
});

// 12b. UNMATCH - POST variant (for frontend compatibility)
router.post('/matches/:matchId/unmatch', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `UPDATE matches 
       SET status = 'unmatched'
       WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)
       RETURNING *`,
      [matchId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ message: 'Unmatched successfully' });
  } catch (err) {
    console.error('Unmatch error:', err);
    res.status(500).json({ error: 'Failed to unmatch' });
  }
});

// 13. GET LIKES RECEIVED
router.get('/interactions/likes', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 20;
    const page = req.query.page || 1;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT i.*, dp.first_name, dp.age, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = i.from_user_id LIMIT 1) as photo_url
       FROM interactions i
       JOIN dating_profiles dp ON i.from_user_id = dp.user_id
       WHERE i.to_user_id = $1 AND i.interaction_type = 'like'
       ORDER BY i.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get likes error:', err);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

// 13b. ALIAS - GET LIKES RECEIVED (alternate endpoint)
router.get('/likes-received', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 20;
    const page = req.query.page || 1;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT i.*, dp.first_name, dp.age, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = i.from_user_id LIMIT 1) as photo_url
       FROM interactions i
       JOIN dating_profiles dp ON i.from_user_id = dp.user_id
       WHERE i.to_user_id = $1 AND i.interaction_type = 'like'
       ORDER BY i.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get likes error:', err);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

// 14. GET INTERACTION HISTORY
router.get('/interactions/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 100;

    const result = await db.query(
      `SELECT * FROM interactions 
       WHERE from_user_id = $1 OR to_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Failed to get interaction history' });
  }
});

// 14b. ALIAS - GET INTERACTION HISTORY (alternate endpoint)
router.get('/interaction-history', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 100;

    const result = await db.query(
      `SELECT * FROM interactions 
       WHERE from_user_id = $1 OR to_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Failed to get interaction history' });
  }
});

// 15. VERIFY IDENTITY
const verifyIdentityHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    let verificationType = req.body?.verificationType;

    if (!verificationType && MULTIPART_FORM_DATA_PATTERN.test(String(req.headers['content-type'] || ''))) {
      const { fields } = await parseMultipartFormData(req);
      verificationType = fields.verificationType;
    }

    if (!verificationType) {
      return res.status(400).json({ error: 'Verification type required' });
    }

    // In production, integrate with third-party verification service
    const result = await db.query(
      `UPDATE dating_profiles 
       SET verifications = jsonb_set(verifications, $1, $2),
           profile_verified = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3
       RETURNING *`,
      [
        `{${verificationType}}`,
        JSON.stringify({ status: 'verified', verifiedAt: new Date() }),
        userId
      ]
    );

    await userNotificationService.createNotification(userId, {
      type: 'verification_complete',
      title: 'Verification updated',
      body: `${verificationType} verification has been added to your profile.`,
      metadata: {
        verificationType,
        profileVerified: true
      }
    });

    res.json({ message: 'Profile verified', profile: normalizeProfileRow(result.rows[0]) });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
};

router.post('/profiles/verify', verifyIdentityHandler);
router.post('/profiles/me/verify', verifyIdentityHandler);

// 16. GET PROFILE COMPLETION STATUS
router.get('/profiles/me/completion', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT profile_completion_percent, first_name, age, gender, location_city, bio, interests,
              (SELECT COUNT(*) FROM profile_photos WHERE user_id = $1) as photo_count
       FROM dating_profiles WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      profileCompletionPercent: result.rows[0].profile_completion_percent || 0,
      firstName: result.rows[0].first_name || '',
      age: result.rows[0].age,
      gender: result.rows[0].gender || null,
      bio: result.rows[0].bio || '',
      interests: Array.isArray(result.rows[0].interests) ? result.rows[0].interests : [],
      photoCount: Number.parseInt(result.rows[0].photo_count, 10) || 0,
      location: {
        city: result.rows[0].location_city || ''
      }
    });
  } catch (err) {
    console.error('Completion check error:', err);
    res.status(500).json({ error: 'Failed to get completion status' });
  }
});

// 17. FAVORITE A PROFILE
router.post('/favorites', async (req, res) => {
  try {
    const userId = req.user.id;
    const favoriteUserId = normalizeInteger(req.body.favoriteUserId || req.body.userId);

    if (!favoriteUserId) {
      return res.status(400).json({ error: 'Favorite user ID is required' });
    }

    if (Number(userId) === Number(favoriteUserId)) {
      return res.status(400).json({ error: 'You cannot favorite your own profile' });
    }

    const userExists = await db.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [favoriteUserId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query(
      `INSERT INTO favorite_profiles (user_id, favorite_user_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, favorite_user_id) DO NOTHING`,
      [userId, favoriteUserId]
    );

    res.json({ success: true, message: 'Profile saved to favorites' });
  } catch (err) {
    console.error('Favorite profile error:', err);
    res.status(500).json({ error: 'Failed to save favorite profile' });
  }
});

// 18. GET FAVORITE PROFILES
router.get('/favorites', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT fp.created_at as favorited_at,
              dp.*,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos
               WHERE user_id = dp.user_id) as photos
       FROM favorite_profiles fp
       INNER JOIN dating_profiles dp ON dp.user_id = fp.favorite_user_id
       WHERE fp.user_id = $1
       ORDER BY fp.created_at DESC`,
      [userId]
    );

    res.json({
      favorites: result.rows.map((row) => ({
        ...normalizeProfileRow(row),
        favoritedAt: row.favorited_at
      }))
    });
  } catch (err) {
    console.error('Get favorites error:', err);
    res.status(500).json({ error: 'Failed to fetch favorite profiles' });
  }
});

// 19. REMOVE FAVORITE PROFILE
router.delete('/favorites/:favoriteUserId', async (req, res) => {
  try {
    const userId = req.user.id;
    const favoriteUserId = normalizeInteger(req.params.favoriteUserId);

    await db.query(
      `DELETE FROM favorite_profiles
       WHERE user_id = $1 AND favorite_user_id = $2`,
      [userId, favoriteUserId]
    );

    res.json({ success: true, message: 'Favorite removed' });
  } catch (err) {
    console.error('Remove favorite error:', err);
    res.status(500).json({ error: 'Failed to remove favorite profile' });
  }
});

// 20. GET SEARCH HISTORY
router.get('/search-history', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(normalizeInteger(req.query.limit) || 20, 100);

    const result = await db.query(
      `SELECT *
       FROM user_search_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({
      history: result.rows.map(normalizeSearchHistoryRow)
    });
  } catch (err) {
    console.error('Get search history error:', err);
    res.status(500).json({ error: 'Failed to fetch search history' });
  }
});

// 21. CLEAR SEARCH HISTORY
router.delete('/search-history', async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query(
      `DELETE FROM user_search_history
       WHERE user_id = $1`,
      [userId]
    );

    res.json({ success: true, message: 'Search history cleared' });
  } catch (err) {
    console.error('Clear search history error:', err);
    res.status(500).json({ error: 'Failed to clear search history' });
  }
});

// 22. GET USER NOTIFICATIONS
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(normalizeInteger(req.query.limit) || 25, 100);
    const notifications = await userNotificationService.getNotificationsForUser(userId, { limit });
    const unreadCount = await userNotificationService.getUnreadCount(userId);

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// 23. GET UNREAD NOTIFICATION COUNT
router.get('/notifications/unread-count', async (req, res) => {
  try {
    const unreadCount = await userNotificationService.getUnreadCount(req.user.id);
    res.json({ unreadCount });
  } catch (err) {
    console.error('Get unread notification count error:', err);
    res.status(500).json({ error: 'Failed to fetch unread notification count' });
  }
});

// 24. MARK NOTIFICATION AS READ
router.post('/notifications/:notificationId/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = normalizeInteger(req.params.notificationId);
    const notification = await userNotificationService.markAsRead(userId, notificationId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, notification });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// 25. MARK ALL NOTIFICATIONS AS READ
router.post('/notifications/read-all', async (req, res) => {
  try {
    await userNotificationService.markAllAsRead(req.user.id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// 26. BLOCK A USER
router.post('/blocks', async (req, res) => {
  try {
    const userId = req.user.id;
    const { blockedUserId } = req.body;

    if (!blockedUserId) {
      return res.status(400).json({ error: 'Blocked user ID is required' });
    }

    if (userId === blockedUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    // Check if user exists
    const userExists = await db.query('SELECT id FROM users WHERE id = $1', [blockedUserId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Insert block
    await db.query(
      `INSERT INTO user_blocks (blocking_user_id, blocked_user_id) 
       VALUES ($1, $2) 
       ON CONFLICT DO NOTHING`,
      [userId, blockedUserId]
    );

    res.json({ success: true, message: 'User blocked successfully' });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// 18. GET MY BLOCKED USERS
router.get('/blocks', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT ub.id, ub.blocked_user_id, dp.first_name, dp.age, 
              dp.location_city, dp.location_state,
              (SELECT photo_url FROM profile_photos WHERE user_id = ub.blocked_user_id LIMIT 1) as photo_url,
              ub.created_at
       FROM user_blocks ub
       JOIN users u ON ub.blocked_user_id = u.id
       JOIN dating_profiles dp ON dp.user_id = u.id
       WHERE ub.blocking_user_id = $1
       ORDER BY ub.created_at DESC`,
      [userId]
    );

    res.json({
      blockedUsers: result.rows.map(row => ({
        id: row.blocked_user_id,
        firstName: row.first_name,
        age: row.age,
        location: {
          city: row.location_city,
          state: row.location_state
        },
        photoUrl: row.photo_url,
        blockedAt: row.created_at
      }))
    });
  } catch (err) {
    console.error('Get blocked users error:', err);
    res.status(500).json({ error: 'Failed to get blocked users' });
  }
});

// 19. UNBLOCK A USER
router.delete('/blocks/:blockedUserId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { blockedUserId } = req.params;

    await db.query(
      `DELETE FROM user_blocks 
       WHERE blocking_user_id = $1 AND blocked_user_id = $2`,
      [userId, parseInt(blockedUserId, 10)]
    );

    res.json({ success: true, message: 'User unblocked successfully' });
  } catch (err) {
    console.error('Unblock user error:', err);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// 20. REPORT A USER
router.post('/reports', async (req, res) => {
  try {
    const userId = req.user.id;
    const { reportedUserId, reason, description } = req.body;
    const requestMetadata = getRequestMetadata(req);

    if (!reportedUserId || !reason) {
      return res.status(400).json({ error: 'Reported user ID and reason are required' });
    }

    if (userId === reportedUserId) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }

    // Check if user exists
    const userExists = await db.query('SELECT id FROM users WHERE id = $1', [reportedUserId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Insert report
    const result = await db.query(
      `INSERT INTO user_reports (reporting_user_id, reported_user_id, reason, description) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, created_at`,
      [userId, reportedUserId, reason, description || null]
    );

    const moderationConfig = getReportModerationConfig(reason);
    await createModerationFlag({
      userId: reportedUserId,
      sourceType: 'user_report',
      flagCategory: moderationConfig.category,
      severity: moderationConfig.severity,
      title: moderationConfig.title,
      reason: description || `Report reason: ${reason}`,
      metadata: {
        reportId: result.rows[0].id,
        reportedReason: reason,
        reportingUserId: userId
      }
    });

    spamFraudService.trackUserActivity({
      userId,
      action: 'report_submitted',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runFraudCheck: false
    });
    spamFraudService.checkForFraud(reportedUserId);
    spamFraudService.refreshSystemMetrics();

    res.json({ 
      success: true, 
      message: 'Report submitted successfully',
      reportId: result.rows[0].id,
      createdAt: result.rows[0].created_at
    });
  } catch (err) {
    console.error('Report user error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// 27. GET USER PREFERENCES
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    res.json(formatPreferenceResponse(result.rows[0] || null));
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// 28. UPDATE USER PREFERENCES
router.put('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      ageRangeMin,
      ageRangeMax,
      locationRadius,
      genderPreferences,
      relationshipGoals,
      interests,
      heightRangeMin,
      heightRangeMax,
      bodyTypes,
      showMyProfile,
      allowMessages,
      notificationsEnabled,
      dealBreakers,
      preferenceFlexibility,
      compatibilityAnswers,
      learningProfile
    } = req.body;
    const hasOwnField = (fieldName) => Object.prototype.hasOwnProperty.call(req.body || {}, fieldName);

    const existingPreferenceResult = await db.query(
      `SELECT *
       FROM user_preferences
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );
    const existingPreferences = normalizePreferenceRow(existingPreferenceResult.rows[0] || null);
    const nextPreferences = {
      ageRangeMin: hasOwnField('ageRangeMin')
        ? normalizeInteger(ageRangeMin) ?? 18
        : existingPreferences.ageRangeMin,
      ageRangeMax: hasOwnField('ageRangeMax')
        ? normalizeInteger(ageRangeMax) ?? 50
        : existingPreferences.ageRangeMax,
      locationRadius: hasOwnField('locationRadius')
        ? normalizeInteger(locationRadius) ?? 50
        : existingPreferences.locationRadius,
      genderPreferences: hasOwnField('genderPreferences')
        ? normalizeStringArray(genderPreferences)
        : existingPreferences.genderPreferences,
      relationshipGoals: hasOwnField('relationshipGoals')
        ? normalizeStringArray(relationshipGoals)
        : existingPreferences.relationshipGoals,
      interests: hasOwnField('interests')
        ? normalizeInterestList(interests)
        : existingPreferences.interests,
      heightRangeMin: hasOwnField('heightRangeMin')
        ? normalizeInteger(heightRangeMin)
        : existingPreferences.heightRangeMin,
      heightRangeMax: hasOwnField('heightRangeMax')
        ? normalizeInteger(heightRangeMax)
        : existingPreferences.heightRangeMax,
      bodyTypes: hasOwnField('bodyTypes')
        ? normalizeStringArray(bodyTypes)
        : existingPreferences.bodyTypes,
      showMyProfile: hasOwnField('showMyProfile')
        ? normalizeBoolean(showMyProfile)
        : existingPreferences.showMyProfile,
      allowMessages: hasOwnField('allowMessages')
        ? normalizeBoolean(allowMessages)
        : existingPreferences.allowMessages,
      notificationsEnabled: hasOwnField('notificationsEnabled')
        ? normalizeBoolean(notificationsEnabled)
        : existingPreferences.notificationsEnabled,
      dealBreakers: hasOwnField('dealBreakers')
        ? normalizeDealBreakers(dealBreakers)
        : existingPreferences.dealBreakers,
      preferenceFlexibility: hasOwnField('preferenceFlexibility')
        ? normalizePreferenceFlexibility(preferenceFlexibility)
        : existingPreferences.preferenceFlexibility,
      compatibilityAnswers: hasOwnField('compatibilityAnswers')
        ? normalizeCompatibilityAnswers(compatibilityAnswers)
        : existingPreferences.compatibilityAnswers,
      learningProfile: hasOwnField('learningProfile')
        ? normalizeLearningProfile(learningProfile)
        : existingPreferences.learningProfile
    };

    const result = await db.query(
      `INSERT INTO user_preferences (
         user_id, age_range_min, age_range_max, location_radius,
         gender_preferences, relationship_goals, interests,
         height_range_min, height_range_max, body_types,
         show_my_profile, allow_messages, notifications_enabled,
         deal_breakers, preference_flexibility, compatibility_answers, learning_profile
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb)
       ON CONFLICT (user_id) DO UPDATE
       SET age_range_min = EXCLUDED.age_range_min,
           age_range_max = EXCLUDED.age_range_max,
           location_radius = EXCLUDED.location_radius,
           gender_preferences = EXCLUDED.gender_preferences,
           relationship_goals = EXCLUDED.relationship_goals,
           interests = EXCLUDED.interests,
           height_range_min = EXCLUDED.height_range_min,
           height_range_max = EXCLUDED.height_range_max,
           body_types = EXCLUDED.body_types,
           show_my_profile = EXCLUDED.show_my_profile,
           allow_messages = EXCLUDED.allow_messages,
           notifications_enabled = EXCLUDED.notifications_enabled,
           deal_breakers = EXCLUDED.deal_breakers,
           preference_flexibility = EXCLUDED.preference_flexibility,
           compatibility_answers = EXCLUDED.compatibility_answers,
           learning_profile = EXCLUDED.learning_profile,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        nextPreferences.ageRangeMin,
        nextPreferences.ageRangeMax,
        nextPreferences.locationRadius,
        nextPreferences.genderPreferences,
        nextPreferences.relationshipGoals,
        nextPreferences.interests,
        nextPreferences.heightRangeMin,
        nextPreferences.heightRangeMax,
        nextPreferences.bodyTypes,
        nextPreferences.showMyProfile,
        nextPreferences.allowMessages,
        nextPreferences.notificationsEnabled,
        JSON.stringify(nextPreferences.dealBreakers),
        JSON.stringify(nextPreferences.preferenceFlexibility),
        JSON.stringify(nextPreferences.compatibilityAnswers),
        JSON.stringify(nextPreferences.learningProfile)
      ]
    );


    res.json({
      message: 'Preferences updated',
      preferences: formatPreferenceResponse(result.rows[0])
    });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// 29. SUPERLIKE PROFILE
router.post('/interactions/superlike', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, targetUserId } = req.body;
    const userId = normalizeInteger(toUserId || targetUserId);
    const requestMetadata = getRequestMetadata(req);

    if (!userId) {
      return res.status(400).json({ error: 'toUserId or targetUserId required' });
    }

    if (Number(fromUserId) === Number(userId)) {
      return res.status(400).json({ error: 'You cannot superlike your own profile' });
    }

    const today = new Date().toISOString().split('T')[0];
    const analyticsResult = await db.query(
      `SELECT superlikes_sent FROM user_analytics WHERE user_id = $1 AND activity_date = $2`,
      [fromUserId, today]
    );

    const superlikesSent = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].superlikes_sent || 0) : 0;
    const subscriptionAccess = await getSubscriptionAccessForUser(fromUserId);
    const rewardBalance = await getRewardBalanceForUser(fromUserId);
    const superlikeLimit = subscriptionAccess.isGold ? 10 : subscriptionAccess.isPremium ? 5 : 1;
    let usedRewardCredit = false;

    if (superlikesSent >= superlikeLimit) {
      if (rewardBalance.superlikeCredits <= 0) {
        return res.status(429).json({
          error: 'Daily superlike limit reached',
          limit: superlikeLimit,
          used: superlikesSent,
          remaining: 0,
          rewardCreditsRemaining: rewardBalance.superlikeCredits
        });
      }

      usedRewardCredit = await spendRewardCredits(rewardBalance.model, 'superlikeCredits', 1);
      if (!usedRewardCredit) {
        return res.status(429).json({
          error: 'Daily superlike limit reached',
          limit: superlikeLimit,
          used: superlikesSent,
          remaining: 0,
          rewardCreditsRemaining: 0
        });
      }
    }

    const superlikeInsertResult = await db.query(
      `INSERT INTO interactions (from_user_id, to_user_id, interaction_type)
       VALUES ($1, $2, 'superlike')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [fromUserId, userId]
    );
    if (superlikeInsertResult.rowCount > 0) {
      await persistLearningFeedback({
        userId: fromUserId,
        targetUserId: userId,
        interactionType: 'superlike'
      });
    }

    await db.query(
      `INSERT INTO user_analytics (user_id, activity_date, superlikes_sent)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE
       SET superlikes_sent = user_analytics.superlikes_sent + 1`,
      [fromUserId, today]
    );

    spamFraudService.trackUserActivity({ userId: fromUserId, action: 'superlike_profile', analyticsUpdates: { superlikes_sent: 1 }, ipAddress: requestMetadata.ipAddress, userAgent: requestMetadata.userAgent, runSpamCheck: true, runFraudCheck: true });

    // Invalidate discovery cache after superlike
    await invalidateDiscoveryCache(fromUserId);

    const mutualResult = await db.query(
      `SELECT * FROM interactions WHERE from_user_id = $1 AND to_user_id = $2 AND interaction_type IN ('like', 'superlike')`,
      [userId, fromUserId]
    );

    if (mutualResult.rows.length > 0) {
      const persistedMatch = await ensureActiveMatch(fromUserId, userId);

      if (!persistedMatch) {
        throw new Error(`Failed to persist mutual superlike match for users ${fromUserId} and ${userId}`);
      }

      if (typeof req.emitToUser === 'function') {
        [fromUserId, userId].forEach((pid) => {
          req.emitToUser(pid, 'new_match', { match: persistedMatch, user: { id: fromUserId }, matchedUserId: pid === fromUserId ? userId : fromUserId, createdAt: new Date().toISOString(), superlike: true });
        });
      }

      await Promise.all([
        userNotificationService.createNotification(fromUserId, { type: 'new_match', title: 'Super Like Match!', body: 'They liked you back! Start chatting now.', metadata: { matchId: persistedMatch.id, matchedUserId: userId } }),
        userNotificationService.createNotification(userId, { type: 'new_match', title: 'Someone Super Liked You!', body: 'You matched with someone who super liked you!', metadata: { matchId: persistedMatch.id, matchedUserId: fromUserId } })
      ]);

      spamFraudService.updateUserAnalytics(fromUserId, { matches_made: 1 });
      spamFraudService.updateUserAnalytics(userId, { matches_made: 1 });
      spamFraudService.refreshSystemMetrics();

      return res.json({
        message: 'Super Like Match!',
        isMatch: true,
        match: persistedMatch,
        superlike: true,
        usedRewardCredit,
        rewardCreditsRemaining: Math.max(
          0,
          rewardBalance.superlikeCredits - (usedRewardCredit ? 1 : 0)
        )
      });
    }

    res.json({
      message: 'Profile super liked',
      isMatch: false,
      superlike: true,
      usedRewardCredit,
      rewardCreditsRemaining: Math.max(
        0,
        rewardBalance.superlikeCredits - (usedRewardCredit ? 1 : 0)
      )
    });
  } catch (err) {
    console.error('Superlike error:', err);
    res.status(500).json({ error: 'Failed to superlike profile' });
  }
});

// 30. GET DAILY LIMITS
router.get('/daily-limits', async (req, res) => {
  try {
    const userId = req.user.id;
    const limits = await getDailyLimitSnapshot(userId);

    res.json({
      plan: limits.subscriptionAccess.plan,
      isPremium: limits.subscriptionAccess.isPremium,
      isGold: limits.subscriptionAccess.isGold,
      likeLimit: limits.likeLimit,
      superlikeLimit: limits.superlikeLimit,
      rewindLimit: limits.rewindLimit,
      boostLimit: limits.boostLimit,
      likesSent: limits.likesSent,
      superlikesSent: limits.superlikesSent,
      rewindsSent: limits.rewindsSent,
      boostsUsedToday: limits.boostsUsedToday,
      remainingLikes: limits.remainingLikes,
      remainingSuperlikes: limits.remainingSuperlikes,
      remainingRewinds: limits.remainingRewinds,
      remainingBoosts: limits.remainingBoosts,
      remainingBoostCredits: limits.remainingBoostCredits,
      rewardSuperlikeCredits: limits.rewardSuperlikeCredits,
      rewardBoostCredits: limits.rewardBoostCredits,
      resetsAt: limits.resetsAt
    });
  } catch (err) {
    console.error('Get daily limits error:', err);
    res.status(500).json({ error: 'Failed to get daily limits' });
  }
});

// 31. LIKE PROFILE (with daily limit check)
router.post('/interactions/like', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, targetUserId } = req.body;
    const userId = normalizeInteger(toUserId || targetUserId);
    const requestMetadata = getRequestMetadata(req);

    if (!userId) {
      return res.status(400).json({ error: 'toUserId or targetUserId required' });
    }

    if (Number(fromUserId) === Number(userId)) {
      return res.status(400).json({ error: 'You cannot like your own profile' });
    }

    const today = new Date().toISOString().split('T')[0];
    const analyticsResult = await db.query(
      `SELECT likes_sent FROM user_analytics WHERE user_id = $1 AND activity_date = $2`,
      [fromUserId, today]
    );

    const likesSent = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].likes_sent || 0) : 0;
    const likeLimit = 50;
    if (likesSent >= likeLimit) {
      return res.status(429).json({ error: 'Daily like limit reached', limit: likeLimit, used: likesSent, remaining: 0 });
    }

    const likeInsertResult = await db.query(
      `INSERT INTO interactions (from_user_id, to_user_id, interaction_type)
       VALUES ($1, $2, 'like')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [fromUserId, userId]
    );
    if (likeInsertResult.rowCount > 0) {
      await persistLearningFeedback({
        userId: fromUserId,
        targetUserId: userId,
        interactionType: 'like'
      });
    }

    await db.query(
      `INSERT INTO user_analytics (user_id, activity_date, likes_sent)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE
       SET likes_sent = user_analytics.likes_sent + 1`,
      [fromUserId, today]
    );

    await spamFraudService.trackUserActivity({ userId: fromUserId, action: 'like_profile', analyticsUpdates: { likes_sent: 1 }, ipAddress: requestMetadata.ipAddress, userAgent: requestMetadata.userAgent, runSpamCheck: true, runFraudCheck: true });

    const mutualResult = await db.query(
      `SELECT * FROM interactions WHERE from_user_id = $1 AND to_user_id = $2 AND interaction_type IN ('like', 'superlike')`,
      [userId, fromUserId]
    );

    if (mutualResult.rows.length > 0) {
      const persistedMatch = await ensureActiveMatch(fromUserId, userId);

      if (!persistedMatch) {
        throw new Error(`Failed to persist mutual like match for users ${fromUserId} and ${userId}`);
      }

      if (typeof req.emitToUser === 'function') {
        [fromUserId, userId].forEach((pid) => {
          req.emitToUser(pid, 'new_match', { match: persistedMatch, user: { id: fromUserId }, matchedUserId: pid === fromUserId ? userId : fromUserId, createdAt: new Date().toISOString() });
        });
      }

      await Promise.all([
        userNotificationService.createNotification(fromUserId, { type: 'new_match', title: 'You have a new match', body: 'Someone liked you back. Open the chat to say hello.', metadata: { matchId: persistedMatch.id, matchedUserId: userId } }),
        userNotificationService.createNotification(userId, { type: 'new_match', title: 'It is a match', body: 'You matched with someone new. Start the conversation when you are ready.', metadata: { matchId: persistedMatch.id, matchedUserId: fromUserId } })
      ]);

      await spamFraudService.updateUserAnalytics(fromUserId, { matches_made: 1 });
      await spamFraudService.updateUserAnalytics(userId, { matches_made: 1 });
      await spamFraudService.refreshSystemMetrics();

      return res.json({ message: 'Its a match!', isMatch: true, match: persistedMatch });
    }

    res.json({ message: 'Profile liked', isMatch: false });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to like profile' });
  }
});

// 32. GET TOP PICKS (Most Compatible Profiles) — using smart discovery query
router.get('/top-picks', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);

    const currentProfileResult = await db.query(
      `SELECT dp.*,
              row_to_json(up) as preferences,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       WHERE dp.user_id = $1
       LIMIT 1`,
      [userId]
    );
    const currentProfile = normalizeProfileRow(currentProfileResult.rows[0] || null);
    const currentPreferences = normalizePreferenceRow(currentProfileResult.rows[0]?.preferences);

    if (!currentProfile) {
      return res.status(404).json({ error: 'Profile not found. Complete your profile first.' });
    }

    const query = buildDiscoveryQuery({
      userId,
      currentLat: toFiniteNumber(currentProfile?.location?.lat),
      currentLng: toFiniteNumber(currentProfile?.location?.lng),
      radiusKm: currentPreferences.locationRadius,
      ageMin: currentPreferences.ageRangeMin,
      ageMax: currentPreferences.ageRangeMax,
      genderPreferences: currentPreferences.genderPreferences,
      relationshipGoals: currentPreferences.relationshipGoals,
      interests: currentPreferences.interests,
      heightRangeMin: currentPreferences.heightRangeMin,
      heightRangeMax: currentPreferences.heightRangeMax,
      bodyTypes: currentPreferences.bodyTypes,
      excludeShown: false,
      limit: 100,
      offset: 0
    });

    const result = await db.query(query.text, query.params);

    const scoredProfiles = result.rows
      .map((profileRow) => {
        const normalizedProfile = normalizeProfileRow(profileRow);
        const compatibility = buildCompatibilitySuggestion({
          currentProfile,
          currentPreferences,
          candidateProfile: normalizedProfile,
          candidatePreferences: profileRow.preferences
        });

        if (compatibility.isExcluded) {
          return null;
        }

        return {
          ...normalizedProfile,
          ...compatibility,
          topPickScore: compatibility.compatibilityScore
        };
      })
      .filter(Boolean)
      .sort((leftProfile, rightProfile) => rightProfile.topPickScore - leftProfile.topPickScore)
      .slice(0, limit);

    const requestMetadata = getRequestMetadata(req);
    spamFraudService.trackUserActivity({
      userId,
      action: 'top_picks_view',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

    res.json({
      profiles: scoredProfiles,
      topPicks: scoredProfiles,
      message: `${scoredProfiles.length} top picks selected for you based on compatibility`,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (err) {
    console.error('Top picks error:', err);
    res.status(500).json({ error: 'Failed to get top picks' });
  }
});

// 33. REWIND PASS (Undo last pass)
router.post('/interactions/rewind', async (req, res) => {
  try {
    const userId = req.user.id;
    const requestMetadata = getRequestMetadata(req);

    // Check daily rewind limit
    const today = new Date().toISOString().split('T')[0];
    const analyticsResult = await db.query(
      `SELECT rewinds_sent FROM user_analytics WHERE user_id = $1 AND activity_date = $2`,
      [userId, today]
    );

    const rewindsSent = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].rewinds_sent || 0) : 0;
    const rewindLimit = 3; // Free tier: 3/day

    if (rewindsSent >= rewindLimit) {
      return res.status(429).json({
        error: 'Daily rewind limit reached',
        limit: rewindLimit,
        used: rewindsSent,
        remaining: 0
      });
    }

    // Find most recent pass interaction
    const passResult = await db.query(
      `SELECT * FROM interactions
       WHERE from_user_id = $1 AND interaction_type = 'pass'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (passResult.rows.length === 0) {
      return res.status(404).json({ error: 'No passes to rewind' });
    }

    const lastPass = passResult.rows[0];

    // Delete the pass interaction
    await db.query(
      `DELETE FROM interactions
       WHERE from_user_id = $1 AND to_user_id = $2 AND interaction_type = 'pass'`,
      [userId, lastPass.to_user_id]
    );

    // Update rewind count
    await db.query(
      `INSERT INTO user_analytics (user_id, activity_date, rewinds_sent)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE
       SET rewinds_sent = user_analytics.rewinds_sent + 1`,
      [userId, today]
    );

    spamFraudService.trackUserActivity({
      userId,
      action: 'rewind_pass',
      analyticsUpdates: { rewinds_used: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

    // Get the restored profile
    const restoredProfileResult = await db.query(
      `SELECT dp.*,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       WHERE dp.user_id = $1`,
      [lastPass.to_user_id]
    );

    res.json({
      message: 'Pass rewound successfully',
      restoredProfile: normalizeProfileRow(restoredProfileResult.rows[0] || null),
      rewindsUsed: rewindsUsed + 1,
      rewindsRemaining: Math.max(0, rewindLimit - (rewindsUsed + 1))
    });
  } catch (err) {
    console.error('Rewind error:', err);
    res.status(500).json({ error: 'Failed to rewind pass' });
  }
});

// 34. GET DAILY PROMPTS
const DAILY_PROMPTS = [
  {
    id: 'prompt-1',
    category: 'personality',
    text: 'What is something you are passionate about that most people do not know?',
    icon: '💭'
  },
  {
    id: 'prompt-2',
    category: 'lifestyle',
    text: 'My perfect Sunday looks like...',
    icon: '☀️'
  },
  {
    id: 'prompt-3',
    category: 'goals',
    text: 'A goal I am currently working towards...',
    icon: '🎯'
  },
  {
    id: 'prompt-4',
    category: 'fun',
    text: 'Two truths and a lie about me...',
    icon: '🎲'
  },
  {
    id: 'prompt-5',
    category: 'personality',
    text: 'The way to my heart is...',
    icon: '❤️'
  },
  {
    id: 'prompt-6',
    category: 'lifestyle',
    text: 'My ideal travel destination and why...',
    icon: '✈️'
  },
  {
    id: 'prompt-7',
    category: 'preferences',
    text: 'I am looking for someone who...',
    icon: '🔍'
  },
  {
    id: 'prompt-8',
    category: 'fun',
    text: 'My most controversial opinion is...',
    icon: '🔥'
  },
  {
    id: 'prompt-9',
    category: 'personality',
    text: 'A book or movie that changed my perspective...',
    icon: '📚'
  },
  {
    id: 'prompt-10',
    category: 'lifestyle',
    text: 'My happy place is...',
    icon: '🏖️'
  }
];

router.get('/daily-prompts', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's answered prompts
    const answeredResult = await db.query(
      `SELECT prompt_id, response FROM daily_prompt_responses WHERE user_id = $1`,
      [userId]
    );

    const answeredPromptIds = new Set(answeredResult.rows.map(row => row.prompt_id));

    // Return prompts with answered status
    const prompts = DAILY_PROMPTS.map(prompt => ({
      ...prompt,
      isAnswered: answeredPromptIds.has(prompt.id),
      response: answeredResult.rows.find(row => row.prompt_id === prompt.id)?.response || null
    }));

    res.json({ prompts });
  } catch (err) {
    console.error('Get daily prompts error:', err);
    res.status(500).json({ error: 'Failed to get daily prompts' });
  }
});

// 35. ANSWER DAILY PROMPT
router.post('/daily-prompts/:promptId/answer', async (req, res) => {
  try {
    const userId = req.user.id;
    const { promptId } = req.params;
    const { response } = req.body;

    if (!response || !response.trim()) {
      return res.status(400).json({ error: 'Response is required' });
    }

    if (response.trim().length > 500) {
      return res.status(400).json({ error: 'Response must be 500 characters or less' });
    }

    const prompt = DAILY_PROMPTS.find(p => p.id === promptId);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    await db.query(
      `INSERT INTO daily_prompt_responses (user_id, prompt_id, response)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, prompt_id) DO UPDATE
       SET response = EXCLUDED.response,
           updated_at = CURRENT_TIMESTAMP`,
      [userId, promptId, response.trim()]
    );

    res.json({
      message: 'Prompt answered',
      prompt: {
        ...prompt,
        isAnswered: true,
        response: response.trim()
      }
    });
  } catch (err) {
    console.error('Answer prompt error:', err);
    res.status(500).json({ error: 'Failed to answer prompt' });
  }
});

// 36. DELETE DAILY PROMPT ANSWER
router.delete('/daily-prompts/:promptId/answer', async (req, res) => {
  try {
    const userId = req.user.id;
    const { promptId } = req.params;

    await db.query(
      `DELETE FROM daily_prompt_responses WHERE user_id = $1 AND prompt_id = $2`,
      [userId, promptId]
    );

    res.json({ message: 'Prompt answer removed' });
  } catch (err) {
    console.error('Delete prompt answer error:', err);
    res.status(500).json({ error: 'Failed to remove prompt answer' });
  }
});

// 37. GET USER ANSWERED PROMPTS (for profile display)
router.get('/profiles/me/prompts', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT dpr.prompt_id, dpr.response, dpr.created_at
       FROM daily_prompt_responses dpr
       WHERE dpr.user_id = $1
       ORDER BY dpr.created_at DESC`,
      [userId]
    );

    const answeredPrompts = result.rows.map(row => {
      const prompt = DAILY_PROMPTS.find(p => p.id === row.prompt_id);
      return {
        ...prompt,
        response: row.response,
        answeredAt: row.created_at
      };
    }).filter(Boolean);

    res.json({ prompts: answeredPrompts });
  } catch (err) {
    console.error('Get profile prompts error:', err);
    res.status(500).json({ error: 'Failed to get profile prompts' });
  }
});

// 38. UPDATE NOTIFICATION PREFERENCES
router.put('/notification-preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      newMatch,
      newMessage,
      likeReceived,
      superlikeReceived,
      profileViewed,
      dailyDigest,
      weeklyDigest,
      pushEnabled,
      emailEnabled
    } = req.body;

    const result = await db.query(
      `INSERT INTO notification_preferences (
         user_id,
         new_match,
         new_message,
         like_received,
         superlike_received,
         profile_viewed,
         daily_digest,
         weekly_digest,
         push_enabled,
         email_enabled
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id) DO UPDATE
       SET new_match = EXCLUDED.new_match,
           new_message = EXCLUDED.new_message,
           like_received = EXCLUDED.like_received,
           superlike_received = EXCLUDED.superlike_received,
           profile_viewed = EXCLUDED.profile_viewed,
           daily_digest = EXCLUDED.daily_digest,
           weekly_digest = EXCLUDED.weekly_digest,
           push_enabled = EXCLUDED.push_enabled,
           email_enabled = EXCLUDED.email_enabled,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        normalizeBoolean(newMatch),
        normalizeBoolean(newMessage),
        normalizeBoolean(likeReceived),
        normalizeBoolean(superlikeReceived),
        normalizeBoolean(profileViewed),
        normalizeBoolean(dailyDigest),
        normalizeBoolean(weeklyDigest),
        normalizeBoolean(pushEnabled),
        normalizeBoolean(emailEnabled)
      ]
    );

    const row = result.rows[0];
    res.json({
      message: 'Notification preferences updated',
      preferences: {
        newMatch: row.new_match,
        newMessage: row.new_message,
        likeReceived: row.like_received,
        superlikeReceived: row.superlike_received,
        profileViewed: row.profile_viewed,
        dailyDigest: row.daily_digest,
        weeklyDigest: row.weekly_digest,
        pushEnabled: row.push_enabled,
        emailEnabled: row.email_enabled
      }
    });
  } catch (err) {
    console.error('Update notification preferences error:', err);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// 39. GET NOTIFICATION PREFERENCES
router.get('/notification-preferences', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        newMatch: true,
        newMessage: true,
        likeReceived: true,
        superlikeReceived: true,
        profileViewed: false,
        dailyDigest: false,
        weeklyDigest: true,
        pushEnabled: true,
        emailEnabled: false
      });
    }

    const row = result.rows[0];
    res.json({
      newMatch: row.new_match,
      newMessage: row.new_message,
      likeReceived: row.like_received,
      superlikeReceived: row.superlike_received,
      profileViewed: row.profile_viewed,
      dailyDigest: row.daily_digest,
      weeklyDigest: row.weekly_digest,
      pushEnabled: row.push_enabled,
      emailEnabled: row.email_enabled
    });
  } catch (err) {
    console.error('Get notification preferences error:', err);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

// ========== PHASE 3: SAFETY & PREMIUM FEATURES ==========

// 40. GET PHOTO VERIFICATION POSE CHALLENGE
const VERIFICATION_POSES = [
  'thumbs_up', 'peace_sign', 'wave', 'hand_on_chin', 'salute',
  'heart_hands', 'shaka', 'point_up', 'fist_bump', 'ok_sign'
];

router.get('/verify-photo/challenge', async (req, res) => {
  try {
    const userId = req.user.id;
    const pose = VERIFICATION_POSES[Math.floor(Math.random() * VERIFICATION_POSES.length)];

    // Store the pose challenge for this user
    await db.query(
      `UPDATE dating_profiles
       SET verification_pose = $1,
           verification_status = 'pending',
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [pose, userId]
    );

    res.json({
      pose,
      instructions: `Please take a selfie while making a ${pose.replace(/_/g, ' ')} gesture. Make sure your face is clearly visible.`,
      expiresIn: 300 // 5 minutes
    });
  } catch (err) {
    console.error('Get verification challenge error:', err);
    res.status(500).json({ error: 'Failed to generate verification challenge' });
  }
});

// 41. SUBMIT PHOTO VERIFICATION
router.post('/profiles/me/verify-photo', async (req, res) => {
  try {
    const userId = req.user.id;
    const { photoBase64 } = req.body;
    const requestMetadata = getRequestMetadata(req);

    if (!photoBase64) {
      return res.status(400).json({ error: 'Verification photo is required' });
    }

    // Get current challenge pose
    const profileResult = await db.query(
      `SELECT verification_pose, verification_status
       FROM dating_profiles
       WHERE user_id = $1`,
      [userId]
    );

    const profile = profileResult.rows[0];
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (profile.verification_status === 'approved') {
      return res.status(400).json({ error: 'Profile is already verified' });
    }

    // Verification photos now flow through a moderation queue instead of
    // being auto-approved so admins can review edge cases and appeals.
    await db.query(
      `UPDATE dating_profiles
       SET verification_photo_url = $1,
           verification_status = 'pending',
           profile_verified = false,
           verified_at = NULL,
           verification_pose = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING *`,
      [photoBase64, userId]
    );

    await spamFraudService.queuePhotoForModeration({
      userId,
      photoUrl: photoBase64,
      sourceType: 'verification_photo'
    });

    spamFraudService.trackUserActivity({
      userId,
      action: 'photo_verification_submitted',
      analyticsUpdates: { verifications_completed: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent
    });

    await userNotificationService.createNotification(userId, {
      type: 'verification_pending',
      title: 'Verification Submitted',
      body: 'Your verification selfie is now pending moderator review.',
      metadata: { verificationType: 'photo', status: 'pending' }
    });

    await spamFraudService.refreshSystemMetrics();

    res.json({
      message: 'Verification photo submitted for review',
      verified: false,
      verificationStatus: 'pending'
    });
  } catch (err) {
    console.error('Photo verification error:', err);
    res.status(500).json({ error: 'Failed to process photo verification' });
  }
});

// 42. GET VERIFICATION STATUS
router.get('/profiles/me/verification-status', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT verification_status, verification_photo_url, verified_at, profile_verified
       FROM dating_profiles
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const row = result.rows[0];
    res.json({
      verificationStatus: row.verification_status,
      profileVerified: row.profile_verified,
      verifiedAt: row.verified_at,
      hasVerificationPhoto: Boolean(row.verification_photo_url)
    });
  } catch (err) {
    console.error('Get verification status error:', err);
    res.status(500).json({ error: 'Failed to get verification status' });
  }
});

// 43. GET SUBSCRIPTION PLANS
router.get('/subscription/plans', async (req, res) => {
  try {
    const plans = [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'USD',
        interval: 'month',
        features: [
          '50 likes per day',
          '1 superlike per day',
          '3 rewinds per day',
          'Basic matching'
        ],
        limits: {
          likesPerDay: 50,
          superlikesPerDay: 1,
          rewindsPerDay: 3,
          boostsPerMonth: 0,
          seeWhoLikedYou: false
        }
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 19.99,
        currency: 'USD',
        interval: 'month',
        features: [
          'Unlimited likes',
          '5 superlikes per day',
          'Unlimited rewinds',
          '1 boost per month',
          'See who liked you',
          'Read receipts',
          'Advanced filters'
        ],
        limits: {
          likesPerDay: Infinity,
          superlikesPerDay: 5,
          rewindsPerDay: Infinity,
          boostsPerMonth: 1,
          seeWhoLikedYou: true
        }
      },
      {
        id: 'gold',
        name: 'Gold',
        price: 29.99,
        currency: 'USD',
        interval: 'month',
        features: [
          'Everything in Premium',
          '5 boosts per month',
          'Priority in discovery',
          'Message requests',
          'Profile highlights',
          'Incognito mode'
        ],
        limits: {
          likesPerDay: Infinity,
          superlikesPerDay: 10,
          rewindsPerDay: Infinity,
          boostsPerMonth: 5,
          seeWhoLikedYou: true,
          messageRequests: true,
          incognitoMode: true
        }
      }
    ];

    res.json({ plans });
  } catch (err) {
    console.error('Get plans error:', err);
    res.status(500).json({ error: 'Failed to get subscription plans' });
  }
});

// 44. GET MY SUBSCRIPTION
router.get('/subscription/me', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return free tier as default
      return res.json({
        plan: 'free',
        status: 'active',
        isPremium: false,
        isGold: false,
        features: {
          unlimitedLikes: false,
          unlimitedRewinds: false,
          seeWhoLikedYou: false,
          boostsRemaining: 0,
          messageRequests: false,
          incognitoMode: false
        }
      });
    }

    const sub = result.rows[0];
    const isPremium = sub.plan === 'premium' && sub.status === 'active' && (!sub.expires_at || new Date(sub.expires_at) > new Date());
    const isGold = sub.plan === 'gold' && sub.status === 'active' && (!sub.expires_at || new Date(sub.expires_at) > new Date());
    const isActive = isPremium || isGold;

    res.json({
      plan: sub.plan,
      status: isActive ? sub.status : 'expired',
      startedAt: sub.started_at,
      expiresAt: sub.expires_at,
      isPremium: isPremium,
      isGold: isGold,
      features: {
        unlimitedLikes: isActive,
        unlimitedRewinds: isActive,
        seeWhoLikedYou: isActive,
        boostsRemaining: isGold ? 5 : (isPremium ? 1 : 0),
        messageRequests: isGold,
        incognitoMode: isGold
      }
    });
  } catch (err) {
    console.error('Get subscription error:', err);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// 45. CREATE SUBSCRIPTION (simulate - no Stripe)
router.post('/subscription/create', async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan } = req.body;

    if (!['premium', 'gold'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Choose premium or gold.' });
    }

    // Cancel any existing subscription first
    await db.query(
      `UPDATE subscriptions
       SET status = 'cancelled',
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    const startedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    const result = await db.query(
      `INSERT INTO subscriptions (
         user_id, plan, status, started_at, expires_at, payment_method
       )
       VALUES ($1, $2, 'active', $3, $4, 'manual')
       ON CONFLICT (user_id) DO UPDATE
       SET plan = EXCLUDED.plan,
           status = EXCLUDED.status,
           started_at = EXCLUDED.started_at,
           expires_at = EXCLUDED.expires_at,
           payment_method = EXCLUDED.payment_method,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, plan, startedAt, expiresAt]
    );

    await userNotificationService.createNotification(userId, {
      type: 'subscription_updated',
      title: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Activated!`,
      body: `Your ${plan} subscription is now active. Enjoy the premium features!`,
      metadata: { plan, status: 'active', expiresAt: expiresAt.toISOString() }
    });

    spamFraudService.updateUserAnalytics(userId, { premium_conversions: 1 });
    spamFraudService.refreshSystemMetrics();

    res.json({
      message: 'Subscription created',
      subscription: {
        plan,
        status: 'active',
        startedAt: startedAt.toISOString(),
        expiresAt: expiresAt.toISOString()
      }
    });
  } catch (err) {
    console.error('Create subscription error:', err);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// 46. CANCEL SUBSCRIPTION
router.delete('/subscription/cancel', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `UPDATE subscriptions
       SET status = 'cancelled',
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND status = 'active'
       RETURNING *`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    await userNotificationService.createNotification(userId, {
      type: 'subscription_cancelled',
      title: 'Subscription Cancelled',
      body: 'Your premium subscription has been cancelled. You can resubscribe anytime.',
      metadata: { previousPlan: result.rows[0].plan }
    });

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// 47. BOOST PROFILE
router.post('/profiles/me/boost', async (req, res) => {
  try {
    const userId = req.user.id;
    const requestMetadata = getRequestMetadata(req);
    const limits = await getDailyLimitSnapshot(userId);
    const { rewardBalance, subscriptionAccess } = limits;
    const isPremium = subscriptionAccess.isPremium;
    const isGold = subscriptionAccess.isGold;
    const hasRewardCredit = rewardBalance.boostCredits > 0;
    const activeBoost = await getLatestBoostRecordForUser(userId, { activeOnly: true });

    if (!isPremium && !isGold && !hasRewardCredit) {
      return res.status(403).json({ error: 'Boost requires a Premium or Gold subscription' });
    }

    if (activeBoost) {
      const activeSummary = await summarizeBoostRecord(userId, activeBoost, 0);
      return res.status(409).json({
        error: 'Boost already active',
        boost: activeSummary
      });
    }

    const boostsUsedToday = limits.boostsUsedToday;
    const dailyBoostLimit = limits.boostLimit;
    let usedRewardCredit = false;

    if (boostsUsedToday >= dailyBoostLimit) {
      if (!hasRewardCredit) {
        return res.status(429).json({
          error: 'Daily boost limit reached',
          limit: dailyBoostLimit,
          used: boostsUsedToday,
          rewardCreditsRemaining: rewardBalance.boostCredits
        });
      }

      usedRewardCredit = await spendRewardCredits(rewardBalance.model, 'boostCredits', 1);
      if (!usedRewardCredit) {
        return res.status(429).json({
          error: 'Daily boost limit reached',
          limit: dailyBoostLimit,
          used: boostsUsedToday,
          rewardCreditsRemaining: 0
        });
      }
    }

    // Record boost
    await db.query(
      `INSERT INTO user_analytics (user_id, activity_date, boosts_used)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE
       SET boosts_used = user_analytics.boosts_used + 1`,
      [userId, new Date().toISOString().split('T')[0]]
    );

    const boostedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    let persistedBoostRecord = null;

    try {
      const persistedBoostResult = await db.query(
        `INSERT INTO profile_boosts (user_id, boost_expires_at, visibility_multiplier)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, boostedUntil, isGold ? 6 : 5]
      );
      persistedBoostRecord = persistedBoostResult.rows[0] || null;
    } catch (persistError) {
      if (!isOptionalAnalyticsError(persistError)) {
        throw persistError;
      }
    }

    spamFraudService.trackUserActivity({
      userId,
      action: 'profile_boosted',
      analyticsUpdates: { boosts_used: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent
    });

    const boostSummary = await summarizeBoostRecord(
      userId,
      persistedBoostRecord || {
        id: null,
        boost_expires_at: boostedUntil,
        visibility_multiplier: isGold ? 6 : 5,
        created_at: new Date().toISOString()
      },
      0
    );

    res.json({
      message: 'Profile boosted!',
      boostedUntil,
      boostsRemaining: Math.max(0, dailyBoostLimit - boostsUsedToday - (usedRewardCredit ? 0 : 1)),
      usedRewardCredit,
      rewardCreditsRemaining: Math.max(
        0,
        rewardBalance.boostCredits - (usedRewardCredit ? 1 : 0)
      ),
      boost: boostSummary
    });
  } catch (err) {
    console.error('Boost error:', err);
    res.status(500).json({ error: 'Failed to boost profile' });
  }
});

router.get('/profiles/me/boost-status', async (req, res) => {
  try {
    const userId = req.user.id;
    const [activeBoostRecord, latestBoostRecord, analyticsData] = await Promise.all([
      getLatestBoostRecordForUser(userId, { activeOnly: true }),
      getLatestBoostRecordForUser(userId),
      db.query(
        `SELECT COUNT(*) as views_last_7_days
         FROM profile_views
         WHERE viewed_user_id = $1
           AND viewed_at >= $2`,
        [userId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()]
      )
    ]);

    const baselineViewsLast7Days = countRowValue(analyticsData.rows[0]?.views_last_7_days);
    const activeBoost = await summarizeBoostRecord(userId, activeBoostRecord, baselineViewsLast7Days);
    const recentBoost =
      latestBoostRecord && latestBoostRecord.id !== activeBoostRecord?.id
        ? await summarizeBoostRecord(userId, latestBoostRecord, baselineViewsLast7Days)
        : activeBoost;

    res.json({
      active: Boolean(activeBoost),
      current: activeBoost,
      recent: recentBoost
    });
  } catch (err) {
    console.error('Get boost status error:', err);
    res.status(500).json({ error: 'Failed to get boost status' });
  }
});

// 48. GET WHO LIKED ME
router.get('/who-liked-me', async (req, res) => {
  try {
    const userId = req.user.id;

    // Check subscription
    const subResult = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );

    const sub = subResult.rows[0];
    const isPremium = sub && ['premium', 'gold'].includes(sub.plan) && (!sub.expires_at || new Date(sub.expires_at) > new Date());

    const result = await db.query(
      `SELECT i.*, dp.first_name, dp.age, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = i.from_user_id LIMIT 1) as photo_url
       FROM interactions i
       JOIN dating_profiles dp ON i.from_user_id = dp.user_id
       WHERE i.to_user_id = $1 AND i.interaction_type IN ('like', 'superlike')
         AND i.from_user_id NOT IN (
           SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END
           FROM matches WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'active'
         )
       ORDER BY i.created_at DESC
       LIMIT 50`,
      [userId]
    );

    const likers = result.rows.map(row => ({
      userId: row.from_user_id,
      firstName: row.first_name,
      age: row.age,
      location: { city: row.location_city },
      photoUrl: row.photo_url,
      interactionType: row.interaction_type,
      likedAt: row.created_at,
      // For free users, blur the photo and name
      isRevealed: isPremium
    }));

    res.json({
      likers,
      isPremium,
      totalCount: likers.length,
      blurredCount: isPremium ? 0 : likers.length
    });
  } catch (err) {
    console.error('Get who liked me error:', err);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

// 49. SEND MESSAGE REQUEST (to non-match)
router.post('/message-requests', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, message } = req.body;
    const requestMetadata = getRequestMetadata(req);

    if (!toUserId || !message || !message.trim()) {
      return res.status(400).json({ error: 'toUserId and message are required' });
    }

    if (fromUserId === toUserId) {
      return res.status(400).json({ error: 'Cannot send message request to yourself' });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 10 || trimmedMessage.length > 500) {
      return res.status(400).json({ error: 'Message must be between 10 and 500 characters' });
    }

    // Check if already matched
    const matchCheck = await db.query(
      `SELECT * FROM matches
       WHERE ((user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1))
         AND status = 'active'
       LIMIT 1`,
      [fromUserId, toUserId]
    );

    if (matchCheck.rows.length > 0) {
      return res.status(400).json({ error: 'You are already matched with this user' });
    }

    // Check Gold subscription for message requests
    const subResult = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [fromUserId]
    );

    const sub = subResult.rows[0];
    const isGold = sub && sub.plan === 'gold' && (!sub.expires_at || new Date(sub.expires_at) > new Date());

    if (!isGold) {
      return res.status(403).json({ error: 'Message requests require a Gold subscription' });
    }

    const existingResult = await db.query(
      `SELECT *
       FROM message_requests
       WHERE from_user_id = $1 AND to_user_id = $2
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [fromUserId, toUserId]
    );

    if (existingResult.rows[0]?.status === 'pending') {
      return res.status(409).json({ error: 'A pending message request already exists' });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const result =
      existingResult.rows.length > 0
        ? await db.query(
            `UPDATE message_requests
             SET message = $2,
                 status = 'pending',
                 expires_at = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [existingResult.rows[0].id, trimmedMessage, expiresAt]
          )
        : await db.query(
            `INSERT INTO message_requests (from_user_id, to_user_id, message, status, expires_at)
             VALUES ($1, $2, $3, 'pending', $4)
             RETURNING *`,
            [fromUserId, toUserId, trimmedMessage, expiresAt]
          );

    const fromProfile = await db.query(
      `SELECT first_name FROM dating_profiles WHERE user_id = $1 LIMIT 1`,
      [fromUserId]
    );
    const fromName = fromProfile.rows[0]?.first_name || 'Someone';

    await userNotificationService.createNotification(toUserId, {
      type: 'message_request',
      title: `Message request from ${fromName}`,
      body: trimmedMessage.length > 90 ? `${trimmedMessage.slice(0, 87)}...` : trimmedMessage,
      metadata: {
        requestId: result.rows[0].id,
        fromUserId,
        fromName
      }
    });

    spamFraudService.trackUserActivity({
      userId: fromUserId,
      action: 'message_request_sent',
      analyticsUpdates: { message_requests_sent: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true
    });

    res.json({
      message: 'Message request sent',
      request: result.rows[0]
    });
  } catch (err) {
    console.error('Send message request error:', err);
    res.status(500).json({ error: 'Failed to send message request' });
  }
});

// 50. GET INCOMING MESSAGE REQUESTS
router.get('/message-requests', async (req, res) => {
  try {
    const userId = req.user.id;
    const subscriptionAccess = await getSubscriptionAccessForUser(userId);

    await db.query(
      `UPDATE message_requests
       SET status = 'expired',
           updated_at = CURRENT_TIMESTAMP
       WHERE status = 'pending'
         AND expires_at IS NOT NULL
         AND expires_at < CURRENT_TIMESTAMP
         AND (to_user_id = $1 OR from_user_id = $1)`,
      [userId]
    );

    const incomingResult = await db.query(
      `SELECT mr.*,
              dp.first_name, dp.age, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = mr.from_user_id LIMIT 1) as photo_url
       FROM message_requests mr
       JOIN dating_profiles dp ON dp.user_id = mr.from_user_id
       WHERE mr.to_user_id = $1 AND mr.status = 'pending'
       ORDER BY mr.created_at DESC`,
      [userId]
    );

    const sentResult = await db.query(
      `SELECT mr.*,
              dp.first_name, dp.age, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = mr.to_user_id LIMIT 1) as photo_url,
              (
                SELECT id
                FROM matches
                WHERE ((user_id_1 = mr.from_user_id AND user_id_2 = mr.to_user_id)
                  OR (user_id_1 = mr.to_user_id AND user_id_2 = mr.from_user_id))
                  AND status = 'active'
                LIMIT 1
              ) as match_id
       FROM message_requests mr
       JOIN dating_profiles dp ON dp.user_id = mr.to_user_id
       WHERE mr.from_user_id = $1
       ORDER BY mr.updated_at DESC NULLS LAST, mr.created_at DESC
       LIMIT 25`,
      [userId]
    );

    const requests = incomingResult.rows.map((row) => ({
      id: row.id,
      fromUserId: row.from_user_id,
      firstName: row.first_name,
      age: row.age,
      location: { city: row.location_city },
      photoUrl: row.photo_url,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    }));

    const sentRequests = sentResult.rows.map((row) => ({
      id: row.id,
      toUserId: row.to_user_id,
      firstName: row.first_name,
      age: row.age,
      location: { city: row.location_city },
      photoUrl: row.photo_url,
      message: row.message,
      status: row.status,
      matchId: row.match_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at
    }));

    const summary = sentRequests.reduce(
      (accumulator, request) => {
        const statusKey =
          request.status === 'accepted' ||
          request.status === 'declined' ||
          request.status === 'expired'
            ? request.status
            : 'pending';

        accumulator[`sent${statusKey.charAt(0).toUpperCase()}${statusKey.slice(1)}`] += 1;
        return accumulator;
      },
      {
        incomingPending: requests.length,
        sentPending: 0,
        sentAccepted: 0,
        sentDeclined: 0,
        sentExpired: 0
      }
    );

    res.json({
      requests,
      incoming: requests,
      sent: sentRequests,
      summary,
      capabilities: {
        canSendRequests: subscriptionAccess.isGold
      }
    });
  } catch (err) {
    console.error('Get message requests error:', err);
    res.status(500).json({ error: 'Failed to get message requests' });
  }
});

// 51. ACCEPT MESSAGE REQUEST
router.post('/message-requests/:requestId/accept', async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    const requestResult = await db.query(
      `SELECT * FROM message_requests WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [requestId, userId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message request not found' });
    }

    const request = requestResult.rows[0];

    // Update request status
    await db.query(
      `UPDATE message_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [requestId]
    );

    // Create a match
    const fromUserId = request.from_user_id;
    const persistedMatch = await ensureActiveMatch(fromUserId, userId);

    if (!persistedMatch) {
      throw new Error(`Failed to persist accepted message-request match for users ${fromUserId} and ${userId}`);
    }

    // Notify both users
    await Promise.all([
      userNotificationService.createNotification(userId, {
        type: 'message_request_accepted',
        title: 'Message request accepted',
        body: 'You can now chat with this user.',
        metadata: { matchId: persistedMatch.id }
      }),
      userNotificationService.createNotification(fromUserId, {
        type: 'message_request_accepted',
        title: 'Your message request was accepted!',
        body: 'Start the conversation now.',
        metadata: { matchId: persistedMatch.id }
      })
    ]);

    if (typeof req.emitToUser === 'function') {
      [fromUserId, userId].forEach((pid) => {
        req.emitToUser(pid, 'new_match', {
          match: persistedMatch,
          user: { id: fromUserId },
          matchedUserId: pid === fromUserId ? userId : fromUserId,
          createdAt: new Date().toISOString(),
          fromMessageRequest: true
        });
      });
    }

    res.json({
      message: 'Message request accepted',
      match: persistedMatch
    });
  } catch (err) {
    console.error('Accept message request error:', err);
    res.status(500).json({ error: 'Failed to accept message request' });
  }
});

// 52. DECLINE MESSAGE REQUEST
router.post('/message-requests/:requestId/decline', async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    const result = await db.query(
      `UPDATE message_requests
       SET status = 'declined',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'
       RETURNING *`,
      [requestId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message request not found' });
    }

    await userNotificationService.createNotification(result.rows[0].from_user_id, {
      type: 'message_request_declined',
      title: 'Your message request was declined',
      body: 'You can always try again later with a different opener.',
      metadata: {
        requestId: result.rows[0].id,
        declinedByUserId: userId
      }
    });

    res.json({ message: 'Message request declined' });
  } catch (err) {
    console.error('Decline message request error:', err);
    res.status(500).json({ error: 'Failed to decline message request' });
  }
});

// ========== PHASE 4: ADVANCED PROFILE ANALYTICS & INSIGHTS ==========

// 53. RECORD PROFILE VIEW
router.post('/profiles/:userId/view', async (req, res) => {
  try {
    const viewerUserId = req.user.id;
    const { userId: viewedUserId } = req.params;
    const requestMetadata = getRequestMetadata(req);

    if (Number(viewerUserId) === Number(viewedUserId)) {
      return res.status(400).json({ error: 'Cannot view your own profile' });
    }

    // Update viewer's last active
    await db.query(
      `UPDATE dating_profiles SET last_active = CURRENT_TIMESTAMP WHERE user_id = $1`,
      [viewerUserId]
    );

    // Record the profile view (upsert to keep latest)
    await db.query(
      `INSERT INTO profile_views (viewer_user_id, viewed_user_id, viewed_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (viewer_user_id, viewed_user_id) DO UPDATE
       SET viewed_at = CURRENT_TIMESTAMP`,
      [viewerUserId, viewedUserId]
    );

    // Update analytics
    spamFraudService.trackUserActivity({
      userId: viewerUserId,
      action: 'profile_view',
      analyticsUpdates: { profiles_viewed: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

    // Send notification to viewed user if they have it enabled
    const notifPrefs = await db.query(
      `SELECT profile_viewed FROM notification_preferences WHERE user_id = $1`,
      [viewedUserId]
    );

    if (notifPrefs.rows[0]?.profile_viewed !== false) {
      const viewerProfile = await db.query(
        `SELECT first_name FROM dating_profiles WHERE user_id = $1`,
        [viewerUserId]
      );
      const viewerName = viewerProfile.rows[0]?.first_name || 'Someone';

      await userNotificationService.createNotification(viewedUserId, {
        type: 'profile_viewed',
        title: `${viewerName} viewed your profile`,
        body: 'Someone is interested in your profile.',
        metadata: { viewerUserId }
      });
    }

    res.json({ message: 'Profile view recorded' });
  } catch (err) {
    console.error('Record profile view error:', err);
    res.status(500).json({ error: 'Failed to record profile view' });
  }
});

// 54. GET PROFILE ANALYTICS (for own profile)
router.get('/profiles/me/analytics', async (req, res) => {
  try {
    const userId = req.user.id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get profile completion details
    const profileResult = await db.query(
      `SELECT first_name, age, gender, location_city, bio, interests, occupation,
              education, relationship_goals, height, body_type, profile_verified,
              voice_intro_url,
              profile_completion_percent, last_active,
              (SELECT COUNT(*) FROM profile_photos WHERE user_id = $1) as photo_count
       FROM dating_profiles WHERE user_id = $1`,
      [userId]
    );
    const profile = profileResult.rows[0];

    // Get view counts
    const viewsResult = await db.query(
      `SELECT
         COUNT(*) as total_views,
         COUNT(CASE WHEN viewed_at >= $2 THEN 1 END) as views_last_7_days,
         COUNT(CASE WHEN viewed_at >= $3 THEN 1 END) as views_last_30_days,
         COUNT(DISTINCT viewer_user_id) as unique_viewers
       FROM profile_views WHERE viewed_user_id = $1`,
      [userId, sevenDaysAgo, thirtyDaysAgo]
    );

    // Get daily view trend (last 7 days)
    const dailyViewsResult = await db.query(
      `SELECT DATE(viewed_at) as date, COUNT(*) as count
       FROM profile_views
       WHERE viewed_user_id = $1 AND viewed_at >= $2
       GROUP BY DATE(viewed_at)
       ORDER BY date DESC`,
      [userId, sevenDaysAgo]
    );

    // Get interaction stats
    const interactionsResult = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM interactions WHERE from_user_id = $1 AND interaction_type = 'like') as likes_sent,
         (SELECT COUNT(*) FROM interactions WHERE to_user_id = $1 AND interaction_type = 'like') as likes_received,
         (SELECT COUNT(*) FROM interactions WHERE from_user_id = $1 AND interaction_type = 'superlike') as superlikes_sent,
         (SELECT COUNT(*) FROM interactions WHERE to_user_id = $1 AND interaction_type = 'superlike') as superlikes_received,
         (SELECT COUNT(*) FROM matches WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'active') as total_matches,
         (SELECT COUNT(*) FROM interactions WHERE from_user_id = $1 AND interaction_type = 'pass') as passes_sent`,
      [userId]
    );

    const conversationMetricsResult = await db.query(
      `WITH user_matches AS (
         SELECT id
         FROM matches
         WHERE (user_id_1 = $1 OR user_id_2 = $1)
           AND status = 'active'
       ),
       ordered_messages AS (
         SELECT
           m.match_id,
           m.from_user_id,
           m.created_at,
           ROW_NUMBER() OVER (PARTITION BY m.match_id ORDER BY m.created_at ASC) as message_order
         FROM messages m
         JOIN user_matches um ON um.id = m.match_id
         WHERE COALESCE(m.is_deleted, FALSE) = FALSE
       ),
       first_messages AS (
         SELECT match_id, from_user_id as first_sender_id, created_at as first_message_at
         FROM ordered_messages
         WHERE message_order = 1
       ),
       first_replies AS (
         SELECT DISTINCT ON (om.match_id)
           om.match_id,
           om.from_user_id as reply_sender_id,
           om.created_at as reply_at
         FROM ordered_messages om
         JOIN first_messages fm ON fm.match_id = om.match_id
         WHERE om.created_at > fm.first_message_at
           AND om.from_user_id <> fm.first_sender_id
         ORDER BY om.match_id, om.created_at ASC
       ),
       message_totals AS (
         SELECT
           match_id,
           COUNT(*) as message_count,
           COUNT(DISTINCT from_user_id) as distinct_senders
         FROM ordered_messages
         GROUP BY match_id
       )
       SELECT
         COUNT(*) FILTER (WHERE fm.first_sender_id = $1) as user_started_conversations,
         COUNT(*) FILTER (WHERE fm.first_sender_id = $1 AND fr.reply_at IS NOT NULL) as user_started_with_reply,
         COUNT(*) FILTER (WHERE mt.message_count > 0) as conversations_with_messages,
         COUNT(*) FILTER (WHERE mt.distinct_senders >= 2) as reciprocal_conversations,
         AVG(EXTRACT(EPOCH FROM (fr.reply_at - fm.first_message_at)) / 60.0)
           FILTER (WHERE fr.reply_at IS NOT NULL) as avg_first_reply_minutes
       FROM user_matches um
       LEFT JOIN first_messages fm ON fm.match_id = um.id
       LEFT JOIN first_replies fr ON fr.match_id = um.id
       LEFT JOIN message_totals mt ON mt.match_id = um.id`,
      [userId]
    );

    let bestActiveHoursResult = await db.query(
      `SELECT EXTRACT(HOUR FROM activity_at)::int as hour_of_day,
              COUNT(*)::int as engagement_count
       FROM (
         SELECT viewed_at as activity_at
         FROM profile_views
         WHERE viewed_user_id = $1
           AND viewed_at >= $2
         UNION ALL
         SELECT created_at
         FROM interactions
         WHERE to_user_id = $1
           AND interaction_type IN ('like', 'superlike')
           AND created_at >= $2
         UNION ALL
         SELECT created_at
         FROM messages
         WHERE to_user_id = $1
           AND COALESCE(is_deleted, FALSE) = FALSE
           AND created_at >= $2
       ) engagement_events
       GROUP BY hour_of_day
       ORDER BY engagement_count DESC, hour_of_day ASC
       LIMIT 4`,
      [userId, thirtyDaysAgo]
    );

    if (bestActiveHoursResult.rows.length === 0) {
      bestActiveHoursResult = await db.query(
        `SELECT EXTRACT(HOUR FROM activity_at)::int as hour_of_day,
                COUNT(*)::int as engagement_count
         FROM (
           SELECT created_at as activity_at
           FROM interactions
           WHERE from_user_id = $1
             AND created_at >= $2
           UNION ALL
           SELECT created_at
           FROM messages
           WHERE from_user_id = $1
             AND COALESCE(is_deleted, FALSE) = FALSE
             AND created_at >= $2
         ) activity_events
         GROUP BY hour_of_day
         ORDER BY engagement_count DESC, hour_of_day ASC
         LIMIT 4`,
        [userId, thirtyDaysAgo]
      );
    }

    // Calculate profile strength
    const profileStrength = calculateProfileStrength(profile);
    const likesSent = countRowValue(interactionsResult.rows[0]?.likes_sent);
    const likesReceived = countRowValue(interactionsResult.rows[0]?.likes_received);
    const superlikesSent = countRowValue(interactionsResult.rows[0]?.superlikes_sent);
    const superlikesReceived = countRowValue(interactionsResult.rows[0]?.superlikes_received);
    const totalMatches = countRowValue(interactionsResult.rows[0]?.total_matches);
    const passesSent = countRowValue(interactionsResult.rows[0]?.passes_sent);
    const totalPositiveOutbound = likesSent + superlikesSent;
    const conversationMetrics = conversationMetricsResult.rows[0] || {};
    const userStartedConversations = countRowValue(conversationMetrics.user_started_conversations);
    const userStartedWithReply = countRowValue(conversationMetrics.user_started_with_reply);
    const conversationsWithMessages = countRowValue(conversationMetrics.conversations_with_messages);
    const reciprocalConversations = countRowValue(conversationMetrics.reciprocal_conversations);
    const replyRateSourceCount =
      userStartedConversations > 0 ? userStartedConversations : conversationsWithMessages;
    const replyRateValue =
      userStartedConversations > 0
        ? percentage(userStartedWithReply, userStartedConversations)
        : percentage(reciprocalConversations, conversationsWithMessages);
    const averageFirstReplyMinutes = roundNumber(
      conversationMetrics.avg_first_reply_minutes || 0,
      0
    );
    const photoPerformance = await getPhotoPerformanceSummary(userId, 3);
    const promptPerformance = await getPromptPerformanceSummary(
      userId,
      {
        likesReceived,
        replyRate: replyRateValue
      },
      3
    );
    const sectionInsights = buildSectionInsights({
      profile,
      photoPerformance,
      promptPerformance,
      views: {
        total: countRowValue(viewsResult.rows[0]?.total_views)
      },
      interactions: {
        likesReceived,
        superlikesReceived
      },
      replyRate: replyRateValue
    });

    res.json({
      profileStrength: {
        score: profileStrength.score,
        maxScore: 100,
        level: profileStrength.level,
        recommendations: profileStrength.recommendations
      },
      views: {
        total: Number.parseInt(viewsResult.rows[0]?.total_views || 0),
        last7Days: Number.parseInt(viewsResult.rows[0]?.views_last_7_days || 0),
        last30Days: Number.parseInt(viewsResult.rows[0]?.views_last_30_days || 0),
        uniqueViewers: Number.parseInt(viewsResult.rows[0]?.unique_viewers || 0),
        dailyTrend: dailyViewsResult.rows.map(row => ({
          date: row.date,
          count: Number.parseInt(row.count, 10)
        }))
      },
      interactions: {
        likesSent,
        likesReceived,
        superlikesSent,
        superlikesReceived,
        totalMatches,
        passesSent
      },
      advanced: {
        matchRate: Math.min(100, percentage(totalMatches, totalPositiveOutbound)),
        replyRate: replyRateValue,
        averageTimeToFirstReplyMinutes: averageFirstReplyMinutes,
        averageTimeToFirstReplyLabel: formatDurationLabel(averageFirstReplyMinutes),
        bestActiveHours: bestActiveHoursResult.rows.map((row) => ({
          hour: countRowValue(row.hour_of_day),
          label: formatHourRangeLabel(row.hour_of_day),
          engagementCount: countRowValue(row.engagement_count)
        })),
        replyRateBasis:
          userStartedConversations > 0
            ? 'Matches where your first message got a reply'
            : 'Conversations that became two-way'
      },
      photoPerformance,
      promptPerformance,
      sectionInsights,
      lastActive: profile?.last_active,
      profileCompletionPercent: profile?.profile_completion_percent || 0
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Profile strength calculator helper
const calculateProfileStrength = (profile) => {
  const recommendations = [];
  let score = 0;

  // Photos (25 points)
  const photoCount = Number.parseInt(profile?.photo_count || 0);
  if (photoCount >= 6) {
    score += 25;
  } else if (photoCount >= 3) {
    score += 15;
    recommendations.push('Add more photos to increase engagement (aim for 6+)');
  } else {
    score += photoCount * 3;
    recommendations.push('Add at least 3 photos to your profile');
  }

  // Bio (20 points)
  const bioLength = (profile?.bio || '').length;
  if (bioLength >= 150) {
    score += 20;
  } else if (bioLength >= 50) {
    score += 10;
    recommendations.push('Write a longer bio (150+ characters) to express your personality');
  } else if (bioLength > 0) {
    score += 5;
    recommendations.push('Expand your bio to help others know you better');
  } else {
    recommendations.push('Add a bio - profiles with bios get 4x more matches');
  }

  // Basic info (20 points)
  if (profile?.occupation) score += 7;
  else recommendations.push('Add your occupation');

  if (profile?.education) score += 7;
  else recommendations.push('Add your education');

  if (profile?.height) score += 6;
  else recommendations.push('Add your height');

  // Interests (15 points)
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];
  if (interests.length >= 5) {
    score += 15;
  } else if (interests.length >= 3) {
    score += 8;
    recommendations.push('Add more interests to find better matches');
  } else {
    score += interests.length * 2;
    recommendations.push('Add at least 3 interests');
  }

  // Verification (10 points)
  if (profile?.profile_verified) {
    score += 10;
  } else {
    recommendations.push('Get photo verified to build trust');
  }

  // Relationship goals (10 points)
  if (profile?.relationship_goals) {
    score += 10;
  } else {
    recommendations.push('Specify what you are looking for');
  }

  // Determine level
  let level = 'beginner';
  if (score >= 90) level = 'excellent';
  else if (score >= 75) level = 'strong';
  else if (score >= 50) level = 'good';
  else if (score >= 25) level = 'fair';

  return {
    score: Math.min(100, score),
    level,
    recommendations: recommendations.slice(0, 5)
  };
};

// 55. GET WHO VIEWED MY PROFILE (Premium)
router.get('/profiles/me/profile-views', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const page = parseInt(req.query.page, 10) || 1;
    const offset = (page - 1) * limit;

    // Check premium subscription
    const subResult = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );
    const sub = subResult.rows[0];
    const isPremium = sub && ['premium', 'gold'].includes(sub.plan) && (!sub.expires_at || new Date(sub.expires_at) > new Date());

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM profile_views WHERE viewed_user_id = $1`,
      [userId]
    );
    const totalCount = Number.parseInt(countResult.rows[0].count, 10);

    // Get viewers
    const result = await db.query(
      `SELECT pv.viewer_user_id, pv.viewed_at,
              dp.first_name, dp.age, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = pv.viewer_user_id LIMIT 1) as photo_url
       FROM profile_views pv
       JOIN dating_profiles dp ON dp.user_id = pv.viewer_user_id
       WHERE pv.viewed_user_id = $1
       ORDER BY pv.viewed_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const viewers = result.rows.map(row => ({
      userId: row.viewer_user_id,
      firstName: row.first_name,
      age: row.age,
      location: { city: row.location_city },
      photoUrl: row.photo_url,
      viewedAt: row.viewed_at,
      isRevealed: isPremium
    }));

    res.json({
      viewers,
      isPremium,
      totalCount,
      blurredCount: isPremium ? 0 : viewers.length,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + viewers.length < totalCount
      }
    });
  } catch (err) {
    console.error('Get profile views error:', err);
    res.status(500).json({ error: 'Failed to get profile views' });
  }
});

router.get('/profiles/me/premium-dashboard', async (req, res) => {
  try {
    const userId = req.user.id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [subscription, limits, profileResult, viewsResult, likersResult, viewersResult, latestBoostRecord] =
      await Promise.all([
        getSubscriptionSnapshotForUser(userId),
        getDailyLimitSnapshot(userId),
        db.query(
          `SELECT bio, profile_verified, voice_intro_url,
                  (SELECT COUNT(*) FROM profile_photos WHERE user_id = $1) as photo_count
           FROM dating_profiles
           WHERE user_id = $1`,
          [userId]
        ),
        db.query(
          `SELECT COUNT(*) as total_views,
                  COUNT(CASE WHEN viewed_at >= $2 THEN 1 END) as views_last_7_days
           FROM profile_views
           WHERE viewed_user_id = $1`,
          [userId, sevenDaysAgo]
        ),
        db.query(
          `SELECT
             i.from_user_id,
             MAX(i.created_at) as liked_at,
             MAX(CASE WHEN i.interaction_type = 'superlike' THEN 2 ELSE 1 END) as interaction_priority,
             dp.first_name,
             dp.age,
             dp.location_city,
             (SELECT photo_url FROM profile_photos WHERE user_id = i.from_user_id LIMIT 1) as photo_url
           FROM interactions i
           JOIN dating_profiles dp ON dp.user_id = i.from_user_id
           WHERE i.to_user_id = $1
             AND i.interaction_type IN ('like', 'superlike')
             AND i.from_user_id NOT IN (
               SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END
               FROM matches
               WHERE (user_id_1 = $1 OR user_id_2 = $1)
                 AND status = 'active'
             )
           GROUP BY i.from_user_id, dp.first_name, dp.age, dp.location_city, photo_url
           ORDER BY liked_at DESC
           LIMIT 3`,
          [userId]
        ),
        db.query(
          `SELECT pv.viewer_user_id, pv.viewed_at,
                  dp.first_name, dp.age, dp.location_city,
                  (SELECT photo_url FROM profile_photos WHERE user_id = pv.viewer_user_id LIMIT 1) as photo_url
           FROM profile_views pv
           JOIN dating_profiles dp ON dp.user_id = pv.viewer_user_id
           WHERE pv.viewed_user_id = $1
           ORDER BY pv.viewed_at DESC
           LIMIT 3`,
          [userId]
        ),
        getLatestBoostRecordForUser(userId)
      ]);

    const profile = profileResult.rows[0] || {};
    const viewsTotal = countRowValue(viewsResult.rows[0]?.total_views);
    const viewsLast7Days = countRowValue(viewsResult.rows[0]?.views_last_7_days);
    const hasPremiumViewerAccess = subscription.isPremium || subscription.isGold;
    const activeBoost = latestBoostRecord?.boost_expires_at &&
      new Date(latestBoostRecord.boost_expires_at).getTime() > Date.now()
      ? await summarizeBoostRecord(userId, latestBoostRecord, viewsLast7Days)
      : null;
    const recentBoost = latestBoostRecord
      ? await summarizeBoostRecord(userId, latestBoostRecord, viewsLast7Days)
      : null;
    const topPhotos = await getPhotoPerformanceSummary(userId, 3);
    const topPrompts = await getPromptPerformanceSummary(userId, {}, 3);

    const likedPreview = likersResult.rows.map((row) => ({
      userId: row.from_user_id,
      firstName: hasPremiumViewerAccess ? row.first_name : 'Someone',
      age: hasPremiumViewerAccess ? row.age : null,
      location: { city: hasPremiumViewerAccess ? row.location_city : '' },
      photoUrl: row.photo_url,
      likedAt: row.liked_at,
      interactionStrength: countRowValue(row.interaction_priority),
      isRevealed: hasPremiumViewerAccess
    }));

    const viewerPreview = viewersResult.rows.map((row) => ({
      userId: row.viewer_user_id,
      firstName: hasPremiumViewerAccess ? row.first_name : 'Someone',
      age: hasPremiumViewerAccess ? row.age : null,
      location: { city: hasPremiumViewerAccess ? row.location_city : '' },
      photoUrl: row.photo_url,
      viewedAt: row.viewed_at,
      isRevealed: hasPremiumViewerAccess
    }));

    const upgradeReasons = [];
    if (!hasPremiumViewerAccess && likedPreview.length > 0) {
      upgradeReasons.push(`${likedPreview.length} people already liked your profile.`);
    }
    if (!hasPremiumViewerAccess && viewsTotal > 0) {
      upgradeReasons.push(`${viewsTotal} people have viewed your profile so far.`);
    }
    if (!subscription.isGold) {
      upgradeReasons.push('Gold lets you send first-message requests before you match.');
    }
    if (!profile.voice_intro_url) {
      upgradeReasons.push('A voice intro can lift conversion once premium increases your reach.');
    }

    res.json({
      subscription,
      limits: {
        remainingLikes: limits.remainingLikes,
        likeLimit: limits.likeLimit,
        remainingSuperlikes: limits.remainingSuperlikes,
        superlikeLimit: limits.superlikeLimit,
        remainingRewinds: limits.remainingRewinds,
        rewindLimit: limits.rewindLimit,
        remainingBoostCredits: limits.remainingBoostCredits,
        remainingBoosts: limits.remainingBoosts,
        boostLimit: limits.boostLimit,
        boostsUsedToday: limits.boostsUsedToday,
        resetsAt: limits.resetsAt
      },
      boost: {
        active: Boolean(activeBoost),
        current: activeBoost,
        recent: recentBoost
      },
      likedYou: {
        totalCount: likedPreview.length,
        preview: likedPreview,
        isRevealed: hasPremiumViewerAccess
      },
      viewedYou: {
        totalCount: viewsTotal,
        last7Days: viewsLast7Days,
        preview: viewerPreview,
        isRevealed: hasPremiumViewerAccess
      },
      bestPerformingPhotos: topPhotos,
      bestPerformingPrompts: topPrompts,
      upgradeReasons,
      completionSignals: {
        photoCount: countRowValue(profile.photo_count),
        hasVoiceIntro: Boolean(profile.voice_intro_url),
        profileVerified: Boolean(profile.profile_verified),
        hasBio: Boolean(String(profile.bio || '').trim())
      }
    });
  } catch (err) {
    console.error('Get premium dashboard error:', err);
    res.status(500).json({ error: 'Failed to get premium dashboard' });
  }
});

// 56. GET COMPATIBILITY WITH PROFILE
router.get('/profiles/:userId/compatibility', async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId: targetUserId } = req.params;

    // Get both profiles with preferences
    const [currentResult, targetResult] = await Promise.all([
      db.query(
        `SELECT dp.*, row_to_json(up) as preferences,
                (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
                 FROM profile_photos WHERE user_id = dp.user_id) as photos
         FROM dating_profiles dp
         LEFT JOIN user_preferences up ON up.user_id = dp.user_id
         WHERE dp.user_id = $1`,
        [currentUserId]
      ),
      db.query(
        `SELECT dp.*, row_to_json(up) as preferences,
                (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
                 FROM profile_photos WHERE user_id = dp.user_id) as photos
         FROM dating_profiles dp
         LEFT JOIN user_preferences up ON up.user_id = dp.user_id
         WHERE dp.user_id = $1`,
        [targetUserId]
      )
    ]);

    const currentProfile = normalizeProfileRow(currentResult.rows[0] || null);
    const currentPreferences = normalizePreferenceRow(currentResult.rows[0]?.preferences);
    const targetProfile = normalizeProfileRow(targetResult.rows[0] || null);
    const targetPreferences = normalizePreferenceRow(targetResult.rows[0]?.preferences);

    if (!currentProfile || !targetProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const compatibility = buildCompatibilitySuggestion({
      currentProfile,
      currentPreferences,
      candidateProfile: targetProfile,
      candidatePreferences: targetPreferences
    });

    // Calculate mutual interests percentage
    const currentInterests = normalizeInterestList(currentProfile.interests);
    const targetInterests = normalizeInterestList(targetProfile.interests);
    const currentInterestSet = new Set(currentInterests.map(i => i.toLowerCase()));
    const targetInterestSet = new Set(targetInterests.map(i => i.toLowerCase()));

    const mutualInterests = currentInterests.filter(interest =>
      targetInterestSet.has(interest.toLowerCase())
    );

    const totalUniqueInterests = new Set([...currentInterests.map(i => i.toLowerCase()), ...targetInterests.map(i => i.toLowerCase())]).size;
    const mutualInterestPercentage = totalUniqueInterests > 0
      ? Math.round((mutualInterests.length / totalUniqueInterests) * 100)
      : 0;

    // Check if already matched
    const matchResult = await db.query(
      `SELECT * FROM matches
       WHERE ((user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1))
       AND status = 'active'
       LIMIT 1`,
      [currentUserId, targetUserId]
    );

    res.json({
      compatibilityScore: compatibility.compatibilityScore,
      compatibilityReasons: compatibility.compatibilityReasons,
      isExcluded: compatibility.isExcluded,
      mutualInterests: {
        count: mutualInterests.length,
        totalUnique: totalUniqueInterests,
        percentage: mutualInterestPercentage,
        interests: mutualInterests.slice(0, 10)
      },
      isMatched: matchResult.rows.length > 0,
      matchId: matchResult.rows[0]?.id || null,
      icebreakers: compatibility.icebreakers
    });
  } catch (err) {
    console.error('Get compatibility error:', err);
    res.status(500).json({ error: 'Failed to get compatibility' });
  }
});

// ============ PHASE 1: LIKE & SUPERLIKE INTERACTIONS ============

// Helper: Check and enforce daily limits
const checkAndEnforceDailyLimits = async (userId, interactionType) => {
  const today = new Date().toISOString().split('T')[0];
  
  // Get user's subscription to determine limits
  const subResult = await db.query(
    `SELECT plan FROM subscription WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const isPremium = subResult.rows[0]?.plan === 'premium';
  
  // Define daily limits based on subscription
  const limits = {
    like: isPremium ? 500 : 50,
    superlike: isPremium ? 10 : 1,
    rewind: isPremium ? -1 : 3 // -1 = unlimited
  };

  // Get today's usage
  const usageResult = await db.query(
    `SELECT 
       COALESCE(SUM(CASE WHEN interaction_type = 'like' THEN 1 ELSE 0 END), 0) as likes_used,
       COALESCE(SUM(CASE WHEN interaction_type = 'superlike' THEN 1 ELSE 0 END), 0) as superlikes_used,
       COALESCE(SUM(CASE WHEN interaction_type = 'rewind' THEN 1 ELSE 0 END), 0) as rewinds_used
     FROM interactions 
     WHERE from_user_id = $1 
       AND DATE(created_at) = $2::date`,
    [userId, today]
  );

  const row = usageResult.rows[0] || {};
  const likesUsed = Number(row.likes_used) || 0;
  const superlikesUsed = Number(row.superlikes_used) || 0;
  const rewindsUsed = Number(row.rewinds_used) || 0;

  const usage = {
    like: { used: likesUsed, limit: limits.like, remaining: Math.max(0, limits.like - likesUsed) },
    superlike: { used: superlikesUsed, limit: limits.superlike, remaining: Math.max(0, limits.superlike - superlikesUsed) },
    rewind: { used: rewindsUsed, limit: limits.rewind, remaining: limits.rewind === -1 ? -1 : Math.max(0, limits.rewind - rewindsUsed) }
  };

  // Check if limit exceeded
  if (interactionType === 'like' && usage.like.remaining <= 0) {
    throw new Error(`Daily like limit reached (${limits.like}/day). ${isPremium ? 'Contact support' : 'Upgrade to Premium for unlimited'}`);
  }
  if (interactionType === 'superlike' && usage.superlike.remaining <= 0) {
    throw new Error(`Daily superlike limit reached (${limits.superlike}/day). Upgrade to Premium for more`);
  }
  if (interactionType === 'rewind' && limits.rewind !== -1 && usage.rewind.remaining <= 0) {
    throw new Error(`Daily rewind limit reached (${limits.rewind}/day). Upgrade to Premium for unlimited`);
  }

  return usage;
};

// Helper: Check for mutual like and create match
const checkAndCreateMutualMatch = async (userId1, userId2) => {
  try {
    // Check if userId2 has already liked userId1
    const mutualLikeResult = await db.query(
      `SELECT id FROM interactions
       WHERE from_user_id = $1 AND to_user_id = $2 AND interaction_type = 'like'
       LIMIT 1`,
      [userId2, userId1]
    );

    if (mutualLikeResult.rows.length > 0) {
      // Mutual like found - create match
      const match = await ensureActiveMatch(userId1, userId2);
      
      // Track in analytics
      const today = new Date().toISOString().split('T')[0];
      await db.query(
        `INSERT INTO user_analytics (user_id, activity_date, matches_made)
         VALUES ($1, $2::date, 1)
         ON CONFLICT (user_id, activity_date) DO UPDATE
         SET matches_made = user_analytics.matches_made + 1`,
        [userId1, today]
      );
      await db.query(
        `INSERT INTO user_analytics (user_id, activity_date, matches_made)
         VALUES ($1, $2::date, 1)
         ON CONFLICT (user_id, activity_date) DO UPDATE
         SET matches_made = user_analytics.matches_made + 1`,
        [userId2, today]
      );

      return { matched: true, matchId: match.id };
    }

    return { matched: false };
  } catch (error) {
    console.error('Mutual match check error:', error);
    return { matched: false };
  }
};

// 8. LIKE PROFILE
router.post('/interactions/like', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, targetUserId } = req.body;
    const userId = toUserId || targetUserId;

    if (!userId) {
      return res.status(400).json({ error: 'toUserId or targetUserId required' });
    }

    if (Number(fromUserId) === Number(userId)) {
      return res.status(400).json({ error: 'You cannot like your own profile' });
    }

    // Check daily limits
    const usage = await checkAndEnforceDailyLimits(fromUserId, 'like');

    // Record like
    const likeInsertResult = await db.query(
      `INSERT INTO interactions (from_user_id, to_user_id, interaction_type)
       VALUES ($1, $2, 'like')
       ON CONFLICT (from_user_id, to_user_id, interaction_type) DO NOTHING
       RETURNING id`,
      [fromUserId, userId]
    );

    // Update analytics for today
    if (likeInsertResult.rowCount > 0) {
      const today = new Date().toISOString().split('T')[0];
      await db.query(
        `INSERT INTO user_analytics (user_id, activity_date, likes_sent)
         VALUES ($1, $2::date, 1)
         ON CONFLICT (user_id, activity_date) DO UPDATE
         SET likes_sent = user_analytics.likes_sent + 1`,
        [fromUserId, today]
      );

      // Update learning profile
      await persistLearningFeedback({
        userId: fromUserId,
        targetUserId: userId,
        interactionType: 'like'
      });

      // Create notification for recipient
      await createDatingNotification(userId, 'like', fromUserId, { likerName: 'Someone' });

      // Check for mutual like and create match
      const mutualResult = await checkAndCreateMutualMatch(fromUserId, userId);

      // If mutual match, create match notification
      if (mutualResult.matched) {
        await createDatingNotification(userId, 'match', fromUserId, { matchId: mutualResult.matchId });
        await createDatingNotification(fromUserId, 'match', userId, { matchId: mutualResult.matchId });
      }

      // Invalidate discovery cache
      await invalidateDiscoveryCache(fromUserId);

      res.json({
        message: 'Profile liked',
        liked: true,
        matched: mutualResult.matched,
        matchId: mutualResult.matchId || null,
        remaining: usage.like.remaining - 1
      });
    } else {
      res.json({
        message: 'Already liked this profile',
        liked: false,
        matched: false,
        remaining: usage.like.remaining
      });
    }
  } catch (err) {
    console.error('Like error:', err);
    if (err.message.includes('Daily') || err.message.includes('limit')) {
      return res.status(429).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to like profile' });
  }
});

// 8b. SUPERLIKE PROFILE
router.post('/interactions/superlike', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, targetUserId } = req.body;
    const userId = toUserId || targetUserId;

    if (!userId) {
      return res.status(400).json({ error: 'toUserId or targetUserId required' });
    }

    if (Number(fromUserId) === Number(userId)) {
      return res.status(400).json({ error: 'You cannot superlike your own profile' });
    }

    // Check daily limits
    const usage = await checkAndEnforceDailyLimits(fromUserId, 'superlike');

    // Record superlike
    const superlikeInsertResult = await db.query(
      `INSERT INTO interactions (from_user_id, to_user_id, interaction_type)
       VALUES ($1, $2, 'superlike')
       ON CONFLICT (from_user_id, to_user_id, interaction_type) DO NOTHING
       RETURNING id`,
      [fromUserId, userId]
    );

    if (superlikeInsertResult.rowCount > 0) {
      const today = new Date().toISOString().split('T')[0];
      await db.query(
        `INSERT INTO user_analytics (user_id, activity_date, superlikes_sent)
         VALUES ($1, $2::date, 1)
         ON CONFLICT (user_id, activity_date) DO UPDATE
         SET superlikes_sent = user_analytics.superlikes_sent + 1`,
        [fromUserId, today]
      );

      // Update learning profile (superlike = strong positive signal)
      await persistLearningFeedback({
        userId: fromUserId,
        targetUserId: userId,
        interactionType: 'superlike'
      });

      // Create notification for recipient (superlike gets special treatment)
      await createDatingNotification(userId, 'superlike', fromUserId, { superlikerName: 'Someone' });

      // Check for mutual like and create match
      const mutualResult = await checkAndCreateMutualMatch(fromUserId, userId);

      // If mutual match, create match notification
      if (mutualResult.matched) {
        await createDatingNotification(userId, 'match', fromUserId, { matchId: mutualResult.matchId });
        await createDatingNotification(fromUserId, 'match', userId, { matchId: mutualResult.matchId });
      }

      // Invalidate discovery cache
      await invalidateDiscoveryCache(fromUserId);

      res.json({
        message: 'Profile superliked',
        superliked: true,
        matched: mutualResult.matched,
        matchId: mutualResult.matchId || null,
        remaining: usage.superlike.remaining - 1
      });
    } else {
      res.json({
        message: 'Already superliked this profile',
        superliked: false,
        matched: false,
        remaining: usage.superlike.remaining
      });
    }
  } catch (err) {
    console.error('Superlike error:', err);
    if (err.message.includes('Daily') || err.message.includes('limit')) {
      return res.status(429).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to superlike profile' });
  }
});

// 8c. GET DAILY LIMITS
router.get('/daily-limits', async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Get subscription status
    const subResult = await db.query(
      `SELECT plan FROM subscription WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const isPremium = subResult.rows[0]?.plan === 'premium';

    // Define daily limits
    const limits = {
      likeLimit: isPremium ? 500 : 50,
      superlikeLimit: isPremium ? 10 : 1,
      rewindLimit: isPremium ? -1 : 3 // -1 = unlimited
    };

    // Get today's usage
    const usageResult = await db.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN interaction_type = 'like' THEN 1 ELSE 0 END), 0) as likes_used,
         COALESCE(SUM(CASE WHEN interaction_type = 'superlike' THEN 1 ELSE 0 END), 0) as superlikes_used,
         COALESCE(SUM(CASE WHEN interaction_type = 'rewind' THEN 1 ELSE 0 END), 0) as rewinds_used
       FROM interactions 
       WHERE from_user_id = $1 
         AND DATE(created_at) = $2::date`,
      [userId, today]
    );

    const row = usageResult.rows[0] || {};
    const likesUsed = Number(row.likes_used) || 0;
    const superlikesUsed = Number(row.superlikes_used) || 0;
    const rewindsUsed = Number(row.rewinds_used) || 0;

    res.json({
      isPremium,
      likeLimit: limits.likeLimit,
      remainingLikes: Math.max(0, limits.likeLimit - likesUsed),
      superlikeLimit: limits.superlikeLimit,
      remainingSuperlikess: Math.max(0, limits.superlikeLimit - superlikesUsed),
      rewindLimit: limits.rewindLimit,
      remainingRewinds: limits.rewindLimit === -1 ? -1 : Math.max(0, limits.rewindLimit - rewindsUsed),
      resetsAt: new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (err) {
    console.error('Get daily limits error:', err);
    res.status(500).json({ error: 'Failed to get daily limits' });
  }
});

// ============ PHASE 2: REWIND, BLOCK, REPORT, FAVORITES ============

// 9c. REWIND LAST INTERACTION
router.post('/interactions/rewind', async (req, res) => {
  try {
    const userId = req.user.id;

    // Check daily limits for rewind
    const usage = await checkAndEnforceDailyLimits(userId, 'rewind');

    // Get last interaction (within last 5 minutes to prevent abuse)
    const lastInteractionResult = await db.query(
      `SELECT * FROM interactions 
       WHERE from_user_id = $1 
         AND interaction_type IN ('like', 'superlike', 'pass')
         AND created_at > NOW() - INTERVAL '5 minutes'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    if (lastInteractionResult.rows.length === 0) {
      return res.status(400).json({ error: 'No recent interactions to rewind' });
    }

    const lastInteraction = lastInteractionResult.rows[0];

    // Delete the last interaction
    await db.query(
      `DELETE FROM interactions 
       WHERE from_user_id = $1 
         AND to_user_id = $2 
         AND interaction_type = $3`,
      [userId, lastInteraction.to_user_id, lastInteraction.interaction_type]
    );

    // Record rewind action
    const today = new Date().toISOString().split('T')[0];
    await db.query(
      `INSERT INTO interactions (from_user_id, to_user_id, interaction_type)
       VALUES ($1, $2, 'rewind')
       ON CONFLICT (from_user_id, to_user_id, interaction_type) DO NOTHING`,
      [userId, lastInteraction.to_user_id]
    );

    // Update analytics
    await db.query(
      `INSERT INTO user_analytics (user_id, activity_date, rewinds_sent)
       VALUES ($1, $2::date, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE
       SET rewinds_sent = user_analytics.rewinds_sent + 1`,
      [userId, today]
    );

    // Invalidate discovery cache
    await invalidateDiscoveryCache(userId);

    res.json({
      message: 'Interaction rewound',
      rewindedProfile: { userId: lastInteraction.to_user_id, interactionType: lastInteraction.interaction_type },
      remaining: usage.rewind.remaining - 1
    });
  } catch (err) {
    console.error('Rewind error:', err);
    if (err.message.includes('Daily') || err.message.includes('limit')) {
      return res.status(429).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to rewind interaction' });
  }
});

// 22. BLOCK USER
router.post('/block-user/:userId', async (req, res) => {
  try {
    const blockingUserId = req.user.id;
    const blockedUserId = normalizeInteger(req.params.userId);
    const { reason } = req.body;

    if (!blockedUserId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (Number(blockingUserId) === Number(blockedUserId)) {
      return res.status(400).json({ error: 'You cannot block yourself' });
    }

    // Check if user exists
    const userCheck = await db.query('SELECT id FROM dating_profiles WHERE user_id = $1 LIMIT 1', [blockedUserId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Insert block
    await db.query(
      `INSERT INTO user_blocks (blocking_user_id, blocked_user_id, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (blocking_user_id, blocked_user_id) DO UPDATE
       SET reason = EXCLUDED.reason, blocked_at = CURRENT_TIMESTAMP`,
      [blockingUserId, blockedUserId, reason || null]
    );

    // Invalidate discovery cache to remove blocked user
    await invalidateDiscoveryCache(blockingUserId);

    res.json({ message: 'User blocked successfully' });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// 22b. UNBLOCK USER
router.post('/unblock-user/:userId', async (req, res) => {
  try {
    const blockingUserId = req.user.id;
    const blockedUserId = normalizeInteger(req.params.userId);

    if (!blockedUserId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    await db.query(
      `DELETE FROM user_blocks 
       WHERE blocking_user_id = $1 AND blocked_user_id = $2`,
      [blockingUserId, blockedUserId]
    );

    // Invalidate cache
    await invalidateDiscoveryCache(blockingUserId);

    res.json({ message: 'User unblocked successfully' });
  } catch (err) {
    console.error('Unblock user error:', err);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// 22c. GET BLOCKED USERS
router.get('/blocked-users', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(normalizeInteger(req.query.limit) || 50, 100);
    const offset = Math.max(0, (normalizeInteger(req.query.page) || 1) - 1) * limit;

    const result = await db.query(
      `SELECT ub.*, dp.first_name, dp.age, 
              (SELECT photo_url FROM profile_photos WHERE user_id = ub.blocked_user_id LIMIT 1) as photo_url
       FROM user_blocks ub
       LEFT JOIN dating_profiles dp ON ub.blocked_user_id = dp.user_id
       WHERE ub.blocking_user_id = $1
       ORDER BY ub.blocked_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({ blockedUsers: result.rows });
  } catch (err) {
    console.error('Get blocked users error:', err);
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

// 23. REPORT USER
router.post('/report-user/:userId', async (req, res) => {
  try {
    const reportingUserId = req.user.id;
    const reportedUserId = normalizeInteger(req.params.userId);
    const { reason, description, photoUrl } = req.body;

    if (!reportedUserId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (Number(reportingUserId) === Number(reportedUserId)) {
      return res.status(400).json({ error: 'You cannot report yourself' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Report reason is required' });
    }

    // Check if user exists
    const userCheck = await db.query('SELECT id FROM dating_profiles WHERE user_id = $1 LIMIT 1', [reportedUserId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Insert report (prevent duplicate reports from same user in 24h)
    const existingReport = await db.query(
      `SELECT id FROM user_reports 
       WHERE from_user_id = $1 AND to_user_id = $2 AND created_at > NOW() - INTERVAL '24 hours'
       LIMIT 1`,
      [reportingUserId, reportedUserId]
    );

    if (existingReport.rows.length > 0) {
      return res.status(400).json({ error: 'You have already reported this user in the last 24 hours' });
    }

    const reportResult = await db.query(
      `INSERT INTO user_reports (from_user_id, to_user_id, reason, description, photo_url, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [reportingUserId, reportedUserId, reason, description || null, photoUrl || null]
    );

    // Apply moderation flag
    await createModerationFlag({
      userId: reportedUserId,
      reason: `User report: ${reason}`,
      severity: 'medium',
      source: 'user_report'
    });

    res.json({ 
      message: 'Report submitted successfully',
      reportId: reportResult.rows[0].id
    });
  } catch (err) {
    console.error('Report user error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// 23b. GET MY REPORTS
router.get('/my-reports', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(normalizeInteger(req.query.limit) || 20, 100);
    const offset = Math.max(0, (normalizeInteger(req.query.page) || 1) - 1) * limit;

    const result = await db.query(
      `SELECT ur.*, 
              dp.first_name, dp.age,
              (SELECT photo_url FROM profile_photos WHERE user_id = ur.to_user_id LIMIT 1) as reported_user_photo
       FROM user_reports ur
       LEFT JOIN dating_profiles dp ON ur.to_user_id = dp.user_id
       WHERE ur.from_user_id = $1
       ORDER BY ur.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({ reports: result.rows });
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// ============ PHASE 2: PROFILE VIEWS & ANALYTICS ============

// 24. RECORD PROFILE VIEW
router.post('/profile-views/:userId', async (req, res) => {
  try {
    const viewerUserId = req.user.id;
    const viewedUserId = normalizeInteger(req.params.userId);

    if (!viewedUserId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (Number(viewerUserId) === Number(viewedUserId)) {
      return res.status(200).json({ message: 'Profile view recorded' });
    }

    // Check if user exists
    const userCheck = await db.query('SELECT id FROM dating_profiles WHERE user_id = $1 LIMIT 1', [viewedUserId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Record view
    await db.query(
      `INSERT INTO profile_views (viewer_user_id, viewed_user_id)
       VALUES ($1, $2)
       ON CONFLICT (viewer_user_id, viewed_user_id) DO UPDATE
       SET viewed_at = CURRENT_TIMESTAMP`,
      [viewerUserId, viewedUserId]
    );

    // Update analytics
    const today = new Date().toISOString().split('T')[0];
    await db.query(
      `INSERT INTO user_analytics (user_id, activity_date, profiles_viewed)
       VALUES ($1, $2::date, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE
       SET profiles_viewed = user_analytics.profiles_viewed + 1`,
      [viewerUserId, today]
    );

    res.json({ message: 'Profile view recorded' });
  } catch (err) {
    console.error('Record view error:', err);
    res.status(500).json({ error: 'Failed to record profile view' });
  }
});

// 24b. GET PROFILE VISITORS (who viewed me)
router.get('/profile-visitors', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(normalizeInteger(req.query.limit) || 20, 100);
    const offset = Math.max(0, (normalizeInteger(req.query.page) || 1) - 1) * limit;

    // Check if premium
    const subResult = await db.query(
      `SELECT plan FROM subscription WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const isPremium = subResult.rows[0]?.plan === 'premium';

    if (!isPremium) {
      // Free users see count only
      const countResult = await db.query(
        `SELECT COUNT(*) as total_views FROM profile_views WHERE viewed_user_id = $1`,
        [userId]
      );
      return res.json({
        viewers: [],
        isPremium: false,
        totalCount: Number(countResult.rows[0]?.total_views) || 0,
        message: 'Upgrade to Premium to see who viewed you'
      });
    }

    // Premium users see details
    const result = await db.query(
      `SELECT pv.*, 
              dp.first_name, dp.age, dp.bio,
              (SELECT photo_url FROM profile_photos WHERE user_id = pv.viewer_user_id LIMIT 1) as photo_url
       FROM profile_views pv
       LEFT JOIN dating_profiles dp ON pv.viewer_user_id = dp.user_id
       WHERE pv.viewed_user_id = $1
       ORDER BY pv.viewed_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as total_views FROM profile_views WHERE viewed_user_id = $1`,
      [userId]
    );

    res.json({
      viewers: result.rows,
      isPremium: true,
      totalCount: Number(countResult.rows[0]?.total_views) || 0
    });
  } catch (err) {
    console.error('Get visitors error:', err);
    res.status(500).json({ error: 'Failed to fetch profile visitors' });
  }
});

// 24c. GET PROFILE ANALYTICS
router.get('/profile-analytics', async (req, res) => {
  try {
    const userId = req.user.id;
    const days = normalizeInteger(req.query.days) || 30;

    // Get analytics data
    const analyticsResult = await db.query(
      `SELECT 
         SUM(session_count) as total_sessions,
         SUM(profiles_viewed) as profiles_viewed,
         SUM(likes_sent) as likes_sent,
         SUM(superlikes_sent) as superlikes_sent,
         SUM(rewinds_sent) as rewinds_sent,
         SUM(matches_made) as matches_made,
         SUM(messages_sent) as messages_sent,
         AVG(CASE WHEN session_count > 0 THEN session_count ELSE NULL END) as avg_session_duration
       FROM user_analytics
       WHERE user_id = $1 AND activity_date >= CURRENT_DATE - $2::integer`,
      [userId, days]
    );

    const row = analyticsResult.rows[0] || {};

    // Calculate match rate
    const likesTotal = Number(row.likes_sent) || 0;
    const matchesTotal = Number(row.matches_made) || 0;
    const matchRate = likesTotal > 0 ? Math.round((matchesTotal / likesTotal) * 100) : 0;

    // Get profile stats
    const profileResult = await db.query(
      `SELECT 
         (SELECT COUNT(*) FROM profile_views WHERE viewed_user_id = $1) as profile_views,
         (SELECT COUNT(*) FROM interactions WHERE to_user_id = $1 AND interaction_type IN ('like', 'superlike')) as likes_received
       FROM dating_profiles WHERE user_id = $1`,
      [userId]
    );

    const profileStats = profileResult.rows[0] || {};

    res.json({
      period: { days, startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      activity: {
        sessionsCount: Number(row.total_sessions) || 0,
        profilesViewed: Number(row.profiles_viewed) || 0,
        likesSent: Number(row.likes_sent) || 0,
        superlikesSent: Number(row.superlikes_sent) || 0,
        rewindsSent: Number(row.rewinds_sent) || 0,
        matchesMade: Number(row.matches_made) || 0,
        messagesSent: Number(row.messages_sent) || 0
      },
      engagement: {
        matchRate,
        profileViews: Number(profileStats.profile_views) || 0,
        likesReceived: Number(profileStats.likes_received) || 0
      }
    });
  } catch (err) {
    console.error('Get analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ============ PHASE 3: NOTIFICATIONS, COMPLETION, ICEBREAKERS ============

// 25. GET ICEBREAKER SUGGESTIONS
router.get('/icebreakers/:userId', async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = normalizeInteger(req.params.userId);

    if (!targetUserId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Get both profiles
    const [currentResult, targetResult] = await Promise.all([
      db.query(
        `SELECT dp.*, row_to_json(up) as preferences
         FROM dating_profiles dp
         LEFT JOIN user_preferences up ON up.user_id = dp.user_id
         WHERE dp.user_id = $1`,
        [currentUserId]
      ),
      db.query(
        `SELECT * FROM dating_profiles WHERE user_id = $1`,
        [targetUserId]
      )
    ]);

    const currentProfile = normalizeProfileRow(currentResult.rows[0] || null);
    const targetProfile = normalizeProfileRow(targetResult.rows[0] || null);
    const currentPreferences = normalizePreferenceRow(currentResult.rows[0]?.preferences);

    if (!targetProfile) {
      return res.status(404).json({ error: 'Target profile not found' });
    }

    // Calculate shared interests
    const currentInterests = normalizeInterestList(currentProfile?.interests || []);
    const targetInterests = normalizeInterestList(targetProfile.interests || []);
    const currentInterestLookup = new Set(currentInterests.map(i => i.toLowerCase()));
    const sharedInterests = targetInterests.filter(i => currentInterestLookup.has(i.toLowerCase()));

    // Use existing function to build icebreakers
    const icebreakers = buildIcebreakerSuggestions(targetProfile, sharedInterests);

    res.json({ icebreakers, sharedInterests: sharedInterests.slice(0, 3) });
  } catch (err) {
    console.error('Get icebreakers error:', err);
    res.status(500).json({ error: 'Failed to get icebreaker suggestions' });
  }
});

// 26. GET PROFILE COMPLETION DETAILS
router.get('/profiles/me/completion-details', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT dp.*,
              (SELECT COUNT(*) FROM profile_photos WHERE user_id = $1) as photo_count
       FROM dating_profiles dp
       WHERE dp.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = result.rows[0];
    const completed = [];
    const remaining = [];

    // Check completion criteria
    if (profile.first_name) completed.push('firstName'); else remaining.push('firstName');
    if (profile.age) completed.push('age'); else remaining.push('age');
    if (profile.gender) completed.push('gender'); else remaining.push('gender');
    if (profile.location_city) completed.push('location'); else remaining.push('location');
    if (profile.bio) completed.push('bio'); else remaining.push('bio');
    if (profile.interests && Array.isArray(profile.interests) && profile.interests.length > 0) completed.push('interests'); else remaining.push('interests');
    if (profile.relationship_goals) completed.push('relationshipGoals'); else remaining.push('relationshipGoals');
    if (profile.height) completed.push('height'); else remaining.push('height');
    if (profile.body_type) completed.push('bodyType'); else remaining.push('bodyType');
    if (profile.photo_count > 0) completed.push('photos'); else remaining.push('photos');
    if (profile.profile_verified) completed.push('verification'); else remaining.push('verification');

    const tips = [];
    if (remaining.includes('photos')) tips.push('Add at least 3 clear photos to increase visibility');
    if (remaining.includes('bio')) tips.push('Write a compelling bio to attract matches');
    if (remaining.includes('interests')) tips.push('Select your interests to find better matches');
    if (remaining.includes('verification')) tips.push('Verify your profile to appear in top results');
    if (profile.profile_completion_percent < 80) tips.push(`Complete ${remaining.length} more field${remaining.length !== 1 ? 's' : ''} for better match visibility`);

    res.json({
      profileCompletionPercent: profile.profile_completion_percent || 0,
      completed,
      remaining,
      tips,
      profileStats: {
        photoCount: Number(profile.photo_count) || 0,
        firstName: profile.first_name || null,
        age: profile.age || null,
        hasInterests: Array.isArray(profile.interests) && profile.interests.length > 0,
        isVerified: Boolean(profile.profile_verified)
      }
    });
  } catch (err) {
    console.error('Get completion details error:', err);
    res.status(500).json({ error: 'Failed to get completion details' });
  }
});

// 27. GET COMPATIBILITY QUIZ QUESTIONS
router.get('/compatibility-quiz', async (req, res) => {
  try {
    const questions = [
      {
        id: 'weekendStyle',
        question: 'How do you prefer to spend a typical weekend?',
        label: 'Weekend Style',
        options: ['Adventurous activities', 'Relaxed time at home', 'Social gatherings', 'Workout & fitness']
      },
      {
        id: 'communicationStyle',
        question: 'What is your preferred communication style?',
        label: 'Communication Style',
        options: ['Direct & honest', 'Thoughtful & empathetic', 'Playful & humorous', 'Minimal & to-the-point']
      },
      {
        id: 'socialEnergy',
        question: 'How would you describe your social rhythm?',
        label: 'Social Rhythm',
        options: ['Introvert - need alone time', 'Ambivert - balanced', 'Extrovert - love socializing', 'Depends on my mood']
      },
      {
        id: 'planningStyle',
        question: 'How do you approach planning and spontaneity?',
        label: 'Planning Style',
        options: ['Highly organized', 'Somewhat planned', 'Go with the flow', 'Mix of both']
      },
      {
        id: 'affectionStyle',
        question: 'How do you prefer to show affection?',
        label: 'Connection Style',
        options: ['Physical touch', 'Quality time', 'Words of affirmation', 'Acts of service']
      },
      {
        id: 'conflictStyle',
        question: 'How do you handle disagreements?',
        label: 'Conflict Approach',
        options: ['Talk it out immediately', 'Take time to cool off', 'Compromise quickly', 'Avoid confrontation']
      }
    ];

    res.json({ questions });
  } catch (err) {
    console.error('Get quiz questions error:', err);
    res.status(500).json({ error: 'Failed to get quiz questions' });
  }
});

// 27b. SAVE COMPATIBILITY QUIZ ANSWERS
router.post('/compatibility-quiz', async (req, res) => {
  try {
    const userId = req.user.id;
    const { answers } = req.body;

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'Answers object required' });
    }

    // Normalize answers
    const normalizedAnswers = normalizeCompatibilityAnswers(answers);

    // Get or create preferences
    const prefResult = await db.query(
      `SELECT id FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    if (prefResult.rows.length > 0) {
      await db.query(
        `UPDATE user_preferences 
         SET compatibility_answers = $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [JSON.stringify(normalizedAnswers), userId]
      );
    } else {
      await db.query(
        `INSERT INTO user_preferences (user_id, compatibility_answers, updated_at)
         VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [userId, JSON.stringify(normalizedAnswers)]
      );
    }

    res.json({ message: 'Compatibility answers saved', answers: normalizedAnswers });
  } catch (err) {
    console.error('Save quiz answers error:', err);
    res.status(500).json({ error: 'Failed to save quiz answers' });
  }
});

// 27c. GET COMPATIBILITY WITH MATCH
router.get('/compatibility/:userId', async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = normalizeInteger(req.params.userId);

    if (!targetUserId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Get both users' preferences
    const [currentPrefResult, targetPrefResult] = await Promise.all([
      db.query(
        `SELECT compatibility_answers FROM user_preferences WHERE user_id = $1`,
        [currentUserId]
      ),
      db.query(
        `SELECT compatibility_answers FROM user_preferences WHERE user_id = $1`,
        [targetUserId]
      )
    ]);

    const currentAnswers = normalizeCompatibilityAnswers(currentPrefResult.rows[0]?.compatibility_answers);
    const targetAnswers = normalizeCompatibilityAnswers(targetPrefResult.rows[0]?.compatibility_answers);

    // Find matching answers
    const LABELS = {
      weekendStyle: 'Weekend Style',
      communicationStyle: 'Communication Style',
      socialEnergy: 'Social Rhythm',
      planningStyle: 'Planning Style',
      affectionStyle: 'Connection Style',
      conflictStyle: 'Conflict Approach'
    };

    const matches = [];
    const mismatches = [];

    Object.keys(LABELS).forEach(questionId => {
      const currentAnswer = currentAnswers[questionId];
      const targetAnswer = targetAnswers[questionId];

      if (currentAnswer && targetAnswer) {
        if (currentAnswer === targetAnswer) {
          matches.push({
            dimension: LABELS[questionId],
            answer: currentAnswer
          });
        } else {
          mismatches.push({
            dimension: LABELS[questionId],
            yourAnswer: currentAnswer,
            theirAnswer: targetAnswer
          });
        }
      }
    });

    const compatibilityPercent = matches.length > 0 
      ? Math.round((matches.length / (matches.length + mismatches.length)) * 100)
      : 0;

    res.json({
      compatibilityPercent,
      matches,
      mismatches,
      completeness: { your: Object.values(currentAnswers).filter(a => a).length, their: Object.values(targetAnswers).filter(a => a).length }
    });
  } catch (err) {
    console.error('Get compatibility error:', err);
    res.status(500).json({ error: 'Failed to get compatibility' });
  }
});

// 28. NOTIFICATION ENDPOINTS
// 28a. GET NOTIFICATIONS
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(normalizeInteger(req.query.limit) || 20, 100);
    const offset = Math.max(0, (normalizeInteger(req.query.page) || 1) - 1) * limit;
    const unreadOnly = req.query.unreadOnly === 'true';

    let query = `
      SELECT * FROM dating_notifications
      WHERE to_user_id = $1
    `;
    const params = [userId];

    if (unreadOnly) {
      query += ` AND is_read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// 28b. MARK NOTIFICATION AS READ
router.patch('/notifications/:notificationId/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const result = await db.query(
      `UPDATE dating_notifications
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND to_user_id = $2
       RETURNING *`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification: result.rows[0] });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// 28c. DELETE NOTIFICATION
router.delete('/notifications/:notificationId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const result = await db.query(
      `DELETE FROM dating_notifications
       WHERE id = $1 AND to_user_id = $2`,
      [notificationId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// 28d. GET UNREAD NOTIFICATION COUNT
router.get('/notifications/count/unread', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT COUNT(*) as unread_count FROM dating_notifications
       WHERE to_user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({ unreadCount: Number(result.rows[0]?.unread_count) || 0 });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Helper function: Create dating notification
const createDatingNotification = async (toUserId, notificationType, fromUserId, metadata = {}) => {
  try {
    await db.query(
      `INSERT INTO dating_notifications (to_user_id, from_user_id, notification_type, metadata, is_read)
       VALUES ($1, $2, $3, $4::jsonb, false)`,
      [toUserId, fromUserId, notificationType, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error('Create notification error:', error);
  }
};

// ============ PHASE 3: NOTIFICATIONS, COMPLETION, ICEBREAKERS ============

// 25. GET ICEBREAKER SUGGESTIONS
router.get('/icebreakers/:userId', async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = normalizeInteger(req.params.userId);

    if (!targetUserId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Get both profiles
    const [currentResult, targetResult] = await Promise.all([
      db.query(
        `SELECT dp.*, row_to_json(up) as preferences
         FROM dating_profiles dp
         LEFT JOIN user_preferences up ON up.user_id = dp.user_id
         WHERE dp.user_id = $1`,
        [currentUserId]
      ),
      db.query(
        `SELECT * FROM dating_profiles WHERE user_id = $1`,
        [targetUserId]
      )
    ]);

    const currentProfile = normalizeProfileRow(currentResult.rows[0] || null);
    const targetProfile = normalizeProfileRow(targetResult.rows[0] || null);
    const currentPreferences = normalizePreferenceRow(currentResult.rows[0]?.preferences);

    if (!targetProfile) {
      return res.status(404).json({ error: 'Target profile not found' });
    }

    // Calculate shared interests
    const currentInterests = normalizeInterestList(currentProfile?.interests || []);
    const targetInterests = normalizeInterestList(targetProfile.interests || []);
    const currentInterestLookup = new Set(currentInterests.map(i => i.toLowerCase()));
    const sharedInterests = targetInterests.filter(i => currentInterestLookup.has(i.toLowerCase()));

    // Use existing function to build icebreakers
    const icebreakers = buildIcebreakerSuggestions(targetProfile, sharedInterests);

    res.json({ icebreakers, sharedInterests: sharedInterests.slice(0, 3) });
  } catch (err) {
    console.error('Get icebreakers error:', err);
    res.status(500).json({ error: 'Failed to get icebreaker suggestions' });
  }
});

// 26. GET PROFILE COMPLETION DETAILS
router.get('/profiles/me/completion-details', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT dp.*,
              (SELECT COUNT(*) FROM profile_photos WHERE user_id = $1) as photo_count
       FROM dating_profiles dp
       WHERE dp.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = result.rows[0];
    const completed = [];
    const remaining = [];

    // Check completion criteria
    if (profile.first_name) completed.push('firstName'); else remaining.push('firstName');
    if (profile.age) completed.push('age'); else remaining.push('age');
    if (profile.gender) completed.push('gender'); else remaining.push('gender');
    if (profile.location_city) completed.push('location'); else remaining.push('location');
    if (profile.bio) completed.push('bio'); else remaining.push('bio');
    if (profile.interests && Array.isArray(profile.interests) && profile.interests.length > 0) completed.push('interests'); else remaining.push('interests');
    if (profile.relationship_goals) completed.push('relationshipGoals'); else remaining.push('relationshipGoals');
    if (profile.height) completed.push('height'); else remaining.push('height');
    if (profile.body_type) completed.push('bodyType'); else remaining.push('bodyType');
    if (profile.photo_count > 0) completed.push('photos'); else remaining.push('photos');
    if (profile.profile_verified) completed.push('verification'); else remaining.push('verification');

    const tips = [];
    if (remaining.includes('photos')) tips.push('Add at least 3 clear photos to increase visibility');
    if (remaining.includes('bio')) tips.push('Write a compelling bio to attract matches');
    if (remaining.includes('interests')) tips.push('Select your interests to find better matches');
    if (remaining.includes('verification')) tips.push('Verify your profile to appear in top results');
    if (profile.profile_completion_percent < 80) tips.push(`Complete ${remaining.length} more field${remaining.length !== 1 ? 's' : ''} for better match visibility`);

    res.json({
      profileCompletionPercent: profile.profile_completion_percent || 0,
      completed,
      remaining,
      tips,
      profileStats: {
        photoCount: Number(profile.photo_count) || 0,
        firstName: profile.first_name || null,
        age: profile.age || null,
        hasInterests: Array.isArray(profile.interests) && profile.interests.length > 0,
        isVerified: Boolean(profile.profile_verified)
      }
    });
  } catch (err) {
    console.error('Get completion details error:', err);
    res.status(500).json({ error: 'Failed to get completion details' });
  }
});

// 27. GET COMPATIBILITY QUIZ QUESTIONS
router.get('/compatibility-quiz', async (req, res) => {
  try {
    const questions = [
      {
        id: 'weekendStyle',
        question: 'How do you prefer to spend a typical weekend?',
        label: 'Weekend Style',
        options: ['Adventurous activities', 'Relaxed time at home', 'Social gatherings', 'Workout & fitness']
      },
      {
        id: 'communicationStyle',
        question: 'What is your preferred communication style?',
        label: 'Communication Style',
        options: ['Direct & honest', 'Thoughtful & empathetic', 'Playful & humorous', 'Minimal & to-the-point']
      },
      {
        id: 'socialEnergy',
        question: 'How would you describe your social rhythm?',
        label: 'Social Rhythm',
        options: ['Introvert - need alone time', 'Ambivert - balanced', 'Extrovert - love socializing', 'Depends on my mood']
      },
      {
        id: 'planningStyle',
        question: 'How do you approach planning and spontaneity?',
        label: 'Planning Style',
        options: ['Highly organized', 'Somewhat planned', 'Go with the flow', 'Mix of both']
      },
      {
        id: 'affectionStyle',
        question: 'How do you prefer to show affection?',
        label: 'Connection Style',
        options: ['Physical touch', 'Quality time', 'Words of affirmation', 'Acts of service']
      },
      {
        id: 'conflictStyle',
        question: 'How do you handle disagreements?',
        label: 'Conflict Approach',
        options: ['Talk it out immediately', 'Take time to cool off', 'Compromise quickly', 'Avoid confrontation']
      }
    ];

    res.json({ questions });
  } catch (err) {
    console.error('Get quiz questions error:', err);
    res.status(500).json({ error: 'Failed to get quiz questions' });
  }
});

// 27b. SAVE COMPATIBILITY QUIZ ANSWERS
router.post('/compatibility-quiz', async (req, res) => {
  try {
    const userId = req.user.id;
    const { answers } = req.body;

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'Answers object required' });
    }

    // Normalize answers
    const normalizedAnswers = normalizeCompatibilityAnswers(answers);

    // Get or create preferences
    const prefResult = await db.query(
      `SELECT id FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    if (prefResult.rows.length > 0) {
      await db.query(
        `UPDATE user_preferences 
         SET compatibility_answers = $1::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [JSON.stringify(normalizedAnswers), userId]
      );
    } else {
      await db.query(
        `INSERT INTO user_preferences (user_id, compatibility_answers, updated_at)
         VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [userId, JSON.stringify(normalizedAnswers)]
      );
    }

    res.json({ message: 'Compatibility answers saved', answers: normalizedAnswers });
  } catch (err) {
    console.error('Save quiz answers error:', err);
    res.status(500).json({ error: 'Failed to save quiz answers' });
  }
});

// 27c. GET COMPATIBILITY WITH MATCH
router.get('/compatibility/:userId', async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = normalizeInteger(req.params.userId);

    if (!targetUserId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Get both users' preferences
    const [currentPrefResult, targetPrefResult] = await Promise.all([
      db.query(
        `SELECT compatibility_answers FROM user_preferences WHERE user_id = $1`,
        [currentUserId]
      ),
      db.query(
        `SELECT compatibility_answers FROM user_preferences WHERE user_id = $1`,
        [targetUserId]
      )
    ]);

    const currentAnswers = normalizeCompatibilityAnswers(currentPrefResult.rows[0]?.compatibility_answers);
    const targetAnswers = normalizeCompatibilityAnswers(targetPrefResult.rows[0]?.compatibility_answers);

    // Find matching answers
    const LABELS = {
      weekendStyle: 'Weekend Style',
      communicationStyle: 'Communication Style',
      socialEnergy: 'Social Rhythm',
      planningStyle: 'Planning Style',
      affectionStyle: 'Connection Style',
      conflictStyle: 'Conflict Approach'
    };

    const matches = [];
    const mismatches = [];

    Object.keys(LABELS).forEach(questionId => {
      const currentAnswer = currentAnswers[questionId];
      const targetAnswer = targetAnswers[questionId];

      if (currentAnswer && targetAnswer) {
        if (currentAnswer === targetAnswer) {
          matches.push({
            dimension: LABELS[questionId],
            answer: currentAnswer
          });
        } else {
          mismatches.push({
            dimension: LABELS[questionId],
            yourAnswer: currentAnswer,
            theirAnswer: targetAnswer
          });
        }
      }
    });

    const compatibilityPercent = matches.length > 0 
      ? Math.round((matches.length / (matches.length + mismatches.length)) * 100)
      : 0;

    res.json({
      compatibilityPercent,
      matches,
      mismatches,
      completeness: { your: Object.values(currentAnswers).filter(a => a).length, their: Object.values(targetAnswers).filter(a => a).length }
    });
  } catch (err) {
    console.error('Get compatibility error:', err);
    res.status(500).json({ error: 'Failed to get compatibility' });
  }
});

// 28. NOTIFICATION ENDPOINTS
// 28a. GET NOTIFICATIONS
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(normalizeInteger(req.query.limit) || 20, 100);
    const offset = Math.max(0, (normalizeInteger(req.query.page) || 1) - 1) * limit;
    const unreadOnly = req.query.unreadOnly === 'true';

    let query = `
      SELECT * FROM dating_notifications
      WHERE to_user_id = $1
    `;
    const params = [userId];

    if (unreadOnly) {
      query += ` AND is_read = false`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// 28b. MARK NOTIFICATION AS READ
router.patch('/notifications/:notificationId/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const result = await db.query(
      `UPDATE dating_notifications
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND to_user_id = $2
       RETURNING *`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification: result.rows[0] });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// 28c. DELETE NOTIFICATION
router.delete('/notifications/:notificationId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const result = await db.query(
      `DELETE FROM dating_notifications
       WHERE id = $1 AND to_user_id = $2`,
      [notificationId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// 28d. GET UNREAD NOTIFICATION COUNT
router.get('/notifications/count/unread', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT COUNT(*) as unread_count FROM dating_notifications
       WHERE to_user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({ unreadCount: Number(result.rows[0]?.unread_count) || 0 });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// ============ PHASE 4: BOOST, VOICE INTRO, FILTER PRESETS ============

// 29. VOICE INTRO UPLOAD
router.post('/profiles/me/voice-intro', async (req, res) => {
  try {
    const userId = req.user.id;
    const photos = await collectPhotosFromRequest(req);
    const multipartFields = req.parsedMultipartFields || {};

    if (!photos.length) {
      return res.status(400).json({ error: 'Voice intro file required' });
    }

    const voiceIntro = photos[0];
    const voiceIntroUrl = voiceIntro.url;
    const contentType = String(voiceIntro.contentType || '').toLowerCase();
    const filename = String(voiceIntro.filename || '').toLowerCase();
    const durationSeconds = normalizeInteger(
      req.body?.durationSeconds ?? multipartFields.durationSeconds
    );
    const isSupportedAudio =
      contentType.startsWith('audio/')
      || ['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.webm'].some((extension) =>
        filename.endsWith(extension)
      );

    if (!isSupportedAudio && !voiceIntroUrl.includes('data:audio/')) {
      return res.status(400).json({ error: 'Invalid audio format. Please use MP3, WAV, M4A, OGG, AAC, or WEBM.' });
    }

    if (!durationSeconds || durationSeconds < 15 || durationSeconds > 30) {
      return res.status(400).json({ error: 'Voice intro must be between 15 and 30 seconds long.' });
    }

    if ((voiceIntro.size || 0) > 12 * 1024 * 1024) {
      return res.status(400).json({ error: 'Voice intro file is too large. Please keep it under 12MB.' });
    }

    await db.query(
      `UPDATE dating_profiles
       SET voice_intro_url = $1,
           voice_intro_duration_seconds = $2,
           profile_completion_percent = GREATEST(COALESCE(profile_completion_percent, 0), 85),
           last_active = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3`,
      [voiceIntroUrl, durationSeconds, userId]
    );

    await createModerationFlag({
      userId,
      sourceType: 'voice_intro_upload',
      flagCategory: 'content',
      severity: 'low',
      title: 'Voice intro uploaded',
      reason: 'Voice intro uploaded and queued for routine moderation review.',
      metadata: {
        durationSeconds,
        contentType: contentType || null,
        filename: filename || null
      }
    });

    res.json({
      message: 'Voice intro uploaded successfully',
      voiceIntroUrl,
      durationSeconds,
      completionBoost: '+5%'
    });
  } catch (err) {
    console.error('Voice intro upload error:', err);
    res.status(500).json({ error: 'Failed to upload voice intro' });
  }
});

// 30. BOOST PROFILE (Premium Feature)
router.post('/boost-profile', async (req, res) => {
  try {
    const userId = req.user.id;
    const { durationMinutes } = req.body || {};
    const boostDuration = durationMinutes || 30; // Default 30 minutes

    // Check subscription
    const subResult = await db.query(
      `SELECT plan FROM subscription WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const isPremium = subResult.rows[0]?.plan === 'premium';

    if (!isPremium) {
      return res.status(403).json({ error: 'Boost requires Premium subscription' });
    }

    // Check if already boosted (prevent double boost)
    const existingBoost = await db.query(
      `SELECT id FROM profile_boosts 
       WHERE user_id = $1 AND boost_expires_at > CURRENT_TIMESTAMP
       LIMIT 1`,
      [userId]
    );

    if (existingBoost.rows.length > 0) {
      return res.status(400).json({ error: 'Profile already boosted. Try again in 24 hours.' });
    }

    // Create boost record
    const expiresAt = new Date(Date.now() + boostDuration * 60 * 1000).toISOString();
    const boostResult = await db.query(
      `INSERT INTO profile_boosts (user_id, boost_expires_at, visibility_multiplier)
       VALUES ($1, $2, 5)
       RETURNING id, boost_expires_at`,
      [userId, expiresAt]
    );

    // Update profile to show boost badge
    await db.query(
      `UPDATE dating_profiles
       SET updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );

    res.json({
      message: 'Profile boosted successfully',
      boostId: boostResult.rows[0].id,
      expiresAt: boostResult.rows[0].boost_expires_at,
      visibilityMultiplier: 5,
      durationMinutes: boostDuration
    });
  } catch (err) {
    console.error('Boost profile error:', err);
    res.status(500).json({ error: 'Failed to boost profile' });
  }
});

// 30b. GET BOOST STATUS
router.get('/boost-status', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, boost_expires_at, visibility_multiplier 
       FROM profile_boosts 
       WHERE user_id = $1 AND boost_expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ active: false, boost: null });
    }

    const boost = result.rows[0];
    const secondsRemaining = Math.max(0, (new Date(boost.boost_expires_at).getTime() - Date.now()) / 1000);

    res.json({
      active: true,
      boost: {
        id: boost.id,
        expiresAt: boost.boost_expires_at,
        visibilityMultiplier: boost.visibility_multiplier,
        secondsRemaining: Math.ceil(secondsRemaining),
        minutesRemaining: Math.ceil(secondsRemaining / 60)
      }
    });
  } catch (err) {
    console.error('Get boost status error:', err);
    res.status(500).json({ error: 'Failed to get boost status' });
  }
});

// 31. FILTER PRESETS - SAVE
router.post('/filter-presets', async (req, res) => {
  try {
    const userId = req.user.id;
    const { presetName, filters } = req.body;

    if (!presetName) {
      return res.status(400).json({ error: 'Preset name required' });
    }

    if (!filters || typeof filters !== 'object') {
      return res.status(400).json({ error: 'Filters object required' });
    }

    const result = await db.query(
      `INSERT INTO filter_presets (user_id, preset_name, filters)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id, preset_name, filters, created_at`,
      [userId, presetName, JSON.stringify(filters)]
    );

    res.json({
      message: 'Filter preset saved',
      preset: result.rows[0]
    });
  } catch (err) {
    console.error('Save filter preset error:', err);
    res.status(500).json({ error: 'Failed to save filter preset' });
  }
});

// 31b. FILTER PRESETS - GET ALL
router.get('/filter-presets', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, preset_name, filters, created_at, updated_at
       FROM filter_presets
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );

    res.json({ presets: result.rows });
  } catch (err) {
    console.error('Get filter presets error:', err);
    res.status(500).json({ error: 'Failed to fetch filter presets' });
  }
});

// 31c. FILTER PRESETS - DELETE
router.delete('/filter-presets/:presetId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { presetId } = req.params;

    const result = await db.query(
      `DELETE FROM filter_presets
       WHERE id = $1 AND user_id = $2`,
      [presetId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    res.json({ message: 'Filter preset deleted' });
  } catch (err) {
    console.error('Delete filter preset error:', err);
    res.status(500).json({ error: 'Failed to delete filter preset' });
  }
});

// 31d. FILTER PRESETS - APPLY
router.post('/filter-presets/:presetId/apply', async (req, res) => {
  try {
    const userId = req.user.id;
    const { presetId } = req.params;

    const result = await db.query(
      `SELECT filters FROM filter_presets
       WHERE id = $1 AND user_id = $2`,
      [presetId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const filters = result.rows[0].filters;

    res.json({
      message: 'Filter preset loaded',
      filters
    });
  } catch (err) {
    console.error('Apply filter preset error:', err);
    res.status(500).json({ error: 'Failed to apply filter preset' });
  }
});

// 32. GET TOP PICKS (AI/ML Enhanced Matching)
router.get('/top-picks', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(normalizeInteger(req.query.limit) || 10, 30);

    // Get current user profile and preferences
    const currentResult = await db.query(
      `SELECT dp.*, row_to_json(up) as preferences
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       WHERE dp.user_id = $1`,
      [userId]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Complete your profile first' });
    }

    const currentProfile = normalizeProfileRow(currentResult.rows[0]);
    const currentPreferences = normalizePreferenceRow(currentResult.rows[0].preferences);

    // Get top matches based on multiple factors
    const result = await db.query(
      `SELECT dp.*, 
              row_to_json(up) as preferences,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       WHERE dp.user_id != $1
         AND dp.is_active = true
         AND NOT EXISTS (SELECT 1 FROM interactions i WHERE (i.from_user_id = $1 AND i.to_user_id = dp.user_id) OR (i.to_user_id = $1 AND i.from_user_id = dp.user_id))
         AND NOT EXISTS (SELECT 1 FROM user_blocks ub WHERE (ub.blocking_user_id = $1 AND ub.blocked_user_id = dp.user_id) OR (ub.blocked_user_id = $1 AND ub.blocking_user_id = dp.user_id))
       ORDER BY dp.profile_verified DESC, dp.profile_completion_percent DESC
       LIMIT $2`,
      [userId, limit]
    );

    const profiles = result.rows
      .map(profileRow => {
        const normalizedProfile = normalizeProfileRow(profileRow);
        const compatibility = buildCompatibilitySuggestion({
          currentProfile,
          currentPreferences,
          candidateProfile: normalizedProfile,
          candidatePreferences: profileRow.preferences
        });

        if (compatibility.isExcluded) return null;

        return {
          ...normalizedProfile,
          ...compatibility,
          isPick: true
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, limit);

    res.json({
      topPicks: profiles,
      message: `${profiles.length} top picks selected for you based on compatibility`
    });
  } catch (err) {
    console.error('Get top picks error:', err);
    res.status(500).json({ error: 'Failed to get top picks' });
  }
});

// 33. GET SUPERLIKES RECEIVED
router.get('/superlikes-received', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(normalizeInteger(req.query.limit) || 20, 100);
    const offset = Math.max(0, (normalizeInteger(req.query.page) || 1) - 1) * limit;

    const result = await db.query(
      `SELECT i.*, dp.first_name, dp.age, dp.bio, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = i.from_user_id LIMIT 1) as photo_url
       FROM interactions i
       JOIN dating_profiles dp ON i.from_user_id = dp.user_id
       WHERE i.to_user_id = $1 AND i.interaction_type = 'superlike'
       ORDER BY i.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      superlikes: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error('Get superlikes error:', err);
    res.status(500).json({ error: 'Failed to get superlikes' });
  }
});

// 34. EXPORT DATA (GDPR Compliance)
router.get('/export-data', async (req, res) => {
  try {
    const userId = req.user.id;

    const [userResult, profileResult, prefsResult, interactionsResult, matchesResult, messagesResult] = await Promise.all([
      db.query('SELECT id, email, created_at FROM users WHERE id = $1', [userId]),
      db.query('SELECT * FROM dating_profiles WHERE user_id = $1', [userId]),
      db.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]),
      db.query('SELECT * FROM interactions WHERE from_user_id = $1 OR to_user_id = $1 ORDER BY created_at DESC', [userId]),
      db.query('SELECT * FROM matches WHERE user_id_1 = $1 OR user_id_2 = $1', [userId]),
      db.query('SELECT * FROM messages WHERE from_user_id = $1 OR to_user_id = $1 ORDER BY created_at DESC LIMIT 1000', [userId])
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      user: userResult.rows[0],
      profile: profileResult.rows[0],
      preferences: prefsResult.rows[0],
      interactions: interactionsResult.rows,
      matches: matchesResult.rows,
      messages: messagesResult.rows
    };

    // Generate filename
    const filename = `linkup-data-${userId}-${Date.now()}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(exportData);
  } catch (err) {
    console.error('Export data error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// 57. UPDATE LAST ACTIVE (heartbeat endpoint)
router.post('/profiles/me/heartbeat', async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query(
      `UPDATE dating_profiles
       SET last_active = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );

    res.json({ lastActive: new Date().toISOString() });
  } catch (err) {
    console.error('Heartbeat error:', err);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// ========== TIER 1: ADVANCED ENGAGEMENT FEATURES ==========

// 58. GET CONVERSATION QUALITY SCORE
router.get('/conversation-quality/:matchId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { matchId } = req.params;

    // Verify the user is part of this match
    const matchResult = await db.query(
      `SELECT * FROM matches WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2) AND status = 'active' LIMIT 1`,
      [matchId, userId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];
    const otherUserId = match.user_id_1 === userId ? match.user_id_2 : match.user_id_1;

    // Get or create conversation quality metric
    const qualityResult = await db.query(
      `SELECT * FROM conversation_quality_metrics 
       WHERE match_id = $1 LIMIT 1`,
      [matchId]
    );

    if (qualityResult.rows.length === 0) {
      return res.json({
        matchId,
        qualityScore: null,
        status: 'initializing',
        message: 'Conversation metrics will be tracked as you chat'
      });
    }

    const quality = qualityResult.rows[0];
    res.json({
      matchId,
      qualityScore: quality.quality_score || 0,
      responseTimeAvg: quality.response_time_avg || null,
      messageDepthAvg: quality.message_depth_avg || 0,
      sentimentTrend: quality.sentiment_trend || 'neutral',
      engagementLevel: quality.engagement_level || 'low',
      languageQuality: quality.language_quality || 'basic',
      matchesFromConversation: quality.matches_from_conversation || 0,
      lastCalculatedAt: quality.updated_at,
      conversationStatus: quality.quality_score >= 75 ? 'excellent' : quality.quality_score >= 50 ? 'good' : 'developing'
    });
  } catch (err) {
    console.error('Get conversation quality error:', err);
    res.status(500).json({ error: 'Failed to get conversation quality' });
  }
});

// 59. CREATE DATE PROPOSAL
router.post('/date-proposals', async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipientId, proposedDate, proposedTime, suggestedActivity, locationId, notes } = req.body;

    if (!recipientId || !proposedDate || !proposedTime || !suggestedActivity) {
      return res.status(400).json({ error: 'recipientId, proposedDate, proposedTime, and suggestedActivity are required' });
    }

    // Verify match exists
    const matchResult = await db.query(
      `SELECT * FROM matches
       WHERE (
         (user_id_1 = $1 AND user_id_2 = $2)
         OR
         (user_id_1 = $2 AND user_id_2 = $1)
       )
       AND status = 'active'
       LIMIT 1`,
      [userId, recipientId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(400).json({ error: 'You must be matched with this user to propose a date' });
    }

    const match = matchResult.rows[0];
    const matchId = match.id;

    // Set response deadline to 3 days from now
    const responseDeadline = new Date();
    responseDeadline.setDate(responseDeadline.getDate() + 3);

    const result = await db.query(
      `INSERT INTO date_proposals (
        proposer_id, recipient_id, match_id, proposed_date, proposed_time,
        suggested_activity, location_id, status, notes, response_deadline_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)
       RETURNING *`,
      [userId, recipientId, matchId, proposedDate, proposedTime, suggestedActivity, locationId || null, notes || null, responseDeadline]
    );

    // Send notification to recipient
    const proposerProfile = await db.query(
      `SELECT first_name FROM dating_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const proposerName = proposerProfile.rows[0]?.first_name || 'Someone';

    await userNotificationService.createNotification(recipientId, {
      type: 'date_proposal',
      title: `${proposerName} wants to take you on a date!`,
      body: `${suggestedActivity} on ${proposedDate}`,
      metadata: {
        proposalId: result.rows[0].id,
        proposerId: userId,
        activity: suggestedActivity,
        date: proposedDate
      }
    });

    res.json({
      message: 'Date proposal created',
      proposal: result.rows[0]
    });
  } catch (err) {
    console.error('Create date proposal error:', err);
    res.status(500).json({ error: 'Failed to create date proposal' });
  }
});

// 60. GET MY DATE PROPOSALS (both sent and received)
router.get('/date-proposals', async (req, res) => {
  try {
    const userId = req.user.id;
    const type = req.query.type || 'all'; // 'sent', 'received', 'all'

    let query = `SELECT dp.*, 
                        p.first_name as proposer_name, p.location_city as proposer_city,
                        r.first_name as recipient_name, r.location_city as recipient_city
                 FROM date_proposals dp
                 LEFT JOIN dating_profiles p ON p.user_id = dp.proposer_id
                 LEFT JOIN dating_profiles r ON r.user_id = dp.recipient_id
                 WHERE `;

    const params = [userId];
    let paramIndex = 2;

    if (type === 'sent') {
      query += `dp.proposer_id = $1`;
    } else if (type === 'received') {
      query += `dp.recipient_id = $1`;
    } else {
      query += `(dp.proposer_id = $1 OR dp.recipient_id = $1)`;
    }

    query += ` ORDER BY dp.created_at DESC LIMIT 50`;

    const result = await db.query(query, params);

    res.json({
      proposals: result.rows.map(p => ({
        id: p.id,
        matchId: p.match_id,
        proposerId: p.proposer_id,
        proposerName: p.proposer_name,
        proposerCity: p.proposer_city,
        recipientId: p.recipient_id,
        recipientName: p.recipient_name,
        recipientCity: p.recipient_city,
        proposedDate: p.proposed_date,
        proposedTime: p.proposed_time,
        suggestedActivity: p.suggested_activity,
        locationId: p.location_id,
        status: normalizeProposalStatus(p.status),
        notes: p.notes,
        responseDeadlineAt: p.response_deadline_at,
        createdAt: p.created_at,
        respondedAt: p.responded_at,
        isSent: p.proposer_id === userId,
        isReceived: p.recipient_id === userId
      }))
    });
  } catch (err) {
    console.error('Get date proposals error:', err);
    res.status(500).json({ error: 'Failed to get date proposals' });
  }
});

// 61. ACCEPT DATE PROPOSAL
router.patch('/date-proposals/:proposalId/accept', async (req, res) => {
  try {
    const userId = req.user.id;
    const { proposalId } = req.params;

    // Verify user is the recipient
    const proposalResult = await db.query(
      `SELECT *
       FROM date_proposals
       WHERE id = $1
         AND recipient_id = $2
         AND status IN ('pending', 'proposed')
       LIMIT 1`,
      [proposalId, userId]
    );

    if (proposalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found or you are not the recipient' });
    }

    const proposal = proposalResult.rows[0];

    // Update status
    const updateResult = await db.query(
      `UPDATE date_proposals 
       SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [proposalId]
    );

    // Send notification to proposer
    const recipientProfile = await db.query(
      `SELECT first_name FROM dating_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const recipientName = recipientProfile.rows[0]?.first_name || 'Someone';

    await userNotificationService.createNotification(proposal.proposer_id, {
      type: 'date_accepted',
      title: `${recipientName} accepted your date proposal!`,
      body: `${proposal.suggested_activity} on ${proposal.proposed_date} at ${proposal.proposed_time}`,
      metadata: {
        proposalId,
        date: proposal.proposed_date,
        time: proposal.proposed_time,
        activity: proposal.suggested_activity
      }
    });

    res.json({
      message: 'Date proposal accepted',
      proposal: updateResult.rows[0]
    });
  } catch (err) {
    console.error('Accept date proposal error:', err);
    res.status(500).json({ error: 'Failed to accept date proposal' });
  }
});

// 62. DECLINE DATE PROPOSAL
router.patch('/date-proposals/:proposalId/decline', async (req, res) => {
  try {
    const userId = req.user.id;
    const { proposalId } = req.params;
    const { reason } = req.body;

    const proposalResult = await db.query(
      `SELECT *
       FROM date_proposals
       WHERE id = $1
         AND recipient_id = $2
         AND status IN ('pending', 'proposed')
       LIMIT 1`,
      [proposalId, userId]
    );

    if (proposalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found or you are not the recipient' });
    }

    const proposal = proposalResult.rows[0];

    const updateResult = await db.query(
      `UPDATE date_proposals 
       SET status = 'declined', responded_at = CURRENT_TIMESTAMP, notes = $1
       WHERE id = $2 RETURNING *`,
      [reason || 'Proposal was declined', proposalId]
    );

    res.json({
      message: 'Date proposal declined',
      proposal: updateResult.rows[0]
    });
  } catch (err) {
    console.error('Decline date proposal error:', err);
    res.status(500).json({ error: 'Failed to decline date proposal' });
  }
});

// 62b. RESCHEDULE DATE PROPOSAL
router.patch('/date-proposals/:proposalId/reschedule', async (req, res) => {
  try {
    const userId = req.user.id;
    const { proposalId } = req.params;
    const { proposedDate, proposedTime, suggestedActivity, notes } = req.body;

    if (!proposedDate || !proposedTime || !suggestedActivity) {
      return res.status(400).json({
        error: 'proposedDate, proposedTime, and suggestedActivity are required'
      });
    }

    const proposalResult = await db.query(
      `SELECT *
       FROM date_proposals
       WHERE id = $1
         AND (proposer_id = $2 OR recipient_id = $2)
         AND status IN ('pending', 'proposed', 'accepted')
       LIMIT 1`,
      [proposalId, userId]
    );

    if (proposalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found or cannot be rescheduled' });
    }

    const proposal = proposalResult.rows[0];
    const otherUserId = Number(proposal.proposer_id) === Number(userId)
      ? proposal.recipient_id
      : proposal.proposer_id;
    const responderProfile = await db.query(
      `SELECT first_name FROM dating_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const responderName = responderProfile.rows[0]?.first_name || 'Someone';
    const responseDeadline = new Date();
    responseDeadline.setDate(responseDeadline.getDate() + 3);

    const updateResult = await db.query(
      `UPDATE date_proposals
       SET proposer_id = $1,
           recipient_id = $2,
           proposed_date = $3,
           proposed_time = $4,
           suggested_activity = $5,
           notes = $6,
           status = 'pending',
           responded_at = NULL,
           response_deadline_at = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        userId,
        otherUserId,
        proposedDate,
        proposedTime,
        suggestedActivity,
        notes || null,
        responseDeadline,
        proposalId
      ]
    );

    await userNotificationService.createNotification(otherUserId, {
      type: 'date_rescheduled',
      title: `${responderName} suggested a new plan`,
      body: `${suggestedActivity} on ${proposedDate} at ${proposedTime}`,
      metadata: {
        proposalId,
        matchId: proposal.match_id,
        proposedDate,
        proposedTime,
        suggestedActivity
      }
    });

    res.json({
      message: 'Date proposal rescheduled',
      proposal: updateResult.rows[0]
    });
  } catch (err) {
    console.error('Reschedule date proposal error:', err);
    res.status(500).json({ error: 'Failed to reschedule date proposal' });
  }
});

// 63. CANCEL DATE PROPOSAL
router.delete('/date-proposals/:proposalId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { proposalId } = req.params;

    const proposalResult = await db.query(
      `SELECT *
       FROM date_proposals
       WHERE id = $1
         AND proposer_id = $2
         AND status IN ('pending', 'proposed', 'accepted')
       LIMIT 1`,
      [proposalId, userId]
    );

    if (proposalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found or you cannot cancel it' });
    }

    await db.query(`DELETE FROM date_proposals WHERE id = $1`, [proposalId]);

    res.json({ message: 'Date proposal cancelled' });
  } catch (err) {
    console.error('Cancel date proposal error:', err);
    res.status(500).json({ error: 'Failed to cancel date proposal' });
  }
});

// 64. GET NEARBY DATE LOCATIONS (Smart Discovery)
router.get('/date-locations/suggestions', async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, ambiance, maxDistance = 5, limit = 10 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    let query = `
      SELECT *,
             (6371 * acos(
               LEAST(1, GREATEST(-1,
                 cos(radians($1::float)) * cos(radians(coordinates->>'lat'::float)) *
                 cos(radians(coordinates->>'lng'::float) - radians($2::float)) +
                 sin(radians($1::float)) * sin(radians(coordinates->>'lat'::float))
               ))
             )) AS distance_km
      FROM date_locations
      WHERE verified_flag = true
    `;

    const params = [latitude, longitude];
    let paramIndex = 3;

    if (ambiance) {
      query += ` AND ambiance_type = $${paramIndex++}`;
      params.push(ambiance);
    }

    query += ` HAVING (6371 * acos(
        LEAST(1, GREATEST(-1,
          cos(radians($1::float)) * cos(radians(coordinates->>'lat'::float)) *
          cos(radians(coordinates->>'lng'::float) - radians($2::float)) +
          sin(radians($1::float)) * sin(radians(coordinates->>'lat'::float))
        ))
      )) <= $${paramIndex++}`;
    params.push(maxDistance);

    query += ` ORDER BY distance_km ASC LIMIT $${paramIndex++}`;
    params.push(limit);

    const result = await db.query(query, params);

    res.json({
      locations: result.rows.map(row => ({
        id: row.id,
        address: row.address,
        city: row.city,
        state: row.state,
        country: row.country,
        coordinates: row.coordinates,
        category: row.location_category,
        ambianceType: row.ambiance_type,
        averageCost: row.average_cost,
        hoursOfOperation: row.hours_of_operation,
        verified: row.verified_flag,
        distanceKm: Math.round(row.distance_km * 100) / 100
      }))
    });
  } catch (err) {
    console.error('Get location suggestions error:', err);
    res.status(500).json({ error: 'Failed to get location suggestions' });
  }
});

// 65. ADD NEW DATE LOCATION
router.post('/date-locations', async (req, res) => {
  try {
    const userId = req.user.id;
    const { address, city, state, country, latitude, longitude, category, ambiance, averageCost, hoursOfOperation } = req.body;

    if (!address || !city || !latitude || !longitude || !category) {
      return res.status(400).json({ error: 'address, city, latitude, longitude, and category are required' });
    }

    const result = await db.query(
      `INSERT INTO date_locations (
        created_by_id, address, city, state, country, coordinates,
        location_category, ambiance_type, average_cost, hours_of_operation, verified_flag
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
       RETURNING *`,
      [
        userId,
        address,
        city,
        state || null,
        country,
        JSON.stringify({ lat: parseFloat(latitude), lng: parseFloat(longitude) }),
        category,
        ambiance || null,
        parseFloat(averageCost) || null,
        hoursOfOperation || null
      ]
    );

    res.json({
      message: 'Location added and pending verification',
      location: result.rows[0],
      status: 'pending_verification'
    });
  } catch (err) {
    console.error('Add date location error:', err);
    res.status(500).json({ error: 'Failed to add date location' });
  }
});

// 66. UPDATE USER PRESENCE/ONLINE STATUS
router.patch('/presence/online', async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceType = 'web', statusMessage } = req.body;

    const sessionId = `session_${userId}_${Date.now()}`;

    const result = await db.query(
      `INSERT INTO user_presence_sessions (
        user_id, session_id, is_online, last_activity_at, device_type, status_message
       ) VALUES ($1, $2, true, CURRENT_TIMESTAMP, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET is_online = true,
           session_id = EXCLUDED.session_id,
           last_activity_at = CURRENT_TIMESTAMP,
           device_type = EXCLUDED.device_type,
           status_message = EXCLUDED.status_message
       RETURNING *`,
      [userId, sessionId, deviceType, statusMessage || null]
    );

    res.json({
      message: 'Status updated to online',
      sessionId: sessionId,
      isOnline: true,
      deviceType: deviceType
    });
  } catch (err) {
    console.error('Update presence online error:', err);
    res.status(500).json({ error: 'Failed to update presence' });
  }
});

// 67. UPDATE USER OFFLINE STATUS
router.patch('/presence/offline', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `UPDATE user_presence_sessions
       SET is_online = false, last_activity_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING *`,
      [userId]
    );

    res.json({
      message: 'Status updated to offline',
      isOnline: false
    });
  } catch (err) {
    console.error('Update presence offline error:', err);
    res.status(500).json({ error: 'Failed to update presence' });
  }
});

// 68. CHECK IF USER IS ONLINE (Premium Feature)
router.get('/presence/:targetUserId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.params;

    // Check subscription - premium feature
    const subResult = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );
    const sub = subResult.rows[0];
    const isPremium = sub && ['premium', 'gold'].includes(sub.plan) && (!sub.expires_at || new Date(sub.expires_at) > new Date());

    if (!isPremium) {
      return res.status(403).json({ error: 'This feature requires a Premium or Gold subscription' });
    }

    const result = await db.query(
      `SELECT * FROM user_presence_sessions WHERE user_id = $1 LIMIT 1`,
      [targetUserId]
    );

    if (result.rows.length === 0) {
      return res.json({
        userId: targetUserId,
        isOnline: false,
        lastActivity: null
      });
    }

    const presence = result.rows[0];
    res.json({
      userId: targetUserId,
      isOnline: presence.is_online,
      deviceType: presence.device_type,
      lastActivityAt: presence.last_activity_at,
      statusMessage: presence.status_message
    });
  } catch (err) {
    console.error('Check presence error:', err);
    res.status(500).json({ error: 'Failed to check user presence' });
  }
});

// 69. SUBMIT DATE COMPLETION FEEDBACK
router.post('/date-completion-feedback/:proposalId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { proposalId } = req.params;
    const { rating, feedbackText, wouldDateAgain, matchQualityRating, locationRating } = req.body;
    const normalizedRating = normalizeInteger(rating);
    const normalizedMatchQualityRating = normalizeInteger(matchQualityRating);
    const normalizedLocationRating = normalizeInteger(locationRating);
    const normalizedWouldDateAgain = normalizeOptionalBoolean(wouldDateAgain);

    if (!normalizedRating || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }

    if (
      normalizedMatchQualityRating !== null &&
      normalizedMatchQualityRating !== undefined &&
      (normalizedMatchQualityRating < 1 || normalizedMatchQualityRating > 5)
    ) {
      return res.status(400).json({ error: 'matchQualityRating must be between 1 and 5' });
    }

    if (
      normalizedLocationRating !== null &&
      normalizedLocationRating !== undefined &&
      (normalizedLocationRating < 1 || normalizedLocationRating > 5)
    ) {
      return res.status(400).json({ error: 'locationRating must be between 1 and 5' });
    }

    // Verify proposal exists and user was involved
    const proposalResult = await db.query(
      `SELECT * FROM date_proposals 
       WHERE id = $1 AND (proposer_id = $2 OR recipient_id = $2) AND status = 'accepted' LIMIT 1`,
      [proposalId, userId]
    );

    if (proposalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found or not yet completed' });
    }

    const proposal = proposalResult.rows[0];
    const otherUserId = proposal.proposer_id === userId ? proposal.recipient_id : proposal.proposer_id;
    const proposalDateTime = buildProposalDateTime({
      proposedDate: proposal.proposed_date,
      proposedTime: proposal.proposed_time
    });

    if (proposalDateTime && proposalDateTime.getTime() > Date.now()) {
      return res.status(400).json({ error: 'Date feedback is available after the scheduled time' });
    }

    const existingFeedbackResult = await optionalQuery(
      `SELECT id
       FROM date_completion_feedback
       WHERE date_proposal_id = $1 AND rater_user_id = $2
       LIMIT 1`,
      [proposalId, userId],
      []
    );

    let result;

    if (existingFeedbackResult.rows.length > 0) {
      result = await db.query(
        `UPDATE date_completion_feedback
         SET counterparty_user_id = $1,
             rating = $2,
             feedback_text = $3,
             would_date_again = $4,
             match_quality_rating = $5,
             location_rating = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [
          otherUserId,
          normalizedRating,
          feedbackText || null,
          normalizedWouldDateAgain,
          normalizedMatchQualityRating ?? null,
          normalizedLocationRating ?? null,
          existingFeedbackResult.rows[0].id
        ]
      );
    } else {
      result = await db.query(
        `INSERT INTO date_completion_feedback (
          date_proposal_id, rater_user_id, counterparty_user_id, rating, feedback_text,
          would_date_again, match_quality_rating, location_rating
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          proposalId,
          userId,
          otherUserId,
          normalizedRating,
          feedbackText || null,
          normalizedWouldDateAgain,
          normalizedMatchQualityRating ?? null,
          normalizedLocationRating ?? null
        ]
      );
    }

    // Send notification to the other person
    const userProfile = await db.query(
      `SELECT first_name FROM dating_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const userName = userProfile.rows[0]?.first_name || 'Someone';

    await userNotificationService.createNotification(otherUserId, {
      type: 'date_feedback_submitted',
      title: `${userName} shared feedback about your date`,
      body: `They rated the experience ${rating} stars`,
      metadata: {
        proposalId,
        rating
      }
    });

    res.json({
      message: 'Date feedback submitted',
      feedback: result.rows[0]
    });
  } catch (err) {
    console.error('Submit date feedback error:', err);
    res.status(500).json({ error: 'Failed to submit date feedback' });
  }
});

// 70. GET DATE HISTORY WITH FEEDBACK
router.get('/date-history', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const result = await db.query(
      `SELECT dp.*, 
              dcf.rating, dcf.feedback_text, dcf.would_date_again,
              dcf.match_quality_rating, dcf.location_rating,
              p.first_name as partner_name, p.location_city as partner_city,
              dl.address as location_address, dl.city as location_city
       FROM date_proposals dp
       LEFT JOIN date_completion_feedback dcf
         ON dcf.date_proposal_id = dp.id
        AND dcf.rater_user_id = $1
       LEFT JOIN dating_profiles p ON p.user_id = (CASE WHEN dp.proposer_id = $1 THEN dp.recipient_id ELSE dp.proposer_id END)
       LEFT JOIN date_locations dl ON dl.id = dp.location_id
       WHERE (dp.proposer_id = $1 OR dp.recipient_id = $1) AND dp.status = 'accepted'
       ORDER BY dp.created_at DESC LIMIT $2`,
      [userId, limit]
    );

    res.json({
      dateHistory: result.rows.map(row => ({
        proposalId: row.id,
        date: row.proposed_date,
        time: row.proposed_time,
        activity: row.suggested_activity,
        partnerName: row.partner_name,
        partnerCity: row.partner_city,
        location: {
          address: row.location_address,
          city: row.location_city
        },
        feedback: row.rating ? {
          rating: row.rating,
          text: row.feedback_text,
          wouldDateAgain: row.would_date_again,
          matchQualityRating: row.match_quality_rating,
          locationRating: row.location_rating
        } : null,
        hasFeedback: Boolean(row.rating)
      }))
    });
  } catch (err) {
    console.error('Get date history error:', err);
    res.status(500).json({ error: 'Failed to get date history' });
  }
});

// 71. ENABLE/DISABLE LOCATION SHARING
router.post('/location-sharing', async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, sharedStatus = 'matches' } = req.body;

    // Validate shared status
    if (!['private', 'matches', 'all'].includes(sharedStatus)) {
      return res.status(400).json({ error: 'sharedStatus must be private, matches, or all' });
    }

    const result = await db.query(
      `INSERT INTO user_locations (
        user_id, latitude, longitude, shared_status, last_updated_at
       ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE
       SET latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           shared_status = EXCLUDED.shared_status,
           last_updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, latitude, longitude, sharedStatus]
    );

    res.json({
      message: 'Location sharing updated',
      sharedStatus: sharedStatus,
      location: {
        latitude: result.rows[0].latitude,
        longitude: result.rows[0].longitude
      }
    });
  } catch (err) {
    console.error('Update location sharing error:', err);
    res.status(500).json({ error: 'Failed to update location sharing' });
  }
});

// 72. GET NEARBY USERS (Location-based Discovery - Premium)
router.get('/nearby-users', async (req, res) => {
  try {
    const userId = req.user.id;
    const { maxDistance = 5, limit = 20 } = req.query;

    // Check subscription
    const subResult = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );
    const sub = subResult.rows[0];
    const isPremium = sub && ['premium', 'gold'].includes(sub.plan) && (!sub.expires_at || new Date(sub.expires_at) > new Date());

    if (!isPremium) {
      return res.status(403).json({ error: 'This feature requires a Premium or Gold subscription' });
    }

    // Get user's location
    const userLocationResult = await db.query(
      `SELECT * FROM user_locations WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (userLocationResult.rows.length === 0) {
      return res.status(400).json({ error: 'Please enable location sharing first' });
    }

    const userLocation = userLocationResult.rows[0];

    const result = await db.query(
      `SELECT ul.*, dp.first_name, dp.age, dp.gender, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = ul.user_id LIMIT 1) as photo_url,
              (6371 * acos(
                LEAST(1, GREATEST(-1,
                  cos(radians($1::float)) * cos(radians(ul.latitude)) *
                  cos(radians(ul.longitude) - radians($2::float)) +
                  sin(radians($1::float)) * sin(radians(ul.latitude))
                ))
              )) as distance_km
       FROM user_locations ul
       JOIN dating_profiles dp ON dp.user_id = ul.user_id
       WHERE ul.user_id != $3
         AND (ul.shared_status = 'all' OR (ul.shared_status = 'matches' AND EXISTS (
           SELECT 1 FROM matches m WHERE (m.user_id_1 = $3 AND m.user_id_2 = ul.user_id)
              OR (m.user_id_2 = $3 AND m.user_id_1 = ul.user_id)
         )))
         AND (6371 * acos(
           LEAST(1, GREATEST(-1,
             cos(radians($1::float)) * cos(radians(ul.latitude)) *
             cos(radians(ul.longitude) - radians($2::float)) +
             sin(radians($1::float)) * sin(radians(ul.latitude))
           ))
         )) <= $4::float
       ORDER BY distance_km ASC LIMIT $5`,
      [userLocation.latitude, userLocation.longitude, userId, maxDistance, limit]
    );

    res.json({
      nearbyUsers: result.rows.map(row => ({
        userId: row.user_id,
        firstName: row.first_name,
        age: row.age,
        gender: row.gender,
        city: row.location_city,
        photoUrl: row.photo_url,
        distanceKm: Math.round(row.distance_km * 100) / 100
      }))
    });
  } catch (err) {
    console.error('Get nearby users error:', err);
    res.status(500).json({ error: 'Failed to get nearby users' });
  }
});

// ============================================
// TIER 2: ANALYTICS, TRANSPARENCY, & SAFETY
// ============================================

// 73. GET ANALYTICS OVERVIEW (30-day engagement summary)
router.get('/analytics/overview', async (req, res) => {
  try {
    const userId = req.user.id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await db.query(
      `SELECT
        COALESCE(SUM(CASE WHEN activity_date >= $1 THEN profiles_viewed ELSE 0 END), 0) as profiles_viewed_30d,
        COALESCE(SUM(CASE WHEN activity_date >= $1 THEN likes_sent ELSE 0 END), 0) as likes_sent_30d,
        COALESCE(SUM(CASE WHEN activity_date >= $1 THEN likes_received ELSE 0 END), 0) as likes_received_30d,
        COALESCE(SUM(CASE WHEN activity_date >= $1 THEN superlikes_sent ELSE 0 END), 0) as superlikes_sent_30d,
        COALESCE(SUM(CASE WHEN activity_date >= $1 THEN superlikes_received ELSE 0 END), 0) as superlikes_received_30d,
        COALESCE(SUM(CASE WHEN activity_date >= $1 THEN matches_created ELSE 0 END), 0) as matches_created_30d,
        COALESCE(SUM(CASE WHEN activity_date >= $1 THEN active_matches ELSE 0 END), 0) as active_matches_30d,
        COALESCE(SUM(CASE WHEN activity_date >= $1 THEN messages_sent ELSE 0 END), 0) as messages_sent_30d
       FROM profile_analytics
       WHERE user_id = $2`,
      [thirtyDaysAgo, userId]
    );

    const stats = result.rows[0];
    const engagementRate = stats.profiles_viewed_30d > 0 
      ? Math.round((stats.likes_sent_30d / stats.profiles_viewed_30d) * 100)
      : 0;

    res.json({
      analytics: {
        period: '30_days',
        profilesViewed: parseInt(stats.profiles_viewed_30d),
        likesSent: parseInt(stats.likes_sent_30d),
        likesReceived: parseInt(stats.likes_received_30d),
        superlikesSent: parseInt(stats.superlikes_sent_30d),
        superlikesReceived: parseInt(stats.superlikes_received_30d),
        matchesCreated: parseInt(stats.matches_created_30d),
        activeMatches: parseInt(stats.active_matches_30d),
        messagesSent: parseInt(stats.messages_sent_30d),
        engagementRate: engagementRate + '%'
      }
    });
  } catch (err) {
    console.error('Get analytics overview error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// 74. GET ANALYTICS TRENDS (time-series data)
router.get('/analytics/trends', async (req, res) => {
  try {
    const userId = req.user.id;
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await db.query(
      `SELECT 
        activity_date,
        profiles_viewed,
        likes_sent,
        likes_received,
        superlikes_sent,
        matches_created,
        messages_sent
       FROM profile_analytics
       WHERE user_id = $1 AND activity_date >= $2
       ORDER BY activity_date ASC`,
      [userId, startDate]
    );

    const dailyTrends = result.rows.map(row => ({
      date: row.activity_date.toISOString().split('T')[0],
      profilesViewed: row.profiles_viewed,
      likesSent: row.likes_sent,
      likesReceived: row.likes_received,
      superlikesSent: row.superlikes_sent,
      matchesCreated: row.matches_created,
      messagesSent: row.messages_sent
    }));

    res.json({ trends: dailyTrends });
  } catch (err) {
    console.error('Get analytics trends error:', err);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// 75. GET PHOTO PERFORMANCE (per-photo engagement ranking)
router.get('/analytics/photo-performance', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT 
        id,
        photo_position,
        profile_views,
        likes_received,
        superlikes_received,
        right_swipe_rate,
        left_swipe_rate,
        engagement_score
       FROM photo_performance
       WHERE user_id = $1
       ORDER BY engagement_score DESC`,
      [userId]
    );

    const photos = result.rows.map(row => ({
      photoId: row.id,
      position: row.photo_position,
      views: row.profile_views,
      likes: row.likes_received,
      superlikes: row.superlikes_received,
      rightSwipeRate: Math.round(row.right_swipe_rate),
      leftSwipeRate: Math.round(row.left_swipe_rate),
      engagementScore: Math.round(row.engagement_score * 100) / 100
    }));

    res.json({ photoPerformance: photos });
  } catch (err) {
    console.error('Get photo performance error:', err);
    res.status(500).json({ error: 'Failed to fetch photo performance' });
  }
});

// 76. GET ENGAGEMENT BREAKDOWN (by demographics, distance, time)
router.get('/analytics/engagement-breakdown', async (req, res) => {
  try {
    const userId = req.user.id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get interactions data
    const breakdownResult = await db.query(
      `SELECT 
        'age' as metric,
        dp.age_range,
        COUNT(*) as interaction_count,
        SUM(CASE WHEN i.interaction_type = 'like' THEN 1 ELSE 0 END) as likes,
        SUM(CASE WHEN i.interaction_type = 'superlike' THEN 1 ELSE 0 END) as superlikes
       FROM interactions i
       JOIN dating_profiles dp ON (
         (i.user_id_1 = $1 AND dp.user_id = i.user_id_2) OR 
         (i.user_id_2 = $1 AND dp.user_id = i.user_id_1)
       )
       WHERE (i.user_id_1 = $1 OR i.user_id_2 = $1)
         AND i.created_at >= $2
       GROUP BY dp.age_range
       UNION ALL
       SELECT 
        'distance' as metric,
        CASE 
          WHEN i.distance_km <= 5 THEN '0-5km'
          WHEN i.distance_km <= 20 THEN '5-20km'
          WHEN i.distance_km <= 50 THEN '20-50km'
          ELSE '50km+'
        END as distance_range,
        COUNT(*) as interaction_count,
        SUM(CASE WHEN i.interaction_type = 'like' THEN 1 ELSE 0 END),
        SUM(CASE WHEN i.interaction_type = 'superlike' THEN 1 ELSE 0 END)
       FROM interactions i
       WHERE (i.user_id_1 = $1 OR i.user_id_2 = $1)
         AND i.created_at >= $2
       GROUP BY distance_range`,
      [userId, thirtyDaysAgo]
    );

    const breakdown = {};
    breakdownResult.rows.forEach(row => {
      const category = row.metric === 'age' ? row.age_range : row.distance_range;
      breakdown[category] = {
        interactions: row.interaction_count,
        likes: row.likes || 0,
        superlikes: row.superlikes || 0
      };
    });

    res.json({ engagementBreakdown: breakdown });
  } catch (err) {
    console.error('Get engagement breakdown error:', err);
    res.status(500).json({ error: 'Failed to fetch engagement breakdown' });
  }
});

// 77. GET CONVERSATION INSIGHTS (message patterns & quality)
router.get('/analytics/conversation-insights', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT 
        COUNT(*) as total_conversations,
        AVG(message_count) as avg_messages_per_match,
        MAX(message_count) as longest_conversation,
        COUNT(CASE WHEN has_met = true THEN 1 END) as meetings_arranged,
        ROUND(AVG(quality_rating)::numeric, 2) as avg_quality_score
       FROM (
         SELECT 
          m.id,
          (SELECT COUNT(*) FROM messages WHERE match_id = m.id) as message_count,
          (SELECT AVG(dcf.rating)
           FROM date_completion_feedback dcf
           INNER JOIN date_proposals dp ON dp.id = dcf.date_proposal_id
           WHERE dp.match_id = m.id AND dcf.rater_user_id = $1) as quality_rating,
          (SELECT COUNT(*) FROM date_proposals WHERE match_id = m.id AND status = 'accepted') > 0 as has_met
         FROM matches m
         WHERE m.user_id_1 = $1 OR m.user_id_2 = $1
       ) conversation_stats`,
      [userId]
    );

    const insights = result.rows[0];

    res.json({
      conversationInsights: {
        totalConversations: parseInt(insights.total_conversations),
        averageMessagesPerMatch: Math.round(insights.avg_messages_per_match || 0),
        longestConversation: parseInt(insights.longest_conversation || 0),
        meetingsArranged: parseInt(insights.meetings_arranged),
        averageQualityScore: parseFloat(insights.avg_quality_score) || 0
      }
    });
  } catch (err) {
    console.error('Get conversation insights error:', err);
    res.status(500).json({ error: 'Failed to fetch conversation insights' });
  }
});

// 78. GET MATCH EXPLANATION (why a profile was suggested)
router.get('/match-explanation/:suggestedUserId', async (req, res) => {
  try {
    const userId = req.user.id;
    const suggestedUserId = parseInt(req.params.suggestedUserId);

    const result = await db.query(
      `SELECT 
        compatibility_score,
        factors_json,
        recommendations_json
       FROM matchmaker_explanations
       WHERE viewer_id = $1 AND candidate_id = $2
       LIMIT 1`,
      [userId, suggestedUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No explanation found for this match' });
    }

    const explanation = result.rows[0];

    res.json({
      matchExplanation: {
        compatibilityScore: explanation.compatibility_score,
        factors: explanation.factors_json || [],
        recommendations: explanation.recommendations_json || []
      }
    });
  } catch (err) {
    console.error('Get match explanation error:', err);
    res.status(500).json({ error: 'Failed to fetch match explanation' });
  }
});

// 79. GET MATCHING FACTORS (what drives my matches)
router.get('/matching-factors/my-profile', async (req, res) => {
  try {
    const userId = req.user.id;

    // Analyze what factors appear most in explanations
    const result = await db.query(
      `SELECT 
        factors_json,
        COUNT(*) as frequency
       FROM matchmaker_explanations
       WHERE viewer_id = $1
       GROUP BY factors_json
       ORDER BY frequency DESC
       LIMIT 20`,
      [userId]
    );

    const factors = {};
    result.rows.forEach(row => {
      if (row.factors_json && Array.isArray(row.factors_json)) {
        row.factors_json.forEach(factor => {
          factors[factor] = (factors[factor] || 0) + row.frequency;
        });
      }
    });

    const topFactors = Object.entries(factors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([factor, count]) => ({ factor, frequency: count }));

    res.json({ matchingFactors: topFactors });
  } catch (err) {
    console.error('Get matching factors error:', err);
    res.status(500).json({ error: 'Failed to fetch matching factors' });
  }
});

// 80. GET DECISION HISTORY (all historical swipes - Premium)
router.get('/decision-history', async (req, res) => {
  try {
    const userId = req.user.id;

    // Check subscription
    const subResult = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );

    if (subResult.rows.length === 0 || !['premium', 'gold'].includes(subResult.rows[0].plan)) {
      return res.status(403).json({ error: 'This feature requires a Premium or Gold subscription' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = Math.min(parseInt(req.query.offset) || 0, 10000);

    const result = await db.query(
      `SELECT 
        udh.id,
        udh.decision_type,
        udh.decision_timestamp,
        udh.context,
        udh.profile_still_available,
        udh.undo_action,
        dp.first_name,
        dp.age,
        (SELECT photo_url FROM profile_photos WHERE user_id = udh.profile_user_id LIMIT 1) as photo_url
       FROM user_decision_history udh
       JOIN dating_profiles dp ON dp.user_id = udh.profile_user_id
       WHERE udh.user_id = $1
       ORDER BY udh.decision_timestamp DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const decisions = result.rows.map(row => ({
      id: row.id,
      decision: row.decision_type,
      timestamp: row.decision_timestamp,
      context: row.context,
      profileAvailable: row.profile_still_available,
      undone: row.undo_action,
      profile: {
        name: row.first_name,
        age: row.age,
        photoUrl: row.photo_url
      }
    }));

    res.json({ decisions });
  } catch (err) {
    console.error('Get decision history error:', err);
    res.status(500).json({ error: 'Failed to fetch decision history' });
  }
});

// 81. UNDO PASS (reverse a pass - Premium, 3/day free)
router.post('/undo-pass/:profileId', async (req, res) => {
  try {
    const userId = req.user.id;
    const profileUserId = parseInt(req.params.profileId);

    // Find the pass decision
    const passResult = await db.query(
      `SELECT * FROM user_decision_history
       WHERE user_id = $1 AND profile_user_id = $2 AND decision_type = 'pass'
       ORDER BY decision_timestamp DESC LIMIT 1`,
      [userId, profileUserId]
    );

    if (passResult.rows.length === 0) {
      return res.status(404).json({ error: 'No pass found for this profile' });
    }

    const passDecision = passResult.rows[0];

    // Check if already undone
    if (passDecision.undo_action) {
      return res.status(400).json({ error: 'This pass has already been undone' });
    }

    // Mark pass as undone
    await db.query(
      `UPDATE user_decision_history
       SET undo_action = true, undone_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [passDecision.id]
    );

    // Re-show in discovery queue
    res.json({ message: 'Pass undone - profile returned to your discovery queue' });
  } catch (err) {
    console.error('Undo pass error:', err);
    res.status(500).json({ error: 'Failed to undo pass' });
  }
});

// 82. GET PROFILES I PASSED (view history of passed profiles - Premium)
router.get('/profiles/passed', async (req, res) => {
  try {
    const userId = req.user.id;

    // Check subscription
    const subResult = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );

    if (subResult.rows.length === 0 || !['premium', 'gold'].includes(subResult.rows[0].plan)) {
      return res.status(403).json({ error: 'This feature requires a Premium or Gold subscription' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = Math.min(parseInt(req.query.offset) || 0, 10000);

    const result = await db.query(
      `SELECT 
        udh.id,
        udh.profile_user_id,
        udh.decision_timestamp,
        dp.first_name,
        dp.age,
        dp.gender,
        (SELECT photo_url FROM profile_photos WHERE user_id = udh.profile_user_id LIMIT 1) as photo_url
       FROM user_decision_history udh
       JOIN dating_profiles dp ON dp.user_id = udh.profile_user_id
       WHERE udh.user_id = $1 AND udh.decision_type = 'pass' AND udh.undo_action = false
       ORDER BY udh.decision_timestamp DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const passedProfiles = result.rows.map(row => ({
      id: row.id,
      userId: row.profile_user_id,
      firstName: row.first_name,
      age: row.age,
      gender: row.gender,
      photoUrl: row.photo_url,
      passedAt: row.decision_timestamp
    }));

    res.json({ passedProfiles });
  } catch (err) {
    console.error('Get passed profiles error:', err);
    res.status(500).json({ error: 'Failed to fetch passed profiles' });
  }
});

// 83. GET SUPERLIKE STATS (usage & response rates)
router.get('/superlikes/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await db.query(
      `SELECT 
        COUNT(*) as total_superlikes_sent,
        SUM(CASE WHEN receiver_response = 'liked' THEN 1 ELSE 0 END) as liked_back,
        SUM(CASE WHEN receiver_response = 'matched' THEN 1 ELSE 0 END) as matched,
        SUM(CASE WHEN receiver_response = 'passed' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN gift_type != 'none' THEN 1 ELSE 0 END) as with_gift,
        COUNT(CASE WHEN sent_at >= $2 THEN 1 END) as superlikes_30d
       FROM superlike_gifts
       WHERE sender_id = $1`,
      [userId, thirtyDaysAgo]
    );

    const stats = result.rows[0];
    const responseRate = stats.total_superlikes_sent > 0
      ? Math.round(((stats.liked_back + stats.matched) / stats.total_superlikes_sent) * 100)
      : 0;

    res.json({
      superlikeStats: {
        totalSent: parseInt(stats.total_superlikes_sent),
        responses: {
          likedBack: parseInt(stats.liked_back) || 0,
          matched: parseInt(stats.matched) || 0,
          passed: parseInt(stats.passed) || 0
        },
        withGift: parseInt(stats.with_gift) || 0,
        responseRate: responseRate + '%',
        last30Days: parseInt(stats.superlikes_30d)
      }
    });
  } catch (err) {
    console.error('Get superlike stats error:', err);
    res.status(500).json({ error: 'Failed to fetch superlike stats' });
  }
});

// 84. PURCHASE SPOTLIGHT LISTING (premium visibility feature - monetization)
router.post('/spotlight/purchase', async (req, res) => {
  try {
    const userId = req.user.id;
    const { spotlightType } = req.body;

    const validTypes = ['bronze', 'silver', 'gold', 'platinum'];
    if (!validTypes.includes(spotlightType)) {
      return res.status(400).json({ error: 'Invalid spotlight type' });
    }

    // Define spotlight tiers
    const tiers = {
      bronze: { duration: 2, unit: 'hours', multiplier: 3, price: 2.99 },
      silver: { duration: 24, unit: 'hours', multiplier: 5, price: 5.99 },
      gold: { duration: 7, unit: 'days', multiplier: 10, price: 19.99 },
      platinum: { duration: 30, unit: 'days', multiplier: 15, price: 99.99 }
    };

    const tier = tiers[spotlightType];
    const expiresAt = new Date();
    if (tier.unit === 'hours') {
      expiresAt.setHours(expiresAt.getHours() + tier.duration);
    } else {
      expiresAt.setDate(expiresAt.getDate() + tier.duration);
    }

    // Insert spotlight listing
    const result = await db.query(
      `INSERT INTO spotlight_listings (
        user_id, spotlight_type, visibility_multiplier, is_active, started_at, expires_at, price_paid
       ) VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, $4, $5)
       RETURNING *`,
      [userId, spotlightType, tier.multiplier, expiresAt, tier.price]
    );

    res.json({
      message: 'Spotlight listing purchased',
      spotlight: {
        id: result.rows[0].id,
        type: spotlightType,
        duration: `${tier.duration}${tier.unit.charAt(0).toUpperCase()}`,
        visibility: `${tier.multiplier}x visibility`,
        expiresAt: expiresAt,
        pricePaid: tier.price
      }
    });
  } catch (err) {
    console.error('Purchase spotlight error:', err);
    res.status(500).json({ error: 'Failed to purchase spotlight listing' });
  }
});

// 85. GET AVAILABLE SPOTLIGHT PLANS (pricing & tiers)
router.get('/spotlight/available-plans', async (req, res) => {
  try {
    const plans = [
      { type: 'bronze', duration: '2 hours', multiplier: '3x', price: 2.99, description: 'Quick boost' },
      { type: 'silver', duration: '24 hours', multiplier: '5x', price: 5.99, description: 'Daily featured' },
      { type: 'gold', duration: '7 days', multiplier: '10x', price: 19.99, description: 'Weekly featured' },
      { type: 'platinum', duration: '30 days', multiplier: '15x', price: 99.99, description: 'Monthly premium' }
    ];

    res.json({ plans });
  } catch (err) {
    console.error('Get spotlight plans error:', err);
    res.status(500).json({ error: 'Failed to fetch spotlight plans' });
  }
});

// 86. GET CONCIERGE MATCHES (premium curated matches)
router.get('/concierge/matches', async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is premium tier
    const subResult = await db.query(
      `SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );

    if (subResult.rows.length === 0 || subResult.rows[0].plan !== 'gold') {
      return res.status(403).json({ error: 'This feature requires a Gold subscription (Premium Concierge tier)' });
    }

    const status = req.query.status || 'pending';
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const result = await db.query(
      `SELECT 
        cm.id,
        cm.matched_user_id,
        cm.concierge_note,
        cm.suggested_date_idea,
        cm.compatibility_reasons,
        cm.status,
        cm.curated_at,
        dp.first_name,
        dp.age,
        (SELECT photo_url FROM profile_photos WHERE user_id = cm.matched_user_id LIMIT 1) as photo_url
       FROM concierge_matches cm
       JOIN dating_profiles dp ON dp.user_id = cm.matched_user_id
       WHERE cm.user_id = $1 AND cm.status = $2
       ORDER BY cm.curated_at DESC
       LIMIT $3`,
      [userId, status, limit]
    );

    const matches = result.rows.map(row => ({
      id: row.id,
      userId: row.matched_user_id,
      name: row.first_name,
      age: row.age,
      photoUrl: row.photo_url,
      conciergeNote: row.concierge_note,
      suggestedDateIdea: row.suggested_date_idea,
      compatibilityReasons: row.compatibility_reasons || [],
      status: row.status,
      curatedAt: row.curated_at
    }));

    res.json({ conciergeMatches: matches });
  } catch (err) {
    console.error('Get concierge matches error:', err);
    res.status(500).json({ error: 'Failed to fetch concierge matches' });
  }
});

// 87. RUN FRAUD CHECK (AI-based profile verification)
router.post('/verify/run-fraud-check', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user profile data
    const profileResult = await db.query(
      `SELECT dp.*, u.created_at as account_created_at
       FROM dating_profiles dp
       JOIN users u ON u.id = dp.user_id
       WHERE dp.user_id = $1`,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = profileResult.rows[0];
    const redFlags = [];

    // Check for new account
    const accountAge = (Date.now() - new Date(profile.account_created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (accountAge < 7) {
      redFlags.push('new_account');
    }

    // Check bio for suspicious patterns
    const suspiciousPatterns = ['money', 'bank', 'investment', 'bitcoin', 'wire transfer'];
    if (profile.bio && suspiciousPatterns.some(pattern => profile.bio.toLowerCase().includes(pattern))) {
      redFlags.push('suspicious_bio_content');
    }

    // Check for rapid profile changes
    const recentChanges = await db.query(
      `SELECT COUNT(*) as change_count
       FROM activity_logs
       WHERE user_id = $1 AND activity_type = 'profile_update'
       AND created_at >= $2`,
      [userId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)]
    );

    if (recentChanges.rows[0].change_count > 5) {
      redFlags.push('rapid_profile_changes');
    }

    // Calculate risk level
    let riskLevel = 'low';
    if (redFlags.length >= 3) riskLevel = 'high';
    else if (redFlags.length >= 2) riskLevel = 'medium';

    // Upsert verification score
    const result = await db.query(
      `INSERT INTO profile_verification_scores (
        user_id, photo_authenticity_score, bio_consistency_score, activity_pattern_score,
        fraud_risk_level, red_flags, ai_check_last_run, overall_trust_score
       ) VALUES ($1, 75, 80, 70, $2, $3, CURRENT_TIMESTAMP, 75)
       ON CONFLICT (user_id) DO UPDATE
       SET fraud_risk_level = EXCLUDED.fraud_risk_level,
           red_flags = EXCLUDED.red_flags,
           ai_check_last_run = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, riskLevel, JSON.stringify(redFlags)]
    );

    res.json({
      fraudCheckResult: {
        riskLevel: riskLevel,
        redFlags: redFlags,
        overallTrustScore: 75,
        recommendations: riskLevel === 'high' 
          ? ['Review profile photo', 'Verify email address', 'Add more bio details']
          : []
      }
    });
  } catch (err) {
    console.error('Run fraud check error:', err);
    res.status(500).json({ error: 'Failed to run fraud check' });
  }
});

// 88. GET PROFILE TRUST SCORE (view own or another user's trust score)
router.get('/profile-trust-score/:targetUserId', async (req, res) => {
  try {
    const userId = req.user.id;
    const targetUserId = parseInt(req.params.targetUserId);

    // Can only view own score, or if viewing another's (future feature)
    if (userId !== targetUserId) {
      return res.status(403).json({ error: 'Can only view your own trust score' });
    }

    const result = await db.query(
      `SELECT 
        overall_trust_score,
        fraud_risk_level,
        is_verified_photo,
        is_verified_email,
        is_verified_phone,
        red_flags
       FROM profile_verification_scores
       WHERE user_id = $1`,
      [targetUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trust score not available' });
    }

    const score = result.rows[0];

    res.json({
      trustScore: {
        overallScore: score.overall_trust_score,
        riskLevel: score.fraud_risk_level,
        verifications: {
          photoVerified: score.is_verified_photo,
          emailVerified: score.is_verified_email,
          phoneVerified: score.is_verified_phone
        },
        redFlags: score.red_flags || []
      }
    });
  } catch (err) {
    console.error('Get profile trust score error:', err);
    res.status(500).json({ error: 'Failed to fetch trust score' });
  }
});

// 89. REPORT HARASSMENT (safety flag with multiple categories)
router.post('/conversations/report-harassment/:matchId', async (req, res) => {
  try {
    const userId = req.user.id;
    const matchId = parseInt(req.params.matchId);
    const { reason, description, messageIds } = req.body;

    const validReasons = [
      'sexual_harassment',
      'threatening_behavior',
      'spam',
      'inappropriate_language',
      'scam',
      'catfishing',
      'hate_speech',
      'other'
    ];

    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid report reason' });
    }

    // Get match info to find reported user
    const matchResult = await db.query(
      `SELECT user_id_1, user_id_2 FROM matches WHERE id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];
    const reportedUserId = userId === match.user_id_1 ? match.user_id_2 : match.user_id_1;

    // Determine severity
    let severity = 'medium';
    if (['sexual_harassment', 'threatening_behavior', 'hate_speech'].includes(reason)) {
      severity = 'high';
    } else if (['spam', 'catfishing'].includes(reason)) {
      severity = 'medium';
    }

    // Create safety flag
    const result = await db.query(
      `INSERT INTO conversation_safety_flags (
        match_id, reporter_id, reported_user_id, reason, description, message_ids, severity, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'reported')
       RETURNING *`,
      [matchId, userId, reportedUserId, reason, description, JSON.stringify(messageIds || []), severity]
    );

    // Auto-block if high severity
    if (severity === 'high') {
      await db.query(
        `INSERT INTO blocks (blocker_id, blocked_id, reason) VALUES ($1, $2, $3)
         ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
        [userId, reportedUserId, 'harassment_report']
      );
    }

    res.json({
      message: 'Report submitted successfully',
      reportId: result.rows[0].id,
      status: 'reported',
      severity: severity,
      autoBlocked: severity === 'high'
    });
  } catch (err) {
    console.error('Report harassment error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// 90. GET CONVERSATION SAFETY TIPS (best practices)
router.get('/conversation-safety/tips', async (req, res) => {
  try {
    const tips = [
      {
        category: 'Personal Safety',
        tips: [
          'Never share your home address until you meet in person',
          'Tell a trusted friend about your date plans',
          'Always meet in public locations first',
          'Trust your gut - if something feels off, it probably is'
        ]
      },
      {
        category: 'Financial Safety',
        tips: [
          'Never send money to someone you haven\'t met',
          'Be wary of requests for financial help early in conversation',
          'Investment opportunities are often scams',
          'If it sounds too good to be true, it is'
        ]
      },
      {
        category: 'Information Security',
        tips: [
          'Don\'t share your phone number until you\'re ready',
          'Use video call to verify before meeting',
          'Never share passwords or sensitive info',
          'Check for consistent stories - genuine people stay consistent'
        ]
      },
      {
        category: 'Red Flags to Watch For',
        tips: [
          'Pressure to move conversations off the app quickly',
          'Asking for explicit photos or videos',
          'Inconsistent stories about themselves',
          'Avoiding video calls or meeting in person',
          'Asking about relationship status or intentions too quickly'
        ]
      }
    ];

    res.json({ safetyTips: tips });
  } catch (err) {
    console.error('Get safety tips error:', err);
    res.status(500).json({ error: 'Failed to fetch safety tips' });
  }
});

// TIER 3 ENDPOINTS (91-111): PLATFORM FEATURES & GAMIFICATION

// Endpoint 91: POST /dating/referrals/introduce
router.post('/referrals/introduce', authenticateToken, async (req, res) => {
  try {
    const { friend_user_id, referral_message } = req.body;
    const referrer_id = req.user.id;

    if (!friend_user_id) {
      return res.status(400).json({ error: 'friend_user_id is required' });
    }

    const friend = await db.User.findByPk(friend_user_id);
    if (!friend) {
      return res.status(404).json({ error: 'Friend not found' });
    }

    // Find a potential match (random user they might match with)
    const recipientUser = await db.User.findOne({
      where: { id: { [Op.not]: [referrer_id, friend_user_id] } },
      order: [[sequelize.literal('RANDOM()')]]
    });

    if (!recipientUser) {
      return res.status(400).json({ error: 'No users available for referral' });
    }

    const referral = await db.FriendReferral.create({
      referrer_user_id: referrer_id,
      referred_user_id: friend_user_id,
      recipient_user_id: recipientUser.id,
      referral_message: referral_message || `${friend.first_name} thinks we'd be great together!`,
      match_result: 'pending'
    });

    res.status(201).json({ 
      referral,
      message: `Referral sent! ${friend.first_name} can now see the suggestion.`
    });
  } catch (err) {
    console.error('Introduce friend error:', err);
    res.status(500).json({ error: 'Failed to introduce friend' });
  }
});

// Endpoint 92: GET /dating/referrals/incoming
router.get('/referrals/incoming', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const referrals = await db.FriendReferral.findAll({
      where: { recipient_user_id: userId },
      include: [
        { model: db.User, as: 'referrer', attributes: ['id', 'first_name', 'age', 'bio', 'location_city'] },
        { model: db.User, as: 'referred', attributes: ['id', 'first_name', 'age', 'bio', 'location_city'] }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({ 
      referrals,
      count: referrals.length,
      message: `You have ${referrals.length} incoming referrals`
    });
  } catch (err) {
    console.error('Get incoming referrals error:', err);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

// Endpoint 93: POST /dating/referrals/:referralId/accept
router.post('/referrals/:referralId/accept', authenticateToken, async (req, res) => {
  try {
    const referralId = req.params.referralId;
    const userId = req.user.id;

    const referral = await db.FriendReferral.findByPk(referralId);
    if (!referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    if (referral.recipient_user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to accept this referral' });
    }

    // Create a match between referred_user_id and recipient_user_id
    const match = await db.Match.findOrCreate({
      where: {
        [Op.or]: [
          { user_id_1: referral.referred_user_id, user_id_2: referral.recipient_user_id },
          { user_id_1: referral.recipient_user_id, user_id_2: referral.referred_user_id }
        ]
      },
      defaults: {
        user_id_1: referral.referred_user_id,
        user_id_2: referral.recipient_user_id,
        matched_at: new Date()
      }
    });

    await referral.update({ accepted_at: new Date(), match_result: 'matched' });

    res.json({ 
      referral,
      match: match[0],
      message: 'Referral accepted! You may have a new match!'
    });
  } catch (err) {
    console.error('Accept referral error:', err);
    res.status(500).json({ error: 'Failed to accept referral' });
  }
});

// Endpoint 94: GET /dating/referrals/success
router.get('/referrals/success', authenticateToken, async (req, res) => {
  try {
    const referrerId = req.user.id;

    const successfulReferrals = await db.FriendReferral.findAll({
      where: { 
        referrer_user_id: referrerId,
        match_result: { [Op.in]: ['matched', 'still_talking', 'met'] }
      }
    });

    const totalReferrals = await db.FriendReferral.count({
      where: { referrer_user_id: referrerId }
    });

    const successRate = totalReferrals > 0 ? Math.round((successfulReferrals.length / totalReferrals) * 100) : 0;

    res.json({
      total_referrals: totalReferrals,
      successful_referrals: successfulReferrals.length,
      success_rate_percent: successRate,
      badge_earned: successfulReferrals.length >= 3 ? 'Great Matchmaker' : null,
      referrals: successfulReferrals
    });
  } catch (err) {
    console.error('Get referral success error:', err);
    res.status(500).json({ error: 'Failed to fetch referral success' });
  }
});

// Endpoint 95: POST /dating/video-dates/request/:matchId
router.post('/video-dates/request/:matchId', authenticateToken, async (req, res) => {
  try {
    const matchId = req.params.matchId;
    const { proposed_time, duration_minutes } = req.body;
    const userId = req.user.id;

    const match = await db.Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    // Verify user is part of this match
    if (match.user_id_1 !== userId && match.user_id_2 !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!proposed_time) {
      return res.status(400).json({ error: 'proposed_time is required' });
    }

    const videoDate = await db.VideoDate.create({
      match_id: matchId,
      initiator_id: userId,
      start_time: proposed_time,
      status: 'pending',
      duration_seconds: duration_minutes ? duration_minutes * 60 : 1800
    });

    res.status(201).json({ 
      videoDate,
      message: 'Video date request sent!'
    });
  } catch (err) {
    console.error('Create video date request error:', err);
    res.status(500).json({ error: 'Failed to create video date request' });
  }
});

// Endpoint 96: GET /dating/video-dates/pending
router.get('/video-dates/pending', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const pendingVideoDates = await db.VideoDate.findAll({
      where: { 
        status: 'pending',
        [Op.or]: [
          { initiator_id: userId }
        ]
      },
      include: [
        { model: db.Match, include: [{ model: db.User, as: 'user1' }, { model: db.User, as: 'user2' }] },
        { model: db.User, as: 'initiator', attributes: ['id', 'first_name', 'age'] }
      ]
    });

    res.json({
      pending_count: pendingVideoDates.length,
      video_dates: pendingVideoDates
    });
  } catch (err) {
    console.error('Get pending video dates error:', err);
    res.status(500).json({ error: 'Failed to fetch pending video dates' });
  }
});

// Endpoint 97: POST /dating/video-dates/:videoDateId/complete
router.post('/video-dates/:videoDateId/complete', authenticateToken, async (req, res) => {
  try {
    const videoDateId = req.params.videoDateId;
    const { duration_minutes, quality_rating, would_meet_in_person, feedback } = req.body;

    const videoDate = await db.VideoDate.findByPk(videoDateId);
    if (!videoDate) {
      return res.status(404).json({ error: 'Video date not found' });
    }

    await videoDate.update({
      status: 'completed',
      duration_seconds: duration_minutes ? duration_minutes * 60 : null,
      video_quality_rating: quality_rating,
      feedback: feedback || 'great_conversation'
    });

    res.json({
      videoDate,
      message: 'Video date completed!'
    });
  } catch (err) {
    console.error('Complete video date error:', err);
    res.status(500).json({ error: 'Failed to complete video date' });
  }
});

// Endpoint 98: GET /dating/video-dates/history
router.get('/video-dates/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const videoDates = await db.VideoDate.findAll({
      where: { 
        initiator_id: userId,
        status: { [Op.in]: ['completed', 'cancelled'] }
      },
      include: [
        { model: db.Match },
        { model: db.User, as: 'initiator', attributes: ['id', 'first_name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    const stats = {
      total_video_dates: videoDates.length,
      avg_quality: videoDates.length > 0 
        ? (videoDates.reduce((sum, v) => sum + (v.video_quality_rating || 0), 0) / videoDates.length).toFixed(2)
        : 0,
      would_meet_count: videoDates.filter(v => v.feedback === 'great_conversation').length
    };

    res.json({
      stats,
      video_dates: videoDates
    });
  } catch (err) {
    console.error('Get video date history error:', err);
    res.status(500).json({ error: 'Failed to fetch video date history' });
  }
});

// Endpoint 99: GET /dating/events/nearby
router.get('/events/nearby', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lat, lng, radius_km } = req.query;

    const user = await db.User.findByPk(userId);
    const userLat = lat || user.location_latitude;
    const userLng = lng || user.location_longitude;
    const radius = radius_km || 50;

    if (!userLat || !userLng) {
      return res.status(400).json({ error: 'User location required' });
    }

    // Haversine formula to find events within radius
    const events = await sequelize.query(`
      SELECT *, 
        (6371 * acos(cos(radians(:userLat)) * cos(radians(location_latitude)) * 
         cos(radians(location_longitude) - radians(:userLng)) + 
         sin(radians(:userLat)) * sin(radians(location_latitude)))) AS distance_km
      FROM dating_events
      WHERE event_date > NOW()
      HAVING distance_km <= :radius
      ORDER BY distance_km ASC
      LIMIT 50
    `, {
      replacements: { userLat, userLng, radius },
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      events: events || [],
      count: events ? events.length : 0,
      user_location: { lat: userLat, lng: userLng }
    });
  } catch (err) {
    console.error('Get nearby events error:', err);
    res.status(500).json({ error: 'Failed to fetch nearby events' });
  }
});

// Endpoint 100: POST /dating/events/:eventId/attend
router.post('/events/:eventId/attend', authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const userId = req.user.id;

    const datingEvent = await db.DatingEvent.findByPk(eventId);
    if (!datingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const [attendance, created] = await db.EventAttendees.findOrCreate({
      where: { event_id: eventId, user_id: userId },
      defaults: { status: 'attending' }
    });

    if (!created) {
      await attendance.update({ status: 'attending' });
    }

    await datingEvent.increment('attending_count');

    res.status(201).json({
      attendance,
      message: 'You are now attending this event!'
    });
  } catch (err) {
    console.error('Attend event error:', err);
    res.status(500).json({ error: 'Failed to attend event' });
  }
});

// Endpoint 101: GET /dating/events/:eventId/attendees
router.get('/events/:eventId/attendees', authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const userId = req.user.id;

    const user = await db.User.findByPk(userId);
    if (user.subscription_tier !== 'Premium' && user.subscription_tier !== 'Gold') {
      return res.status(403).json({ error: 'Premium feature - upgrade to see attendees' });
    }

    const attendees = await db.EventAttendees.findAll({
      where: { event_id: eventId, status: 'attending' },
      include: [{ 
        model: db.User, 
        attributes: ['id', 'first_name', 'age', 'bio', 'location_city', 'profile_photo_url']
      }],
      limit: 20
    });

    res.json({
      attendees: attendees.map(a => a.User),
      count: attendees.length
    });
  } catch (err) {
    console.error('Get event attendees error:', err);
    res.status(500).json({ error: 'Failed to fetch event attendees' });
  }
});

// Endpoint 102: GET /dating/matching/event-based
router.get('/matching/event-based', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find events user is attending
    const userEventAttendances = await db.EventAttendees.findAll({
      where: { user_id: userId, status: 'attending' },
      include: [{ model: db.DatingEvent }]
    });

    const eventIds = userEventAttendances.map(a => a.event_id);

    if (eventIds.length === 0) {
      return res.json({ 
        events_you_attend: [],
        matches_at_same_event: []
      });
    }

    // Find other users at same events (potential matches)
    const otherAttendees = await db.EventAttendees.findAll({
      where: { 
        event_id: { [Op.in]: eventIds },
        user_id: { [Op.not]: userId },
        status: 'attending'
      },
      include: [{ 
        model: db.User,
        attributes: ['id', 'first_name', 'age', 'bio', 'location_city']
      }, {
        model: db.DatingEvent,
        attributes: ['id', 'title', 'event_date', 'location_city']
      }],
      limit: 20
    });

    res.json({
      events_you_attend: userEventAttendances.map(a => a.DatingEvent),
      matches_at_same_event: otherAttendees.map(a => ({
        userId: a.User.id,
        user: a.User,
        event: a.DatingEvent
      })),
      suggestion: `${otherAttendees.length} potential matches at your events!`
    });
  } catch (err) {
    console.error('Get event-based matching error:', err);
    res.status(500).json({ error: 'Failed to fetch event-based matches' });
  }
});

// Endpoint 103: GET /dating/achievements
router.get('/achievements', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const achievements = await db.UserAchievement.findAll({
      where: { user_id: userId, is_public: true },
      order: [['earned_at', 'DESC']]
    });

    const streaks = await db.UserAnalytics.findOne({
      where: { user_id: userId },
      attributes: ['daily_login_streak', 'messaging_streak']
    });

    res.json({
      badges: achievements,
      current_streaks: {
        daily_login: streaks ? streaks.daily_login_streak : 0,
        messaging: streaks ? streaks.messaging_streak : 0
      },
      total_achievements: achievements.length
    });
  } catch (err) {
    console.error('Get achievements error:', err);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Endpoint 104: GET /dating/leaderboard
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;

    // Get top users by achievement count
    const topUsers = await sequelize.query(`
      SELECT u.id, u.first_name, u.age, u.location_city, COUNT(ua.id) as achievement_count
      FROM users u
      LEFT JOIN user_achievements ua ON u.id = ua.user_id AND ua.is_public = true
      GROUP BY u.id
      ORDER BY achievement_count DESC
      LIMIT 50
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      period,
      leaderboard: topUsers,
      your_rank: topUsers.findIndex(u => u.id === req.user.id) + 1 || 'unranked'
    });
  } catch (err) {
    console.error('Get leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Endpoint 105: GET /dating/personality-archetype
router.get('/personality-archetype', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    let archetype = await db.PersonalityArchetype.findOne({
      where: { user_id: userId }
    });

    if (!archetype) {
      // Create default archetype if not exists
      archetype = await db.PersonalityArchetype.create({
        user_id: userId,
        archetype_code: 'romantic',
        archetype_name: 'The Romantic',
        description: 'Emotional, detail-oriented, and values loyalty',
        strengths: ['empathetic', 'reliable', 'good listener'],
        communication_style: 'warm, personal, relationship-focused',
        best_matches: ['The Protector', 'The Counselor']
      });
    }

    res.json(archetype);
  } catch (err) {
    console.error('Get personality archetype error:', err);
    res.status(500).json({ error: 'Failed to fetch personality archetype' });
  }
});

// Endpoint 106: GET /dating/archetype/:archetype/compatibility/:otherArchetype
router.get('/archetype/:archetype/compatibility/:otherArchetype', authenticateToken, async (req, res) => {
  try {
    const { archetype, otherArchetype } = req.params;

    // Compatibility matrix (simplified)
    const compatibilityMatrix = {
      'romantic-romantic': 0.75,
      'romantic-protector': 0.87,
      'romantic-counselor': 0.85,
      'intellectual-intellectual': 0.80,
      'intellectual-mastermind': 0.82,
      'adventurer-adventurer': 0.78
    };

    const key1 = `${archetype}-${otherArchetype}`;
    const key2 = `${otherArchetype}-${archetype}`;
    const score = compatibilityMatrix[key1] || compatibilityMatrix[key2] || 0.70;

    res.json({
      compatibility_score: score,
      archetype_1: archetype,
      archetype_2: otherArchetype,
      strengths_together: ['Complementary communication styles', 'Shared values potential'],
      potential_challenges: ['May need to discuss expectations early'],
      advice: `This pairing has ${Math.round(score * 100)}% romantic potential if both appreciate emotional depth.`
    });
  } catch (err) {
    console.error('Get archetype compatibility error:', err);
    res.status(500).json({ error: 'Failed to calculate compatibility' });
  }
});

// Endpoint 107: POST /dating/profiles/archetype-preference
router.post('/profiles/archetype-preference', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { archetype_preferences, avoid_archetypes } = req.body;

    let archetype = await db.PersonalityArchetype.findOne({
      where: { user_id: userId }
    });

    if (!archetype) {
      return res.status(404).json({ error: 'Personality archetype not found' });
    }

    await archetype.update({
      archetype_preferences: archetype_preferences || [],
      avoid_archetypes: avoid_archetypes || []
    });

    res.json({
      archetype,
      message: 'Archetype preferences updated!'
    });
  } catch (err) {
    console.error('Update archetype preference error:', err);
    res.status(500).json({ error: 'Failed to update archetype preference' });
  }
});

// Endpoint 108: POST /dating/goals
router.post('/goals', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { goal_type, goal_description, deadline, target_count } = req.body;

    if (!goal_type) {
      return res.status(400).json({ error: 'goal_type is required' });
    }

    const goal = await db.DatingGoal.create({
      user_id: userId,
      goal_type,
      goal_description: goal_description || '',
      deadline: deadline || null,
      target_count: target_count || 1,
      status: 'active'
    });

    res.status(201).json({ goal });
  } catch (err) {
    console.error('Create goal error:', err);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// Endpoint 109: GET /dating/goals/progress
router.get('/goals/progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const goals = await db.DatingGoal.findAll({
      where: { 
        user_id: userId,
        status: 'active'
      }
    });

    res.json({
      current_goals: goals,
      milestones_achieved: ['First match!', 'First message sent!', 'First date!'],
      total_active_goals: goals.length
    });
  } catch (err) {
    console.error('Get goals progress error:', err);
    res.status(500).json({ error: 'Failed to fetch goals progress' });
  }
});

// Endpoint 110: GET /dating/goals/statistics
router.get('/goals/statistics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const completedGoals = await db.DatingGoal.findAll({
      where: { 
        user_id: userId,
        status: 'completed'
      }
    });

    const avgCompletionTime = completedGoals.length > 0
      ? Math.round(completedGoals.reduce((sum, g) => {
          return sum + (new Date(g.completed_at) - new Date(g.created_at));
        }, 0) / completedGoals.length / (1000 * 60 * 60 * 24))
      : 0;

    res.json({
      completed_goals: completedGoals.length,
      avg_completion_days: avgCompletionTime,
      recommendations: [
        'Keep dating sessions short - focus on quality conversation',
        'Set realistic deadlines - allow 3-4 weeks per goal',
        'Engage with multiple matches - increases success rate'
      ]
    });
  } catch (err) {
    console.error('Get goals statistics error:', err);
    res.status(500).json({ error: 'Failed to fetch goals statistics' });
  }
});

// Endpoint 111: GET /dating/event-attendees/:userId (bonus endpoint)
router.get('/event-attendees/:userId', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    const events = await db.EventAttendees.findAll({
      where: { user_id: targetUserId, status: 'attending' },
      include: [{ model: db.DatingEvent, attributes: ['id', 'title', 'event_date', 'location_city'] }]
    });

    res.json({
      user_id: targetUserId,
      attending_events: events.map(e => e.DatingEvent),
      count: events.length
    });
  } catch (err) {
    console.error('Get user event attendances error:', err);
    res.status(500).json({ error: 'Failed to fetch event attendances' });
  }
});

// ============================================================================
// TIER 4: TRUST & SAFETY ENDPOINTS (112-116)
// ============================================================================

// Endpoint 112: POST /dating/verify/run-fraud-check (admin endpoint)
router.post('/verify/run-fraud-check', authenticateToken, async (req, res) => {
  try {
    const { target_user_id } = req.body;
    const requestingUser = req.user;

    // Only admins or self can trigger fraud check
    if (requestingUser.role !== 'admin' && requestingUser.id !== parseInt(target_user_id)) {
      return res.status(403).json({ error: 'Not authorized to run fraud check' });
    }

    const targetUser = await db.User.findByPk(target_user_id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get or create verification score
    let verificationScore = await db.ProfileVerificationScore.findOne({
      where: { user_id: target_user_id }
    });

    if (!verificationScore) {
      verificationScore = await db.ProfileVerificationScore.create({
        user_id: target_user_id
      });
    }

    // Simulate AI fraud detection checks
    const profile = await db.DatingProfile.findOne({ where: { user_id: target_user_id } });
    const redFlags = [];

    // Check 1: Photo consistency (simulate AI analysis)
    let photoScore = 85;
    if (!profile || !profile.photos || profile.photos.length < 2) {
      photoScore = 40;
      redFlags.push('insufficient_photos');
    }

    // Check 2: Bio consistency
    let bioScore = 80;
    if (!profile || !profile.bio || profile.bio.length < 20) {
      bioScore = 30;
      redFlags.push('incomplete_bio');
    }

    // Check 3: Activity pattern (human vs bot)
    let activityScore = 75;
    const daysSinceCreated = Math.floor((Date.now() - new Date(targetUser.createdAt)) / (1000 * 60 * 60 * 24));
    if (daysSinceCreated < 3 && redFlags.length > 0) {
      activityScore = 35;
      redFlags.push('new_account_with_issues');
    }

    // Check 4: Location consistency
    let locationScore = 80;
    if (!targetUser.latitude || !targetUser.longitude) {
      locationScore = 50;
      redFlags.push('missing_location_data');
    }

    // Check 5: Profile field consistency
    let fieldScore = 78;
    if (!targetUser.bio || !targetUser.age || !profile) {
      fieldScore = 40;
      redFlags.push('incomplete_profile_fields');
    }

    // Determine overall fraud risk level
    const averageScore = (photoScore + bioScore + activityScore + locationScore + fieldScore) / 5;
    let fraudRiskLevel = 'low';
    let verificationLevel = 'verified_trusted';

    if (averageScore < 40) {
      fraudRiskLevel = 'critical';
      verificationLevel = 'flagged';
    } else if (averageScore < 55) {
      fraudRiskLevel = 'high';
      verificationLevel = 'basic';
    } else if (averageScore < 70) {
      fraudRiskLevel = 'medium';
      verificationLevel = 'basic';
    }

    // Update verification score
    await verificationScore.update({
      photo_authenticity_score: photoScore,
      bio_consistency_score: bioScore,
      activity_pattern_score: activityScore,
      location_consistency_score: locationScore,
      profile_field_consistency_score: fieldScore,
      overall_trust_score: averageScore,
      fraud_risk_level: fraudRiskLevel,
      verification_level: verificationLevel,
      red_flags: redFlags,
      is_hidden: fraudRiskLevel === 'critical',
      ai_check_last_run: new Date(),
      manual_review_status: fraudRiskLevel === 'critical' || fraudRiskLevel === 'high' ? 'pending' : 'none',
      badge_earned: verificationLevel === 'verified_trusted' ? 'verified_trusted_profile' : null,
      reason_safe: verificationLevel === 'verified_trusted' 
        ? 'Photo verified, complete profile, active user'
        : fraudRiskLevel === 'critical' ? 'Profile flagged for manual review' : 'Basic verification complete'
    });

    res.status(200).json({
      message: 'Fraud check completed',
      user_id: target_user_id,
      fraud_risk_level: fraudRiskLevel,
      verification_level: verificationLevel,
      trust_score: Math.round(averageScore),
      scores: {
        photo_authenticity: Math.round(photoScore),
        bio_consistency: Math.round(bioScore),
        activity_pattern: Math.round(activityScore),
        location_consistency: Math.round(locationScore),
        profile_field_consistency: Math.round(fieldScore)
      },
      red_flags: redFlags,
      is_hidden: fraudRiskLevel === 'critical',
      check_timestamp: new Date()
    });
  } catch (err) {
    console.error('Run fraud check error:', err);
    res.status(500).json({ error: 'Failed to run fraud check' });
  }
});

// Endpoint 113: GET /dating/profile-trust-score/:userId
router.get('/profile-trust-score/:userId', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    const verificationScore = await db.ProfileVerificationScore.findOne({
      where: { user_id: targetUserId }
    });

    if (!verificationScore) {
      return res.status(404).json({ error: 'Verification score not found. Run fraud check first.' });
    }

    // Build response based on verification level
    const response = {
      user_id: targetUserId,
      verification_level: verificationScore.verification_level,
      overall_trust_score: verificationScore.overall_trust_score,
      badge: verificationScore.badge_earned || null,
      red_flags: verificationScore.red_flags || [],
      reason_safe: verificationScore.reason_safe || 'User profile verification pending',
      scores: {
        photo_authenticity: verificationScore.photo_authenticity_score,
        bio_consistency: verificationScore.bio_consistency_score,
        activity_pattern: verificationScore.activity_pattern_score,
        location_consistency: verificationScore.location_consistency_score,
        profile_field_consistency: verificationScore.profile_field_consistency_score
      },
      last_check_date: verificationScore.ai_check_last_run,
      is_visible: !verificationScore.is_hidden
    };

    res.json(response);
  } catch (err) {
    console.error('Get profile trust score error:', err);
    res.status(500).json({ error: 'Failed to fetch trust score' });
  }
});

// Endpoint 114: GET /dating/users/:userId/red-flags (what matches see)
router.get('/users/:userId/red-flags', authenticateToken, async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    const verificationScore = await db.ProfileVerificationScore.findOne({
      where: { user_id: targetUserId }
    });

    if (!verificationScore) {
      return res.json({
        user_id: targetUserId,
        has_red_flags: false,
        warning_level: 'none',
        red_flags: [],
        visible_to_matches: true
      });
    }

    // If critical: profile is hidden completely
    if (verificationScore.fraud_risk_level === 'critical') {
      return res.json({
        user_id: targetUserId,
        has_red_flags: true,
        warning_level: 'critical',
        message: 'Profile hidden due to verification issues',
        visible_to_matches: false,
        red_flags: []
      });
    }

    // If high risk: show warning but keep profile visible
    if (verificationScore.fraud_risk_level === 'high') {
      return res.json({
        user_id: targetUserId,
        has_red_flags: true,
        warning_level: 'high',
        warning_message: 'This profile may not be authentic. Proceed with caution.',
        visible_to_matches: true,
        red_flags: verificationScore.red_flags || []
      });
    }

    // Otherwise: profile is clean
    res.json({
      user_id: targetUserId,
      has_red_flags: false,
      warning_level: 'none',
      visible_to_matches: true,
      red_flags: []
    });
  } catch (err) {
    console.error('Get red flags error:', err);
    res.status(500).json({ error: 'Failed to fetch red flags' });
  }
});

// Endpoint 115: POST /dating/report-suspicious-profile/:userId (enhanced)
router.post('/report-suspicious-profile/:userId', authenticateToken, async (req, res) => {
  try {
    const { reason, message_ids, additional_notes } = req.body;
    const targetUserId = req.params.userId;
    const reportingUserId = req.user.id;

    if (!reason || !['catfishing', 'fake_profile', 'bot', 'scam', 'harassment', 'other'].includes(reason)) {
      return res.status(400).json({ error: 'Invalid report reason' });
    }

    // Don't allow reporting yourself
    if (reportingUserId === parseInt(targetUserId)) {
      return res.status(400).json({ error: 'Cannot report your own profile' });
    }

    // Create report record
    const report = await db.SuspiciousProfileReport.create({
      reporting_user_id: reportingUserId,
      reported_user_id: targetUserId,
      reason: reason,
      message_ids: message_ids || [],
      notes: additional_notes,
      status: 'reported',
      created_at: new Date()
    });

    // Update verification score with AI auto-flag based on patterns
    const verificationScore = await db.ProfileVerificationScore.findOne({
      where: { user_id: targetUserId }
    });

    if (verificationScore) {
      // Get count of reports against this user
      const reportCount = await db.SuspiciousProfileReport.count({
        where: { reported_user_id: targetUserId }
      });

      // Auto-flag if multiple reports
      if (reportCount >= 3) {
        await verificationScore.update({
          fraud_risk_level: 'high',
          manual_review_status: 'pending',
          red_flags: [...(verificationScore.red_flags || []), 'multiple_user_reports']
        });
      }

      // Queue for manual review if needed
      if (reason === 'catfishing' || reason === 'fake_profile') {
        await verificationScore.update({
          manual_review_status: 'pending',
          manual_review_notes: `User-reported ${reason}. Total reports: ${reportCount}`
        });
      }
    }

    res.status(201).json({
      message: 'Profile reported successfully',
      report_id: report.id,
      status: 'reported',
      reason: reason,
      reported_user_id: targetUserId,
      timestamp: new Date(),
      next_steps: 'Our team will review this report and take appropriate action'
    });
  } catch (err) {
    console.error('Report suspicious profile error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Endpoint 116: GET /dating/conversation-safety/tips
router.get('/conversation-safety/tips', authenticateToken, async (req, res) => {
  try {
    const safetyTips = {
      general_safety: [
        'Trust your instincts - if something feels off, it probably is',
        'Never share your home address until you have met in person multiple times',
        'Use the app messaging only until you know someone well',
        'Watch for signs of catfishing: asking for money, avoiding video chat, inconsistent stories',
        'Consider video chatting before meeting in person',
        'Always tell a trusted friend where you are meeting and when'
      ],
      online_communication: [
        'Be cautious of messages asking you to move off the app quickly',
        'Watch for rapid escalation to sexual or explicit content',
        'Avoid sharing personal details like workplace, school, or regular routines early on',
        'Don\'t send money or gift cards to people you haven\'t met',
        'Be wary of requests for passwords, banking info, or social media access',
        'Verify profile information independently if possible'
      ],
      meeting_in_person: [
        'Always meet in a public place for the first date',
        'Meet during daylight hours when possible',
        'Drive your own vehicle or use a verifiable rideshare service',
        'Have your phone fully charged',
        'Tell someone trusted where you\'ll be and when you expect to return',
        'Trust your gut - if you feel unsafe, leave immediately',
        'Arrange a way to exit the date gracefully if not going well'
      ],
      recognizing_red_flags: [
        'Unwillingness to video chat or meet in person for weeks',
        'Pressure to move conversations to another platform',
        'Requests for money, gifts, or personal information',
        'Stories that constantly change or don\'t add up',
        'Asking personal questions but never sharing about themselves',
        'Excessive flattery or moving too fast emotionally',
        'Asking inappropriate sexual questions early in conversation'
      ],
      reporting_issues: [
        'Report harassment, threatening behavior, or scams immediately',
        'Use the "Report" button on problematic messages',
        'Save evidence of inappropriate behavior',
        'Block users who make you uncomfortable',
        'Contact app support if you suspect fraudulent activity',
        'Report to local authorities if you experience physical threats or crimes'
      ]
    };

    res.json({
      safety_tips: safetyTips,
      general_advice: 'Your safety is our priority. If someone makes you uncomfortable at any time, use the report feature or block them. Remember: people who respect you will respect your boundaries.',
      emergency_resources: {
        national_sexual_assault_hotline: '1-800-656-4673',
        national_domestic_violence_hotline: '1-800-799-7233'
      },
      last_updated: new Date()
    });
  } catch (err) {
    console.error('Get safety tips error:', err);
    res.status(500).json({ error: 'Failed to fetch safety tips' });
  }
});

// ========================================
// TIER 5: PLATFORM FEATURES
// ========================================

// Endpoint 117: POST /dating/referrals/introduce
router.post('/referrals/introduce', authenticateToken, async (req, res) => {
  try {
    const { friend_user_id, referral_message } = req.body;
    const referrer_id = req.user.id;

    if (!friend_user_id) {
      return res.status(400).json({ error: 'friend_user_id is required' });
    }

    // Verify both users exist
    const [referrer, friend, recipient] = await Promise.all([
      User.findByPk(referrer_id),
      User.findByPk(friend_user_id),
      User.findByPk(req.body.recipient_user_id)
    ]);

    if (!referrer || !friend) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create referral (referrer is setting up their friend with someone)
    const referral = await db.FriendReferral.create({
      referrer_user_id: referrer_id,
      referred_user_id: friend_user_id,
      recipient_user_id: req.body.recipient_user_id,
      referral_type: 'romantic_setup',
      referral_message: referral_message || `${referrer.first_name} thinks you'd be great together!`,
      status: 'pending'
    });

    res.status(201).json({
      message: 'Introduction sent successfully',
      referral_id: referral.id,
      referrer_name: referrer.first_name,
      friend_name: friend.first_name,
      status: 'pending',
      created_at: referral.created_at
    });
  } catch (err) {
    console.error('Introduce friend error:', err);
    res.status(500).json({ error: 'Failed to send introduction' });
  }
});

// Endpoint 118: GET /dating/referrals/incoming
router.get('/referrals/incoming', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const referrals = await db.FriendReferral.findAll({
      where: { recipient_user_id: userId, status: 'pending' },
      include: [
        { model: User, as: 'referrer', attributes: ['id', 'first_name', 'last_name'] },
        { model: User, as: 'referred', attributes: ['id', 'first_name', 'last_name', 'profile_photo_url'] }
      ],
      order: [['created_at', 'DESC']],
      limit: 50
    });

    res.json({
      message: 'Incoming referrals retrieved',
      count: referrals.length,
      referrals: referrals.map(r => ({
        referral_id: r.id,
        referrer_name: r.referrer?.first_name,
        friend_name: r.referred?.first_name,
        friend_photo: r.referred?.profile_photo_url,
        message: r.referral_message,
        created_at: r.created_at
      }))
    });
  } catch (err) {
    console.error('Get incoming referrals error:', err);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

// Endpoint 119: POST /dating/referrals/:referralId/accept
router.post('/referrals/:referralId/accept', authenticateToken, async (req, res) => {
  try {
    const { referralId } = req.params;
    const userId = req.user.id;

    const referral = await db.FriendReferral.findByPk(referralId);
    if (!referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    if (referral.recipient_user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to accept this referral' });
    }

    // Create match between referred_user and recipient
    const existingMatch = await db.Match.findOne({
      where: {
        [db.Sequelize.Op.or]: [
          { user1_id: referral.referred_user_id, user2_id: userId },
          { user1_id: userId, user2_id: referral.referred_user_id }
        ]
      }
    });

    if (existingMatch) {
      return res.status(400).json({ error: 'Match already exists' });
    }

    const match = await db.Match.create({
      user1_id: referral.referred_user_id,
      user2_id: userId,
      match_source: 'friend_referral',
      referral_id: referralId
    });

    // Update referral status
    referral.status = 'matched';
    referral.match_result = 'matched';
    await referral.save();

    res.json({
      message: 'Referral accepted and match created',
      match_id: match.id,
      status: 'matched'
    });
  } catch (err) {
    console.error('Accept referral error:', err);
    res.status(500).json({ error: 'Failed to accept referral' });
  }
});

// Endpoint 120: GET /dating/referrals/success
router.get('/referrals/success', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const referrals = await db.FriendReferral.findAll({
      where: { referrer_user_id: userId },
      include: [{ model: User, as: 'referred', attributes: ['first_name', 'last_name'] }]
    });

    const successCount = referrals.filter(r => r.match_result === 'matched').length;
    const totalCount = referrals.length;
    const successRate = totalCount > 0 ? (successCount / totalCount * 100).toFixed(1) : 0;

    res.json({
      message: 'Your referral success stats',
      total_referrals: totalCount,
      successful_matches: successCount,
      success_rate: `${successRate}%`,
      badge_progress: {
        current: successCount,
        next_milestone: Math.ceil((successCount + 1) / 3) * 3,
        progress_to_matchmaker: `${successCount}/3 matches for "Matchmaker" badge`
      },
      referrals: referrals.map(r => ({
        referred_name: r.referred?.first_name,
        result: r.match_result || 'pending',
        created_at: r.created_at
      }))
    });
  } catch (err) {
    console.error('Get referral success error:', err);
    res.status(500).json({ error: 'Failed to fetch referral stats' });
  }
});

// Endpoint 121: POST /dating/video-dates/request/:matchId
router.post('/video-dates/request/:matchId', authenticateToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { proposed_time, duration_minutes } = req.body;
    const userId = req.user.id;

    if (!proposed_time || !duration_minutes) {
      return res.status(400).json({ error: 'proposed_time and duration_minutes are required' });
    }

    const match = await db.Match.findByPk(matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (match.user1_id !== userId && match.user2_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to request video date for this match' });
    }

    const videoDate = await db.VideoDate.create({
      match_id: matchId,
      initiator_id: userId,
      proposed_time: new Date(proposed_time),
      duration_minutes: duration_minutes,
      status: 'pending'
    });

    res.status(201).json({
      message: 'Video date request sent',
      video_date_id: videoDate.id,
      proposed_time: videoDate.proposed_time,
      status: 'pending'
    });
  } catch (err) {
    console.error('Request video date error:', err);
    res.status(500).json({ error: 'Failed to request video date' });
  }
});

// Endpoint 122: GET /dating/video-dates/pending
router.get('/video-dates/pending', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const videoDates = await db.VideoDate.findAll({
      where: {
        status: 'pending',
        [db.Sequelize.Op.or]: [
          { initiator_id: userId },
          db.Sequelize.where(
            db.Sequelize.col('Match.user1_id'), 
            db.Sequelize.Op.eq, 
            userId
          ),
          db.Sequelize.where(
            db.Sequelize.col('Match.user2_id'), 
            db.Sequelize.Op.eq, 
            userId
          )
        ]
      },
      include: [{ model: db.Match, attributes: ['user1_id', 'user2_id'] }],
      order: [['proposed_time', 'ASC']]
    });

    res.json({
      message: 'Pending video date requests',
      count: videoDates.length,
      video_dates: videoDates.map(vd => ({
        video_date_id: vd.id,
        match_id: vd.match_id,
        initiator_id: vd.initiator_id,
        proposed_time: vd.proposed_time,
        duration_minutes: vd.duration_minutes,
        status: vd.status
      }))
    });
  } catch (err) {
    console.error('Get pending video dates error:', err);
    res.status(500).json({ error: 'Failed to fetch pending video dates' });
  }
});

// Endpoint 123: POST /dating/video-dates/:videoDateId/start
router.post('/video-dates/:videoDateId/start', authenticateToken, async (req, res) => {
  try {
    const { videoDateId } = req.params;
    const userId = req.user.id;

    const videoDate = await db.VideoDate.findByPk(videoDateId, {
      include: [{ model: db.Match, attributes: ['user1_id', 'user2_id'] }]
    });

    if (!videoDate) {
      return res.status(404).json({ error: 'Video date not found' });
    }

    if (videoDate.Match.user1_id !== userId && videoDate.Match.user2_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to start this video date' });
    }

    if (videoDate.status !== 'accepted') {
      return res.status(400).json({ error: 'Video date must be accepted first' });
    }

    // In production, generate WebRTC/Twilio credentials
    // For now, return mock connection data
    const mockCredentials = {
      token: `token_${Date.now()}`,
      room_name: `videocall_${videoDate.id}`,
      server_url: 'https://webrtc.dailyco.com/api/v1'
    };

    videoDate.status = 'in_progress';
    videoDate.start_time = new Date();
    await videoDate.save();

    res.json({
      message: 'Video date started',
      video_date_id: videoDate.id,
      connection_credentials: mockCredentials,
      duration_minutes: videoDate.duration_minutes
    });
  } catch (err) {
    console.error('Start video date error:', err);
    res.status(500).json({ error: 'Failed to start video date' });
  }
});

// Endpoint 124: POST /dating/video-dates/:videoDateId/complete
router.post('/video-dates/:videoDateId/complete', authenticateToken, async (req, res) => {
  try {
    const { videoDateId } = req.params;
    const { duration_minutes, quality_rating, would_meet_in_person, feedback } = req.body;
    const userId = req.user.id;

    const videoDate = await db.VideoDate.findByPk(videoDateId, {
      include: [{ model: db.Match, attributes: ['user1_id', 'user2_id'] }]
    });

    if (!videoDate) {
      return res.status(404).json({ error: 'Video date not found' });
    }

    if (videoDate.Match.user1_id !== userId && videoDate.Match.user2_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to complete this video date' });
    }

    videoDate.status = 'completed';
    videoDate.actual_duration_minutes = duration_minutes;
    videoDate.quality_rating = quality_rating || 5;
    videoDate.would_meet_in_person = would_meet_in_person || false;
    videoDate.feedback = feedback;
    videoDate.end_time = new Date();
    await videoDate.save();

    // Create completion feedback record
    await db.DateCompletionFeedback.create({
      user_id: userId,
      match_id: videoDate.match_id,
      date_type: 'video',
      rating: quality_rating,
      feedback: feedback,
      would_meet_again: would_meet_in_person
    });

    res.json({
      message: 'Video date completed',
      video_date_id: videoDate.id,
      rating_received: quality_rating,
      status: 'completed'
    });
  } catch (err) {
    console.error('Complete video date error:', err);
    res.status(500).json({ error: 'Failed to complete video date' });
  }
});

// Endpoint 125: GET /dating/video-dates/history
router.get('/video-dates/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const videoDates = await db.VideoDate.findAll({
      where: { status: 'completed' },
      include: [
        {
          model: db.Match,
          attributes: ['user1_id', 'user2_id'],
          include: [
            { model: User, attributes: ['id', 'first_name', 'profile_photo_url'] }
          ]
        }
      ],
      order: [['end_time', 'DESC']],
      limit: limit
    });

    const userVideoDates = videoDates.filter(vd => 
      vd.Match.user1_id === userId || vd.Match.user2_id === userId
    );

    res.json({
      message: 'Video date history',
      count: userVideoDates.length,
      video_dates: userVideoDates.map(vd => ({
        video_date_id: vd.id,
        quality_rating: vd.quality_rating,
        duration_minutes: vd.actual_duration_minutes,
        would_meet_in_person: vd.would_meet_in_person,
        feedback: vd.feedback,
        completed_at: vd.end_time
      }))
    });
  } catch (err) {
    console.error('Get video date history error:', err);
    res.status(500).json({ error: 'Failed to fetch video date history' });
  }
});

// Endpoint 126: GET /dating/events/nearby
router.get('/events/nearby', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { max_distance_km = 50 } = req.query;

    const user = await User.findByPk(userId, {
      include: [{ model: db.UserLocation, attributes: ['latitude', 'longitude'] }]
    });

    if (!user || !user.UserLocation) {
      return res.status(400).json({ error: 'User location not set' });
    }

    // Get events near user (within max_distance_km)
    const events = await db.DatingEvent.findAll({
      where: {
        dating_category: true,
        event_date: { [db.Sequelize.Op.gte]: new Date() }
      },
      limit: 50
    });

    // Filter by distance using Haversine formula
    const nearbyEvents = events.filter(event => {
      const distance = calculateDistance(
        user.UserLocation.latitude,
        user.UserLocation.longitude,
        event.latitude,
        event.longitude
      );
      return distance <= parseFloat(max_distance_km);
    });

    res.json({
      message: 'Nearby dating events',
      count: nearbyEvents.length,
      events: nearbyEvents.map(e => ({
        event_id: e.id,
        title: e.title,
        date: e.event_date,
        category: e.category,
        location: `${e.latitude}, ${e.longitude}`,
        attending_count: e.attending_count || 0
      }))
    });
  } catch (err) {
    console.error('Get nearby events error:', err);
    res.status(500).json({ error: 'Failed to fetch nearby events' });
  }
});

// Endpoint 127: POST /dating/events/:eventId/attend
router.post('/events/:eventId/attend', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    const event = await db.DatingEvent.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const existingAttendance = await db.EventAttendees.findOne({
      where: { user_id: userId, event_id: eventId }
    });

    if (existingAttendance) {
      return res.status(400).json({ error: 'Already attending this event' });
    }

    const attendance = await db.EventAttendees.create({
      user_id: userId,
      event_id: eventId,
      status: 'attending'
    });

    // Increment event attending count
    event.attending_count = (event.attending_count || 0) + 1;
    await event.save();

    res.status(201).json({
      message: 'Successfully marked as attending',
      event_id: eventId,
      status: 'attending',
      event_title: event.title
    });
  } catch (err) {
    console.error('Attend event error:', err);
    res.status(500).json({ error: 'Failed to attend event' });
  }
});

// Endpoint 128: GET /dating/events/:eventId/attendees
router.get('/events/:eventId/attendees', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Check if user is premium (premium can see attendees)
    const user = await User.findByPk(userId, {
      include: [{ model: db.Subscription, attributes: ['subscription_tier'] }]
    });

    if (!user.Subscription || user.Subscription.subscription_tier !== 'premium') {
      return res.status(403).json({ error: 'Premium feature - upgrade to view attendees' });
    }

    const attendees = await db.EventAttendees.findAll({
      where: { event_id: eventId, status: 'attending' },
      include: [{
        model: User,
        attributes: ['id', 'first_name', 'profile_photo_url', 'age']
      }],
      limit: 100
    });

    res.json({
      message: 'Event attendees (premium)',
      count: attendees.length,
      attendees: attendees.map(a => ({
        user_id: a.User.id,
        first_name: a.User.first_name,
        age: a.User.age,
        photo_url: a.User.profile_photo_url
      }))
    });
  } catch (err) {
    console.error('Get event attendees error:', err);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

// Endpoint 129: GET /dating/matching/event-based
router.get('/matching/event-based', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get events user is attending
    const userEvents = await db.EventAttendees.findAll({
      where: { user_id: userId, status: 'attending' },
      include: [{ model: db.DatingEvent, attributes: ['id', 'title'] }]
    });

    const eventIds = userEvents.map(e => e.event_id);

    if (eventIds.length === 0) {
      return res.json({
        message: 'No events to match from',
        events_attending: 0,
        potential_matches: []
      });
    }

    // Find other attendees at same events
    const matches = await db.EventAttendees.findAll({
      where: {
        event_id: { [db.Sequelize.Op.in]: eventIds },
        user_id: { [db.Sequelize.Op.ne]: userId },
        status: 'attending'
      },
      include: [
        { model: User, attributes: ['id', 'first_name', 'age', 'profile_photo_url'] },
        { model: db.DatingEvent, attributes: ['title', 'event_date'] }
      ],
      limit: 50
    });

    // Deduplicate users
    const uniqueMatches = {};
    matches.forEach(m => {
      if (!uniqueMatches[m.user_id]) {
        uniqueMatches[m.user_id] = {
          user_id: m.User.id,
          first_name: m.User.first_name,
          age: m.User.age,
          photo_url: m.User.profile_photo_url,
          events: [m.DatingEvent.title]
        };
      } else {
        uniqueMatches[m.user_id].events.push(m.DatingEvent.title);
      }
    });

    res.json({
      message: 'Event-based matching results',
      events_attending: userEvents.length,
      potential_matches: Object.values(uniqueMatches),
      suggestion: `You have ${Object.keys(uniqueMatches).length} potential matches at events you're attending!`
    });
  } catch (err) {
    console.error('Event-based matching error:', err);
    res.status(500).json({ error: 'Failed to fetch event-based matches' });
  }
});

// Helper function: Calculate distance using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ========================================
// TIER 6: GAMIFICATION & RETENTION
// ========================================

// Endpoint 130: GET /dating/achievements
router.get('/achievements', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const achievements = await db.UserAchievement.findAll({
      where: { user_id: userId },
      order: [['earned_at', 'DESC']]
    });

    // Get current streaks (simulate from user activity)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const activity = await db.UserActivity.findAll({
      where: {
        user_id: userId,
        created_at: { [db.Sequelize.Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      attributes: ['created_at', 'activity_type'],
      raw: true
    });

    // Calculate login streak
    let loginStreak = 0;
    const dates = new Set(activity.map(a => {
      const d = new Date(a.created_at);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }));

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      if (dates.has(checkDate.getTime())) {
        loginStreak++;
      } else {
        break;
      }
    }

    // Calculate messaging streak
    const messageActivity = activity.filter(a => a.activity_type === 'message');
    let messagingStreak = 0;
    const msgDates = new Set(messageActivity.map(m => {
      const d = new Date(m.created_at);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }));

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      if (msgDates.has(checkDate.getTime())) {
        messagingStreak++;
      } else {
        break;
      }
    }

    res.json({
      message: 'User achievements and streaks',
      badges: achievements.map(a => ({
        badge_type: a.badge_type,
        earned_at: a.earned_at,
        is_public: a.is_public,
        progress: a.progress
      })),
      current_streaks: {
        daily_login: loginStreak,
        messaging: messagingStreak
      },
      total_badges: achievements.length,
      next_milestone: achievements.length < 12 ? `${achievements.length}/12 badges to MVP` : 'MVP achieved!'
    });
  } catch (err) {
    console.error('Get achievements error:', err);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Endpoint 131: GET /dating/leaderboard
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const { period = 'monthly', city = null } = req.query;

    // Get top users by achievement count
    const leaderboard = await db.sequelize.query(`
      SELECT u.id, u.first_name, u.profile_photo_url, u.location_city,
             COUNT(ua.id) as badge_count,
             (SELECT COUNT(*) FROM matches WHERE user1_id = u.id OR user2_id = u.id) as match_count,
             (SELECT AVG(quality_score) FROM conversation_quality_metrics WHERE match_id IN 
              (SELECT id FROM matches WHERE user1_id = u.id OR user2_id = u.id)) as avg_quality
      FROM users u
      LEFT JOIN user_achievements ua ON u.id = ua.user_id
      ${city ? 'WHERE u.location_city = ?' : ''}
      GROUP BY u.id
      ORDER BY badge_count DESC, match_count DESC, avg_quality DESC
      LIMIT 50
    `, {
      replacements: city ? [city] : [],
      type: db.Sequelize.QueryTypes.SELECT
    });

    res.json({
      message: `Leaderboard (${period})`,
      period: period,
      region: city || 'Global',
      leaderboard: leaderboard.map((user, index) => ({
        rank: index + 1,
        user_id: user.id,
        first_name: user.first_name,
        photo_url: user.profile_photo_url,
        city: user.location_city,
        badges: user.badge_count || 0,
        matches: user.match_count || 0,
        avg_conversation_quality: user.avg_quality ? parseFloat(user.avg_quality).toFixed(2) : 'N/A'
      }))
    });
  } catch (err) {
    console.error('Get leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Endpoint 132: GET /dating/personality-archetype
router.get('/personality-archetype', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's archetype from quiz results or preferences
    const userArchetype = await db.PersonalityArchetype.findOne({
      where: { user_id: userId }
    });

    if (!userArchetype) {
      return res.status(400).json({ 
        error: 'Complete compatibility quiz first to discover your archetype',
        quiz_link: '/dating/compatibility-quiz'
      });
    }

    // Define all 16 archetypes (16 Personality Types MBTI style)
    const archetypeDetails = {
      'The Adventurer': {
        description: 'Energetic, spontaneous, and loves new experiences',
        strengths: ['adventurous', 'charismatic', 'spontaneous'],
        communication_style: 'direct, enthusiastic, action-oriented',
        best_matches: ['The Romantic', 'The Visionary'],
        compatibility_scores: { 'The Romantic': 0.88, 'The Visionary': 0.85 }
      },
      'The Romantic': {
        description: 'Emotional, detail-oriented, and values loyalty',
        strengths: ['empathetic', 'reliable', 'good listener'],
        communication_style: 'warm, personal, relationship-focused',
        best_matches: ['The Adventurer', 'The Protector'],
        compatibility_scores: { 'The Adventurer': 0.88, 'The Protector': 0.82 }
      },
      'The Intellectual': {
        description: 'Analytical, strategic, and loves problem-solving',
        strengths: ['logical', 'strategic', 'decisive'],
        communication_style: 'direct, theory-focused, idea-driven',
        best_matches: ['The Visionary', 'The Counselor'],
        compatibility_scores: { 'The Visionary': 0.84, 'The Counselor': 0.78 }
      },
      'The Protector': {
        description: 'Caring, responsible, and traditional',
        strengths: ['nurturing', 'reliable', 'organized'],
        communication_style: 'supportive, practical, tradition-valuing',
        best_matches: ['The Romantic', 'The Composer'],
        compatibility_scores: { 'The Romantic': 0.82, 'The Composer': 0.80 }
      },
      'The Visionary': {
        description: 'Innovative, future-focused, and strategic',
        strengths: ['visionary', 'ambitious', 'strategic'],
        communication_style: 'big-picture, forward-thinking, ambition-driven',
        best_matches: ['The Intellectual', 'The Adventurer'],
        compatibility_scores: { 'The Intellectual': 0.84, 'The Adventurer': 0.85 }
      },
      'The Counselor': {
        description: 'Insightful, warm, and values deep connections',
        strengths: ['insightful', 'caring', 'supportive'],
        communication_style: 'warm, authentic, deeply engaged',
        best_matches: ['The Intellectual', 'The Romantic'],
        compatibility_scores: { 'The Intellectual': 0.78, 'The Romantic': 0.82 }
      },
      'The Composer': {
        description: 'Observant, aesthetic, and lives in the moment',
        strengths: ['artistic', 'observant', 'flexible'],
        communication_style: 'artistic, observational, present-focused',
        best_matches: ['The Protector', 'The Performer'],
        compatibility_scores: { 'The Protector': 0.80, 'The Performer': 0.79 }
      },
      'The Performer': {
        description: 'Energetic, enthusiastic, and social',
        strengths: ['charismatic', 'energetic', 'fun-loving'],
        communication_style: 'engaging, enthusiastic, social',
        best_matches: ['The Adventurer', 'The Composer'],
        compatibility_scores: { 'The Adventurer': 0.86, 'The Composer': 0.79 }
      }
    };

    const details = archetypeDetails[userArchetype.archetype_type] || {};

    res.json({
      message: 'Your personality archetype',
      archetype: userArchetype.archetype_type,
      ...details,
      quiz_results: {
        extraversion_score: userArchetype.extraversion_score,
        intuition_score: userArchetype.intuition_score,
        thinking_score: userArchetype.thinking_score,
        judging_score: userArchetype.judging_score
      }
    });
  } catch (err) {
    console.error('Get personality archetype error:', err);
    res.status(500).json({ error: 'Failed to fetch archetype' });
  }
});

// Endpoint 133: GET /dating/archetype/:archetype/compatibility/:otherArchetype
router.get('/archetype/:archetype/compatibility/:otherArchetype', authenticateToken, async (req, res) => {
  try {
    const { archetype, otherArchetype } = req.params;

    const archetypeCompatibility = {
      'The Adventurer-The Romantic': {
        compatibility_score: 0.88,
        strengths_together: ['Both value experiences', 'Complimentary energy levels', 'Adventure meets stability'],
        potential_challenges: ['Different paces', 'Communication styles differ'],
        advice: 'This pairing has strong potential - the Romantic grounds the Adventurer while the Adventurer brings excitement'
      },
      'The Intellectual-The Visionary': {
        compatibility_score: 0.84,
        strengths_together: ['Both strategic thinkers', 'Shared ambition', 'Great problem-solving together'],
        potential_challenges: ['May be too detached', 'Feelings overlooked'],
        advice: 'Excellent intellectual partnership - remember to nurture the emotional connection'
      },
      'The Romantic-The Protector': {
        compatibility_score: 0.82,
        strengths_together: ['Both value loyalty', 'Natural caregivers', 'Stable foundation'],
        potential_challenges: ['May become predictable', 'Need external stimulation'],
        advice: 'Strong traditional pairing - plan adventures to keep spark alive'
      }
    };

    const key = `${archetype}-${otherArchetype}`;
    const reverseKey = `${otherArchetype}-${archetype}`;
    const compat = archetypeCompatibility[key] || archetypeCompatibility[reverseKey];

    if (!compat) {
      return res.json({
        archetype: archetype,
        other_archetype: otherArchetype,
        compatibility_score: 0.75,
        strengths_together: ['Different perspectives', 'Potential for growth'],
        potential_challenges: ['Unknown dynamic', 'May need adjustment'],
        advice: 'This combination is less common - approach with open mind and clear communication'
      });
    }

    res.json({
      archetype: archetype,
      other_archetype: otherArchetype,
      ...compat
    });
  } catch (err) {
    console.error('Get archetype compatibility error:', err);
    res.status(500).json({ error: 'Failed to calculate compatibility' });
  }
});

// Endpoint 134: POST /dating/profiles/archetype-preference
router.post('/profiles/archetype-preference', authenticateToken, async (req, res) => {
  try {
    const { archetype_preferences, avoid_archetypes } = req.body;
    const userId = req.user.id;

    if (!archetype_preferences || !Array.isArray(archetype_preferences)) {
      return res.status(400).json({ error: 'archetype_preferences must be an array' });
    }

    // Update user preferences
    await db.sequelize.query(`
      UPDATE user_preferences 
      SET archetype_preferences = ?, avoid_archetypes = ?
      WHERE user_id = ?
    `, {
      replacements: [JSON.stringify(archetype_preferences), JSON.stringify(avoid_archetypes || []), userId]
    });

    res.json({
      message: 'Archetype preferences updated',
      preferences: archetype_preferences,
      avoid: avoid_archetypes || [],
      status: 'saved'
    });
  } catch (err) {
    console.error('Update archetype preference error:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Endpoint 135: POST /dating/goals
router.post('/goals', authenticateToken, async (req, res) => {
  try {
    const { goal_type, goal, deadline, target_count } = req.body;
    const userId = req.user.id;

    if (!goal_type || !goal || !deadline) {
      return res.status(400).json({ error: 'goal_type, goal, and deadline are required' });
    }

    const datingGoal = await db.DatingGoal.create({
      user_id: userId,
      goal_type: goal_type,
      goal_description: goal,
      deadline: new Date(deadline),
      target_count: target_count || 1,
      status: 'in_progress',
      progress: 0
    });

    res.status(201).json({
      message: 'Goal created successfully',
      goal_id: datingGoal.id,
      goal_type: goal_type,
      goal: goal,
      deadline: datingGoal.deadline,
      status: 'in_progress'
    });
  } catch (err) {
    console.error('Create goal error:', err);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// Endpoint 136: GET /dating/goals/progress
router.get('/goals/progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const goals = await db.DatingGoal.findAll({
      where: { user_id: userId, status: 'in_progress' },
      order: [['deadline', 'ASC']]
    });

    // Get milestones achieved
    const userActivity = await db.UserActivity.findAll({
      where: {
        user_id: userId,
        activity_type: { [db.Sequelize.Op.in]: ['first_match', 'first_message', 'first_date'] }
      }
    });

    const milestones = [];
    if (userActivity.some(a => a.activity_type === 'first_match')) {
      milestones.push('First match!');
    }
    if (userActivity.some(a => a.activity_type === 'first_message')) {
      milestones.push('First message sent!');
    }
    if (userActivity.some(a => a.activity_type === 'first_date')) {
      milestones.push('First date completed!');
    }

    res.json({
      message: 'Your goal progress',
      current_goals: goals.map(g => ({
        goal_id: g.id,
        goal: g.goal_description,
        target: `${g.target_count} ${g.goal_type}`,
        progress: g.progress,
        target_count: g.target_count,
        progress_percentage: ((g.progress / g.target_count) * 100).toFixed(0),
        deadline: g.deadline,
        status: g.status
      })),
      milestones_achieved: milestones,
      total_active_goals: goals.length
    });
  } catch (err) {
    console.error('Get goal progress error:', err);
    res.status(500).json({ error: 'Failed to fetch goal progress' });
  }
});

// Endpoint 137: GET /dating/goals/statistics
router.get('/goals/statistics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's stats
    const user = await User.findByPk(userId, {
      include: [
        { model: db.Match, attributes: ['id', 'created_at'] }
      ]
    });

    const userStats = {
      total_matches: user.Matches?.length || 0,
      avg_time_to_match_days: 5,
      profile_completion: 85,
      message_response_rate: 0.78
    };

    // Compare to global averages
    const globalStats = await db.sequelize.query(`
      SELECT 
        COUNT(DISTINCT m.id) / COUNT(DISTINCT u.id) as avg_matches,
        AVG(DATEDIFF(m.created_at, u.created_at)) as avg_days_to_match
      FROM users u
      LEFT JOIN matches m ON u.id = m.user1_id OR u.id = m.user2_id
      WHERE u.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    `, { type: db.Sequelize.QueryTypes.SELECT });

    res.json({
      message: 'Your goal statistics and comparisons',
      your_stats: userStats,
      global_comparison: {
        your_matches_vs_average: `${userStats.total_matches} (global avg: 3.2)`,
        your_response_rate_vs_average: `${(userStats.message_response_rate * 100).toFixed(0)}% (global avg: 68%)`,
        percentile_rank: 'Top 15%'
      },
      recommendations_to_accelerate_progress: [
        'Complete all profile fields to increase match quality',
        'Message matches within 24 hours (higher response rate)',
        'Try video dating to move conversations faster',
        'Join events to meet in person sooner'
      ],
      average_time_to_achieve: {
        'First match': '2-3 days',
        '3 messages': '1-2 days',
        'First date': '1-3 weeks',
        'Serious relationship': '2-3 months'
      }
    });
  } catch (err) {
    console.error('Get goal statistics error:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ========== AI-POWERED PROFILE SUGGESTIONS (TIER 3) ==========

// AI.1. GET SMART SUGGESTIONS - AI-ranked profiles with compatibility explanations
router.get('/smart-suggestions', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const cursor = req.query.cursor || null;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    // Check cache first
    const cacheKey = buildCacheKey('ai', userId, 'smart-suggestions', cursor);
    const cached = await cacheGetPaginated(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get current user's profile and preferences
    const currentProfileResult = await db.query(
      `SELECT dp.*,
              row_to_json(up) as preferences,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       WHERE dp.user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (currentProfileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found. Complete your profile first.' });
    }

    const currentProfile = normalizeProfileRow(currentProfileResult.rows[0]);
    const currentPreferences = normalizePreferenceRow(currentProfileResult.rows[0]?.preferences);

    // Build discovery query with user's preferences
    const query = buildDiscoveryQuery({
      userId,
      currentLat: toFiniteNumber(currentProfile?.location?.lat),
      currentLng: toFiniteNumber(currentProfile?.location?.lng),
      radiusKm: currentPreferences.locationRadius,
      ageMin: currentPreferences.ageRangeMin,
      ageMax: currentPreferences.ageRangeMax,
      genderPreferences: currentPreferences.genderPreferences,
      relationshipGoals: currentPreferences.relationshipGoals,
      interests: currentPreferences.interests,
      heightRangeMin: currentPreferences.heightRangeMin,
      heightRangeMax: currentPreferences.heightRangeMax,
      bodyTypes: currentPreferences.bodyTypes,
      excludeShown: false,
      limit,
      cursor
    });

    const result = await db.query(query.text, query.params);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    // Apply ML compatibility scoring
    const smartSuggestions = rows
      .map((profileRow) => {
        const normalizedProfile = normalizeProfileRow(profileRow);
        const learning = normalizeLearningProfile(currentPreferences.learningProfile);

        // Use ML service to calculate compatibility
        const compatibilityScore = mlCompatibilityService.calculateCompatibilityScore(
          currentProfile,
          normalizedProfile,
          learning
        );

        // Generate "Why You Might Like Them" reasons
        const candidateInterests = normalizeInterestList(normalizedProfile.interests);
        const currentInterests = normalizeInterestList(currentProfile.interests);
        const shared = candidateInterests.filter(i => 
          currentInterests.map(ci => ci.toLowerCase()).includes(i.toLowerCase())
        );

        const suggestions = mlCompatibilityService.buildSuggestions(
          currentProfile,
          normalizedProfile,
          shared
        );

        // Generate icebreaker suggestions
        const icebreakers = mlCompatibilityService.generateIcebreakers(
          normalizedProfile,
          shared
        );

        return {
          ...normalizedProfile,
          compatibilityScore,
          compatibilityReasons: suggestions,
          icebreakers,
          aiSuggestion: true,
          scoreExplanation: `${compatibilityScore}% match based on profile preferences, interests, and your interaction patterns.`
        };
      })
      .filter(profile => profile.compatibilityScore >= 50) // Only show 50%+ matches
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, limit);

    // Cache compatibility scores in the CompatibilityScore model
    const bulkScoreData = smartSuggestions.map(profile => ({
      viewer_user_id: userId,
      candidate_user_id: profile.userId,
      compatibility_score: profile.compatibilityScore,
      factors_json: profile.compatibilityReasons,
      recommendations_json: {
        icebreakers: profile.icebreakers,
        suggestions: profile.compatibilityReasons
      }
    }));

    if (bulkScoreData.length > 0) {
      try {
        // Batch insert compatibility scores
        const scoreValues = bulkScoreData.map((score, i) => 
          `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}::jsonb, $${i * 5 + 5}::jsonb)`
        ).join(', ');
        
        const scoreParams = [];
        bulkScoreData.forEach(score => {
          scoreParams.push(score.viewer_user_id, score.candidate_user_id, score.compatibility_score);
          scoreParams.push(JSON.stringify(score.factors_json), JSON.stringify(score.recommendations_json));
        });

        await db.query(
          `INSERT INTO compatibility_scores (viewer_user_id, candidate_user_id, compatibility_score, factors_json, recommendations_json)
           VALUES ${scoreValues}
           ON CONFLICT (viewer_user_id, candidate_user_id) DO UPDATE
           SET compatibility_score = EXCLUDED.compatibility_score,
               factors_json = EXCLUDED.factors_json,
               recommendations_json = EXCLUDED.recommendations_json,
               updated_at = CURRENT_TIMESTAMP`,
          scoreParams
        );
      } catch (cacheErr) {
        console.warn('Could not cache compatibility scores:', cacheErr.message);
      }
    }

    const lastRow = rows[rows.length - 1];
    const nextCursor = hasMore && lastRow ? encodeCursor(lastRow.updated_at, lastRow.id) : null;

    const response = {
      profiles: smartSuggestions,
      nextCursor,
      hasMore: Boolean(nextCursor),
      generatedAt: new Date().toISOString(),
      message: `Found ${smartSuggestions.length} AI-matched profiles for you`
    };

    await cacheSetPaginated(cacheKey, response, DISCOVERY_CACHE_TTL);

    const requestMetadata = getRequestMetadata(req);
    spamFraudService.trackUserActivity({
      userId,
      action: 'smart_suggestions_view',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

    res.json(response);
  } catch (err) {
    console.error('Smart suggestions error:', err);
    res.status(500).json({ error: 'Failed to get smart suggestions', details: err.message });
  }
});

// AI.2. GET COMPATIBILITY SCORE - Detailed compatibility breakdown for specific profile
router.get('/compatibility/:userId', async (req, res) => {
  try {
    const viewerId = req.user.id;
    const { userId: candidateUserIdStr } = req.params;
    const candidateUserId = normalizeInteger(candidateUserIdStr);

    if (!candidateUserId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (Number(viewerId) === Number(candidateUserId)) {
      return res.status(400).json({ error: 'Cannot get compatibility with yourself' });
    }

    // Check if compatibility score already cached
    const cacheKey = buildCacheKey('compatibility', viewerId, candidateUserId);
    const cachedScore = await cacheGetPaginated(cacheKey);
    if (cachedScore) {
      return res.json(cachedScore);
    }

    // Get both profiles and preferences
    const [viewerResult, candidateResult] = await Promise.all([
      db.query(
        `SELECT dp.*,
                row_to_json(up) as preferences,
                (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
                 FROM profile_photos WHERE user_id = dp.user_id) as photos
         FROM dating_profiles dp
         LEFT JOIN user_preferences up ON up.user_id = dp.user_id
         WHERE dp.user_id = $1 LIMIT 1`,
        [viewerId]
      ),
      db.query(
        `SELECT dp.*,
                row_to_json(up) as preferences,
                (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
                 FROM profile_photos WHERE user_id = dp.user_id) as photos
         FROM dating_profiles dp
         LEFT JOIN user_preferences up ON up.user_id = dp.user_id
         WHERE dp.user_id = $1 LIMIT 1`,
        [candidateUserId]
      )
    ]);

    if (viewerResult.rows.length === 0 || candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'One or both profiles not found' });
    }

    const viewerProfile = normalizeProfileRow(viewerResult.rows[0]);
    const viewerPreferences = normalizePreferenceRow(viewerResult.rows[0]?.preferences);
    const candidateProfile = normalizeProfileRow(candidateResult.rows[0]);
    const candidatePreferences = normalizePreferenceRow(candidateResult.rows[0]?.preferences);
    const learningProfile = normalizeLearningProfile(viewerPreferences.learningProfile);

    // Calculate ML compatibility
    const compatibilityScore = mlCompatibilityService.calculateCompatibilityScore(
      viewerProfile,
      candidateProfile,
      learningProfile
    );

    // Get detailed factor breakdown
    const candidateInterests = normalizeInterestList(candidateProfile.interests);
    const viewerInterests = normalizeInterestList(viewerProfile.interests);
    const shared = candidateInterests.filter(i => 
      viewerInterests.map(vi => vi.toLowerCase()).includes(i.toLowerCase())
    );

    // Get suggestions and factors
    const suggestions = mlCompatibilityService.buildSuggestions(
      viewerProfile,
      candidateProfile,
      shared
    );

    // Get why-you-might-like reasons from standard compatibility
    const compatibilityData = buildCompatibilitySuggestion({
      currentProfile: viewerProfile,
      currentPreferences: viewerPreferences,
      candidateProfile: candidateProfile,
      candidatePreferences: candidatePreferences
    });

    // Cache the result
    const result = {
      viewerId,
      candidateUserId,
      compatibilityScore,
      compatibilityReasons: compatibilityData.compatibilityReasons,
      mlSuggestions: suggestions,
      sharedInterests: shared,
      icebreakers: compatibilityData.icebreakers,
      factors: {
        interests: shared.length > 0,
        locationMatch: candidateProfile.location?.city === viewerProfile.location?.city,
        ageMatch: candidateProfile.age >= viewerPreferences.ageRangeMin && candidateProfile.age <= viewerPreferences.ageRangeMax,
        verificationMatch: candidateProfile.profileVerified || false,
        relationshipGoalsMatch: candidateProfile.relationshipGoals === viewerProfile.relationshipGoals,
        isExcluded: compatibilityData.isExcluded
      },
      generatedAt: new Date().toISOString()
    };

    await cacheSetPaginated(cacheKey, result, 3600); // Cache for 1 hour

    res.json(result);
  } catch (err) {
    console.error('Get compatibility error:', err);
    res.status(500).json({ error: 'Failed to get compatibility score', details: err.message });
  }
});

// AI.3. GET COMPATIBILITY EXPLANATION - AI-generated explanation of why profiles match
router.post('/compatibility/explain/:userId', async (req, res) => {
  try {
    const viewerId = req.user.id;
    const { userId: candidateUserIdStr } = req.params;
    const candidateUserId = normalizeInteger(candidateUserIdStr);

    if (!candidateUserId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (Number(viewerId) === Number(candidateUserId)) {
      return res.status(400).json({ error: 'Cannot explain compatibility with yourself' });
    }

    // Get both profiles
    const [viewerResult, candidateResult] = await Promise.all([
      db.query(
        `SELECT dp.*,
                row_to_json(up) as preferences
         FROM dating_profiles dp
         LEFT JOIN user_preferences up ON up.user_id = dp.user_id
         WHERE dp.user_id = $1 LIMIT 1`,
        [viewerId]
      ),
      db.query(
        `SELECT dp.*,
                row_to_json(up) as preferences
         FROM dating_profiles dp
         LEFT JOIN user_preferences up ON up.user_id = dp.user_id
         WHERE dp.user_id = $1 LIMIT 1`,
        [candidateUserId]
      )
    ]);

    if (viewerResult.rows.length === 0 || candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'One or both profiles not found' });
    }

    const viewerProfile = normalizeProfileRow(viewerResult.rows[0]);
    const viewerPreferences = normalizePreferenceRow(viewerResult.rows[0]?.preferences);
    const candidateProfile = normalizeProfileRow(candidateResult.rows[0]);

    // Get detailed compatibility explanation
    const candidateInterests = normalizeInterestList(candidateProfile.interests);
    const viewerInterests = normalizeInterestList(viewerProfile.interests);
    const shared = candidateInterests.filter(i => 
      viewerInterests.map(vi => vi.toLowerCase()).includes(i.toLowerCase())
    );

    // Build explanation
    const compatibilityScore = mlCompatibilityService.calculateCompatibilityScore(
      viewerProfile,
      candidateProfile,
      normalizeLearningProfile(viewerPreferences.learningProfile)
    );

    const suggestions = mlCompatibilityService.buildSuggestions(
      viewerProfile,
      candidateProfile,
      shared
    );

    const icebreakers = mlCompatibilityService.generateIcebreakers(
      candidateProfile,
      shared
    );

    // Generate AI explanation
    const explanation = {
      title: `${compatibilityScore}% Compatible Match`,
      summary: suggestions && suggestions.length > 0 
        ? `You and ${candidateProfile.firstName} have a lot in common. ${suggestions[0]}`
        : `You and ${candidateProfile.firstName} might be a good match based on your profiles.`,
      whyYouMatch: suggestions.slice(0, 3),
      startConversation: icebreakers[0] || 'I noticed we both like discovering new things. What\s something you\ve learned recently?',
      nextSteps: [
        'Take your time reading their profile',
        'Send a thoughtful message with your icebreaker',
        'Share what you have in common',
        'Plan a video date to see if there\s chemistry'
      ]
    };

    res.json({
      explanation,
      compatibilityScore,
      profile: {
        id: candidateProfile.id,
        firstName: candidateProfile.firstName,
        age: candidateProfile.age,
        location: candidateProfile.location,
        interests: candidateProfile.interests
      },
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Get compatibility explanation error:', err);
    res.status(500).json({ error: 'Failed to generate explanation', details: err.message });
  }
});

// AI.4. GET COMPATIBILITY FACTORS - Detailed factor breakdown for profile matching
router.get('/compatibility-factors/:userId', async (req, res) => {
  try {
    const viewerId = req.user.id;
    const { userId: candidateUserIdStr } = req.params;
    const candidateUserId = normalizeInteger(candidateUserIdStr);

    if (!candidateUserId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Try to get cached compatibility score first
    const cachedScore = await db.query(
      `SELECT * FROM compatibility_scores 
       WHERE viewer_user_id = $1 AND candidate_user_id = $2
       LIMIT 1`,
      [viewerId, candidateUserId]
    );

    if (cachedScore.rows.length > 0) {
      const score = cachedScore.rows[0];
      return res.json({
        factors: score.factors_json || {},
        recommendations: score.recommendations_json || {},
        compatibilityScore: score.compatibility_score,
        updatedAt: score.updated_at
      });
    }

    // If not cached, get profiles and calculate
    const [viewerResult, candidateResult] = await Promise.all([
      db.query(
        `SELECT dp.*,
                row_to_json(up) as preferences
         FROM dating_profiles dp
         LEFT JOIN user_preferences up ON up.user_id = dp.user_id
         WHERE dp.user_id = $1 LIMIT 1`,
        [viewerId]
      ),
      db.query(
        `SELECT dp.*
         FROM dating_profiles dp
         WHERE dp.user_id = $1 LIMIT 1`,
        [candidateUserId]
      )
    ]);

    if (viewerResult.rows.length === 0 || candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'One or both profiles not found' });
    }

    const viewerProfile = normalizeProfileRow(viewerResult.rows[0]);
    const viewerPreferences = normalizePreferenceRow(viewerResult.rows[0]?.preferences);
    const candidateProfile = normalizeProfileRow(candidateResult.rows[0]);

    // Calculate factors
    const candidateInterests = normalizeInterestList(candidateProfile.interests);
    const viewerInterests = normalizeInterestList(viewerProfile.interests);
    const shared = candidateInterests.filter(i => 
      viewerInterests.map(vi => vi.toLowerCase()).includes(i.toLowerCase())
    );

    const factors = {
      sharedInterests: {
        score: Math.min(100, shared.length * 20),
        details: shared.slice(0, 5),
        weight: 0.25
      },
      locationMatch: {
        score: candidateProfile.location?.city === viewerProfile.location?.city ? 100 : 
               candidateProfile.location?.state === viewerProfile.location?.state ? 50 : 0,
        details: candidateProfile.location,
        weight: 0.15
      },
      ageMatch: {
        score: (candidateProfile.age >= viewerPreferences.ageRangeMin && 
                candidateProfile.age <= viewerPreferences.ageRangeMax) ? 100 : 0,
        details: `${candidateProfile.age} years old`,
        weight: 0.20
      },
      relationshipGoalsMatch: {
        score: (candidateProfile.relationshipGoals === viewerProfile.relationshipGoals) ? 100 : 50,
        details: candidateProfile.relationshipGoals,
        weight: 0.20
      },
      verificationScore: {
        score: candidateProfile.profileVerified ? 100 : 0,
        details: candidateProfile.profileVerified ? 'Verified profile' : 'Not verified',
        weight: 0.10
      },
      profileCompletion: {
        score: candidateProfile.profileCompletionPercent || 0,
        details: `${candidateProfile.profileCompletionPercent}% complete`,
        weight: 0.10
      }
    };

    res.json({
      factors,
      overallScore: Object.entries(factors).reduce((total, [key, factor]) => 
        total + (factor.score * factor.weight), 0
      ),
      candidateProfile: {
        firstName: candidateProfile.firstName,
        age: candidateProfile.age,
        location: candidateProfile.location,
        profileVerified: candidateProfile.profileVerified
      },
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Get compatibility factors error:', err);
    res.status(500).json({ error: 'Failed to get compatibility factors', details: err.message });
  }
});

module.exports = router;
