/**
 * Incoming Call Notification Component
 * Displays incoming call request with accept/decline options
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import '../styles/IncomingCallNotification.css';

const IncomingCallNotification = ({
  incomingCall,
  onDismiss,
  onAccept,
  onDecline
}) => {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [responding, setResponding] = useState(false);

  // Calculate time remaining for call request expiry
  useEffect(() => {
    if (!incomingCall?.expiresAt) return;

    const calculateTimeRemaining = () => {
      const now = new Date();
      const expiryTime = new Date(incomingCall.expiresAt);
      const diff = expiryTime - now;

      if (diff <= 0) {
        setTimeRemaining(0);
        // Auto-dismiss if expired
        setTimeout(() => {
          onDismiss?.();
        }, 100);
        return;
      }

      const seconds = Math.floor((diff % 60000) / 1000);
      const minutes = Math.floor(diff / 60000);
      setTimeRemaining({ minutes, seconds });
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [incomingCall?.expiresAt, onDismiss]);

  if (!incomingCall) {
    return null;
  }

  const { callType, callerName, callerAge, ratePerMinute, estimatedCost } = incomingCall;
  const callTypeLabel = callType === 'video' ? 'Video' : 'Voice';
  const timeText = timeRemaining
    ? `${timeRemaining.minutes}:${String(timeRemaining.seconds).padStart(2, '0')}`
    : '0:00';

  const handleAccept = async () => {
    setResponding(true);
    const timeoutId = setTimeout(() => {
      console.warn('Accept call timed out - resetting responding state');
      setResponding(false);
    }, 15000); // 15 second timeout

    try {
      console.log('IncomingCallNotification: Accepting call', incomingCall);
      const result = await onAccept?.(incomingCall);
      console.log('IncomingCallNotification: Accept result:', result);
    } catch (error) {
      console.error('IncomingCallNotification: Error accepting call:', error);
    } finally {
      clearTimeout(timeoutId);
      setResponding(false);
    }
  };

  const handleDecline = async () => {
    setResponding(true);
    const timeoutId = setTimeout(() => {
      console.warn('Decline call timed out - resetting responding state');
      setResponding(false);
    }, 15000); // 15 second timeout

    try {
      console.log('IncomingCallNotification: Declining call', incomingCall);
      const result = await onDecline?.(incomingCall);
      console.log('IncomingCallNotification: Decline result:', result);
      onDismiss?.();
    } catch (error) {
      console.error('IncomingCallNotification: Error declining call:', error);
    } finally {
      clearTimeout(timeoutId);
      setResponding(false);
    }
  };

  return (
    <div className="incoming-call-notification" onClick={onDismiss}>
      <div className="incoming-call-modal" onClick={(e) => e.stopPropagation()}>
        <div className="call-header">
          <h2 className="call-title">
            {callTypeLabel} Call Request
          </h2>
          <button
            type="button"
            className="close-btn"
            onClick={onDismiss}
            aria-label="Close"
            disabled={responding}
          >
            ×
          </button>
        </div>

        <div className="call-details">
          <div className="caller-info">
            <div className="caller-name">
              {callerName}
              {callerAge && <span className="caller-age">, {callerAge}</span>}
            </div>
            <div className="call-type-badge">
              {callTypeLabel} Call
            </div>
          </div>

          <div className="call-terms">
            <div className="term-row">
              <span className="term-label">Rate:</span>
              <span className="term-value">INR {ratePerMinute}/min</span>
            </div>
            <div className="term-row">
              <span className="term-label">Estimated:</span>
              <span className="term-value">INR {estimatedCost}</span>
            </div>
            <div className="term-row">
              <span className="term-label">Expires in:</span>
              <span className="term-value expiry-timer">{timeText}</span>
            </div>
          </div>

          <p className="call-note">
            Credits will be deducted from caller when you accept. You can decline or let it expire.
          </p>
        </div>

        <div className="call-actions">
          <button
            type="button"
            className="btn-decline"
            onClick={handleDecline}
            disabled={responding}
          >
            {responding ? 'Processing...' : 'Decline'}
          </button>
          <button
            type="button"
            className="btn-accept"
            onClick={handleAccept}
            disabled={responding}
          >
            {responding ? 'Processing...' : 'Accept & Start Call'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallNotification;
