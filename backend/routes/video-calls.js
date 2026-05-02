const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const userNotificationService = require('../services/userNotificationService');
const spamFraudService = require('../services/spamFraudService');

const router = express.Router();

const DEFAULT_REMINDER_MINUTES = 15;
const MAX_NOTE_LENGTH = 800;
const MAX_TITLE_LENGTH = 120;
const MAX_HISTORY_LIMIT = 25;
const CALL_QUALITY_PRESETS = new Set(['audio', 'balanced', 'hd']);
const BACKGROUND_PRESETS = new Set(['none', 'soft-focus', 'rose-studio', 'midnight-lounge']);
const SESSION_TYPES = new Set(['instant', 'scheduled']);
const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'declined', 'missed']);

const parseInteger = (value, fallback = null) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const normalizeOptionalText = (value, maxLength = null) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim();
  if (!normalizedValue) {
    return null;
  }

  return maxLength ? normalizedValue.slice(0, maxLength) : normalizedValue;
};

const normalizeReminderMinutes = (value) => {
  const parsedValue = parseInteger(value, DEFAULT_REMINDER_MINUTES);
  return Math.min(Math.max(parsedValue, 5), 24 * 60);
};

const normalizeBoolean = (value, fallbackValue = false) => {
  if (value === undefined || value === null) {
    return fallbackValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return Boolean(value);
};

const normalizeQualityPreset = (value) =>
  CALL_QUALITY_PRESETS.has(String(value || '').trim()) ? String(value).trim() : 'balanced';

const normalizeBackgroundPreset = (value) =>
  BACKGROUND_PRESETS.has(String(value || '').trim()) ? String(value).trim() : 'none';

const normalizeSessionType = (value) =>
  SESSION_TYPES.has(String(value || '').trim()) ? String(value).trim() : 'instant';

const normalizeDateInput = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeSettingsSnapshot = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
};

const getRequestMetadata = (req) => ({
  ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null,
  userAgent: req.headers['user-agent'] || null
});

const buildVideoCallSelect = (conditionSql = '1=1') => `
  SELECT
    vd.*,
    CASE
      WHEN vd.user_id_1 = $1 THEN vd.user_id_2
      ELSE vd.user_id_1
    END AS other_user_id,
    COALESCE(dp.first_name, dp.username, u.email, 'Your match') AS other_user_name,
    dp.username AS other_username,
    (
      SELECT photo_url
      FROM profile_photos
      WHERE user_id = CASE WHEN vd.user_id_1 = $1 THEN vd.user_id_2 ELSE vd.user_id_1 END
      ORDER BY is_primary DESC, position ASC, id ASC
      LIMIT 1
    ) AS other_user_photo
  FROM video_dates vd
  LEFT JOIN users u
    ON u.id = CASE WHEN vd.user_id_1 = $1 THEN vd.user_id_2 ELSE vd.user_id_1 END
  LEFT JOIN dating_profiles dp
    ON dp.user_id = u.id
  WHERE ${conditionSql}
`;

const loadMatchForUser = async (userId, matchId) => {
  const result = await db.query(
    `SELECT
       m.*,
       CASE
         WHEN m.user_id_1 = $1 THEN m.user_id_2
         ELSE m.user_id_1
       END AS other_user_id,
       COALESCE(dp.first_name, dp.username, u.email, 'Your match') AS other_user_name,
       dp.username AS other_username,
       (
         SELECT photo_url
         FROM profile_photos
         WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END
         ORDER BY is_primary DESC, position ASC, id ASC
         LIMIT 1
       ) AS other_user_photo
     FROM matches m
     LEFT JOIN users u
       ON u.id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END
     LEFT JOIN dating_profiles dp
       ON dp.user_id = u.id
     WHERE m.id = $2
       AND (m.user_id_1 = $1 OR m.user_id_2 = $1)
       AND m.status = 'active'
     LIMIT 1`,
    [userId, matchId]
  );

  return result.rows[0] || null;
};

