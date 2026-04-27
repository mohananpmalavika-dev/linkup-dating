/**
 * Enhanced User Status Indicator Component
 * Displays activity status with privacy-aware details
 * Features:
 * - "Currently browsing" → "Last active 2 minutes ago"
 * - "On a video call" → "Video dating" badge
 * - Privacy-respecting display
 * - Real-time updates
 */

import React, { useState, useEffect } from 'react';
import { useRealTime } from '../hooks/useRealTime';
import { useUserStatus } from '../hooks/useRealTime';
import './EnhancedUserStatusIndicator.css';

const EnhancedUserStatusIndicator = ({ 
  userId, 
  matchId,
  showDetail = true,
  compactMode = false,
  onClick = null,
  enablePrivacy = true
}) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const { socket } = useRealTime();

  useEffect(() => {
    if (!socket || !userId || !matchId) return;

    const fetchStatus = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/dating/activity-status/${matchId}/${userId}`,
          { credentials: 'include' }
        );
        const data = await response.json();
        if (data.success) {
          setStatus(data);
        }
      } catch (error) {
        console.error('Error fetching status:', error);
      } finally {
        setLoading(false);
      }
    };

    // Fetch initial status
    fetchStatus();

    // Listen for real-time updates
    const handleStatusUpdate = (update) => {
      if (update.userId === userId && update.matchId === matchId) {
        setStatus(update);
      }
    };

    socket.on('user_status_update', handleStatusUpdate);

    // Poll for updates every 30 seconds as fallback
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      socket.off('user_status_update', handleStatusUpdate);
      clearInterval(interval);
    };
  }, [socket, userId, matchId]);

  if (loading) {
    return (
      <div className="status-indicator loading">
        <div className="status-dot skeleton"></div>
        <span className="status-text">Loading...</span>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="status-indicator offline">
        <div className="status-dot offline"></div>
        <span className="status-text">Offline</span>
      </div>
    );
  }

  const { formatted, privacy, status: statusObj } = status;

  // Check if we should hide the status based on privacy
  if (privacy && !privacy.share_detailed_status) {
    return (
      <div className="status-indicator private">
        <div className="status-dot private"></div>
        <span className="status-text">Privacy mode</span>
      </div>
    );
  }

  return (
    <div
      className={`status-indicator ${formatted.badge} ${compactMode ? 'compact' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : 'presentation'}
      tabIndex={onClick ? 0 : -1}
    >
      <div className={`status-dot ${formatted.badge}`}>
        {formatted.emoji && <span className="status-emoji">{formatted.emoji}</span>}
      </div>

      {showDetail && (
        <div className="status-content">
          <div className="status-primary">
            {formatted.text}
          </div>

          {statusObj.isVideoDating && (
            <div className="video-dating-badge">
              🎥 Video Dating
            </div>
          )}

          {statusObj.currentActivity && statusObj.currentActivity !== 'idle' && 
           privacy.show_activity_status && (
            <div className="activity-detail">
              {formatted.emoji} {formatted.text}
            </div>
          )}

          {statusObj.lastActiveFormatted && privacy.show_last_active && (
            <div className="last-active-detail">
              Last active {statusObj.lastActiveFormatted}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedUserStatusIndicator;
