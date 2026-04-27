/**
 * Video Dating Badge Component
 * Displays a prominent badge when user is on a video call
 * Shows: "🎥 Video dating" with optional caller info
 */

import React, { useState, useEffect } from 'react';
import './VideoDatingBadge.css';

const VideoDatingBadge = ({ userId, matchId, showCallerInfo = true, onClick = null, size = 'medium' }) => {
  const [isVideoDating, setIsVideoDating] = useState(false);
  const [callInfo, setCallInfo] = useState(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!userId || !matchId) return;

    const checkVideoDatingStatus = async () => {
      try {
        const response = await fetch(`/api/dating/activity-status/${matchId}/${userId}`, {
          credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success && data.status) {
          const isVideo = data.status.isVideoDating || 
                         (data.status.callType === 'video' && data.status.inCall);
          
          if (isVideo && !isVideoDating) {
            setAnimating(true);
            setTimeout(() => setAnimating(false), 600);
          }
          
          setIsVideoDating(isVideo);
          setCallInfo(data.status);
        }
      } catch (error) {
        console.error('Error checking video dating status:', error);
      }
    };

    checkVideoDatingStatus();

    // Poll for updates every 5 seconds
    const interval = setInterval(checkVideoDatingStatus, 5000);

    // Listen for real-time updates
    // Socket.io listener would be added here if available
    const handleRealtimeUpdate = (event) => {
      if (event.userId === userId) {
        checkVideoDatingStatus();
      }
    };

    window.addEventListener('videoDatingStatusChange', handleRealtimeUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('videoDatingStatusChange', handleRealtimeUpdate);
    };
  }, [userId, matchId]);

  if (!isVideoDating) return null;

  return (
    <div
      className={`video-dating-badge ${size} ${animating ? 'animate-in' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : 'presentation'}
      tabIndex={onClick ? 0 : -1}
    >
      <div className="badge-content">
        <span className="badge-icon">🎥</span>
        <span className="badge-text">Video dating</span>
      </div>

      {showCallerInfo && callInfo && (
        <div className="caller-info">
          <span className="pulse"></span>
          <span className="info-text">Live call</span>
        </div>
      )}
    </div>
  );
};

export default VideoDatingBadge;