const loadDisplayNameForUser = async (userId) => {
  const result = await db.query(
    `SELECT COALESCE(dp.first_name, dp.username, u.email, 'Someone') AS display_name
     FROM users u
     LEFT JOIN dating_profiles dp ON dp.user_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [userId]
  );

  return result.rows[0]?.display_name || 'Someone';
};

const getUserSlot = (videoDateRow, userId) =>
  Number(videoDateRow?.user_id_1) === Number(userId) ? 1 : 2;

const buildTimeline = (row, currentUserId) => {
  const userSlot = getUserSlot(row, currentUserId);
  const currentReminderSentAt =
    userSlot === 1 ? row.reminder_sent_user_1_at : row.reminder_sent_user_2_at;
  const otherReminderSentAt =
    userSlot === 1 ? row.reminder_sent_user_2_at : row.reminder_sent_user_1_at;
  const currentUserJoinedAt = userSlot === 1 ? row.user_1_joined_at : row.user_2_joined_at;
  const otherUserJoinedAt = userSlot === 1 ? row.user_2_joined_at : row.user_1_joined_at;
  const currentUserLeftAt = userSlot === 1 ? row.user_1_left_at : row.user_2_left_at;
  const otherUserLeftAt = userSlot === 1 ? row.user_2_left_at : row.user_1_left_at;

  return [
    row.created_at ? { type: 'created', at: row.created_at, label: 'Session created' } : null,
    row.scheduled_at ? { type: 'scheduled', at: row.scheduled_at, label: 'Call scheduled' } : null,
    currentReminderSentAt ? { type: 'reminder_you', at: currentReminderSentAt, label: 'Reminder sent to you' } : null,
    otherReminderSentAt ? { type: 'reminder_other', at: otherReminderSentAt, label: 'Reminder sent to your match' } : null,
    currentUserJoinedAt ? { type: 'joined_you', at: currentUserJoinedAt, label: 'You joined' } : null,
    otherUserJoinedAt ? { type: 'joined_other', at: otherUserJoinedAt, label: 'Your match joined' } : null,
    row.answered_at ? { type: 'answered', at: row.answered_at, label: 'Call connected' } : null,
    currentUserLeftAt ? { type: 'left_you', at: currentUserLeftAt, label: 'You left' } : null,
    otherUserLeftAt ? { type: 'left_other', at: otherUserLeftAt, label: 'Your match left' } : null,
    row.ended_at ? { type: 'ended', at: row.ended_at, label: 'Call ended' } : null
  ]
    .filter(Boolean)
    .sort((leftEvent, rightEvent) => new Date(leftEvent.at).getTime() - new Date(rightEvent.at).getTime());
};

const normalizeVideoDateRow = (row, currentUserId) => {
  const settingsSnapshot = normalizeSettingsSnapshot(row.settings_snapshot);
  const privateFeedback =
    settingsSnapshot?.privateFeedback && typeof settingsSnapshot.privateFeedback === 'object'
      ? settingsSnapshot.privateFeedback
      : {};
  const currentUserFeedback = privateFeedback[String(currentUserId)] || null;
  const otherUserFeedback = privateFeedback[String(row.other_user_id)] || null;
  const userSlot = getUserSlot(row, currentUserId);
  const currentUserConsented =
    userSlot === 1 ? row.recording_consented_user_1 : row.recording_consented_user_2;
  const otherUserConsented =
    userSlot === 1 ? row.recording_consented_user_2 : row.recording_consented_user_1;
  const currentUserJoinedAt = userSlot === 1 ? row.user_1_joined_at : row.user_2_joined_at;
  const otherUserJoinedAt = userSlot === 1 ? row.user_2_joined_at : row.user_1_joined_at;
  const currentUserLeftAt = userSlot === 1 ? row.user_1_left_at : row.user_2_left_at;
  const otherUserLeftAt = userSlot === 1 ? row.user_2_left_at : row.user_1_left_at;
  const currentUserBackground =
    userSlot === 1 ? row.virtual_background_user_1 : row.virtual_background_user_2;
  const otherUserBackground =
    userSlot === 1 ? row.virtual_background_user_2 : row.virtual_background_user_1;
  const currentUserReminderSentAt =
    userSlot === 1 ? row.reminder_sent_user_1_at : row.reminder_sent_user_2_at;
  const otherUserReminderSentAt =
    userSlot === 1 ? row.reminder_sent_user_2_at : row.reminder_sent_user_1_at;
  const scheduledAtDate = row.scheduled_at ? new Date(row.scheduled_at) : null;
  const isUpcoming =
    row.status === 'scheduled' &&
    scheduledAtDate &&
    scheduledAtDate.getTime() > Date.now();
  const joinWindowMs = 15 * 60 * 1000;
  const canJoinNow =
    !scheduledAtDate ||
    Math.abs(scheduledAtDate.getTime() - Date.now()) <= joinWindowMs ||
    row.status === 'ringing' ||
    row.status === 'ongoing';

  return {
    id: row.id,
    matchId: row.match_id,
    roomId: row.room_id,
    sessionType: row.session_type || 'instant',
    title: row.title || null,
    note: row.note || null,
    status: row.status,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    answeredAt: row.answered_at,
    endedAt: row.ended_at,
    durationSeconds: parseInteger(row.duration_seconds, 0) || 0,
    reminderMinutes: parseInteger(row.reminder_minutes, DEFAULT_REMINDER_MINUTES) || DEFAULT_REMINDER_MINUTES,
    currentUserReminderSentAt,
    otherUserReminderSentAt,
    isUpcoming: Boolean(isUpcoming),
    canJoinNow: Boolean(canJoinNow),
    noShowStatus: row.no_show_status || 'pending',
    endedReason: row.ended_reason || null,
    createdAt: row.created_at,
    scheduledByUserId: row.scheduled_by_user_id || null,
    partner: {
      userId: row.other_user_id,
      name: row.other_user_name,
      username: row.other_username || null,
      photoUrl: row.other_user_photo || null
    },
    recording: {
      requested: Boolean(row.recording_requested),
      requestedByUserId: row.recording_requested_by || null,
      currentUserConsented: Boolean(currentUserConsented),
      otherUserConsented: Boolean(otherUserConsented),
      enabled: Boolean(row.recording_enabled)
    },
    liveSettings: {
      qualityPreset: row.call_quality_preset || 'balanced',
      currentUserBackground: currentUserBackground || 'none',
      otherUserBackground: otherUserBackground || 'none',
      screenShareEnabled: Boolean(row.screen_share_enabled),
      screenShareUserId: row.screen_share_user_id || null,
      snapshot: settingsSnapshot
    },
    presence: {
      currentUserJoinedAt,
      otherUserJoinedAt,
      currentUserLeftAt,
      otherUserLeftAt
    },
    postDateFeedback: {
      submitted: Boolean(currentUserFeedback),
      currentUser: currentUserFeedback,
      partnerSubmitted: Boolean(otherUserFeedback)
    },
    timeline: buildTimeline(row, currentUserId)
  };
};

const updateSettingsSnapshot = async (videoDateId, settingsPatch = {}) => {
  const normalizedPatch = Object.entries(settingsPatch).reduce((accumulator, [key, value]) => {
    if (value !== undefined) {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});

  if (Object.keys(normalizedPatch).length === 0) {
    return;
  }

  await db.query(
    `UPDATE video_dates
     SET settings_snapshot = COALESCE(settings_snapshot::jsonb, '{}'::jsonb) || $2::jsonb
     WHERE id = $1`,
    [videoDateId, JSON.stringify(normalizedPatch)]
  );
};

const loadVideoDateForUser = async (userId, videoDateId) => {
  const result = await db.query(
    `${buildVideoCallSelect('vd.id = $2 AND (vd.user_id_1 = $1 OR vd.user_id_2 = $1)')}
     LIMIT 1`,
    [userId, videoDateId]
  );

  return result.rows[0] || null;
};

router.get('/match/:matchId', async (req, res) => {
  try {
    const userId = req.user.id;
    const matchId = parseInteger(req.params.matchId);

    if (!matchId) {
      return res.status(400).json({ error: 'Valid match ID is required' });
    }

    const match = await loadMatchForUser(userId, matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const result = await db.query(
      `${buildVideoCallSelect('vd.match_id = $2 AND (vd.user_id_1 = $1 OR vd.user_id_2 = $1)')}
       ORDER BY COALESCE(vd.scheduled_at, vd.created_at) DESC, vd.id DESC
       LIMIT $3`,
      [userId, matchId, MAX_HISTORY_LIMIT]
    );

    const sessions = result.rows.map((row) => normalizeVideoDateRow(row, userId));
    const activeSession =
      sessions.find((session) => ['ringing', 'ongoing'].includes(session.status)) || null;
    const upcomingSessions = sessions.filter((session) => session.isUpcoming);
    const history = sessions.filter((session) => !session.isUpcoming);

    res.json({
      match: {
        id: match.id,
        otherUserId: match.other_user_id,
        otherUserName: match.other_user_name,
        otherUsername: match.other_username || null,
        otherUserPhoto: match.other_user_photo || null
      },
      activeSession,
      upcomingSessions,
      history
    });
  } catch (error) {
    console.error('Get video call match summary error:', error);
    res.status(500).json({ error: 'Failed to load video call details' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInteger(req.query.limit, 15), MAX_HISTORY_LIMIT);
    const scope = String(req.query.scope || 'all').trim().toLowerCase();
    const conditions = ['(vd.user_id_1 = $1 OR vd.user_id_2 = $1)'];

    if (scope === 'upcoming') {
      conditions.push(`vd.status = 'scheduled'`);
      conditions.push(`vd.scheduled_at IS NOT NULL`);
      conditions.push(`vd.scheduled_at > CURRENT_TIMESTAMP`);
    } else if (scope === 'completed') {
      conditions.push(`vd.status IN ('completed', 'cancelled', 'declined', 'missed')`);
    }

    const result = await db.query(
      `${buildVideoCallSelect(conditions.join(' AND '))}
       ORDER BY COALESCE(vd.scheduled_at, vd.created_at) DESC, vd.id DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({
      sessions: result.rows.map((row) => normalizeVideoDateRow(row, userId))
    });
  } catch (error) {
    console.error('Get video call history error:', error);
    res.status(500).json({ error: 'Failed to load video call history' });
  }
});

