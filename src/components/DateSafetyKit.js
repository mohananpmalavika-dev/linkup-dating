import React, { useState, useEffect } from 'react';
import dateSafetyService from '../services/dateSafetyService';
import LiveLocationSharing from './LiveLocationSharing';
import CheckInPrompt from './CheckInPrompt';
import SafetyTips from './SafetyTips';
import SOSButton from './SOSButton';
import './DateSafetyKit.css';

const DateSafetyKit = ({ matchId, trustedFriendId, friendName = 'Trusted Friend' }) => {
  const [sessionId, setSessionId] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [sessionDetails, setSessionDetails] = useState(null);
  const [sessionDuration, setSessionDuration] = useState(null);
  const [tipsAcknowledged, setTipsAcknowledged] = useState(false);

  // Timer for session duration
  useEffect(() => {
    let interval;
    if (sessionActive && sessionDetails) {
      interval = setInterval(() => {
        const now = new Date();
        const startTime = new Date(sessionDetails.startTime);
        const durationMs = now - startTime;
        const durationMinutes = Math.floor(durationMs / 60000);
        const durationSeconds = Math.floor((durationMs % 60000) / 1000);
        setSessionDuration(`${durationMinutes}m ${durationSeconds}s`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionActive, sessionDetails]);

  const startSafetySession = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!trustedFriendId) {
        throw new Error('Please select a trusted friend');
      }

      const result = await dateSafetyService.startSession(
        trustedFriendId,
        matchId,
        180 // 3 hours default
      );

      if (result.success) {
        setSessionId(result.sessionId);
        setSessionActive(true);
        setSessionDetails({
          ...result.session,
          startTime: new Date(),
        });
        setActiveTab('overview');
      } else {
        throw new Error(result.error || 'Failed to start session');
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to start safety session:', err);
    } finally {
      setLoading(false);
    }
  };

  const endSafetySession = async () => {
    try {
      setLoading(true);

      const result = await dateSafetyService.endSession(sessionId);

      if (result.success) {
        setSessionActive(false);
        setSessionId(null);
        setSessionDetails(null);
        setSessionDuration(null);
        alert('Safety session ended. Stay safe! ✓');
      } else {
        throw new Error(result.error || 'Failed to end session');
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to end safety session:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!sessionActive && !sessionId) {
    return (
      <div className="date-safety-kit initial-state">
        <div className="safety-kit-header-banner">
          <div className="banner-content">
            <h2>🛡️ First Date Safety Kit</h2>
            <p>Stay safe on your date with live location sharing and emergency support</p>
          </div>
          <div className="banner-icon">🛡️</div>
        </div>

        <div className="safety-features-overview">
          <div className="feature-card">
            <span className="feature-icon">📍</span>
            <h3>Live Location Sharing</h3>
            <p>Share your real-time location with a trusted friend during your date</p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">💬</span>
            <h3>Regular Check-ins</h3>
            <p>Send quick status updates with one tap - "Good", "OK", or "Help"</p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">📋</span>
            <h3>Safety Tips</h3>
            <p>Learn 8 essential safety tips for dating confidently and safely</p>
          </div>

          <div className="feature-card">
            <span className="feature-icon">🆘</span>
            <h3>SOS Emergency</h3>
            <p>Quick access to emergency services if you need immediate help</p>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        <div className="safety-kit-cta">
          <button
            className="btn-start-safety-kit"
            onClick={startSafetySession}
            disabled={loading || !trustedFriendId}
          >
            {loading ? 'Starting...' : '🛡️ Activate Safety Kit'}
          </button>

          {!trustedFriendId && (
            <p className="warning-text">
              ⚠️ Please select a trusted friend first
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="date-safety-kit active-session">
      {/* Session Header */}
      <div className="session-header">
        <div className="session-status">
          <span className="status-badge active">🟢 ACTIVE</span>
          <h2>Date Safety Session</h2>
          <p>Duration: {sessionDuration}</p>
        </div>

        <button
          className="btn-end-session"
          onClick={endSafetySession}
          disabled={loading}
        >
          ✕ End Session
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="session-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📋 Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'location' ? 'active' : ''}`}
          onClick={() => setActiveTab('location')}
        >
          📍 Location
        </button>
        <button
          className={`tab-btn ${activeTab === 'safety' ? 'active' : ''}`}
          onClick={() => setActiveTab('safety')}
        >
          🛡️ Safety Tips
        </button>
        <button
          className={`tab-btn ${activeTab === 'emergency' ? 'active' : ''}`}
          onClick={() => setActiveTab('emergency')}
        >
          🆘 Emergency
        </button>
      </div>

      {/* Tab Content */}
      <div className="session-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-pane overview-pane">
            <h3>Session Overview</h3>

            <div className="overview-cards">
              <div className="overview-card">
                <span className="card-icon">👥</span>
                <h4>Trusted Friend</h4>
                <p>{friendName}</p>
              </div>

              <div className="overview-card">
                <span className="card-icon">⏱️</span>
                <h4>Duration</h4>
                <p>{sessionDuration}</p>
              </div>

              <div className="overview-card">
                <span className="card-icon">💬</span>
                <h4>Check-ins</h4>
                <p>{sessionDetails?.checkInCount || 0}</p>
              </div>

              <div className="overview-card">
                <span className="card-icon">📍</span>
                <h4>Updates</h4>
                <p>{sessionDetails?.locationHistoryCount || 0}</p>
              </div>
            </div>

            <CheckInPrompt
              sessionId={sessionId}
              trustFriendName={friendName}
              onCheckIn={() => {
                // Refresh session details
              }}
            />
          </div>
        )}

        {/* Location Tab */}
        {activeTab === 'location' && (
          <div className="tab-pane location-pane">
            <LiveLocationSharing
              sessionId={sessionId}
              friendName={friendName}
              onLocationUpdate={() => {
                // Handle location update
              }}
            />
          </div>
        )}

        {/* Safety Tips Tab */}
        {activeTab === 'safety' && (
          <div className="tab-pane safety-pane">
            <SafetyTips
              sessionId={sessionId}
              onAcknowledge={() => setTipsAcknowledged(true)}
            />
          </div>
        )}

        {/* Emergency Tab */}
        {activeTab === 'emergency' && (
          <div className="tab-pane emergency-pane">
            <div className="emergency-notice">
              <h3>🆘 Emergency Support</h3>
              <p className="emergency-warning">
                Use this only if you're in immediate danger or need emergency assistance.
              </p>
            </div>

            <SOSButton
              sessionId={sessionId}
              trustFriendName={friendName}
              onSOS={(result) => {
                // Handle SOS activation
              }}
            />

            <div className="emergency-resources">
              <h4>📞 Emergency Resources</h4>

              <div className="resource-card">
                <h5>Emergency Services</h5>
                <p>Call 911 for immediate emergency assistance</p>
                <button className="btn-call-emergency">
                  📞 Call 911
                </button>
              </div>

              <div className="resource-card">
                <h5>Crisis Text Line</h5>
                <p>Text HOME to 741741 for free crisis support</p>
                <button className="btn-text-crisis">
                  💬 Text Crisis Line
                </button>
              </div>

              <div className="resource-card">
                <h5>National Domestic Violence Hotline</h5>
                <p>1-800-799-7233 - Available 24/7</p>
                <button className="btn-call-hotline">
                  📞 Call Hotline
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tips Acknowledgment Reminder */}
      {!tipsAcknowledged && (
        <div className="tips-reminder">
          <span className="reminder-icon">📋</span>
          <p>👉 Don't forget to review the safety tips before your date!</p>
          <button
            className="btn-view-tips"
            onClick={() => setActiveTab('safety')}
          >
            View Tips
          </button>
        </div>
      )}
    </div>
  );
};

export default DateSafetyKit;
