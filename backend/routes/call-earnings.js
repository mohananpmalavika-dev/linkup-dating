/**
 * Call Earnings Routes - Earner dashboard & payout requests
 */

const express = require('express');
const db = require('../config/database');

const router = express.Router();

const parseInteger = (value, fallback = null) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

// Get call settings
const getCallSetting = async (key, defaultValue = null) => {
  const result = await db.query(
    'SELECT value FROM call_settings WHERE key = $1',
    [key]
  );
  return result.rows[0]?.value ?? defaultValue;
};

// Get earnings summary for user
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get profile earnings data
    const profileResult = await db.query(
      'SELECT call_earnings, pending_payout FROM dating_profiles WHERE user_id = $1',
      [userId]
    );
    
    const profile = profileResult.rows[0] || {};
    const totalEarnings = Number(profile.call_earnings) || 0;
    const pendingPayout = Number(profile.pending_payout) || 0;
    const availableBalance = totalEarnings - pendingPayout;
    
    // Get recent earnings
    const earningsResult = await db.query(`
      SELECT SUM(amount) as total 
      FROM call_earnings 
      WHERE user_id = $1 AND type = 'earned' AND status = 'completed'
    `, [userId]);
    
    // Get pending payouts
    const pendingResult = await db.query(`
      SELECT SUM(amount) as total 
      FROM call_payouts 
      WHERE user_id = $1 AND status IN ('pending', 'processing')
    `, [userId]);
    
    const payoutPercentage = parseFloat(await getCallSetting('earner_payout_percent', '70'));
    const minPayout = parseFloat(await getCallSetting('min_payout_amount', '500'));
    
    res.json({
      success: true,
      earnings: {
        totalEarned: totalEarnings,
        pendingPayout,
        availableBalance,
        currency: 'INR'
      },
      payoutSettings: {
        percentage: payoutPercentage,
        minAmount: minPayout
      },
      pendingPayoutRequests: parseFloat(pendingResult.rows[0]?.total || 0)
    });
  } catch (error) {
    console.error('Get earnings summary error:', error);
    res.status(500).json({ error: 'Failed to get earnings summary' });
  }
});

// Get call history
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInteger(req.query.limit, 20), 50);
    const offset = parseInteger(req.query.offset, 0);
    
    // Get sessions where user was receiver
    const result = await db.query(`
      SELECT 
        cs.id,
        cs.session_id,
        cs.call_type,
        cs.start_time,
        cs.end_time,
        cs.duration_seconds,
        cs.rate_per_minute,
        cs.total_cost,
        cs.status,
        caller_profile.first_name as caller_name,
        (
          SELECT photo_url 
          FROM profile_photos 
          WHERE user_id = cs.caller_id 
          ORDER BY is_primary DESC 
          LIMIT 1
        ) as caller_photo
      FROM call_sessions cs
      LEFT JOIN dating_profiles caller_profile ON caller_profile.user_id = cs.caller_id
      WHERE cs.receiver_id = $1
        AND cs.status IN ('completed', 'declined', 'no_answer')
      ORDER BY cs.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    
    const sessions = result.rows.map(session => ({
      sessionId: session.session_id,
      callType: session.call_type,
      callerName: session.caller_name,
      callerPhoto: session.caller_photo,
      duration: session.duration_seconds || 0,
      ratePerMinute: Number(session.rate_per_minute) || 0,
      earned: Number(session.total_cost) || 0,
      status: session.status,
      date: session.start_time
    }));
    
    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ error: 'Failed to get call history' });
  }
});

// Set availability status
router.post('/availability', async (req, res) => {
  try {
    const userId = req.user.id;
    const { available } = req.body;
    
    const isAvailable = available === true || available === 'true';
    
    await db.query(
      'UPDATE dating_profiles SET is_available_for_calls = $1 WHERE user_id = $2',
      [isAvailable, userId]
    );
    
    res.json({
      success: true,
      isAvailable
    });
  } catch (error) {
    console.error('Set availability error:', error);
    res.status(500).json({ error: 'Failed to set availability' });
  }
});

// Get current availability status
router.get('/availability', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await db.query(
      'SELECT is_available_for_calls FROM dating_profiles WHERE user_id = $1',
      [userId]
    );
    
    res.json({
      success: true,
      isAvailable: result.rows[0]?.is_available_for_calls || false
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ error: 'Failed to get availability' });
  }
});

// Request payout
router.post('/payout', async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, method, upiId, bankAccount, bankIfsc } = req.body;
    
    const payoutAmount = parseFloat(amount);
    const minPayout = parseFloat(await getCallSetting('min_payout_amount', '500'));
    
    if (!payoutAmount || payoutAmount < minPayout) {
      return res.status(400).json({ 
        error: `Minimum payout amount is ₹${minPayout}` 
      });
    }
    
    // Get available balance
    const profileResult = await db.query(
      'SELECT call_earnings, pending_payout FROM dating_profiles WHERE user_id = $1',
      [userId]
    );
    
    const profile = profileResult.rows[0] || {};
    const totalEarnings = Number(profile.call_earnings) || 0;
    const pendingPayout = Number(profile.pending_payout) || 0;
    const availableBalance = totalEarnings - pendingPayout;
    
    if (payoutAmount > availableBalance) {
      return res.status(400).json({ 
        error: 'Insufficient earnings balance',
        available: availableBalance
      });
    }
    
    // Create payout request
    const payoutResult = await db.query(`
      INSERT INTO call_payouts (user_id, amount, method, upi_id, bank_account, bank_ifsc, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING id
    `, [userId, payoutAmount, method || 'upi', upiId || null, bankAccount || null, bankIfsc || null]);
    
    // Update pending payout
    await db.query(
      'UPDATE dating_profiles SET pending_payout = pending_payout + $1 WHERE user_id = $2',
      [payoutAmount, userId]
    );
    
    res.json({
      success: true,
      payoutId: payoutResult.rows[0].id,
      amount: payoutAmount,
      method: method || 'upi'
    });
  } catch (error) {
    console.error('Payout request error:', error);
    res.status(500).json({ error: 'Failed to request payout' });
  }
});

// Get payout history
router.get('/payouts', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInteger(req.query.limit, 20), 50);
    
    const result = await db.query(`
      SELECT * FROM call_payouts
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, limit]);
    
    const payouts = result.rows.map(payout => ({
      id: payout.id,
      amount: Number(payout.amount),
      method: payout.method,
      status: payout.status,
      failureReason: payout.failure_reason,
      createdAt: payout.created_at,
      processedAt: payout.processed_at
    }));
    
    res.json({
      success: true,
      payouts
    });
  } catch (error) {
    console.error('Get payout history error:', error);
    res.status(500).json({ error: 'Failed to get payout history' });
  }
});

