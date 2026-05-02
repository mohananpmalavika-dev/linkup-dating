/**
 * Call Wallet Routes - Credits purchase & balance management
 */

const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const db = require('../config/database');

const router = express.Router();

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret'
});

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
    
    console.log('Purchase initiate - userId:', userId, 'packageId:', packageId);
    
    if (packageId === null) {
      return res.status(400).json({ error: 'Invalid or missing package ID' });
    }

    const pkg = CREDIT_PACKAGES.find((creditPackage) => creditPackage.id === packageId);
    if (!pkg) {
      return res.status(400).json({ error: 'Invalid package' });
    }

    const totalCredits = Number(pkg.credits) + Number(pkg.bonus || 0);
    const amountInPaise = pkg.price * 100; // Razorpay expects amount in paise

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `call_credits_${userId}_${Date.now()}`,
      notes: {
        userId,
        packageId,
        baseCredits: pkg.credits,
        bonusCredits: pkg.bonus,
        totalCredits,
        packageName: pkg.label
      }
    });

    const orderId = razorpayOrder.id;

    // Store pending purchase in database
    await db.query(
      `INSERT INTO call_earnings (user_id, amount, type, status, reference_id, created_at)
       VALUES ($1, $2, 'credit_purchase', 'pending', $3, NOW())`,
      [userId, pkg.price, orderId]
    );
    
    console.log('Razorpay order created:', orderId, 'Amount:', pkg.price);

    res.json({
      success: true,
      orderId,
      amount: pkg.price,
      credits: totalCredits,
      baseCredits: pkg.credits,
      bonusCredits: pkg.bonus,
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_key'
    });
  } catch (error) {
    console.error('Purchase initiate error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate purchase', 
      details: error.message 
    });
  }
});

// Verify payment and add credits
router.post('/purchase/verify', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userId = req.user.id;
    const { orderId, paymentId, signatureId, credits } = req.body;
    
    if (!orderId || !paymentId || !credits) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const creditsAmount = parseInteger(credits);
    if (!creditsAmount || creditsAmount < 10) {
      return res.status(400).json({ error: 'Invalid credits amount' });
    }

    try {
      // Verify payment signature
      const sign = `${orderId}|${paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret')
        .update(sign)
        .digest('hex');

      // Verify signature (if provided)
      if (signatureId && signatureId !== expectedSignature) {
        console.warn('Signature verification failed for payment:', paymentId);
        return res.status(400).json({ error: 'Payment signature verification failed' });
      }

      // Get payment details from Razorpay
      const payment = await razorpay.payments.fetch(paymentId);
      
      if (payment.status !== 'captured') {
        return res.status(400).json({ 
          error: 'Payment not captured', 
          status: payment.status 
        });
      }

      // Get the package info from order notes
      const order = await razorpay.orders.fetch(orderId);
      const packageInfo = order.notes || {};

      // Get or create wallet
      const wallet = await getOrCreateWallet(userId);
      const newBalance = Number(wallet.credits_balance) + creditsAmount;
      const newPurchased = Number(wallet.total_purchased) + creditsAmount;
      
      // Update wallet balance
      await db.query(
        `UPDATE call_credits 
         SET credits_balance = $2, total_purchased = $3, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId, newBalance, newPurchased]
      );
      
      // Update earning record with payment details
      await db.query(
        `UPDATE call_earnings 
         SET status = 'completed', reference_id = $1
         WHERE reference_id = $2 AND user_id = $3 AND type = 'credit_purchase'`,
        [paymentId, orderId, userId]
      );

      // Log the transaction
      console.log('Payment verified and credits added:', {
        userId,
        orderId,
        paymentId,
        creditsAdded: creditsAmount,
        newBalance
      });
      
      res.json({
        success: true,
        balance: newBalance,
        creditsAdded: creditsAmount,
        message: `${creditsAmount} credits added to your account!`
      });
    } catch (razorpayError) {
      console.error('Razorpay verification error:', razorpayError.message);
      return res.status(400).json({ 
        error: 'Could not verify payment with Razorpay', 
        details: razorpayError.message 
      });
    }
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