router.post('/match/:matchId/live', async (req, res) => {
  try {
    const userId = req.user.id;
    const matchId = parseInteger(req.params.matchId);
    const requestMetadata = getRequestMetadata(req);
    const {
      scheduledVideoDateId,
      sessionType,
      qualityPreset,
      virtualBackground,
      recordingRequested
    } = req.body || {};

    if (!matchId) {
      return res.status(400).json({ error: 'Valid match ID is required' });
    }

    const match = await loadMatchForUser(userId, matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    let sessionRow = null;

    if (scheduledVideoDateId) {
      sessionRow = await loadVideoDateForUser(userId, parseInteger(scheduledVideoDateId));
      if (sessionRow && Number(sessionRow.match_id) !== Number(matchId)) {
        sessionRow = null;
      }
    }

    if (!sessionRow) {
      const existingSessionResult = await db.query(
        `${buildVideoCallSelect(`
          vd.match_id = $2
          AND (vd.user_id_1 = $1 OR vd.user_id_2 = $1)
          AND vd.status IN ('scheduled', 'ringing', 'ongoing')
        `)}
         ORDER BY COALESCE(vd.scheduled_at, vd.created_at) DESC, vd.id DESC
         LIMIT 1`,
        [userId, matchId]
      );

      sessionRow = existingSessionResult.rows[0] || null;
    }

    const normalizedSessionType = normalizeSessionType(sessionType);
    const normalizedQualityPreset = normalizeQualityPreset(qualityPreset);
    const normalizedBackgroundPreset = normalizeBackgroundPreset(virtualBackground);
    const wantsRecording = normalizeBoolean(recordingRequested, false);
    const userSlot = sessionRow ? getUserSlot(sessionRow, userId) : Number(match.user_id_1) === Number(userId) ? 1 : 2;
    const roomId = sessionRow?.room_id || `video-${matchId}-${uuidv4()}`;

    if (sessionRow) {
      await db.query(
        `UPDATE video_dates
         SET status = CASE
               WHEN status = 'scheduled' AND session_type = 'instant' THEN 'ringing'
               WHEN status = 'scheduled' AND $2::text = 'instant' THEN 'ringing'
               ELSE status
             END,
             session_type = COALESCE(session_type, $2),
             room_id = COALESCE(room_id, $3),
             call_quality_preset = $4,
             recording_requested = CASE WHEN $5::boolean THEN TRUE ELSE recording_requested END,
             recording_requested_by = CASE WHEN $5::boolean THEN $1::integer ELSE recording_requested_by END,
             virtual_background_user_1 = CASE WHEN $6::integer = 1 THEN $7::text ELSE virtual_background_user_1 END,
             virtual_background_user_2 = CASE WHEN $6::integer = 2 THEN $7::text ELSE virtual_background_user_2 END
         WHERE id = $8`,
        [
          userId,
          normalizedSessionType,
          roomId,
          normalizedQualityPreset,
          wantsRecording,
          userSlot,
          normalizedBackgroundPreset,
          sessionRow.id
        ]
      );

      await updateSettingsSnapshot(sessionRow.id, {
        qualityPreset: normalizedQualityPreset,
        virtualBackground: normalizedBackgroundPreset,
        livePreparedAt: new Date().toISOString()
      });
    } else {
      const insertResult = await db.query(
        `INSERT INTO video_dates (
           match_id,
           user_id_1,
           user_id_2,
           session_type,
           status,
           room_id,
           call_quality_preset,
           recording_requested,
           recording_requested_by,
           virtual_background_user_1,
           virtual_background_user_2,
           settings_snapshot
         )
         VALUES (
           $1, $2, $3, $4, 'ringing', $5, $6, $7,
           CASE WHEN $7::boolean THEN $8::integer ELSE NULL END,
           CASE WHEN $9::integer = 1 THEN $10::text ELSE 'none' END,
           CASE WHEN $9::integer = 2 THEN $10::text ELSE 'none' END,
           $11::jsonb
         )
         RETURNING id`,
        [
          matchId,
          match.user_id_1,
          match.user_id_2,
          normalizedSessionType,
          roomId,
          normalizedQualityPreset,
          wantsRecording,
          userId,
          userSlot,
          normalizedBackgroundPreset,
          JSON.stringify({
            qualityPreset: normalizedQualityPreset,
            virtualBackground: normalizedBackgroundPreset,
            preparedByUserId: userId,
            preparedAt: new Date().toISOString()
          })
        ]
      );

      sessionRow = await loadVideoDateForUser(userId, insertResult.rows[0].id);
    }

    spamFraudService.trackUserActivity({
      userId,
      action: 'video_call_started',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runFraudCheck: false
    });

    const freshSession = await loadVideoDateForUser(userId, sessionRow.id);
    res.json({
      session: normalizeVideoDateRow(freshSession, userId)
    });
  } catch (error) {
    console.error('Create live video call session error:', error);
    res.status(500).json({ error: 'Failed to prepare the video call session' });
  }
});

router.post('/match/:matchId/schedule', async (req, res) => {
  try {
    const userId = req.user.id;
    const matchId = parseInteger(req.params.matchId);
    const requestMetadata = getRequestMetadata(req);
    const match = await loadMatchForUser(userId, matchId);
    const scheduledAt = normalizeDateInput(req.body?.scheduledAt);

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (!scheduledAt) {
      return res.status(400).json({ error: 'A valid scheduled time is required' });
    }

    if (scheduledAt.getTime() < Date.now() + 60 * 1000) {
      return res.status(400).json({ error: 'Scheduled calls must be at least one minute in the future' });
    }

    const title = normalizeOptionalText(req.body?.title, MAX_TITLE_LENGTH);
    const note = normalizeOptionalText(req.body?.note, MAX_NOTE_LENGTH);
    const reminderMinutes = normalizeReminderMinutes(req.body?.reminderMinutes);
    const normalizedQualityPreset = normalizeQualityPreset(req.body?.qualityPreset);
    const normalizedBackgroundPreset = normalizeBackgroundPreset(req.body?.virtualBackground);
    const wantsRecording = normalizeBoolean(req.body?.recordingRequested, false);
    const userSlot = Number(match.user_id_1) === Number(userId) ? 1 : 2;
    const schedulerName = await loadDisplayNameForUser(userId);

    const insertResult = await db.query(
      `INSERT INTO video_dates (
         match_id,
         user_id_1,
         user_id_2,
         session_type,
         scheduled_by_user_id,
         title,
         note,
         scheduled_at,
         reminder_minutes,
         status,
         room_id,
         call_quality_preset,
         recording_requested,
         recording_requested_by,
         virtual_background_user_1,
         virtual_background_user_2,
         settings_snapshot
       )
       VALUES (
         $1, $2, $3, 'scheduled', $4, $5, $6, $7, $8, 'scheduled', $9, $10, $11,
         CASE WHEN $11::boolean THEN $4::integer ELSE NULL END,
         CASE WHEN $12::integer = 1 THEN $13::text ELSE 'none' END,
         CASE WHEN $12::integer = 2 THEN $13::text ELSE 'none' END,
         $14::jsonb
       )
       RETURNING id`,
      [
        matchId,
        match.user_id_1,
        match.user_id_2,
        userId,
        title,
        note,
        scheduledAt,
        reminderMinutes,
        `video-${matchId}-${uuidv4()}`,
        normalizedQualityPreset,
        wantsRecording,
        userSlot,
        normalizedBackgroundPreset,
        JSON.stringify({
          qualityPreset: normalizedQualityPreset,
          defaultVirtualBackground: normalizedBackgroundPreset,
          schedulerUserId: userId
        })
      ]
    );

    const scheduledSession = await loadVideoDateForUser(userId, insertResult.rows[0].id);

    await Promise.all([
      userNotificationService.createNotification(userId, {
        type: 'video_call_scheduled',
        title: 'Video call scheduled',
        body: `Your video date with ${match.other_user_name} is booked for ${scheduledAt.toLocaleString()}.`,
        metadata: {
          matchId,
          videoDateId: scheduledSession.id,
          scheduledAt
        }
      }),
      userNotificationService.createNotification(match.other_user_id, {
        type: 'video_call_scheduled',
        title: 'New video date invitation',
        body: `${schedulerName} scheduled a video call for ${scheduledAt.toLocaleString()}.`,
        metadata: {
          matchId,
          videoDateId: scheduledSession.id,
          scheduledAt,
          scheduledByUserId: userId
        }
      })
    ]);

    spamFraudService.trackUserActivity({
      userId,
      action: 'video_call_scheduled',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runFraudCheck: false
    });

    res.status(201).json({
      message: 'Video call scheduled',
      session: normalizeVideoDateRow(scheduledSession, userId)
    });
  } catch (error) {
    console.error('Schedule video call error:', error);
    res.status(500).json({ error: 'Failed to schedule the video call' });
  }
});

router.post('/due-reminders', async (req, res) => {
  try {
    const userId = req.user.id;
    const currentUserName = await loadDisplayNameForUser(userId);
    const dueSessionsResult = await db.query(
      `${buildVideoCallSelect(`
        (vd.user_id_1 = $1 OR vd.user_id_2 = $1)
        AND vd.status = 'scheduled'
        AND vd.scheduled_at IS NOT NULL
        AND CURRENT_TIMESTAMP >= vd.scheduled_at - (COALESCE(vd.reminder_minutes, ${DEFAULT_REMINDER_MINUTES})::text || ' minutes')::interval
        AND CURRENT_TIMESTAMP <= vd.scheduled_at + INTERVAL '15 minutes'
        AND (
          (vd.user_id_1 = $1 AND vd.reminder_sent_user_1_at IS NULL)
          OR
          (vd.user_id_2 = $1 AND vd.reminder_sent_user_2_at IS NULL)
        )
      `)}
       ORDER BY vd.scheduled_at ASC
       LIMIT 10`,
      [userId]
    );

    const reminders = [];

    for (const row of dueSessionsResult.rows) {
      const userSlot = getUserSlot(row, userId);
      const reminderColumn =
        userSlot === 1 ? 'reminder_sent_user_1_at' : 'reminder_sent_user_2_at';

      await db.query(
        `UPDATE video_dates
         SET ${reminderColumn} = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [row.id]
      );

      const notification = await userNotificationService.createNotification(userId, {
        type: 'video_call_reminder',
        title: 'Upcoming video date',
        body: `Your video call with ${row.other_user_name} is coming up soon.`,
        metadata: {
          videoDateId: row.id,
          matchId: row.match_id,
          scheduledAt: row.scheduled_at,
          partnerName: row.other_user_name,
          triggeredFor: currentUserName
        }
      });

      reminders.push({
        session: normalizeVideoDateRow(
          {
            ...row,
            [reminderColumn]: new Date().toISOString()
          },
          userId
        ),
        notification
      });
    }

    res.json({
      reminders
    });
  } catch (error) {
    console.error('Send due video call reminders error:', error);
    res.status(500).json({ error: 'Failed to deliver due reminders' });
  }
});

router.post('/:videoDateId/reminder', async (req, res) => {
  try {
    const userId = req.user.id;
    const videoDateId = parseInteger(req.params.videoDateId);
    const sessionRow = await loadVideoDateForUser(userId, videoDateId);

    if (!sessionRow) {
      return res.status(404).json({ error: 'Video call session not found' });
    }

    const otherUserId = sessionRow.other_user_id;
    const currentUserName = await loadDisplayNameForUser(userId);
    const otherUserSlot = getUserSlot(sessionRow, otherUserId);
    const reminderColumn =
      otherUserSlot === 1 ? 'reminder_sent_user_1_at' : 'reminder_sent_user_2_at';

    await db.query(
      `UPDATE video_dates
       SET ${reminderColumn} = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [videoDateId]
    );

    const notification = await userNotificationService.createNotification(otherUserId, {
      type: 'video_call_reminder',
      title: 'Reminder from your match',
      body: `${currentUserName} sent a reminder for your upcoming video call.`,
      metadata: {
        videoDateId,
        matchId: sessionRow.match_id,
        scheduledAt: sessionRow.scheduled_at,
        sentByUserId: userId
      }
    });

    const updatedSession = await loadVideoDateForUser(userId, videoDateId);
    res.json({
      message: 'Reminder sent',
      notification,
      session: normalizeVideoDateRow(updatedSession, userId)
    });
  } catch (error) {
    console.error('Send manual video call reminder error:', error);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

router.post('/:videoDateId/join', async (req, res) => {
  try {
    const userId = req.user.id;
    const videoDateId = parseInteger(req.params.videoDateId);
    const sessionRow = await loadVideoDateForUser(userId, videoDateId);

    if (!sessionRow) {
      return res.status(404).json({ error: 'Video call session not found' });
    }

    const userSlot = getUserSlot(sessionRow, userId);
    const otherJoinedAt = userSlot === 1 ? sessionRow.user_2_joined_at : sessionRow.user_1_joined_at;
    const joinedColumn = userSlot === 1 ? 'user_1_joined_at' : 'user_2_joined_at';
    const leftColumn = userSlot === 1 ? 'user_1_left_at' : 'user_2_left_at';
    const normalizedQualityPreset = normalizeQualityPreset(req.body?.qualityPreset || sessionRow.call_quality_preset);
    const normalizedBackgroundPreset = normalizeBackgroundPreset(req.body?.virtualBackground);
    const hasConsent = normalizeBoolean(
      req.body?.recordingConsent,
      userSlot === 1 ? sessionRow.recording_consented_user_1 : sessionRow.recording_consented_user_2
    );

    await db.query(
      `UPDATE video_dates
       SET ${joinedColumn} = COALESCE(${joinedColumn}, CURRENT_TIMESTAMP),
           ${leftColumn} = NULL,
           answered_at = CASE
             WHEN $2::boolean = TRUE THEN COALESCE(answered_at, CURRENT_TIMESTAMP)
             ELSE answered_at
           END,
           started_at = CASE
             WHEN $2::boolean = TRUE THEN COALESCE(started_at, CURRENT_TIMESTAMP)
             ELSE started_at
           END,
           status = CASE
             WHEN $2::boolean = TRUE THEN 'ongoing'
             ELSE 'ringing'
           END,
           call_quality_preset = $3,
           recording_consented_user_1 = CASE WHEN $4 = 1 THEN $5 ELSE recording_consented_user_1 END,
           recording_consented_user_2 = CASE WHEN $4 = 2 THEN $5 ELSE recording_consented_user_2 END,
           recording_enabled = CASE
             WHEN $4 = 1 THEN $5 AND recording_consented_user_2
             WHEN $4 = 2 THEN $5 AND recording_consented_user_1
             ELSE recording_enabled
           END,
           virtual_background_user_1 = CASE WHEN $4 = 1 THEN $6 ELSE virtual_background_user_1 END,
           virtual_background_user_2 = CASE WHEN $4 = 2 THEN $6 ELSE virtual_background_user_2 END
       WHERE id = $1`,
      [
        videoDateId,
        Boolean(otherJoinedAt),
        normalizedQualityPreset,
        userSlot,
        hasConsent,
        normalizedBackgroundPreset
      ]
    );

    await updateSettingsSnapshot(videoDateId, {
      qualityPreset: normalizedQualityPreset,
      virtualBackground: normalizedBackgroundPreset,
      joinedByUserId: userId,
      joinedAt: new Date().toISOString()
    });

    const updatedSession = await loadVideoDateForUser(userId, videoDateId);
    res.json({
      message: 'Joined video call',
      session: normalizeVideoDateRow(updatedSession, userId)
    });
  } catch (error) {
    console.error('Join video call error:', error);
    res.status(500).json({ error: 'Failed to join the video call session' });
  }
});

router.post('/:videoDateId/settings', async (req, res) => {
  try {
    const userId = req.user.id;
    const videoDateId = parseInteger(req.params.videoDateId);
    const sessionRow = await loadVideoDateForUser(userId, videoDateId);

    if (!sessionRow) {
      return res.status(404).json({ error: 'Video call session not found' });
    }

    const userSlot = getUserSlot(sessionRow, userId);
    const normalizedQualityPreset = normalizeQualityPreset(req.body?.qualityPreset || sessionRow.call_quality_preset);
    const normalizedBackgroundPreset = normalizeBackgroundPreset(req.body?.virtualBackground);
    const screenShareEnabled = normalizeBoolean(req.body?.screenShareEnabled, false);

    await db.query(
      `UPDATE video_dates
       SET call_quality_preset = $2,
           virtual_background_user_1 = CASE WHEN $3 = 1 THEN $4 ELSE virtual_background_user_1 END,
           virtual_background_user_2 = CASE WHEN $3 = 2 THEN $4 ELSE virtual_background_user_2 END,
           screen_share_enabled = $5,
           screen_share_user_id = CASE
             WHEN $5 THEN $6
             WHEN screen_share_user_id = $6 THEN NULL
             ELSE screen_share_user_id
           END
       WHERE id = $1`,
      [
        videoDateId,
        normalizedQualityPreset,
        userSlot,
        normalizedBackgroundPreset,
        screenShareEnabled,
        userId
      ]
    );

    await updateSettingsSnapshot(videoDateId, {
      qualityPreset: normalizedQualityPreset,
      virtualBackground: normalizedBackgroundPreset,
      screenShareEnabled,
      screenShareUserId: screenShareEnabled ? userId : null
    });

    const updatedSession = await loadVideoDateForUser(userId, videoDateId);
    res.json({
      message: 'Call settings updated',
      session: normalizeVideoDateRow(updatedSession, userId)
    });
  } catch (error) {
    console.error('Update video call settings error:', error);
    res.status(500).json({ error: 'Failed to update video call settings' });
  }
});

router.post('/:videoDateId/recording-consent', async (req, res) => {
  try {
    const userId = req.user.id;
    const videoDateId = parseInteger(req.params.videoDateId);
    const sessionRow = await loadVideoDateForUser(userId, videoDateId);

    if (!sessionRow) {
      return res.status(404).json({ error: 'Video call session not found' });
    }

    const userSlot = getUserSlot(sessionRow, userId);
    const consent = normalizeBoolean(req.body?.consent, false);
    const requested = normalizeBoolean(req.body?.requested, sessionRow.recording_requested);

    await db.query(
      `UPDATE video_dates
       SET recording_requested = $2,
           recording_requested_by = CASE
             WHEN $2 THEN COALESCE(recording_requested_by, $3)
             ELSE NULL
           END,
           recording_consented_user_1 = CASE WHEN $4 = 1 THEN $5 ELSE recording_consented_user_1 END,
           recording_consented_user_2 = CASE WHEN $4 = 2 THEN $5 ELSE recording_consented_user_2 END,
           recording_enabled = CASE
             WHEN $4 = 1 THEN $5 AND recording_consented_user_2
             WHEN $4 = 2 THEN $5 AND recording_consented_user_1
             ELSE recording_enabled
           END
       WHERE id = $1`,
      [videoDateId, requested, userId, userSlot, consent]
    );

    const updatedSession = await loadVideoDateForUser(userId, videoDateId);

    if (requested && consent && !Boolean(sessionRow.recording_enabled) && Boolean(updatedSession.recording_enabled)) {
      await Promise.all([
        userNotificationService.createNotification(userId, {
          type: 'video_call_recording_enabled',
          title: 'Recording enabled',
          body: `Both participants consented to recording with ${updatedSession.other_user_name}.`,
          metadata: {
            videoDateId,
            matchId: updatedSession.match_id
          }
        }),
        userNotificationService.createNotification(updatedSession.other_user_id, {
          type: 'video_call_recording_enabled',
          title: 'Recording enabled',
          body: `Both participants consented to recording this video date.`,
          metadata: {
            videoDateId,
            matchId: updatedSession.match_id
          }
        })
      ]);
    } else if (requested && consent) {
      await userNotificationService.createNotification(updatedSession.other_user_id, {
        type: 'video_call_recording_request',
        title: 'Recording consent requested',
        body: `${await loadDisplayNameForUser(userId)} wants to record your video date. Review the consent prompt in the call.`,
        metadata: {
          videoDateId,
          matchId: updatedSession.match_id,
          requestedByUserId: userId
        }
      });
    }

    res.json({
      message: 'Recording consent updated',
      session: normalizeVideoDateRow(updatedSession, userId)
    });
  } catch (error) {
    console.error('Update recording consent error:', error);
    res.status(500).json({ error: 'Failed to update recording consent' });
  }
});

router.post('/:videoDateId/feedback', async (req, res) => {
  try {
    const userId = req.user.id;
    const videoDateId = parseInteger(req.params.videoDateId);
    const sessionRow = await loadVideoDateForUser(userId, videoDateId);

    if (!sessionRow) {
      return res.status(404).json({ error: 'Video call session not found' });
    }

    if (!TERMINAL_STATUSES.has(sessionRow.status)) {
      return res.status(400).json({ error: 'Feedback can be added after the video date ends' });
    }

    const rating = Math.min(5, Math.max(1, parseInteger(req.body?.rating, 0) || 0));
    const summary = normalizeOptionalText(req.body?.summary, MAX_NOTE_LENGTH);
    const wouldMeetInPerson = normalizeBoolean(req.body?.wouldMeetInPerson, false);

    if (!rating) {
      return res.status(400).json({ error: 'A rating between 1 and 5 is required' });
    }

    const feedbackPayload = {
      rating,
      summary,
      wouldMeetInPerson,
      submittedAt: new Date().toISOString()
    };

    await db.query(
      `UPDATE video_dates
       SET settings_snapshot = jsonb_set(
         COALESCE(settings_snapshot::jsonb, '{}'::jsonb),
         '{privateFeedback}',
         COALESCE(settings_snapshot::jsonb->'privateFeedback', '{}'::jsonb) || jsonb_build_object($2::text, $3::jsonb),
         true
       )
       WHERE id = $1`,
      [videoDateId, String(userId), JSON.stringify(feedbackPayload)]
    );

    const updatedSession = await loadVideoDateForUser(userId, videoDateId);
    res.json({
      message: 'Private video date feedback saved',
      session: normalizeVideoDateRow(updatedSession, userId)
    });
  } catch (error) {
    console.error('Save video date feedback error:', error);
    res.status(500).json({ error: 'Failed to save video date feedback' });
  }
});

router.post('/:videoDateId/complete', async (req, res) => {
  try {
    const userId = req.user.id;
    const videoDateId = parseInteger(req.params.videoDateId);
    const requestMetadata = getRequestMetadata(req);
    const sessionRow = await loadVideoDateForUser(userId, videoDateId);

    if (!sessionRow) {
      return res.status(404).json({ error: 'Video call session not found' });
    }

    if (TERMINAL_STATUSES.has(sessionRow.status)) {
      return res.json({
        message: 'Video call session already finalized',
        session: normalizeVideoDateRow(sessionRow, userId)
      });
    }

    const userSlot = getUserSlot(sessionRow, userId);
    const connected = normalizeBoolean(req.body?.connected, false);
    const reason = normalizeOptionalText(req.body?.reason, 100) || 'ended';
    const providedDurationSeconds = parseInteger(req.body?.durationSeconds, 0) || 0;
    const otherJoinedAt = userSlot === 1 ? sessionRow.user_2_joined_at : sessionRow.user_1_joined_at;
    const currentJoinedAt = userSlot === 1 ? sessionRow.user_1_joined_at : sessionRow.user_2_joined_at;
    const bothJoined = Boolean(currentJoinedAt && otherJoinedAt);

    let nextStatus = 'completed';

    if (reason === 'declined') {
      nextStatus = 'declined';
    } else if (['no_answer_timeout', 'connection_timeout', 'missed'].includes(reason)) {
      nextStatus = 'missed';
    } else if (!connected && !bothJoined && ['back_navigation', 'left_call_screen', 'cancelled'].includes(reason)) {
      nextStatus = 'cancelled';
    } else if (!connected && !bothJoined && reason === 'switched_to_messages') {
      nextStatus = 'cancelled';
    }

    let noShowStatus = 'none';
    if (nextStatus === 'missed' || (!bothJoined && nextStatus !== 'declined')) {
      if (currentJoinedAt && !otherJoinedAt) {
        noShowStatus = userSlot === 1 ? 'user_2_no_show' : 'user_1_no_show';
      } else if (!currentJoinedAt && otherJoinedAt) {
        noShowStatus = userSlot === 1 ? 'user_1_no_show' : 'user_2_no_show';
      } else {
        noShowStatus = 'mutual_no_show';
      }
    }

    const derivedDurationSeconds =
      providedDurationSeconds > 0
        ? providedDurationSeconds
        : sessionRow.started_at
          ? Math.max(
              0,
              Math.floor((Date.now() - new Date(sessionRow.started_at).getTime()) / 1000)
            )
          : 0;

    const leftColumn = userSlot === 1 ? 'user_1_left_at' : 'user_2_left_at';

    await db.query(
      `UPDATE video_dates
       SET ${leftColumn} = COALESCE(${leftColumn}, CURRENT_TIMESTAMP),
           ended_at = CURRENT_TIMESTAMP,
           status = $2,
           no_show_status = $3,
           ended_reason = $4,
           duration_seconds = GREATEST(COALESCE(duration_seconds, 0), $5),
           screen_share_enabled = FALSE,
           screen_share_user_id = NULL,
           recording_enabled = CASE
             WHEN $2 = 'completed' AND recording_enabled THEN recording_enabled
             ELSE FALSE
           END
       WHERE id = $1`,
      [videoDateId, nextStatus, noShowStatus, reason, derivedDurationSeconds]
    );

    await updateSettingsSnapshot(videoDateId, {
      finalizedByUserId: userId,
      finalizedAt: new Date().toISOString(),
      finalReason: reason
    });

    if (derivedDurationSeconds > 0) {
      spamFraudService.trackUserActivity({
        userId,
        action: 'video_call_completed',
        analyticsUpdates: { video_call_duration_seconds: derivedDurationSeconds },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        runFraudCheck: false
      });
    }

    const updatedSession = await loadVideoDateForUser(userId, videoDateId);
    res.json({
      message: 'Video call session finalized',
      session: normalizeVideoDateRow(updatedSession, userId)
    });
  } catch (error) {
    console.error('Finalize video call error:', error);
    res.status(500).json({ error: 'Failed to finalize the video call session' });
  }
});

module.exports = router;
