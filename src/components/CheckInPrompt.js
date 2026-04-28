import React, { useState, useEffect } from 'react';
import dateSafetyService from '../services/dateSafetyService';
import './DateSafetyKit.css';

const CheckInPrompt = ({ sessionId, onCheckIn, trustFriendName = 'your friend' }) => {
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState(null);
  const [nextCheckInTime, setNextCheckInTime] = useState(null);

  useEffect(() => {
    // Schedule check-in reminders every 30 minutes
    const interval = setInterval(() => {
      setShowCheckIn(true);
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleCheckIn = async (status) => {
    try {
      setSending(true);
      const result = await dateSafetyService.sendCheckIn(
        sessionId,
        status,
        message
      );

      if (result.success) {
        setLastCheckIn({
          status,
          timestamp: new Date(),
        });
        setNextCheckInTime(new Date(Date.now() + 30 * 60 * 1000));
        setShowCheckIn(false);
        setSelectedStatus(null);
        setMessage('');

        if (onCheckIn) {
          onCheckIn(status);
        }

        // Show success message
        alert(`Check-in sent to ${trustFriendName}! ✓`);
      }
    } catch (error) {
      alert(`Failed to send check-in: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'good':
        return '#4CAF50';
      case 'ok':
        return '#FF9800';
      case 'help':
        return '#f44336';
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'good':
        return '👍';
      case 'ok':
        return '👌';
      case 'help':
        return '🆘';
      default:
        return '❓';
    }
  };

  if (!showCheckIn && lastCheckIn) {
    return (
      <div className="check-in-status">
        <div className="check-in-status-content">
          <span className="check-in-status-icon">
            {getStatusIcon(lastCheckIn.status)}
          </span>
          <p>Last check-in: {lastCheckIn.status.toUpperCase()}</p>
          {nextCheckInTime && (
            <small>
              Next reminder: {nextCheckInTime.toLocaleTimeString()}
            </small>
          )}
        </div>
        <button
          className="btn-check-in-now"
          onClick={() => setShowCheckIn(true)}
        >
          Check In Again
        </button>
      </div>
    );
  }

  if (!showCheckIn) {
    return null;
  }

  return (
    <div className="check-in-modal-overlay" onClick={() => setShowCheckIn(false)}>
      <div className="check-in-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={() => setShowCheckIn(false)}>
          ✕
        </button>

        <div className="check-in-header">
          <h3>💬 How's your date?</h3>
          <p>Let {trustFriendName} know you're safe</p>
        </div>

        <div className="check-in-options">
          <button
            className={`check-in-btn check-in-good ${selectedStatus === 'good' ? 'selected' : ''}`}
            onClick={() => setSelectedStatus('good')}
            style={selectedStatus === 'good' ? { borderColor: getStatusColor('good') } : {}}
          >
            <span className="check-in-icon">👍</span>
            <span className="check-in-label">Going Great!</span>
            <span className="check-in-desc">Everything's perfect</span>
          </button>

          <button
            className={`check-in-btn check-in-ok ${selectedStatus === 'ok' ? 'selected' : ''}`}
            onClick={() => setSelectedStatus('ok')}
            style={selectedStatus === 'ok' ? { borderColor: getStatusColor('ok') } : {}}
          >
            <span className="check-in-icon">👌</span>
            <span className="check-in-label">It's Okay</span>
            <span className="check-in-desc">Things are fine</span>
          </button>

          <button
            className={`check-in-btn check-in-help ${selectedStatus === 'help' ? 'selected' : ''}`}
            onClick={() => setSelectedStatus('help')}
            style={selectedStatus === 'help' ? { borderColor: getStatusColor('help') } : {}}
          >
            <span className="check-in-icon">🆘</span>
            <span className="check-in-label">Need Help</span>
            <span className="check-in-desc">I need assistance</span>
          </button>
        </div>

        {selectedStatus === 'help' && (
          <div className="check-in-help-notice">
            <strong>⚠️ Important:</strong> If you're in immediate danger, call emergency services
            immediately. Your trusted friend will be notified and emergency services can be contacted.
          </div>
        )}

        {selectedStatus && (
          <div className="check-in-message">
            <textarea
              placeholder="Add a message (optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
            />
            <small>{message.length}/200 characters</small>
          </div>
        )}

        <div className="check-in-actions">
          <button
            className="btn-cancel"
            onClick={() => {
              setShowCheckIn(false);
              setSelectedStatus(null);
              setMessage('');
            }}
          >
            Cancel
          </button>

          <button
            className="btn-send-check-in"
            onClick={() => handleCheckIn(selectedStatus)}
            disabled={!selectedStatus || sending}
          >
            {sending ? 'Sending...' : 'Send Check-in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckInPrompt;
