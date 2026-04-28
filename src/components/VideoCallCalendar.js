import React, { useState, useEffect } from 'react';
import videoCallInsightsService from '../services/videoCallInsightsService';
import './VideoCallAnalytics.css';

const VideoCallCalendar = () => {
  const [upcomingCalls, setUpcomingCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    fetchUpcomingCalls();
  }, []);

  const fetchUpcomingCalls = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await videoCallInsightsService.getUpcomingCalls();

      if (result.success) {
        setUpcomingCalls(result.calls || []);
      } else {
        setError(result.error || 'Failed to load calendar');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTimeUntilCall = (scheduledAt) => {
    const now = new Date();
    const callTime = new Date(scheduledAt);
    const diffMs = callTime - now;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return 'Missed';
    if (diffMins < 1) return 'Starting now!';
    if (diffMins < 60) return `In ${diffMins}m`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `In ${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    return `In ${diffDays}d`;
  };

  if (loading) {
    return (
      <div className="calendar-container loading">
        <div className="spinner"></div>
        <p>Loading your video call schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="calendar-container error">
        <div className="error-message">
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={fetchUpcomingCalls} className="btn-retry">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <h2>📅 Video Call Schedule</h2>
        <p>Your upcoming video dates</p>
      </div>

      {upcomingCalls.length === 0 ? (
        <div className="empty-calendar">
          <span className="icon">📱</span>
          <h3>No Scheduled Calls</h3>
          <p>Schedule a video call with one of your matches!</p>
        </div>
      ) : (
        <div className="calls-list">
          {upcomingCalls.map(call => (
            <div
              key={call.id}
              className="call-item"
              onClick={() => setSelectedDate(call.id)}
            >
              <div className="call-date-time">
                <span className="date">{formatDate(call.scheduledAt)}</span>
                <span className="time">{formatTime(call.scheduledAt)}</span>
              </div>

              <div className="call-details">
                <h4>{call.title || `Video call with ${call.otherUser.first_name}`}</h4>
                <p className="match-name">
                  👤 {call.otherUser.first_name} {call.otherUser.last_name}
                </p>
              </div>

              <div className="call-status">
                <span className="time-until">{getTimeUntilCall(call.scheduledAt)}</span>
                <span className={`status-badge status-${call.status}`}>
                  {call.status}
                </span>
              </div>

              <div className="call-action">
                <button className="btn-join">
                  Join Call →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {upcomingCalls.length > 0 && (
        <div className="calendar-stats">
          <h3>📊 This Week</h3>
          <div className="stats-grid">
            <div className="stat">
              <span className="label">Scheduled Calls</span>
              <span className="value">{upcomingCalls.length}</span>
            </div>
            <div className="stat">
              <span className="label">Next Call</span>
              <span className="value">
                {formatDate(upcomingCalls[0].scheduledAt)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCallCalendar;
