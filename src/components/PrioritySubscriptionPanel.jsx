/**
 * PrioritySubscriptionPanel Component
 * UI for subscribing to preferences priority feature
 */

import React, { useState, useEffect } from 'react';
import usePreferences from '../hooks/usePreferences';
import './PrioritySubscriptionPanel.css';

const PrioritySubscriptionPanel = ({ onClose, onSubscribed }) => {
  const {
    priorityStatus,
    subscriptionInfo,
    eligibility,
    loading,
    error,
    subscribeToPriority,
    cancelSubscription,
    checkPriorityStatus
  } = usePreferences();

  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  /**
   * Handle subscribe click
   */
  const handleSubscribe = async () => {
    setSubscribeLoading(true);
    const result = await subscribeToPriority(true);

    if (result.success) {
      onSubscribed?.(result.subscription);
      // Auto-close after short delay
      setTimeout(() => onClose?.(), 1500);
    }
    setSubscribeLoading(false);
  };

  /**
   * Handle cancel click
   */
  const handleCancel = async () => {
    setCancelLoading(true);
    const result = await cancelSubscription('User requested cancellation');

    if (result.success) {
      setShowCancelConfirm(false);
      await checkPriorityStatus();
    }
    setCancelLoading(false);
  };

  // Loading state
  if (loading || !subscriptionInfo || !eligibility) {
    return (
      <div className="priority-panel priority-panel-loading">
        <div className="spinner"></div>
        <p>Loading subscription details...</p>
      </div>
    );
  }

  // Check eligibility
  if (!eligibility.canAccess) {
    return (
      <div className="priority-panel priority-panel-upgrade">
        <div className="upgrade-icon">🔒</div>
        <h3>Premium Feature</h3>
        <p>Upgrade to premium membership to access Preferences Priority.</p>
        <button className="btn btn-primary" onClick={onClose}>
          Back to Premium
        </button>
      </div>
    );
  }

  // Already subscribed
  if (priorityStatus?.hasSubscription && priorityStatus?.subscription?.isActive) {
    const sub = priorityStatus.subscription;
    const daysRemaining = Math.ceil(
      (new Date(sub.billingEnd) - new Date()) / (1000 * 60 * 60 * 24)
    );

    return (
      <div className="priority-panel priority-panel-active">
        <div className="subscription-header">
          <div className="status-badge active">✓ Active</div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <h2>Your Preferences Priority</h2>

        <div className="active-info">
          <div className="info-card">
            <div className="info-icon">🌟</div>
            <div className="info-content">
              <h4>Current Status</h4>
              <p>
                {sub.currentWeekActive
                  ? '🎯 Top placement this week!'
                  : '📅 In rotation pool for next week'}
              </p>
            </div>
          </div>

          <div className="info-card">
            <div className="info-icon">⏱️</div>
            <div className="info-content">
              <h4>Billing Period</h4>
              <p>${sub.effectivePrice.toFixed(2)}/month</p>
              <small>{daysRemaining} days remaining</small>
            </div>
          </div>

          <div className="info-card">
            <div className="info-icon">🔄</div>
            <div className="info-content">
              <h4>Loyalty Status</h4>
              <p>{sub.totalMonthsActive} months active</p>
              {sub.loyaltyDiscount > 0 && (
                <small>{sub.loyaltyDiscount}% discount applied</small>
              )}
            </div>
          </div>
        </div>

        <div className="features-list">
          <h4>Your Benefits</h4>
          {subscriptionInfo.features && subscriptionInfo.features.map((feature, idx) => (
            <div key={idx} className="feature-item">
              <span className="feature-icon">✓</span>
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {!showCancelConfirm && (
          <button
            className="btn btn-secondary btn-cancel"
            onClick={() => setShowCancelConfirm(true)}
          >
            Cancel Subscription
          </button>
        )}

        {showCancelConfirm && (
          <div className="cancel-confirm">
            <p>Are you sure? You'll lose your priority placement.</p>
            <div className="button-group">
              <button
                className="btn btn-danger"
                onClick={handleCancel}
                disabled={cancelLoading}
              >
                {cancelLoading ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelLoading}
              >
                Keep Subscription
              </button>
            </div>
          </div>
        )}

        <button className="btn btn-outline btn-close" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  // Not subscribed - show subscribe offer
  return (
    <div className="priority-panel priority-panel-subscribe">
      <button className="close-btn" onClick={onClose}>×</button>

      <div className="header-section">
        <div className="header-icon">⭐</div>
        <h2>Preferences Priority</h2>
        <p className="tagline">Stand out in search results</p>
      </div>

      <div className="benefit-section">
        <h3>How It Works</h3>
        <div className="benefit-item">
          <div className="benefit-number">1</div>
          <div className="benefit-text">
            <h4>Get Top Placement</h4>
            <p>Your profile appears first in filtered searches</p>
          </div>
        </div>
        <div className="benefit-item">
          <div className="benefit-number">2</div>
          <div className="benefit-text">
            <h4>Weekly Rotation</h4>
            <p>Fair system ensures everyone gets priority time</p>
          </div>
        </div>
        <div className="benefit-item">
          <div className="benefit-number">3</div>
          <div className="benefit-text">
            <h4>More Matches</h4>
            <p>Increased visibility = more profile views and likes</p>
          </div>
        </div>
      </div>

      <div className="pricing-section">
        <div className="price-display">
          <div className="price-main">${subscriptionInfo.monthlyPrice.toFixed(2)}</div>
          <div className="price-period">per month</div>
        </div>
        <p className="price-note">Billed monthly • Cancel anytime</p>
      </div>

      <div className="features-section">
        <h4>Included Features</h4>
        {subscriptionInfo.features && subscriptionInfo.features.map((feature, idx) => (
          <div key={idx} className="feature-item">
            <span className="check-icon">✓</span>
            <span>{feature}</span>
          </div>
        ))}
      </div>

      <div className="loyalty-section">
        <h4>Loyalty Rewards</h4>
        <p className="loyalty-text">
          Subscribe longer to unlock bigger discounts!
        </p>
        {subscriptionInfo.loyaltyTiers && subscriptionInfo.loyaltyTiers.map((tier, idx) => (
          <div key={idx} className="loyalty-tier">
            <div className="tier-info">
              <span className="tier-months">{tier.months} months</span>
              <span className="tier-price">{tier.price}</span>
            </div>
            <span className="tier-discount">Save {tier.discount}%</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <button
        className="btn btn-primary btn-subscribe"
        onClick={handleSubscribe}
        disabled={subscribeLoading}
      >
        {subscribeLoading ? (
          <>
            <span className="spinner-small"></span>
            Subscribing...
          </>
        ) : (
          <>
            🚀 Subscribe Now
          </>
        )}
      </button>

      <p className="terms-note">
        By subscribing, you agree to automatic monthly billing.
        <br />
        You can cancel anytime from your account settings.
      </p>
    </div>
  );
};

export default PrioritySubscriptionPanel;
