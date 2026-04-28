/**
 * Payment Routes
 * Endpoints for handling Razorpay payments and subscriptions
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const razorpayService = require('../services/razorpayService');

/**
 * GET /payments/plans
 * Get all available subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await razorpayService.getSubscriptionPlans();

    if (plans.length === 0) {
      return res.json({
        plans: [
          {
            id: 1,
            name: 'Premium Monthly',
            price: 99,
            duration_months: 1,
            description: 'Unlimited swipes, message before match, see who liked you',
            features: [
              'Unlimited swipes',
              'Message before matching',
              'See who liked you',
              'Advanced filters',
              'Premium badge',
              'Ad-free'
            ]
          },
          {
            id: 2,
            name: 'Premium Quarterly',
            price: 499,
            duration_months: 3,
            description: 'Save ₹200 with quarterly billing',
            features: [
              'Unlimited swipes',
              'Message before matching',
              'See who liked you',
              'Advanced filters',
              'Premium badge',
              'Ad-free',
              'Save 17%'
            ]
          },
          {
            id: 3,
            name: 'Premium Yearly',
            price: 999,
            duration_months: 12,
            description: 'Save ₹300 with yearly billing',
            features: [
              'Unlimited swipes',
              'Message before matching',
              'See who liked you',
              'Advanced filters',
              'Premium badge',
              'Ad-free',
              'Annual badge',
              'Save 33%'
            ]
          }
        ]
      });
    }

    res.json({
      plans: plans.map(p => ({
        ...p,
        features: [
          'Unlimited swipes',
          'Message before matching',
          'See who liked you',
          'Advanced filters',
          'Premium badge',
          'Ad-free'
        ]
      }))
    });
  } catch (error) {
    console.error('Error getting plans:', error);
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

/**
 * POST /payments/create-order
 * Create a Razorpay order for payment
 * Body: { planId, planName, amount }
 */
router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const { planId, planName, amount } = req.body;
    const userId = req.user.id;

    if (!planId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid plan or amount' });
    }

    if (amount < 99 || amount > 50000) {
      return res.status(400).json({ error: 'Amount out of acceptable range' });
    }

    // Create order with Razorpay
    const order = await razorpayService.createOrder(userId, planId, amount, planName);

    res.json({
      success: true,
      orderId: order.orderId,
      amount: order.amount,
      currency: order.currency,
      keyId: order.keyId,
      planId: order.notes.plan_id,
      planName: order.notes.plan_name
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      error: 'Failed to create payment order',
      details: error.message
    });
  }
});

/**
 * POST /payments/verify
 * Verify payment and create subscription
 * Body: { orderId, paymentId, signature, planId, amount }
 */
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { orderId, paymentId, signature, planId, amount } = req.body;
    const userId = req.user.id;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing payment verification data' });
    }

    // Verify payment with Razorpay
    const result = await razorpayService.processPayment(
      userId,
      orderId,
      paymentId,
      signature,
      planId
    );

    if (result.success) {
      // Get updated subscription info
      const subscription = await razorpayService.getUserSubscription(userId);

      res.json({
        success: true,
        message: 'Payment verified and subscription activated',
        subscription: {
          planName: subscription.name,
          planPrice: subscription.price,
          endDate: subscription.end_date,
          renewalDate: subscription.renewal_date,
          autoRenew: subscription.auto_renew
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(400).json({
      error: 'Payment verification failed',
      details: error.message
    });
  }
});

/**
 * GET /payments/status/:paymentId
 * Get payment status
 */
router.get('/status/:paymentId', authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    // Verify payment belongs to user
    const paymentResult = await db.query(
      `SELECT * FROM payments WHERE id = $1 AND user_id = $2`,
      [paymentId, userId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const status = await razorpayService.getPaymentStatus(paymentId);
    res.json(status);
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

/**
 * GET /payments/subscription
 * Get user's current subscription
 */
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const subscription = await razorpayService.getUserSubscription(userId);

    if (!subscription) {
      return res.json({
        active: false,
        message: 'No active subscription'
      });
    }

    res.json({
      active: true,
      subscription: {
        id: subscription.id,
        planName: subscription.name,
        planPrice: subscription.price,
        durationMonths: subscription.duration_months,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        renewalDate: subscription.renewal_date,
        autoRenew: subscription.auto_renew,
        daysRemaining: Math.ceil(
          (new Date(subscription.end_date) - new Date()) / (1000 * 60 * 60 * 24)
        )
      }
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

/**
 * POST /payments/cancel-subscription
 * Cancel user's subscription
 */
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await razorpayService.cancelSubscription(userId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Subscription cancelled',
        details: 'Your access will end on the current billing date'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * POST /payments/webhook
 * Handle Razorpay webhook events
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.rawBody || JSON.stringify(req.body);

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('⚠️ Razorpay webhook secret not configured');
      return res.status(200).json({ message: 'Webhook acknowledged' });
    }

    const result = await razorpayService.handleWebhook(webhookSecret, body, signature);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error handling webhook:', error);
    // Always return 200 to acknowledge webhook received
    res.status(200).json({ message: 'Webhook acknowledged' });
  }
});

/**
 * POST /payments/refund
 * Request refund for a payment
 * Body: { paymentId, reason, amount? }
 */
router.post('/refund', authenticateToken, async (req, res) => {
  try {
    const { paymentId, reason, amount } = req.body;
    const userId = req.user.id;

    // Verify payment belongs to user
    const paymentResult = await db.query(
      `SELECT * FROM payments WHERE id = $1 AND user_id = $2`,
      [paymentId, userId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];

    // Check if payment was completed
    if (payment.status !== 'completed') {
      return res.status(400).json({ error: 'Can only refund completed payments' });
    }

    // Check 48-hour window for full refund
    const hoursAgo = (new Date() - new Date(payment.created_at)) / (1000 * 60 * 60);
    const canFullRefund = hoursAgo <= 48;

    if (!canFullRefund && !amount) {
      return res.status(400).json({
        error: 'Full refund window (48 hours) has expired',
        message: 'Contact support for partial refund requests'
      });
    }

    // Process refund
    const refundResult = await razorpayService.refundPayment(paymentId, amount);

    // Log refund request
    await db.query(
      `INSERT INTO refund_requests (payment_id, user_id, reason, refund_id, amount, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [paymentId, userId, reason, refundResult.refundId, amount || payment.amount, 'processed']
    );

    res.json({
      success: true,
      message: 'Refund processed',
      refund: refundResult
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

/**
 * GET /payments/receipts
 * Get user's payment receipts
 */
router.get('/receipts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, amount, status, razorpay_payment_id, created_at, verified_at
       FROM payments
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    res.json({
      receipts: result.rows.map(r => ({
        id: r.id,
        amount: r.amount,
        status: r.status,
        paymentId: r.razorpay_payment_id,
        date: r.created_at,
        verifiedDate: r.verified_at
      }))
    });
  } catch (error) {
    console.error('Error getting receipts:', error);
    res.status(500).json({ error: 'Failed to get receipts' });
  }
});

module.exports = router;
