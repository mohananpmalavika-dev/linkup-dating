/**
 * Razorpay Payment Service
 * Handles all payment processing for LinkUp premium subscriptions
 * Supports: order creation, payment verification, webhooks, refunds
 */

const crypto = require('crypto');
const axios = require('axios');
const db = require('../config/database');

class RazorpayService {
  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID;
    this.keySecret = process.env.RAZORPAY_KEY_SECRET;
    this.baseUrl = 'https://api.razorpay.com/v1';

    if (!this.keyId || !this.keySecret) {
      console.warn('⚠️ Razorpay credentials not configured. Payment features will not work.');
    }
  }

  /**
   * Create a payment order in Razorpay
   */
  async createOrder(userId, planId, amount, planName) {
    try {
      if (!this.keyId || !this.keySecret) {
        throw new Error('Razorpay credentials not configured');
      }

      const orderData = {
        amount: Math.round(amount * 100), // Convert to paise
        currency: 'INR',
        receipt: `${userId}-${planId}-${Date.now()}`,
        payment_capture: 1, // Auto-capture payment
        notes: {
          user_id: userId,
          plan_id: planId,
          plan_name: planName
        }
      };

      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

      const response = await axios.post(`${this.baseUrl}/orders`, orderData, {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      // Store order in database
      const result = await db.query(
        `INSERT INTO payments (user_id, razorpay_order_id, plan_id, amount, status, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         RETURNING id, razorpay_order_id, amount, created_at`,
        [userId, response.data.id, planId, amount, 'pending']
      );

      return {
        success: true,
        orderId: response.data.id,
        amount: amount,
        currency: 'INR',
        keyId: this.keyId,
        paymentId: result.rows[0].id,
        notes: {
          user_id: userId,
          plan_id: planId
        }
      };
    } catch (error) {
      console.error('Error creating Razorpay order:', error.message);
      throw error;
    }
  }

  /**
   * Verify payment signature
   * This is crucial for security - verify that payment was actually authorized by Razorpay
   */
  verifyPaymentSignature(orderId, paymentId, signature) {
    try {
      const message = `${orderId}|${paymentId}`;
      const generatedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(message)
        .digest('hex');

      return generatedSignature === signature;
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }

  /**
   * Process successful payment
   */
  async processPayment(userId, orderId, paymentId, signature, planId, discountCode, isUpgrade) {
    try {
      // Verify signature
      if (!this.verifyPaymentSignature(orderId, paymentId, signature)) {
        throw new Error('Invalid payment signature');
      }

      // Get payment from database
      const paymentResult = await db.query(
        `SELECT * FROM payments
         WHERE razorpay_order_id = $1 AND user_id = $2`,
        [orderId, userId]
      );

      if (paymentResult.rows.length === 0) {
        throw new Error('Payment record not found');
      }

      const payment = paymentResult.rows[0];

      // Get plan details
      const planResult = await db.query(
        `SELECT * FROM subscription_plans WHERE id = $1`,
        [planId || payment.plan_id]
      );

      if (planResult.rows.length === 0) {
        throw new Error('Plan not found');
      }

      const plan = planResult.rows[0];
      const client = await db.connect();

      try {
        await client.query('BEGIN');

        // Update payment record
        await client.query(
          `UPDATE payments
           SET status = $1, razorpay_payment_id = $2, verified_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          ['completed', paymentId, payment.id]
        );

        // Create or update subscription
        const subscriptionEnd = new Date();
        if (plan.duration_months) {
          subscriptionEnd.setMonth(subscriptionEnd.getMonth() + plan.duration_months);
        }

        const existingSubscription = await client.query(
          `SELECT id FROM subscriptions
           WHERE user_id = $1 AND status = 'active'`,
          [userId]
        );

        if (existingSubscription.rows.length > 0) {
          // Update existing subscription
          await client.query(
            `UPDATE subscriptions
             SET plan_id = $1, end_date = $2, renewal_date = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [planId || payment.plan_id, subscriptionEnd, existingSubscription.rows[0].id]
          );
        } else {
          // Create new subscription
          await client.query(
            `INSERT INTO subscriptions (user_id, plan_id, start_date, end_date, renewal_date, status, auto_renew, created_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $3, 'active', TRUE, CURRENT_TIMESTAMP)`,
            [userId, planId || payment.plan_id, subscriptionEnd]
          );
        }

        // Update user profile to mark as premium
        await client.query(
          `UPDATE dating_profiles
           SET is_premium = TRUE, premium_until = $1, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2`,
          [subscriptionEnd, userId]
        );

        // Track analytics
        await client.query(
          `INSERT INTO user_analytics (user_id, event_type, event_data, created_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [userId, 'premium_subscription', JSON.stringify({ 
            plan_id: planId, 
            amount: payment.amount,
            discount_code: discountCode || null,
            is_upgrade: isUpgrade || false
          })]
        );

        await client.query('COMMIT');

        return {
          success: true,
          message: 'Payment processed successfully',
          subscriptionEnd,
          planName: plan.name,
          planPrice: plan.price
        };
      } catch (txError) {
        await client.query('ROLLBACK');
        throw txError;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  }

  /**
   * Handle Razorpay webhook
   */
  async handleWebhook(webhookSecret, body, signature) {
    try {
      // Verify webhook signature
      const generatedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      if (generatedSignature !== signature) {
        throw new Error('Invalid webhook signature');
      }

      const event = JSON.parse(body);
      console.log(`📨 Razorpay Webhook: ${event.event}`);

      switch (event.event) {
        case 'payment.authorized':
          return await this.handlePaymentAuthorized(event.payload.payment.entity);

        case 'payment.failed':
          return await this.handlePaymentFailed(event.payload.payment.entity);

        case 'refund.created':
          return await this.handleRefund(event.payload.refund.entity);

        case 'subscription.authenticated':
          return await this.handleSubscriptionAuthenticated(event.payload.subscription.entity);

        case 'subscription.charged':
          return await this.handleSubscriptionCharged(event.payload.subscription.entity);

        case 'subscription.completed':
          return await this.handleSubscriptionCompleted(event.payload.subscription.entity);

        case 'subscription.halted':
          return await this.handleSubscriptionHalted(event.payload.subscription.entity);

        default:
          console.log(`⚠️ Unhandled webhook event: ${event.event}`);
          return { success: true, message: 'Event acknowledged' };
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  async handlePaymentAuthorized(payment) {
    const result = await db.query(
      `UPDATE payments
       SET status = $1, razorpay_payment_id = $2, verified_at = CURRENT_TIMESTAMP
       WHERE razorpay_order_id = $3
       RETURNING user_id, plan_id`,
      ['authorized', payment.id, payment.order_id]
    );

    if (result.rows.length > 0) {
      console.log(`✅ Payment authorized for user: ${result.rows[0].user_id}`);
    }

    return { success: true };
  }

  async handlePaymentFailed(payment) {
    await db.query(
      `UPDATE payments
       SET status = $1, failed_reason = $2, updated_at = CURRENT_TIMESTAMP
       WHERE razorpay_order_id = $3`,
      ['failed', payment.description, payment.order_id]
    );

    console.log(`❌ Payment failed: ${payment.description}`);
    return { success: true };
  }

  async handleRefund(refund) {
    const result = await db.query(
      `UPDATE payments
       SET status = $1, refund_id = $2, refunded_amount = $3, updated_at = CURRENT_TIMESTAMP
       WHERE razorpay_payment_id = $4
       RETURNING user_id`,
      ['refunded', refund.id, refund.amount / 100, refund.payment_id]
    );

    if (result.rows.length > 0) {
      console.log(`💰 Refund processed for user: ${result.rows[0].user_id}`);
    }

    return { success: true };
  }

  async handleSubscriptionAuthenticated(subscription) {
    console.log(`🔒 Subscription authenticated: ${subscription.id}`);
    return { success: true };
  }

  async handleSubscriptionCharged(subscription) {
    console.log(`💳 Subscription charged: ${subscription.id}`);
    return { success: true };
  }

  async handleSubscriptionCompleted(subscription) {
    console.log(`✅ Subscription completed: ${subscription.id}`);
    return { success: true };
  }

  async handleSubscriptionHalted(subscription) {
    console.log(`⏸️ Subscription halted: ${subscription.id}`);
    return { success: true };
  }

  /**
   * Process refund
   */
  async refundPayment(paymentId, amount = null) {
    try {
      const paymentResult = await db.query(
        `SELECT * FROM payments WHERE id = $1`,
        [paymentId]
      );

      if (paymentResult.rows.length === 0) {
        throw new Error('Payment not found');
      }

      const payment = paymentResult.rows[0];
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

      const refundData = {
        amount: amount ? Math.round(amount * 100) : undefined,
        notes: {
          payment_id: paymentId,
          user_id: payment.user_id,
          reason: 'User requested refund'
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/payments/${payment.razorpay_payment_id}/refund`,
        refundData,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Update database
      await db.query(
        `UPDATE payments
         SET status = $1, refund_id = $2, refunded_amount = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        ['refunded', response.data.id, (amount || payment.amount), paymentId]
      );

      return {
        success: true,
        refundId: response.data.id,
        amount: amount || payment.amount,
        status: response.data.status
      };
    } catch (error) {
      console.error('Error refunding payment:', error.message);
      throw error;
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId) {
    try {
      const result = await db.query(
        `SELECT * FROM payments WHERE id = $1`,
        [paymentId]
      );

      if (result.rows.length === 0) {
        return { status: 'not_found' };
      }

      const payment = result.rows[0];

      return {
        id: payment.id,
        status: payment.status,
        orderId: payment.razorpay_order_id,
        paymentId: payment.razorpay_payment_id,
        amount: payment.amount,
        createdAt: payment.created_at,
        verifiedAt: payment.verified_at,
        failedReason: payment.failed_reason
      };
    } catch (error) {
      console.error('Error getting payment status:', error);
      throw error;
    }
  }

  /**
   * Create subscription plan
   */
  async createSubscriptionPlan(planData) {
    try {
      const { name, price, durationMonths, description } = planData;

      const result = await db.query(
        `INSERT INTO subscription_plans (name, price, duration_months, description, active, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         RETURNING *`,
        [name, price, durationMonths, description, true]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating subscription plan:', error);
      throw error;
    }
  }

  /**
   * Get all active subscription plans
   */
  async getSubscriptionPlans() {
    try {
      const result = await db.query(
        `SELECT * FROM subscription_plans WHERE active = TRUE ORDER BY price ASC`
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting subscription plans:', error);
      throw error;
    }
  }

  /**
   * Get user's active subscription
   */
  async getUserSubscription(userId) {
    try {
      const result = await db.query(
        `SELECT s.*, sp.name, sp.price, sp.duration_months
         FROM subscriptions s
         JOIN subscription_plans sp ON s.plan_id = sp.id
         WHERE s.user_id = $1 AND s.status = 'active' AND s.end_date > CURRENT_TIMESTAMP
         ORDER BY s.start_date DESC
         LIMIT 1`,
        [userId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      return null;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId) {
    try {
      const result = await db.query(
        `UPDATE subscriptions
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND status = 'active'
         RETURNING id, user_id, end_date`,
        ['cancelled', userId]
      );

      if (result.rows.length > 0) {
        // Update user profile
        await db.query(
          `UPDATE dating_profiles
           SET is_premium = FALSE, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1`,
          [userId]
        );

        console.log(`❌ Subscription cancelled for user: ${userId}`);
        return { success: true, message: 'Subscription cancelled' };
      }

      return { success: false, message: 'No active subscription found' };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  }
}

module.exports = new RazorpayService();
