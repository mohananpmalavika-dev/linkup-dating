import React, { useState, useEffect } from 'react';
import dateSafetyService from '../services/dateSafetyService';
import './DateSafetyKit.css';

const SOSButton = ({ sessionId, onSOS, trustFriendName = 'your friend' }) => {
  const [isPressed, setIsPressed] = useState(false);
  const [pressCount, setPressCount] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Hold down timer (3 seconds to activate)
  useEffect(() => {
    let timer;
    if (isPressed && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (isPressed && countdown === 0) {
      setShowConfirm(true);
      setIsPressed(false);
      setCountdown(3);
    }
    return () => clearTimeout(timer);
  }, [isPressed, countdown]);

  const handleMouseDown = () => {
    setIsPressed(true);
    setCountdownVisible(true);
  };

  const handleMouseUp = () => {
    setIsPressed(false);
    setCountdownVisible(false);
    setCountdown(3);
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    handleMouseDown();
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    handleMouseUp();
  };

  const handleSOS = async () => {
    try {
      setSending(true);
      setShowConfirm(false);

      // Get current location
      const location = await dateSafetyService.getUserLocation();

      // Activate SOS
      const result = await dateSafetyService.activateSOS(
        sessionId,
        location.latitude,
        location.longitude
      );

      if (result.success) {
        setSosSent(true);

        // Show alert
        alert(
          `🆘 SOS ACTIVATED!\n\n` +
          `Your location has been shared with ${trustFriendName}.\n` +
          `${result.sos.emergencyNumber} has been notified.\n\n` +
          `Stay safe and contact emergency services if needed.`
        );

        if (onSOS) {
          onSOS(result);
        }

        // Hide success message after 5 seconds
        setTimeout(() => {
          setSosSent(false);
        }, 5000);
      }
    } catch (error) {
      alert(`Failed to activate SOS: ${error.message}`);
      setShowConfirm(false);
    } finally {
      setSending(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setPressCount(0);
  };

  if (sosSent) {
    return (
      <div className="sos-sent-notification">
        <div className="sos-sent-content">
          <span className="sos-sent-icon">✓</span>
          <p>SOS Activated!</p>
          <small>Help is on the way. Stay safe.</small>
        </div>
      </div>
    );
  }

  return (
    <div className="sos-container">
      <div className="sos-info">
        <p className="sos-text">⚠️ Emergency Only</p>
        <p className="sos-instruction">Hold for 3 seconds to activate</p>
      </div>

      <div className="sos-button-wrapper">
        <button
          className={`sos-button ${isPressed ? 'pressed' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          disabled={sending}
          aria-label="SOS Emergency Button"
        >
          <span className="sos-button-icon">🆘</span>
          <span className="sos-button-text">SOS</span>

          {countdownVisible && (
            <div className="countdown-ring">
              <span className="countdown-number">{countdown}</span>
            </div>
          )}
        </button>

        {isPressed && countdownVisible && (
          <div className="hold-indicator">
            <div
              className="hold-progress"
              style={{
                width: `${((3 - countdown) / 3) * 100}%`,
              }}
            />
          </div>
        )}
      </div>

      {showConfirm && !sending && (
        <div className="sos-confirm-overlay" onClick={handleCancel}>
          <div className="sos-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>⚠️ Confirm SOS Activation</h3>

            <div className="sos-confirm-content">
              <p>
                <strong>Are you sure you need help?</strong>
              </p>
              <p>
                This will:
              </p>
              <ul>
                <li>📍 Share your exact location with {trustFriendName}</li>
                <li>📞 Alert emergency services (911)</li>
                <li>🔔 Send urgent notifications to your trusted contacts</li>
              </ul>
              <p className="sos-warning">
                Only activate if you're in immediate danger or need emergency assistance.
              </p>
            </div>

            <div className="sos-confirm-actions">
              <button className="btn-cancel" onClick={handleCancel}>
                Cancel
              </button>

              <button
                className="btn-confirm-sos"
                onClick={handleSOS}
                disabled={sending}
              >
                {sending ? 'Activating...' : 'Yes, Activate SOS'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sending && (
        <div className="sos-sending">
          <div className="spinner" />
          <p>Sending SOS...</p>
        </div>
      )}

      <div className="sos-contact-info">
        <p>📱 Emergency services will be contacted</p>
        <p>👥 Your trusted friend will receive your location</p>
      </div>
    </div>
  );
};

export default SOSButton;
