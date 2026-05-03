/**
 * Call Market Routes - Browse & connect with available callers
 */

const express = require('express');
const db = require('../config/database');

const router = express.Router();
const VALID_CALL_TYPES = ['voice', 'video'];
const DEFAULT_CALL_TYPES = ['voice', 'video'];
const AVAILABLE_CALL_TYPES_SQL = `
  COALESCE(
    dp.available_call_types,
    CASE
      WHEN COALESCE(dp.is_available_for_calls, FALSE)
        THEN ARRAY['voice', 'video']::text[]
      ELSE ARRAY[]::text[]
    END
  )
`;
const PRESENCE_SCHEMA_CACHE_TTL_MS = 60 * 1000;
let presenceStatusSchemaCache = {
  expiresAt: 0,
  statusColumn: null
};

const getPresenceStatusColumn = async () => {
  if (presenceStatusSchemaCache.expiresAt > Date.now()) {
    return presenceStatusSchemaCache.statusColumn;
  }

  try {
    const result = await db.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'user_presence_sessions'
         AND column_name IN ('is_online', 'is_active')`
    );

    const availableColumns = new Set(result.rows.map((row) => row.column_name));
    const statusColumn = availableColumns.has('is_online')
      ? 'is_online'
      : availableColumns.has('is_active')
        ? 'is_active'
        : null;

    presenceStatusSchemaCache = {
      expiresAt: Date.now() + PRESENCE_SCHEMA_CACHE_TTL_MS,
      statusColumn
    };

    return statusColumn;
  } catch (error) {
    console.warn('Presence schema lookup failed:', error.message);

    presenceStatusSchemaCache = {
      expiresAt: Date.now() + 10 * 1000,
      statusColumn: null
    };

    return null;
  }
};

const buildOnlineStatusSql = (userAlias, statusColumn) => {
  if (!statusColumn) {
    return 'FALSE';
  }

  return `
    EXISTS (
      SELECT 1
      FROM user_presence_sessions ups
      WHERE ups.user_id = ${userAlias}.id
        AND COALESCE(ups.${statusColumn}, FALSE) = TRUE
    )
  `;
};

const parseInteger = (value, fallback = null) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const normalizeBoolean = (value, fallbackValue = false) => {
  if (value === undefined || value === null) return fallbackValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return Boolean(value);
};

const parseFloatValue = (value, fallback = null) => {
  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const normalizeText = (value) => String(value || '').trim();

const normalizeCallTypes = (value, fallback = DEFAULT_CALL_TYPES) => {
  const rawValues = Array.isArray(value)
    ? value
    : value === undefined || value === null || value === ''
      ? fallback
      : [value];

  return Array.from(
    new Set(
      rawValues
        .map((type) => String(type || '').trim().toLowerCase())
        .filter((type) => VALID_CALL_TYPES.includes(type))
    )
  );
};

const normalizeArrayFilter = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeText(entry))
      .filter(Boolean);
  }

  const normalizedValue = normalizeText(value);
  return normalizedValue ? [normalizedValue] : [];
};

const buildDistanceExpression = (latitudeParamIndex, longitudeParamIndex) => `
  CASE
    WHEN dp.location_lat IS NOT NULL AND dp.location_lng IS NOT NULL
      THEN (
        6371 * acos(
          LEAST(1, GREATEST(-1,
            cos(radians($${latitudeParamIndex})) * cos(radians(dp.location_lat)) *
            cos(radians(dp.location_lng) - radians($${longitudeParamIndex})) +
            sin(radians($${latitudeParamIndex})) * sin(radians(dp.location_lat))
          ))
        )
      )
    ELSE NULL
  END
`;

// Get call settings
const getCallSetting = async (key, defaultValue = null) => {
  const result = await db.query(
    'SELECT value FROM call_settings WHERE key = $1',
    [key]
  );
  return result.rows[0]?.value ?? defaultValue;
};

// Get user's wallet balance
const getWalletBalance = async (userId) => {
  const result = await db.query(
    'SELECT credits_balance FROM call_credits WHERE user_id = $1',
    [userId]
  );
  return result.rows[0]?.credits_balance || 0;
};

// Check if calling is enabled
const isCallingEnabled = async () => {
  const enabled = await getCallSetting('calling_enabled', 'true');
  return enabled === 'true';
};

// Check if user is online based on their presence sessions
const isUserOnline = async (userId) => {
  try {
    const presenceStatusColumn = await getPresenceStatusColumn();
    if (!presenceStatusColumn) {
      return false;
    }

    // Check if user has any active presence sessions using the live schema.
    const presenceResult = await db.query(
      `SELECT COUNT(*) as active_sessions 
       FROM user_presence_sessions 
       WHERE user_id = $1 AND COALESCE(${presenceStatusColumn}, FALSE) = TRUE
       LIMIT 1`,
      [userId]
    );

    return Number.parseInt(presenceResult.rows[0]?.active_sessions || '0', 10) > 0;
  } catch (error) {
    console.error('Error checking user online status:', error);
    return false;
  }
};

// Browse available callers
router.get('/available', async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInteger(req.query.page, 1);
    const limit = Math.min(parseInteger(req.query.limit, 20), 50);
    const offset = (page - 1) * limit;
    const requestedCallType = normalizeCallTypes(req.query.type, [])[0] || null;
    const filtersApplied = normalizeBoolean(req.query.filtersApplied, false);
    const minAge = parseInteger(req.query.minAge, null);
    const maxAge = parseInteger(req.query.maxAge, null);
    const gender = normalizeText(req.query.gender).toLowerCase();
    const languageFilters = normalizeArrayFilter(req.query.language || req.query.languages);
    const locationFilter = normalizeText(req.query.location);
    const maxDistanceKm = parseInteger(req.query.distanceKm ?? req.query.distance, null);
    
    if (!(await isCallingEnabled())) {
      return res.json({
        success: true,
        enabled: false,
        users: []
      });
    }
    
    const voiceRate = parseFloat(await getCallSetting('voice_rate_per_minute', '5'));
    const videoRate = parseFloat(await getCallSetting('video_rate_per_minute', '10'));
    const rate = requestedCallType === 'video' ? videoRate : voiceRate;
    const presenceStatusColumn = await getPresenceStatusColumn();

    if (!presenceStatusColumn) {
      console.warn('Call market availability skipped: user_presence_sessions has no supported online status column');
      return res.json({
        success: true,
        enabled: true,
        callType: requestedCallType,
        ratePerMinute: rate,
        page,
        limit,
        total: 0,
        users: []
      });
    }

    const onlineStatusSql = buildOnlineStatusSql('u', presenceStatusColumn);

    const currentProfileResult = await db.query(
      `SELECT location_lat, location_lng
       FROM dating_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    const currentLat = parseFloatValue(currentProfileResult.rows[0]?.location_lat);
    const currentLng = parseFloatValue(currentProfileResult.rows[0]?.location_lng);
    const hasViewerCoordinates = Number.isFinite(currentLat) && Number.isFinite(currentLng);

    const params = [userId];
    let paramIndex = 2;
    let distanceExpression = 'NULL::numeric';

    if (hasViewerCoordinates) {
      const latitudeParamIndex = paramIndex++;
      const longitudeParamIndex = paramIndex++;
      params.push(currentLat, currentLng);
      distanceExpression = buildDistanceExpression(latitudeParamIndex, longitudeParamIndex);
    }

    let query = `
      SELECT
        u.id as user_id,
        dp.first_name,
        dp.age,
        dp.gender,
        dp.location_city as location,
        dp.location_district,
        dp.location_locality,
        dp.bio,
        dp.interests,
        dp.languages,
        dp.call_rating,
        dp.total_calls_taken,
        (
          SELECT photo_url
          FROM profile_photos
          WHERE user_id = u.id
          ORDER BY is_primary DESC
          LIMIT 1
        ) as photo_url,
        dp.call_earnings,
        ${AVAILABLE_CALL_TYPES_SQL} as available_call_types,
        ${onlineStatusSql} as is_online,
        ${distanceExpression} as distance_km,
        COUNT(*) OVER() as total_count
      FROM users u
      INNER JOIN dating_profiles dp ON dp.user_id = u.id
      WHERE dp.is_available_for_calls = TRUE
        AND u.id != $1
        AND COALESCE(dp.is_active, TRUE) = TRUE
        AND COALESCE(array_length(${AVAILABLE_CALL_TYPES_SQL}, 1), 0) > 0
        AND ${onlineStatusSql}
    `;

    if (requestedCallType) {
      query += ` AND $${paramIndex++} = ANY(${AVAILABLE_CALL_TYPES_SQL})`;
      params.push(requestedCallType);
    }

    if (filtersApplied && Number.isFinite(minAge)) {
      query += ` AND dp.age >= $${paramIndex++}`;
      params.push(minAge);
    }

    if (filtersApplied && Number.isFinite(maxAge)) {
      query += ` AND dp.age <= $${paramIndex++}`;
      params.push(maxAge);
    }

    if (filtersApplied && gender) {
      query += ` AND LOWER(COALESCE(dp.gender, '')) = LOWER($${paramIndex++})`;
      params.push(gender);
    }

    if (filtersApplied && languageFilters.length > 0) {
      query += ` AND COALESCE(dp.languages, ARRAY[]::text[]) && $${paramIndex++}::text[]`;
      params.push(languageFilters);
    }

    if (filtersApplied && locationFilter) {
      query += ` AND (
        (
          dp.location_city IS NULL
          AND dp.location_district IS NULL
          AND dp.location_locality IS NULL
        )
        OR LOWER(COALESCE(dp.location_city, '')) LIKE LOWER($${paramIndex})
        OR LOWER(COALESCE(dp.location_district, '')) LIKE LOWER($${paramIndex})
        OR LOWER(COALESCE(dp.location_locality, '')) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${locationFilter}%`);
      paramIndex += 1;
    }

    if (filtersApplied && hasViewerCoordinates && Number.isFinite(maxDistanceKm) && maxDistanceKm > 0) {
      query += ` AND (
        dp.location_lat IS NULL
        OR dp.location_lng IS NULL
        OR ${distanceExpression} <= $${paramIndex++}
      )`;
      params.push(maxDistanceKm);
    }

    query += `
      ORDER BY is_online DESC, distance_km ASC NULLS LAST, dp.call_rating DESC, dp.total_calls_taken DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const totalCount = parseInt(result.rows[0]?.total_count || 0, 10);
    
    const users = result.rows.map((user) => {
      const availableCallTypes = normalizeCallTypes(user.available_call_types);

      return {
        availableCallTypes,
        availableFor: {
          voice: availableCallTypes.includes('voice'),
          video: availableCallTypes.includes('video')
        },
        userId: user.user_id,
        name: user.first_name,
        age: user.age,
        gender: user.gender,
        location: user.location,
        bio: user.bio,
        interests: user.interests || [],
        languages: user.languages || [],
        photoUrl: user.photo_url,
        callRating: Number(user.call_rating) || 0,
        totalCalls: user.total_calls_taken || 0,
        isOnline: Boolean(user.is_online),
        distanceKm: Number.isFinite(Number(user.distance_km))
          ? Math.round(Number(user.distance_km) * 10) / 10
          : null,
        rates: {
          voice: voiceRate,
          video: videoRate
        }
      };
    });
    
    res.json({
      success: true,
      enabled: true,
      callType: requestedCallType,
      ratePerMinute: rate,
      page,
      limit,
      total: totalCount,
      users
    });
  } catch (error) {
    console.error('Browse available callers error:', error);
    res.status(500).json({ error: 'Failed to browse callers' });
  }
});

// Get single user profile for calling
router.get('/user/:userId', async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = parseInteger(req.params.userId);
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const voiceRate = parseFloat(await getCallSetting('voice_rate_per_minute', '5'));
    const videoRate = parseFloat(await getCallSetting('video_rate_per_minute', '10'));
    
    const result = await db.query(`
      SELECT 
        u.id as user_id,
        dp.first_name,
        dp.age,
        dp.gender,
        dp.location_city as location,
        dp.bio,
        dp.languages,
        dp.call_rating,
        dp.total_calls_taken,
        dp.total_call_minutes,
        dp.call_earnings,
        dp.is_available_for_calls,
        COALESCE(
          dp.available_call_types,
          CASE
            WHEN COALESCE(dp.is_available_for_calls, FALSE)
              THEN '{"voice","video"}'::text[]
            ELSE '{}'::text[]
          END
        ) as available_call_types,
        (
          SELECT photo_url 
          FROM profile_photos 
          WHERE user_id = u.id 
          ORDER BY is_primary DESC 
          LIMIT 1
        ) as photo_url
      FROM users u
      INNER JOIN dating_profiles dp ON dp.user_id = u.id
      WHERE u.id = $1 AND COALESCE(dp.is_active, TRUE) = TRUE
    `, [targetUserId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const myBalance = await getWalletBalance(currentUserId);
    const availableCallTypes = normalizeCallTypes(user.available_call_types);
    
    res.json({
      success: true,
      user: {
        userId: user.user_id,
        name: user.first_name,
        age: user.age,
        gender: user.gender,
        location: user.location,
        bio: user.bio,
        photoUrl: user.photo_url,
        callRating: Number(user.call_rating) || 0,
        totalCalls: user.total_calls_taken || 0,
        totalMinutes: user.total_call_minutes || 0,
        totalEarnings: Number(user.call_earnings) || 0,
        isAvailable: user.is_available_for_calls,
        availableCallTypes,
        availableFor: {
          voice: availableCallTypes.includes('voice'),
          video: availableCallTypes.includes('video')
        },
        languages: user.languages || [],
        rates: {
          voice: voiceRate,
          video: videoRate
        }
      },
      myBalance
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Initiate call request
router.post('/request', async (req, res) => {
  try {
    const callerId = req.user.id;
    const targetUserId = parseInteger(req.body.targetUserId);
    const { callType } = req.body;
    
    if (!targetUserId) {
      return res.status(400).json({ error: 'Target user ID required' });
    }

    if (String(targetUserId) === String(callerId)) {
      return res.status(400).json({ error: 'You cannot call yourself' });
    }
    
    if (!(await isCallingEnabled())) {
      return res.status(403).json({ error: 'Calling is currently disabled' });
    }
    
    const callTypeFinal = callType === 'video' ? 'video' : 'voice';
    const rate = parseFloat(callTypeFinal === 'video' 
      ? await getCallSetting('video_rate_per_minute', '10')
      : await getCallSetting('voice_rate_per_minute', '5'));
    
    const estimatedCost = rate * 5; // 5 minute minimum estimate
    
    // Check balance
    const balance = await getWalletBalance(callerId);
    if (Number(balance) < estimatedCost) {
      return res.status(400).json({ 
        error: 'Insufficient credits',
        balance,
        required: estimatedCost
      });
    }
    
    // Check target is available and accepts this call type
    const targetResult = await db.query(
      `SELECT is_available_for_calls, COALESCE(available_call_types, $2::text[]) as available_call_types 
       FROM dating_profiles 
       WHERE user_id = $1 AND COALESCE(is_active, TRUE) = TRUE`,
      [targetUserId, ['voice', 'video']]
    );
    
    if (!targetResult.rows[0]) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    if (!targetResult.rows[0]?.is_available_for_calls) {
      return res.status(400).json({ error: 'User has disabled direct calling' });
    }

    // Check if target user accepts this specific call type
    const availableTypes = targetResult.rows[0]?.available_call_types || ['voice', 'video'];
    if (!availableTypes.includes(callTypeFinal)) {
      return res.status(400).json({ 
        error: `User does not accept ${callTypeFinal} calls`,
        availableCallTypes: availableTypes
      });
    }

    // Check if target user is online
    const targetIsOnline = await isUserOnline(targetUserId);
    if (!targetIsOnline) {
      return res.status(400).json({ error: 'User is offline' });
    }
    
    const requestId = `req_${Date.now()}_${callerId}_${targetUserId}`;
    const sessionId = `call_${Date.now()}_${callerId}_${targetUserId}`;
    
    // Create call request
    await db.query(`
      INSERT INTO call_requests (request_id, session_id, caller_id, receiver_id, call_type, credits_required, status, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', CURRENT_TIMESTAMP + INTERVAL '2 minutes', NOW())
    `, [requestId, sessionId, callerId, targetUserId, callTypeFinal, estimatedCost]);
    
    // Create session record
    await db.query(`
      INSERT INTO call_sessions (session_id, caller_id, receiver_id, call_type, rate_per_minute, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'requested', NOW())
    `, [sessionId, callerId, targetUserId, callTypeFinal, rate]);
    
    // Get caller profile info for notification
    const callerResult = await db.query(`
      SELECT u.id, dp.first_name, dp.age
      FROM users u
      LEFT JOIN dating_profiles dp ON dp.user_id = u.id
      WHERE u.id = $1
    `, [callerId]);
    
    const callerInfo = callerResult.rows[0] || {};
    const callerName = callerInfo.first_name || 'Someone';
    
    // Emit real-time notification to receiver via Socket.io
    const ioInstance = req.app?.io;
    if (ioInstance) {
      ioInstance.to(`user_${targetUserId}`).emit('incoming_call_request', {
        requestId,
        callId: sessionId,
        sessionId,
        fromUserId: callerId,
        callerId,
        callerName,
        callerAge: callerInfo.age,
        callType: callTypeFinal,
        ratePerMinute: rate,
        estimatedCost,
        expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        receivedAt: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      requestId,
      callId: sessionId,
      sessionId,
      callType: callTypeFinal,
      ratePerMinute: rate,
      estimatedCost,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString()
    });
  } catch (error) {
    console.error('Initiate call request error:', error);
    res.status(500).json({ error: 'Failed to initiate call' });
  }
});

// Accept call request (receiver side)
router.post('/accept/:requestId', async (req, res) => {
  try {
    const receiverId = req.user.id;
    const requestId = req.params.requestId;
    
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const requestResult = await client.query(
        `SELECT * FROM call_requests
         WHERE request_id = $1
           AND receiver_id = $2
           AND status = $3
           AND expires_at > CURRENT_TIMESTAMP
         FOR UPDATE`,
        [requestId, receiverId, 'pending']
      );

      if (requestResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Request not found or expired' });
      }

      const request = requestResult.rows[0];
      const debitResult = await client.query(`
        UPDATE call_credits
        SET credits_balance = credits_balance - $2,
            total_spent = total_spent + $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND credits_balance >= $2
        RETURNING credits_balance
      `, [request.caller_id, request.credits_required]);

      if (debitResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Caller no longer has enough credits' });
      }

      await client.query(`
        UPDATE call_requests
        SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
        WHERE request_id = $1
      `, [requestId]);

      await client.query(`
        UPDATE call_sessions
        SET status = 'ringing', start_time = CURRENT_TIMESTAMP
        WHERE session_id = $1
      `, [request.session_id]);

      await client.query('COMMIT');

      // Emit socket event to notify caller that their call was accepted
      req.app.emitToUser(request.caller_id, 'call:accepted', {
        callId: request.session_id,
        fromUserId: receiverId,
        targetUserId: request.caller_id,
        sessionId: request.session_id,
        callType: request.call_type,
        message: 'Your call was accepted'
      });

      res.json({
        success: true,
        message: 'Call request accepted',
        sessionId: request.session_id,
        balance: debitResult.rows[0].credits_balance
      });
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Accept call request error:', error);
    res.status(500).json({ error: 'Failed to accept call' });
  }
});

// Decline call request
router.post('/decline/:requestId', async (req, res) => {
  try {
    const receiverId = req.user.id;
    const requestId = req.params.requestId;
    
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      const requestResult = await client.query(`
        UPDATE call_requests
        SET status = 'declined', responded_at = CURRENT_TIMESTAMP
        WHERE request_id = $1
          AND receiver_id = $2
          AND status = 'pending'
        RETURNING session_id, caller_id, call_type
      `, [requestId, receiverId]);

      if (requestResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Request not found or already handled' });
      }

      await client.query(`
        UPDATE call_sessions
        SET status = 'declined', ended_at = CURRENT_TIMESTAMP
        WHERE session_id = $1
      `, [requestResult.rows[0].session_id]);

      await client.query('COMMIT');

      req.app.emitToUser(requestResult.rows[0].caller_id, 'call:rejected', {
        callId: requestResult.rows[0].session_id,
        fromUserId: receiverId,
        targetUserId: requestResult.rows[0].caller_id,
        sessionId: requestResult.rows[0].session_id,
        callType: requestResult.rows[0].call_type,
        message: 'Your call was declined'
      });

      res.json({
        success: true,
        message: 'Call request declined'
      });
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Decline call request error:', error);
    res.status(500).json({ error: 'Failed to decline call' });
  }
});

// Get pending call request
router.get('/request/:requestId', async (req, res) => {
  try {
    const userId = req.user.id;
    const requestId = req.params.requestId;
    
    const result = await db.query(`
      SELECT cr.*, 
        caller_profile.first_name as caller_name,
        receiver_profile.first_name as receiver_name
      FROM call_requests cr
      LEFT JOIN dating_profiles caller_profile ON caller_profile.user_id = cr.caller_id
      LEFT JOIN dating_profiles receiver_profile ON receiver_profile.user_id = cr.receiver_id
      WHERE cr.request_id = $1 AND (cr.caller_id = $2 OR cr.receiver_id = $2)
    `, [requestId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    const request = result.rows[0];
    
    res.json({
      success: true,
      request: {
        requestId: request.request_id,
        sessionId: request.session_id,
        callerId: request.caller_id,
        callerName: request.caller_name,
        receiverId: request.receiver_id,
        receiverName: request.receiver_name,
        callType: request.call_type,
        creditsRequired: Number(request.credits_required),
        status: request.status,
        createdAt: request.created_at,
        expiresAt: request.expires_at
      }
    });
  } catch (error) {
    console.error('Get call request error:', error);
    res.status(500).json({ error: 'Failed to get request' });
  }
});

// Default GET / route - same as /available for backwards compatibility  
router.get('/', (req, res, next) => {
  // Delegate to /available route
  req.url = '/available';
  router.handle(req, res);
});

module.exports = router;