// Update call session with actual earnings (called when call ends)
router.post('/session/:sessionId/complete', async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = req.params.sessionId;
    const { durationSeconds, totalCost, callType } = req.body;
    
    const duration = parseInteger(durationSeconds, 0);
    const cost = parseFloat(totalCost);
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    // Get session
    const sessionResult = await db.query(
      'SELECT * FROM call_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = sessionResult.rows[0];
    const receiverId = session.receiver_id;
    const callerId = session.caller_id;
    
    // Calculate earnings (receiver gets % of total)
    const payoutPercent = parseFloat(await getCallSetting('earner_payout_percent', '70'));
    const earnings = (cost * payoutPercent) / 100;
    
    // Update session
    await db.query(`
      UPDATE call_sessions 
      SET end_time = CURRENT_TIMESTAMP,
          duration_seconds = $1,
          total_cost = $2,
          status = 'completed',
          ended_at = CURRENT_TIMESTAMP
      WHERE session_id = $3
    `, [duration, cost, sessionId]);
    
    // Add earnings to receiver
    await db.query(`
      UPDATE dating_profiles 
      SET call_earnings = call_earnings + $1,
          total_calls_taken = total_calls_taken + 1,
          total_call_minutes = total_call_minutes + $2
      WHERE user_id = $3
    `, [earnings, Math.floor(duration / 60), receiverId]);
    
    // Record earnings transaction
    await db.query(`
      INSERT INTO call_earnings (user_id, call_session_id, amount, type, status)
      VALUES ($1, $2, $3, 'earned', 'completed')
    `, [receiverId, session.id, earnings]);
    
    // Refund remaining credits to caller
    const voiceRate = parseFloat(await getCallSetting('voice_rate_per_minute', '5'));
    const ratePerMin = callType === 'video' 
      ? parseFloat(await getCallSetting('video_rate_per_minute', '10'))
      : voiceRate;
    const estimatedCost = ratePerMin * 5; // 5 min pre-authorized
    const refundAmount = estimatedCost - cost;
    
    if (refundAmount > 0) {
      await db.query(`
        UPDATE call_credits 
        SET credits_balance = credits_balance + $1
        WHERE user_id = $2
      `, [refundAmount, callerId]);
      
      await db.query(`
        INSERT INTO call_earnings (user_id, call_session_id, amount, type, status)
        VALUES ($1, $2, $3, 'refund', 'completed')
      `, [callerId, session.id, refundAmount]);
    }
    
    res.json({
      success: true,
      earnings,
      duration,
      cost,
      refunded: refundAmount
    });
  } catch (error) {
    console.error('Complete call session error:', error);
    res.status(500).json({ error: 'Failed to complete call session' });
  }
});

module.exports = router;
