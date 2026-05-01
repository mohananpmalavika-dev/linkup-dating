/**
 * Call Wallet Routes - Credits purchase & balance management
 */

const express = require('express');
const db = require('../config/database');

const router = express.Router();

const CREDIT_PACKAGES = [
  { id: 1, credits: 50, price: 50, bonus: 0, label: 'Starter' },
  { id: 2, credits: 100, price: 95, bonus: 5, label: 'Basic' },
  { id: 3, credits: 250, price: 225, bonus: 25, label: 'Popular' },
  { id: 4, credits: 500, price: 425, bonus: 75, label: 'Pro' },
  { id: 5, credits: 1000, price: 800, bonus: 200, label: 'Premium' }
];

const parseInteger = (value, fallback = null) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
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

// Get call settings
const getCallSetting = async (key, defaultValue = null) => {
  const result = await db.query(
    'SELECT value FROM call_settings WHERE key = $1',
    [key]
  );
  return result.rows[0]?.value ?? defaultValue;
};

// Get or create user's wallet
const getOrCreateWallet = async (userId) => {
  let result = await db.query(
    'SELECT * FROM call_credits WHERE user_id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    result = await db.query(
      'INSERT INTO call_credits (user_id, credits_balance) VALUES ($1, 0) RETURNING *',
      [userId]
    );
  }
  
  return result.rows[0];
};

// Get wallet balance
router.get('/balance', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userId = req.user.id;
    const wallet = await getOrCreateWallet(userId);
    
    res.json({
      success: true,
      balance: wallet.credits_balance,
      totalSpent: wallet.total_spent,
      totalPurchased: wallet.total_purchased
    });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    res.status(500).json({ error: 'Failed to get balance', details: error.message });
  }
});

// Get purchase packages
router.get('/packages', async (req, res) => {
  try {
    const minPurchase = await getCallSetting('min_credits_purchase', '50');
    const enabled = await getCallSetting('calling_enabled', 'true');
    
    res.json({
      success: true,
      enabled: enabled === 'true',
      packages: CREDIT_PACKAGES,
      minPurchase: parseInteger(minPurchase, 50)
    });
  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({ error: 'Failed to get packages' });
  }
});

// Initialize Razorpay order for credit purchase
router.post('/purchase/initiate', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userId = req.user.id;
    const packageId = parseInteger(req.body.packageId);
    
    console.log('Purchase initiate - userId:', userId, 'packageId:', packageId, 'body:', req.body);
    
    if (packageId === null) {
      return res.status(400).json({ error: 'Invalid or missing package ID' });
    }

    const pkg = CREDIT_PACKAGES.find((creditPackage) => creditPackage.id === packageId);
    if (!pkg) {
      return res.status(400).json({ error: 'Invalid package' });
    }

    const totalCredits = Number(pkg.credits) + Number(pkg.bonus || 0);
    
    // In production, create Razorpay order here
    // For now, simulate with order ID
    const orderId = `order_${Date.now()}_${userId}`;
    
    // Store pending purchase
    await db.query(
      `INSERT INTO call_earnings (user_id, amount, type, status, reference_id)
       VALUES ($1, $2, 'credit_purchase', 'pending', $3)`,
      [userId, pkg.price, orderId]
    );
    
    res.json({
      success: true,
      orderId,
      amount: pkg.price,
      credits: totalCredits,
      baseCredits: pkg.credits,
      bonusCredits: pkg.bonus,
      // In production, add Razorpay public key here
      key: 'razorpay_key'
    });
  } catch (error) {
    console.error('Purchase initiate error:', error);
    res.status(500).json({ error: 'Failed to initiate purchase', details: error.message });
  }
});

// Verify payment and add credits
router.post('/purchase/verify', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userId = req.user.id;
    const { orderId, paymentId, credits } = req.body;
    
    if (!orderId || !paymentId || !credits) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const creditsAmount = parseInteger(credits);
    if (!creditsAmount || creditsAmount < 10) {
      return res.status(400).json({ error: 'Invalid credits amount' });
    }
    
    // Update wallet balance
    const wallet = await getOrCreateWallet(userId);
    const newBalance = Number(wallet.credits_balance) + creditsAmount;
    const newPurchased = Number(wallet.total_purchased) + creditsAmount;
    
    await db.query(
      `UPDATE call_credits 
       SET credits_balance = $2, total_purchased = $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId, newBalance, newPurchased]
    );
    
    // Update earning record
    await db.query(
      `UPDATE call_earnings 
       SET status = 'completed'
       WHERE reference_id = $1 AND user_id = $2 AND type = 'credit_purchase'`,
      [orderId, userId]
    );
    
    res.json({
      success: true,
      balance: newBalance,
      creditsAdded: creditsAmount
    });
  } catch (error) {
    console.error('Purchase verify error:', error);
    res.status(500).json({ error: 'Failed to verify payment', details: error.message });
  }
});

// Deduct credits for call (called when call starts)
router.post('/deduct', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userId = req.user.id;
    const { sessionId, estimatedMinutes } = req.body;
    
    const voiceRate = await getCallSetting('voice_rate_per_minute', '5');
    const videoRate = await getCallSetting('video_rate_per_minute', '10');
    
    // Determine rate based on call type
    // This would typically be passed in req.body
    const callType = req.body.callType || 'voice';
    const ratePerMin = callType === 'video' ? parseFloat(videoRate) : parseFloat(voiceRate);
    
    const estimatedCost = (estimatedMinutes || 5) * ratePerMin;
    
    const wallet = await getOrCreateWallet(userId);
    
    if (Number(wallet.credits_balance) < estimatedCost) {
      return res.status(400).json({ 
        error: 'Insufficient credits',
        balance: wallet.credits_balance,
        required: estimatedCost
      });
    }
    
    // Reserve credits (in real implementation, track actual usage after call)
    const newBalance = Number(wallet.credits_balance) - estimatedCost;
    
    await db.query(
      `UPDATE call_credits 
       SET credits_balance = $2, total_spent = total_spent + $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId, newBalance, estimatedCost]
    );
    
    res.json({
      success: true,
      reserved: estimatedCost,
      balance: newBalance
    });
  } catch (error) {
    console.error('Deduct credits error:', error);
    res.status(500).json({ error: 'Failed to deduct credits', details: error.message });
  }
});

// Refund unused credits after call ends
router.post('/refund', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userId = req.user.id;
    const { sessionId, actualDurationSeconds, totalCharged } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    // Get session to find actual cost
    const sessionResult = await db.query(
      'SELECT * FROM call_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = sessionResult.rows[0];
    const actualCost = Number(session.total_cost) || 0;
    const charged = Number(totalCharged) || 0;
    
    // Refund difference
    const refundAmount = charged - actualCost;
    
    if (refundAmount > 0) {
      const wallet = await getOrCreateWallet(userId);
      const newBalance = Number(wallet.credits_balance) + refundAmount;
      
      await db.query(
        `UPDATE call_credits 
         SET credits_balance = $2, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId, newBalance]
      );
      
      // Record refund in earnings
      await db.query(
        `INSERT INTO call_earnings (user_id, call_session_id, amount, type, status)
         VALUES ($1, $2, $3, 'refund', 'completed')`,
        [userId, session.id, refundAmount]
      );
    }
    
    res.json({
      success: true,
      refunded: refundAmount
    });
  } catch (error) {
    console.error('Refund credits error:', error);
    res.status(500).json({ error: 'Failed to process refund', details: error.message });
  }
});

module.exports = router;
