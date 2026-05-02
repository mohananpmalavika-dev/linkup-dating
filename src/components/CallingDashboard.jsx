/**
 * Calling Dashboard - paid voice/video calling marketplace.
 */

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from '../router';
import { useApp } from '../contexts/AppContext';
import callWalletService from '../services/callWalletService';
import realTimeService from '../services/realTimeService';
import useIncomingCall from '../hooks/useIncomingCall';
import CouponRedemption from './CouponRedemption';
import RazorpayPayment from './RazorpayPayment';
import IncomingCallNotification from './IncomingCallNotification';
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
    availableFor: {
      voice: user.availableFor?.voice !== false,
      video: user.availableFor?.video !== false
    },
    rates: {
      voice: toNumber(user.voiceRate ?? rates.voice, 5),
      video: toNumber(user.videoRate ?? rates.video, 10)
    },
    interests: Array.isArray(user.interests) ? user.interests : []
  };
};

const CallDashboard = () => {
  const navigate = useNavigate();
  const { currentUser, apiCall } = useApp();
  const userId = currentUser?.id || currentUser?.userId;
  const { incomingCall, dismissIncomingCall } = useIncomingCall(userId);
  const [balance, setBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [packages, setPackages] = useState(FALLBACK_CREDIT_PACKAGES);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [callingUsers, setCallingUsers] = useState([]);
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [marketEnabled, setMarketEnabled] = useState(true);
  const [availability, setAvailability] = useState(false);
  const [callTypes, setCallTypes] = useState({ voice: true, video: true }); // Track call types user is available for
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

  // Define showNotice callback
  const showNotice = useCallback((message, tone = 'info') => {
    setNotice({ message, tone });
  }, []);

  // Filter incoming call based on user's call type availability
  const filteredIncomingCall = useMemo(() => {
    if (!incomingCall || !availability) {
      return null;
    }
    
    const callType = incomingCall.callType?.toLowerCase() || 'voice';
    const isCallTypeAvailable = callType === 'voice' ? callTypes.voice : callTypes.video;
    
    return isCallTypeAvailable ? incomingCall : null;
  }, [incomingCall, availability, callTypes]);

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
      // Load call type preferences
      setCallTypes({
        voice: data.availableFor?.voice !== false,
        video: data.availableFor?.video !== false
      });
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

  // Initialize real-time connection for incoming calls and call acceptance
  const realTimeConnectionRef = useRef(false);
  const pendingRequestRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.id && !currentUser?.userId) {
      console.warn('CallingDashboard: No user ID available');
      return;
    }

    if (realTimeConnectionRef.current) {
      console.log('CallingDashboard: Real-time connection already initialized');
      return;
    }

    const userId = currentUser.id || currentUser.userId;
    console.log('CallingDashboard: Connecting to real-time service for user:', userId);

    const connectToRealTime = async () => {
      try {
        if (realTimeService.socket?.connected) {
          console.log('CallingDashboard: Real-time service already connected');
          realTimeConnectionRef.current = true;
          setupSocketListeners(userId);
          return;
        }

        console.log('CallingDashboard: Establishing real-time connection...');
        await realTimeService.connect(userId, { device: 'web' });
        realTimeConnectionRef.current = true;
        console.log('CallingDashboard: Real-time service connected successfully');
        showNotice('Connected to call notifications.', 'success');
        setupSocketListeners(userId);
      } catch (err) {
        console.error('CallingDashboard: Failed to connect to real-time service:', err);
        showNotice(
          'Could not connect to call notifications. You can still receive calls, but notifications may be delayed.',
          'warning'
        );
      }
    };

    const setupSocketListeners = (userId) => {
      // Listen for call acceptance from receiver
      realTimeService.socket?.on('call:accepted', (data) => {
        console.log('📞 CallingDashboard: Received call:accepted', {
          receivedCallId: data?.callId,
          pendingCallId: pendingRequestRef.current?.callId,
          match: data?.callId === pendingRequestRef.current?.callId
        });
        if (data?.callId === pendingRequestRef.current?.callId) {
          // Clear pending request
          setPendingRequest(null);
          showNotice('Call accepted! Connecting...', 'success');
          
          // Navigate caller to video room
          const receiverUserId = data.fromUserId || data.targetUserId;
          console.log('📞 CallingDashboard: Navigating caller to video room', { receiverUserId });
          navigate(`/calls/${receiverUserId}/video`, {
            state: {
              callMode: 'outgoing',
              autoAccepted: false,
              callData: data,
              targetUserId: receiverUserId,
              returnPath: '/call'
            }
          });
        }
      });

      // Listen for call rejection
      realTimeService.socket?.on('call:rejected', (data) => {
        console.log('CallingDashboard: Call rejected by receiver', data);
        if (data?.callId === pendingRequestRef.current?.callId) {
          setPendingRequest(null);
          showNotice('Call was rejected.', 'info');
        }
      });

      // Listen for call timeout
      realTimeService.socket?.on('call:timeout', (data) => {
        console.log('CallingDashboard: Call timed out', data);
        if (data?.callId === pendingRequestRef.current?.callId) {
          setPendingRequest(null);
          showNotice('Call request expired.', 'info');
        }
      });

      // Listen for call ended
      realTimeService.socket?.on('call:ended', (data) => {
        console.log('CallingDashboard: Call ended', data);
        if (data?.callId === pendingRequestRef.current?.callId) {
          setPendingRequest(null);
        }
      });
    };

    connectToRealTime();

    return () => {
      // Clean up socket listeners
      realTimeService.socket?.off('call:accepted');
      realTimeService.socket?.off('call:rejected');
      realTimeService.socket?.off('call:timeout');
      realTimeService.socket?.off('call:ended');
    };
  }, [currentUser?.id, currentUser?.userId, showNotice, navigate]);

  const handleToggleAvailability = async () => {
    if (!currentUser || updatingAvailability) {
      return;
    }

    const nextAvailability = !availability;
    setUpdatingAvailability(true);
    try {
      const data = await apiCall('/calling/earnings/availability', 'POST', {
        available: nextAvailability,
        availableFor: nextAvailability ? callTypes : { voice: false, video: false }
      });
      setAvailability(Boolean(data.isAvailable));
      const typesList = nextAvailability && callTypes.voice && callTypes.video ? 'voice and video' : 
                       nextAvailability && callTypes.voice ? 'voice only' :
                       nextAvailability && callTypes.video ? 'video only' : '';
      showNotice(
        data.isAvailable
          ? `You are available for incoming ${typesList} calls.`
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

  const handleCallTypeChange = async (type) => {
    const newCallTypes = { ...callTypes, [type]: !callTypes[type] };
    // Ensure at least one call type is selected
    if (!newCallTypes.voice && !newCallTypes.video) {
      showNotice('You must select at least one call type.', 'warning');
      return;
    }
    setCallTypes(newCallTypes);

    // Always update the server with the new preferences
    try {
      await apiCall('/calling/earnings/availability', 'POST', {
        available: availability,
        availableFor: newCallTypes
      });
      showNotice('Call type preferences updated.', 'success');
      // Reload market to reflect the change
      await loadCallingMarket();
    } catch (error) {
      console.error('Failed to update call type preferences:', error);
      showNotice('Could not update call type preferences.', 'error');
      // Revert the change
      setCallTypes(callTypes);
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
        const pendingRequestData = {
          ...response,
          callId: response.callId || response.id,
          userName: user.name,
          userId: callerId,
          callType: normalizedCallType
        };
        setPendingRequest(pendingRequestData);
        pendingRequestRef.current = pendingRequestData;
        console.log('📞 CallingDashboard: Call request sent', {
          callId: pendingRequestData.callId,
          sessionId: pendingRequestData.sessionId,
          targetUser: user.name
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

  // Handle accepting incoming call request
  const handleAcceptIncomingCall = async (callData) => {
    try {
      // Normalize call data to ensure all fields are present
      const normalizedCallData = {
        ...callData,
        callId: callData.callId || callData.sessionId,
        fromUserId: callData.fromUserId || callData.callerId,
        callType: callData.callType || 'voice'
      };

      console.log('📞 CallingDashboard: Accepting incoming call', {
        receivedCallId: normalizedCallData.callId,
        fromUserId: normalizedCallData.fromUserId
      });

      // First, emit socket event to notify caller before API call
      if (normalizedCallData?.callId && normalizedCallData?.fromUserId) {
        realTimeService.socket?.emit('call:accepted', {
          callId: normalizedCallData.callId,
          fromUserId: currentUser?.id || currentUser?.userId,
          targetUserId: normalizedCallData.fromUserId,
          matchId: normalizedCallData.matchId,
          callType: normalizedCallData.callType
        });
      }

      const response = await apiCall(`/calling/market/accept/${normalizedCallData.requestId}`, 'POST');
      if (response?.success) {
        showNotice('Call accepted! Connecting...', 'success');
        dismissIncomingCall();
        
        // Navigate to video call interface
        // If matchId exists, use match-based route; otherwise use userId-based route
        const hasMatchId = normalizedCallData?.matchId;
        const videoCallRoute = hasMatchId 
          ? `/matches/${normalizedCallData.matchId}/video`
          : `/calls/${normalizedCallData.fromUserId}/video`;
        
        const returnPath = hasMatchId
          ? `/matches/${normalizedCallData.matchId}/chat`
          : `/call`;

        console.log('📞 CallingDashboard: Navigating receiver to video room', {
          callId: normalizedCallData.callId,
          route: videoCallRoute
        });

        navigate(videoCallRoute, {
          state: {
            callMode: 'incoming',
            autoAccepted: true,
            incomingCall: normalizedCallData,
            returnPath: returnPath,
            callType: normalizedCallData.callType,
            targetUserId: normalizedCallData.fromUserId
          }
        });
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      showNotice(
        error?.response?.data?.error || 'Failed to accept the call. Please try again.',
        'error'
      );
    }
  };

  // Handle declining incoming call request
  const handleDeclineIncomingCall = async (callData) => {
    try {
      // Normalize call data to ensure all fields are present
      const normalizedCallData = {
        ...callData,
        callId: callData.callId || callData.sessionId,
        fromUserId: callData.fromUserId || callData.callerId
      };

      // Emit socket event to notify caller BEFORE the API call
      if (normalizedCallData?.callId && normalizedCallData?.fromUserId) {
        realTimeService.socket?.emit('call:rejected', {
          callId: normalizedCallData.callId,
          fromUserId: currentUser?.id || currentUser?.userId,
          targetUserId: normalizedCallData.fromUserId,
          matchId: normalizedCallData.matchId
        });
      }

      const response = await apiCall(`/calling/market/decline/${callData.requestId}`, 'POST');
      if (response?.success) {
        showNotice('Call request declined.', 'info');
        dismissIncomingCall();
      }
    } catch (error) {
      console.error('Error declining call:', error);
      showNotice(
        error?.response?.data?.error || 'Failed to decline the call.',
        'error'
      );
    }
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

        {availability && (
          <div className="call-types-selector">
            <div className="call-types-title">Available for:</div>
            <div className="call-types-options">
              <label className="call-type-option">
                <input
                  type="checkbox"
                  checked={callTypes.voice}
                  onChange={() => handleCallTypeChange('voice')}
                  disabled={updatingAvailability}
                />
                <span className="call-type-label">
                  <span className="call-type-icon">🎤</span> Voice Calls
                </span>
              </label>
              <label className="call-type-option">
                <input
                  type="checkbox"
                  checked={callTypes.video}
                  onChange={() => handleCallTypeChange('video')}
                  disabled={updatingAvailability}
                />
                <span className="call-type-label">
                  <span className="call-type-icon">📹</span> Video Calls
                </span>
              </label>
            </div>
            <p className="call-types-hint">Callers will only see you for the types you select above.</p>
          </div>
        )}

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
                    {user.availableFor?.voice && <span className="call-type-available voice">🎤 Voice</span>}
                    {user.availableFor?.video && <span className="call-type-available video">📹 Video</span>}
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

      <IncomingCallNotification
        incomingCall={filteredIncomingCall}
        onDismiss={dismissIncomingCall}
        onAccept={handleAcceptIncomingCall}
        onDecline={handleDeclineIncomingCall}
      />
    </div>
  );
};

export default CallDashboard;
