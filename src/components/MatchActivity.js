/**
 * MatchActivity Component
 * Displays comprehensive match activity status
 */
import React, { useEffect } from 'react';
import { useMatchActivity } from '../hooks/useRealTime';
import './MatchActivity.css';

const MatchActivity = ({ matchId, onActivityChange }) => {
  const { activity, loading, refresh } = useMatchActivity(matchId);

  useEffect(() => {
    // Refresh activity every 5 seconds
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (activity) {
      onActivityChange?.(activity);
    }
  }, [activity, onActivityChange]);

  if (loading) {
    return <div className="match-activity loading">Loading activity...</div>;
  }

  if (!activity) {
    return null;
  }

  const {
    activeUsers = [],
    typing = [],
    updatedAt
  } = activity;

  return (
    <div className="match-activity-container">
      {/* Active Users */}
      {activeUsers.length > 0 && (
        <div className="activity-section active-users">
          <div className="section-header">
            <span className="icon">👥</span>
            <span className="title">In Chat</span>
            <span className="count">{activeUsers.length}</span>
          </div>
          <div className="users-list">
            {activeUsers.map((user) => (
              <div
                key={user.userId}
                className={`user-item ${user.status}`}
              >
                <span className="user-id">User {user.userId}</span>
                {user.isTyping && (
                  <span className="typing-badge">typing...</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Typing Users */}
      {typing.length > 0 && (
        <div className="activity-section typing-users">
          <div className="section-header">
            <span className="icon">✏️</span>
            <span className="title">Typing</span>
            <span className="count">{typing.length}</span>
          </div>
          <div className="typing-animation">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="activity-footer">
        <span className="updated-at">
          Updated: {new Date(updatedAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

export default MatchActivity;
