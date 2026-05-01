/**
 * Call Market Routes - Browse & connect with available callers
 */

const express = require('express');
const db = require('../config/database');

const router = express.Router();

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

// Browse available callers
router.get('/available', async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInteger(req.query.page, 1);
    const limit = Math.min(parseInteger(req.query.limit, 20), 50);
    const offset = (page - 1) * limit;
    const callType = req.query.type || 'voice';
    
    if (!(await isCallingEnabled())) {
      return res.json({
        success: true,
        enabled: false,
        users: []
      });
    }
    
    const voiceRate = parseFloat(await getCallSetting('voice_rate_per_minute', '5'));
    const videoRate = parseFloat(await getCallSetting('video_rate_per_minute', '10'));
    const rate = callType === 'video' ? videoRate : voiceRate;
    
    // Get available users with online status
    const result = await db.query(`
      SELECT 
        u.id as user_id,
        dp.first_name,
        dp.age,
        dp.location_city as location,
        dp.bio,
        dp.interests,
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
        -- Check if user is online (you'd need a real-time status system)
        FALSE as is_online
      FROM users u
      INNER JOIN dating_profiles dp ON dp.user_id = u.id
      WHERE dp.is_available_for_calls = TRUE
        AND u.id != $1
        AND COALESCE(dp.is_active, TRUE) = TRUE
      ORDER BY dp.call_rating DESC, dp.total_calls_taken DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    
    const users = result.rows.map(user => ({
      userId: user.user_id,
      name: user.first_name,
      age: user.age,
      location: user.location,
      bio: user.bio,
      interests: user.interests || [],
      photoUrl: user.photo_url,
      callRating: Number(user.call_rating) || 0,
      totalCalls: user.total_calls_taken || 0,
      isOnline: user.is_online,
      rates: {
        voice: voiceRate,
        video: videoRate
      }
    }));
    
    res.json({
      success: true,
      enabled: true,
      callType,
      ratePerMinute: rate,
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
        dp.location_city as location,
        dp.bio,
        dp.call_rating,
        dp.total_calls_taken,
        dp.total_call_minutes,
        dp.call_earnings,
        dp.is_available_for_calls,
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
    
    res.json({
      success: true,
      user: {
        userId: user.user_id,
        name: user.first_name,
        age: user.age,
        location: user.location,
        bio: user.bio,
        photoUrl: user.photo_url,
        callRating: Number(user.call_rating) || 0,
        totalCalls: user.total_calls_taken || 0,
        totalMinutes: user.total_call_minutes || 0,
        totalEarnings: Number(user.call_earnings) || 0,
        isAvailable: user.is_available_for_calls,
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
    
    // Check target is available
    const targetResult = await db.query(
      'SELECT is_available_for_calls FROM dating_profiles WHERE user_id = $1 AND COALESCE(is_active, TRUE) = TRUE',
      [targetUserId]
    );
    
    if (!targetResult.rows[0]?.is_available_for_calls) {
      return res.status(400).json({ error: 'User is not available for calls' });
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
    
    res.json({
      success: true,
      requestId,
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
        RETURNING session_id
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
