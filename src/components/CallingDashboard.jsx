/**
 * Calling Dashboard - paid voice/video calling marketplace.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import callWalletService from '../services/callWalletService';
import CouponRedemption from './CouponRedemption';
import RazorpayPayment from './RazorpayPayment';
import '../styles/CallingDashboard.css';

const ESTIMATED_CALL_MINUTES = 5;

const FALLBACK_CREDIT_PACKAGES = [
  { id: 1, name: 'Starter', credits: 50, price: 50, bonus: 0 },
  { id: 2, name: 'Basic', credits: 100, price: 95, bonus: 5 },
  { id: 3, name: 'Popular', credits: 250, price: 225, bonus: 25 },
  { id: 4, name: 'Pro', credits: 500, price: 425, bonus: 75 },
  { id: 5, name: 'Premium', credits: 1000, price: 800, bonus: 200 }
];

const CALL_TYPES = {
  voice: {
    label: 'Voice',
    actionLabel: 'Voice call',
    description: 'Audio only'
  },
  video: {
    label: 'Video',
    actionLabel: 'Video call',
    description: 'Camera and audio'
  }
};

const toNumber = (value, fallback = 0) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const getUserId = (user) => user?.userId || user?.id || user?._id;

const normalizePackage = (pkg) => ({
  id: pkg.id,
  name: pkg.name || pkg.label || 'Credits',
  credits: toNumber(pkg.credits),
  price: toNumber(pkg.price),
  bonus: toNumber(pkg.bonus)
});

const normalizeCaller = (user) => {
  const rates = user.rates || {};

  return {
    ...user,
    userId: getUserId(user),
    name: user.name || user.firstName || 'DatingHub user',
    age: user.age,
    location: user.location,
    bio: user.bio || 'Available for a friendly call.',
    photoUrl: user.photoUrl || user.photo_url,
    callRating: toNumber(user.callRating),
    totalCalls: toNumber(user.totalCalls),
    rates: {
      voice: toNumber(user.voiceRate ?? rates.voice, 5),
      video: toNumber(user.videoRate ?? rates.video, 10)
    },
    interests: Array.isArray(user.interests) ? user.interests : []
  };
};

const CallDashboard = () => {
  const { currentUser, apiCall } = useApp();
  const [balance, setBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [packages, setPackages] = useState(FALLBACK_CREDIT_PACKAGES);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [callingUsers, setCallingUsers] = useState([]);
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [marketEnabled, setMarketEnabled] = useState(true);
  const [availability, setAvailability] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [activeCallAction, setActiveCallAction] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const normalizedPackages = useMemo(
    () => packages.map(normalizePackage),
    [packages]
  );

  const showNotice = useCallback((message, tone = 'info') => {
    setNotice({ message, tone });
  }, []);

  const loadBalance = useCallback(async () => {
    setLoadingBalance(true);
    try {
      const data = await callWalletService.getBalance();
      setBalance(toNumber(data.balance));
    } catch (error) {
      console.error('Failed to load balance:', error);
      showNotice('Could not load your call credits. Please try again.', 'error');
    } finally {
      setLoadingBalance(false);
    }
  }, [showNotice]);

  const loadPackages = useCallback(async () => {
    try {
      const data = await callWalletService.getPackages();
      if (Array.isArray(data.packages) && data.packages.length > 0) {
        setPackages(data.packages);
      }
    } catch (error) {
      console.error('Failed to load packages:', error);
      setPackages(FALLBACK_CREDIT_PACKAGES);
    }
  }, []);

  const loadCallingMarket = useCallback(async () => {
    setLoadingMarket(true);
    try {
      const data = await apiCall('/calling/market/available', 'GET');
      setMarketEnabled(data.enabled !== false);
      setCallingUsers((data.users || []).map(normalizeCaller).filter((user) => user.userId));
    } catch (error) {
      console.error('Failed to load market:', error);
      showNotice('Could not load people available for calls.', 'error');
    } finally {
      setLoadingMarket(false);
    }
  }, [apiCall, showNotice]);

  const loadAvailability = useCallback(async () => {
    setLoadingAvailability(true);
    try {
      const data = await apiCall('/calling/earnings/availability', 'GET');
      setAvailability(Boolean(data.isAvailable));
    } catch (error) {
      console.error('Failed to load availability:', error);
    } finally {
      setLoadingAvailability(false);
    }
  }, [apiCall]);

  useEffect(() => {
    loadBalance();
    loadPackages();
    loadCallingMarket();
    loadAvailability();
  }, [loadAvailability, loadBalance, loadCallingMarket, loadPackages]);

  const handleToggleAvailability = async () => {
    if (!currentUser || updatingAvailability) {
      return;
    }

    const nextAvailability = !availability;
    setUpdatingAvailability(true);
    try {
      const data = await apiCall('/calling/earnings/availability', 'POST', {
        available: nextAvailability
      });
      setAvailability(Boolean(data.isAvailable));
      showNotice(
        data.isAvailable
          ? 'You are available for incoming paid calls.'
          : 'You are offline for paid calls.',
        'success'
      );
      await loadCallingMarket();
    } catch (error) {
      console.error('Failed to update availability:', error);
      showNotice('Could not update your call availability.', 'error');
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const handlePurchase = (pkg) => {
    if (!currentUser) {
      showNotice('Please log in to buy call credits.', 'error');
      return;
    }

    setSelectedPackage(pkg);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = (paymentData) => {
    setShowPaymentModal(false);
    setBalance(paymentData.balance);
    showNotice(
      `Success! ${paymentData.creditsAdded} credits added to your account.`,
      'success'
    );
    loadBalance();
  };

  const handlePaymentError = (error) => {
    showNotice(error, 'error');
  };

  const handleStartCall = async (user, callType = 'voice') => {
    const callerId = getUserId(user);
    const normalizedCallType = callType === 'video' ? 'video' : 'voice';
    const rate = toNumber(user?.rates?.[normalizedCallType], normalizedCallType === 'video' ? 10 : 5);
    const requiredCredits = rate * ESTIMATED_CALL_MINUTES;

    if (!callerId) {
      showNotice('This caller profile is missing a valid ID.', 'error');
      return;
    }

    if (balance < requiredCredits) {
      showNotice(
        `You need at least ${requiredCredits} credits for a ${CALL_TYPES[normalizedCallType].label.toLowerCase()} call.`,
        'error'
      );
      return;
    }

    const actionId = `${callerId}:${normalizedCallType}`;
    setActiveCallAction(actionId);

    try {
      const response = await apiCall('/calling/market/request', 'POST', {
        targetUserId: callerId,
        callType: normalizedCallType
      });

      if (response?.success) {
        setPendingRequest({
          ...response,
          userName: user.name,
          userId: callerId
        });
        showNotice(
          `${CALL_TYPES[normalizedCallType].label} call request sent to ${user.name}. Credits are reserved only when they accept.`,
          'success'
        );
      }
    } catch (error) {
      console.error('Failed to start call:', error);
      showNotice(error?.response?.data?.error || 'Could not send the call request.', 'error');
    } finally {
      setActiveCallAction(null);
    }
  };

  const handleRedemptionSuccess = async (redemptionData = {}) => {
    const returnedBalance = toNumber(redemptionData.callCreditsBalance, null);
    const responseCreditsAdded = toNumber(
      redemptionData.creditsGranted ?? redemptionData.callCreditsGranted ?? redemptionData.creditsAdded,
      0
    );
    const creditsAdded = responseCreditsAdded ||
      (Number.isFinite(returnedBalance) ? Math.max(0, returnedBalance - balance) : 0);

    setShowCouponModal(false);
    if (Number.isFinite(returnedBalance)) {
      setBalance(returnedBalance);
    }
    await loadBalance();
    showNotice(`Coupon redeemed! ${creditsAdded} credits added to your account.`, 'success');
  };

  return (
    <div className="calling-dashboard">
      <div className="calling-header">
        <h1>Calls</h1>
        <p>Use credits to request voice or video calls with people who are available now.</p>
      </div>

      {notice ? (
        <div className={`calling-notice calling-notice-${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="balance-card">
        <div className="balance-info">
          <span className="balance-label">Your Credits</span>
          {loadingBalance ? (
            <span className="balance-amount">Loading...</span>
          ) : (
            <span className="balance-amount">{balance} credits</span>
          )}
        </div>
        <div className="balance-actions">
          <button
            className="btn-reload"
            onClick={() => document.getElementById('credits-section')?.scrollIntoView({ behavior: 'smooth' })}
            type="button"
          >
            Add Credits
          </button>
          <button
            className="btn-coupon"
            onClick={() => setShowCouponModal(true)}
            type="button"
            title="Redeem a coupon code for credits"
          >
            Redeem Coupon
          </button>
        </div>
      </div>

      <section className="availability-section">
        <div>
          <h2>Receive Calls</h2>
          <p>
            {availability
              ? 'You are visible to people looking for a call.'
              : 'Turn this on when you are ready to receive paid calls.'}
          </p>
        </div>
        <button
          type="button"
          className={`availability-toggle ${availability ? 'active' : ''}`}
          onClick={handleToggleAvailability}
          disabled={loadingAvailability || updatingAvailability}
          aria-pressed={availability}
        >
          {loadingAvailability
            ? 'Checking...'
            : updatingAvailability
              ? 'Saving...'
              : availability
                ? 'Available'
                : 'Go Available'}
        </button>
      </section>

      <section id="credits-section" className="credits-section">
        <h2>Buy Credits</h2>
        <div className="packages-grid">
          {normalizedPackages.map((pkg) => (
            <button
              type="button"
              key={pkg.id}
              className={`package-card ${selectedPackage?.id === pkg.id && showPaymentModal ? 'selected' : ''}`}
              onClick={() => handlePurchase(pkg)}
              disabled={showPaymentModal}
            >
              <span className="package-badge">{pkg.name}</span>
              <span className="package-credits">{pkg.credits + pkg.bonus} credits</span>
              {pkg.bonus > 0 ? (
                <span className="package-bonus">+{pkg.bonus} bonus</span>
              ) : null}
              <span className="package-price">INR {pkg.price}</span>
              <span className="btn-buy-package">
                {showPaymentModal && selectedPackage?.id === pkg.id ? 'Processing...' : 'Buy'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="market-section">
        <div className="section-title-row">
          <div>
            <h2>Available Now</h2>
            <p className="market-hint">Send a request first. The call starts only after they accept.</p>
          </div>
          <button type="button" className="btn-refresh" onClick={loadCallingMarket} disabled={loadingMarket}>
            Refresh
          </button>
        </div>

        {loadingMarket ? (
          <div className="loading-market">Loading available people...</div>
        ) : !marketEnabled ? (
          <div className="empty-market">
            <p>Calling is currently unavailable.</p>
            <p>Please check back later.</p>
          </div>
        ) : callingUsers.length === 0 ? (
          <div className="empty-market">
            <p>No one is available for calls right now.</p>
            <p>You can turn on your own availability above or check again soon.</p>
          </div>
        ) : (
          <div className="callers-list">
            {callingUsers.map((user) => (
              <div key={user.userId} className="caller-card">
                <div className="caller-avatar">
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name} />
                  ) : (
                    <span>{user.name?.charAt(0) || '?'}</span>
                  )}
                </div>
                <div className="caller-info">
                  <h3>{user.name}{user.age ? `, ${user.age}` : ''}</h3>
                  <p className="caller-bio">{user.bio}</p>
                  <div className="caller-tags">
                    <span className="caller-rate">Voice INR {user.rates.voice}/min</span>
                    <span className="caller-rate video-rate">Video INR {user.rates.video}/min</span>
                    {user.interests.slice(0, 2).map((tag, i) => (
                      <span key={i} className="caller-tag">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="caller-actions">
                  {Object.entries(CALL_TYPES).map(([callType, config]) => {
                    const requiredCredits = user.rates[callType] * ESTIMATED_CALL_MINUTES;
                    const actionId = `${user.userId}:${callType}`;
                    const disabled = activeCallAction !== null || balance < requiredCredits;

                    return (
                      <button
                        key={callType}
                        className={`btn-call-action btn-${callType}-call`}
                        onClick={() => handleStartCall(user, callType)}
                        disabled={disabled}
                        title={`${config.actionLabel}: ${requiredCredits} credits minimum`}
                        type="button"
                      >
                        <strong>{activeCallAction === actionId ? 'Sending...' : config.label}</strong>
                        <span>{config.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {pendingRequest ? (
          <div className="pending-call-card" role="status">
            <strong>Request sent</strong>
            <p>{pendingRequest.userName} has about two minutes to accept. Keep this page open for updates.</p>
          </div>
        ) : null}
      </section>

      <section className="pricing-section">
        <h2>How It Works</h2>
        <div className="pricing-steps">
          <div className="pricing-step">
            <span className="step-number">1</span>
            <h3>Buy Credits</h3>
            <p>Choose a package that fits your budget.</p>
          </div>
          <div className="pricing-step">
            <span className="step-number">2</span>
            <h3>Pick a Person</h3>
            <p>Only available profiles are shown here.</p>
          </div>
          <div className="pricing-step">
            <span className="step-number">3</span>
            <h3>Send Request</h3>
            <p>Voice or video, with the rate shown first.</p>
          </div>
          <div className="pricing-step">
            <span className="step-number">4</span>
            <h3>Talk Safely</h3>
            <p>The call begins only after both sides agree.</p>
          </div>
        </div>
        <div className="pricing-rates">
          <h3>Current Rates</h3>
          <p>Rates are shown on each profile before you send a request.</p>
          <p>Credits are checked for a 5 minute estimate and settled after the call.</p>
        </div>
      </section>

      <CouponRedemption
        isOpen={showCouponModal}
        onClose={() => setShowCouponModal(false)}
        onRedemptionSuccess={handleRedemptionSuccess}
      />

      <RazorpayPayment
        isOpen={showPaymentModal}
        package={selectedPackage}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    </div>
  );
};

export default CallDashboard;
