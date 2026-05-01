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
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [prorationInfo, setProrationInfo] = useState(null);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([
        fetchPlans(),
        fetchCurrentSubscription(),
        fetchReceipts()
      ]);
    } catch (err) {
      setError('Failed to load subscription data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await apiClient.get('/payments/plans');
      setPlans(response.data.plans || []);
    } catch (err) {
      console.error('Failed to load plans:', err);
      throw err;
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
    }
  };

  const fetchReceipts = async () => {
    try {
      const response = await apiClient.get('/payments/receipts');
      setReceipts(response.data.receipts || []);
    } catch (err) {
      console.error('Failed to fetch receipts:', err);
    }
  };

  const calculateProration = (newPlan) => {
    if (!currentSubscription) {
      return null;
    }

    const currentPlanPrice = currentSubscription.planPrice;
    const newPlanPrice = newPlan.price;
    const daysRemaining = currentSubscription.daysRemaining || 0;
    const dailyRate = currentPlanPrice / 30;
    const amountRemaining = dailyRate * daysRemaining;
    const amountDue = newPlanPrice - amountRemaining;

    return {
      currentPlanPrice,
      newPlanPrice,
      daysRemaining,
      amountRemaining: Math.max(0, amountRemaining),
      amountDue: Math.max(0, amountDue),
      willRefund: amountDue < 0
    };
  };

  const handleSelectPlan = (plan) => {
    if (currentSubscription && currentSubscription.planName === plan.name) {
      setError('You are already subscribed to this plan');
      return;
    }

    setSelectedPlan(plan);
    if (currentSubscription) {
      setProrationInfo(calculateProration(plan));
    }
    setShowCheckout(true);
  };

  const handleValidateDiscount = async () => {
    if (!discountCode.trim()) {
      setAppliedDiscount(null);
      return;
    }

    try {
      const response = await apiClient.post('/payments/validate-discount', {
        code: discountCode,
        planId: selectedPlan.id
      });

      if (response.data.valid) {
        setAppliedDiscount(response.data.discount);
      } else {
        setError(response.data.message || 'Invalid discount code');
      }
    } catch (err) {
      setError('Failed to validate discount code');
      console.error(err);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose premium features.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.post(
        '/payments/cancel-subscription',
        {}
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
          currentSubscription={currentSubscription}
          prorationInfo={prorationInfo}
          discountCode={discountCode}
          setDiscountCode={setDiscountCode}
          appliedDiscount={appliedDiscount}
          setAppliedDiscount={setAppliedDiscount}
          onValidateDiscount={handleValidateDiscount}
          onClose={() => {
            setShowCheckout(false);
            setSelectedPlan(null);
            setProrationInfo(null);
            setDiscountCode('');
            setAppliedDiscount(null);
          }}
          onSuccess={() => {
            setShowCheckout(false);
            setSelectedPlan(null);
            setProrationInfo(null);
            setDiscountCode('');
            setAppliedDiscount(null);
            alert('🎉 Subscription activated! Welcome to LinkUp Premium.');
            loadSubscriptionData();
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
 * Handles Razorpay payment processing with discount codes and proration
 */
const CheckoutModal = ({ plan, currentSubscription, prorationInfo, discountCode, setDiscountCode, appliedDiscount, setAppliedDiscount, onValidateDiscount, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentStep, setPaymentStep] = useState('summary'); // 'summary', 'processing', 'verifying'

  const calculateFinalAmount = () => {
    let amount = plan.price;
    
    // Apply proration
    if (prorationInfo && prorationInfo.amountDue > 0) {
      amount = prorationInfo.amountDue;
    }
    
    // Apply discount
    if (appliedDiscount) {
      if (appliedDiscount.type === 'percentage') {
        amount = amount * (1 - appliedDiscount.value / 100);
      } else if (appliedDiscount.type === 'fixed') {
        amount = Math.max(0, amount - appliedDiscount.value);
      }
    }
    
    return Math.max(0, amount);
  };

  const handlePayment = async () => {
    setLoading(true);
    setError('');
    setPaymentStep('processing');

    try {
      // Validate plan before payment
      if (!plan || plan.price <= 0) {
        throw new Error('Invalid plan selected');
      }

      const finalAmount = calculateFinalAmount();

      // Step 1: Create order
      const orderResponse = await apiClient.post(
        '/payments/create-order',
        {
          planId: plan.id,
          planName: plan.name,
          amount: finalAmount,
          isUpgrade: !!currentSubscription,
          discountCode: appliedDiscount ? discountCode : undefined
        }
      );

      const { orderId, keyId } = orderResponse.data;

      // Step 2: Initialize Razorpay
      const options = {
        key: keyId,
        amount: Math.round(finalAmount * 100), // in paise
        currency: 'INR',
        name: 'LinkUp Premium',
        description: `${plan.name} Subscription${appliedDiscount ? ` (Discount Applied)` : ''}`,
        order_id: orderId,
        handler: async (response) => {
          setPaymentStep('verifying');
          try {
            const verifyResponse = await apiClient.post(
              '/payments/verify',
              {
                orderId: orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                planId: plan.id,
                amount: finalAmount,
                discountCode: appliedDiscount ? discountCode : undefined,
                isUpgrade: !!currentSubscription
              }
            );

            if (verifyResponse.data.success) {
              setError('');
              onSuccess();
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (verifyError) {
            setError('Payment verification failed. Please contact support if amount was deducted.');
            setPaymentStep('summary');
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
            setPaymentStep('summary');
          }
        }
      };

      // Open Razorpay checkout
      if (window.Razorpay) {
        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        throw new Error('Payment gateway not loaded. Please refresh the page.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create payment order');
      setPaymentStep('summary');
      console.error('Payment error:', err);
    } finally {
      setLoading(false);
    }
  };

  const finalAmount = calculateFinalAmount();
  const gstAmount = finalAmount * 0.18;
  const totalAmount = finalAmount + gstAmount;

  return (
    <div className="checkout-modal-overlay" onClick={onClose}>
      <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="checkout-header">
          <h2>Complete Your Purchase</h2>
          <p className="checkout-step">
            {paymentStep === 'processing' && 'Processing payment...'}
            {paymentStep === 'verifying' && 'Verifying payment...'}
            {paymentStep === 'summary' && 'Review your order'}
          </p>
        </div>

        {paymentStep === 'summary' && (
          <>
            <div className="checkout-summary">
              <div className="summary-row">
                <span>Plan:</span>
                <span className="value">{plan.name}</span>
              </div>
              <div className="summary-row">
                <span>Base Price:</span>
                <span className="value">₹{plan.price}</span>
              </div>

              {prorationInfo && (
                <div className="proration-section">
                  <div className="section-title">Proration Credit</div>
                  <div className="summary-row">
                    <span>Days Remaining:</span>
                    <span className="value">{prorationInfo.daysRemaining}</span>
                  </div>
                  <div className="summary-row">
                    <span>Credit from current plan:</span>
                    <span className="value credit">-₹{prorationInfo.amountRemaining.toFixed(2)}</span>
                  </div>
                  <div className="summary-row highlighted">
                    <span>Amount Due:</span>
                    <span className="value">₹{prorationInfo.amountDue.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {!prorationInfo && (
                <div className="summary-row">
                  <span>Amount:</span>
                  <span className="value">₹{plan.price}</span>
                </div>
              )}

              <div className="discount-section">
                <div className="discount-input-group">
                  <input
                    type="text"
                    placeholder="Enter discount code"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    disabled={appliedDiscount !== null}
                    className="discount-input"
                  />
                  {appliedDiscount ? (
                    <button
                      className="btn-apply-discount applied"
                      onClick={() => {
                        setDiscountCode('');
                        setAppliedDiscount(null);
                      }}
                    >
                      ✓ Applied
                    </button>
                  ) : (
                    <button
                      className="btn-apply-discount"
                      onClick={onValidateDiscount}
                      disabled={!discountCode.trim()}
                    >
                      Apply
                    </button>
                  )}
                </div>
              </div>

              {appliedDiscount && (
                <div className="summary-row discount-applied">
                  <span>
                    {appliedDiscount.type === 'percentage' ? `Discount (${appliedDiscount.value}%)` : `Discount`}:
                  </span>
                  <span className="value credit">
                    -₹{appliedDiscount.type === 'percentage' ? (finalAmount * appliedDiscount.value / 100).toFixed(2) : appliedDiscount.value.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="summary-row gst">
                <span>GST (18%):</span>
                <span className="value">₹{gstAmount.toFixed(2)}</span>
              </div>
              <div className="summary-row total">
                <span>Total:</span>
                <span className="value">₹{totalAmount.toFixed(2)}</span>
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
          </>
        )}

        {(paymentStep === 'processing' || paymentStep === 'verifying') && (
          <div className="payment-processing">
            <div className="spinner large"></div>
            <p>{paymentStep === 'processing' ? 'Redirecting to payment...' : 'Verifying payment...'}</p>
            <p className="processing-note">Please do not close this window</p>
          </div>
        )}

        <div className="security-badge">
          🔒 Secured by Razorpay | PCI DSS Compliant
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
