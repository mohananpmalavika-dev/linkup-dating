import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import './SubscriptionPage.css';

/**
 * SubscriptionPage Component
 * Display subscription plans and handle premium upgrades
 */
const SubscriptionPage = ({ user, onSubscriptionChange }) => {
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [receipts, setReceipts] = useState([]);

  useEffect(() => {
    fetchPlans();
    fetchCurrentSubscription();
    fetchReceipts();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await apiClient.get('/payments/plans');
      setPlans(response.data.plans || []);
    } catch (err) {
      setError('Failed to load plans');
      console.error(err);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const response = await apiClient.get('/payments/subscription');
      if (response.data.active) {
        setCurrentSubscription(response.data.subscription);
      }
    } catch (err) {
      console.error('No active subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReceipts = async () => {
    try {
      const response = await axios.get('/payments/receipts', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });piClient.get('/payments/receipts'atch (err) {
      console.error('Failed to fetch receipts:', err);
    }
  };

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setShowCheckout(true);
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose premium features.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(
        '/payments/cancel-subscription',
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      if (response.data.success) {
        setCurrentSubscription(null);
        alert('Subscription cancelled. Your access will end on the current billing date.');
        if (onSubscriptionChange) {
          onSubscriptionChange(false);
        }
      }
    } catch (err) {
      setError('Failed to cancel subscription');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !currentSubscription) {
    return <div className="subscription-container loading">Loading subscription info...</div>;
  }

  return (
    <div className="subscription-container">
      <div className="subscription-header">
        <h1>LinkUp Premium</h1>
        <p className="subtitle">Unlock unlimited dating possibilities</p>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {/* Current Subscription Info */}
      {currentSubscription && (
        <div className="current-subscription-card">
          <div className="subscription-status">
            <h2>Current Plan: {currentSubscription.planName}</h2>
            <div className="subscription-details">
              <div className="detail-row">
                <span className="detail-label">Price:</span>
                <span className="detail-value">₹{currentSubscription.planPrice}/month</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Valid Until:</span>
                <span className="detail-value">
                  {new Date(currentSubscription.endDate).toLocaleDateString('en-IN')}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Days Remaining:</span>
                <span className="detail-value status-active">
                  {currentSubscription.daysRemaining} days
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Auto-Renewal:</span>
                <span className={`detail-value ${currentSubscription.autoRenew ? 'status-active' : 'status-inactive'}`}>
                  {currentSubscription.autoRenew ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>
            </div>
          </div>

          <div className="subscription-actions">
            <button className="btn-upgrade" onClick={() => setShowCheckout(true)}>
              Upgrade Plan
            </button>
            <button className="btn-cancel" onClick={handleCancelSubscription}>
              Cancel Subscription
            </button>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      {!showCheckout && (
        <div className="plans-section">
          <h2>Choose Your Plan</h2>
          <div className="plans-grid">
            {plans.map(plan => (
              <div
                key={plan.id}
                className={`plan-card ${
                  currentSubscription?.planName === plan.name ? 'current' : ''
                } ${plan.id === 3 ? 'popular' : ''}`}
              >
                {plan.id === 3 && <div className="popular-badge">Most Popular</div>}

                <div className="plan-header">
                  <h3>{plan.name}</h3>
                  <div className="plan-price">
                    <span className="currency">₹</span>
                    <span className="amount">{plan.price}</span>
                    <span className="period">/month</span>
                  </div>
                  <p className="plan-description">{plan.description}</p>
                </div>

                <div className="plan-features">
                  <ul>
                    {plan.features?.map((feature, idx) => (
                      <li key={idx}>
                        <span className="checkmark">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="plan-action">
                  {currentSubscription?.planName === plan.name ? (
                    <button className="btn-current" disabled>
                      Current Plan
                    </button>
                  ) : (
                    <button
                      className="btn-select"
                      onClick={() => handleSelectPlan(plan)}
                    >
                      Select Plan
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checkout View */}
      {showCheckout && selectedPlan && (
        <CheckoutModal
          plan={selectedPlan}
          onClose={() => {
            setShowCheckout(false);
            setSelectedPlan(null);
          }}
          onSuccess={() => {
            setShowCheckout(false);
            setSelectedPlan(null);
            fetchCurrentSubscription();
            fetchReceipts();
            if (onSubscriptionChange) {
              onSubscriptionChange(true);
            }
          }}
        />
      )}

      {/* Payment History */}
      {receipts.length > 0 && (
        <div className="receipts-section">
          <h2>Payment History</h2>
          <div className="receipts-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment ID</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map(receipt => (
                  <tr key={receipt.id}>
                    <td>{new Date(receipt.date).toLocaleDateString('en-IN')}</td>
                    <td>₹{receipt.amount}</td>
                    <td>
                      <span className={`status-badge status-${receipt.status}`}>
                        {receipt.status}
                      </span>
                    </td>
                    <td className="payment-id">{receipt.paymentId || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FAQ */}
      <div className="faq-section">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-items">
          <div className="faq-item">
            <h4>Can I cancel my subscription anytime?</h4>
            <p>Yes! You can cancel your subscription anytime from the Subscription page. Your access will continue until your current billing period ends.</p>
          </div>
          <div className="faq-item">
            <h4>Is there a refund policy?</h4>
            <p>We offer full refunds within 48 hours of purchase. After 48 hours, refunds are at our discretion.</p>
          </div>
          <div className="faq-item">
            <h4>How do I update my payment method?</h4>
            <p>You can update your payment method by upgrading to a different plan. The new method will be used for future charges.</p>
          </div>
          <div className="faq-item">
            <h4>Do you offer discounts?</h4>
            <p>Yes! Our quarterly and yearly plans offer significant savings compared to monthly billing.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * CheckoutModal Component
 * Handles Razorpay payment processing
 */
const CheckoutModal = ({ plan, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      // Step 1: Create order
      const orderResponse = await axios.post(
        '/payments/create-order',
        {
          planId: plan.id,
          planName: plan.name,
          amount: plan.price
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      const { orderId, keyId } = orderResponse.data;

      // Step 2: Initialize Razorpay
      const options = {
        key: keyId,
        amount: Math.round(plan.price * 100), // in paise
        currency: 'INR',
        name: 'LinkUp Premium',
        description: `${plan.name} Subscription`,
        order_id: orderId,
        handler: async (response) => {
          // Step 3: Verify payment
          try {
            const verifyResponse = await axios.post(
              '/payments/verify',
              {
                orderId: orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                planId: plan.id,
                amount: plan.price
              },
              { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
            );

            if (verifyResponse.data.success) {
              alert('Payment successful! Your premium subscription is now active.');
              onSuccess();
            }
          } catch (verifyError) {
            setError('Payment verification failed. Please contact support.');
            console.error('Verification error:', verifyError);
          }
        },
        prefill: {
          email: localStorage.getItem('userEmail') || ''
        },
        theme: {
          color: '#667eea'
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          }
        }
      };

      // Open Razorpay checkout
      if (window.Razorpay) {
        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        setError('Payment gateway not loaded. Please refresh the page.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create payment order');
      console.error('Payment error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-modal-overlay" onClick={onClose}>
      <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="checkout-header">
          <h2>Complete Your Purchase</h2>
        </div>

        <div className="checkout-summary">
          <div className="summary-row">
            <span>Plan:</span>
            <span className="value">{plan.name}</span>
          </div>
          <div className="summary-row">
            <span>Amount:</span>
            <span className="value">₹{plan.price}</span>
          </div>
          <div className="summary-row gst">
            <span>GST (18%):</span>
            <span className="value">₹{(plan.price * 0.18).toFixed(2)}</span>
          </div>
          <div className="summary-row total">
            <span>Total:</span>
            <span className="value">₹{(plan.price * 1.18).toFixed(2)}</span>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <span>⚠️</span>
            {error}
          </div>
        )}

        <div className="checkout-actions">
          <button
            className="btn-pay"
            onClick={handlePayment}
            disabled={loading}
          >
            {loading ? 'Processing...' : '💳 Pay with Razorpay'}
          </button>
          <button className="btn-cancel-modal" onClick={onClose}>
            Cancel
          </button>
        </div>

        <div className="security-badge">
          🔒 Secured by Razorpay | PCI DSS Compliant
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
