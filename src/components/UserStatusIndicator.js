/**
 * UserStatusIndicator Component
 * Displays online/offline status with last active time
 */
import React, { useState, useEffect } from 'react';
import { useUserStatus } from '../hooks/useRealTime';
import './UserStatusIndicator.css';

const UserStatusIndicator = ({
  userId,
  showLastActive = true,
  showDevice = false,
  size = 'medium',
  showLabel = true
}) => {
  const { status, loading } = useUserStatus(userId);
  const [lastActiveText, setLastActiveText] = useState('');

  // Format last active time
  useEffect(() => {
    if (!status?.lastActive) return;

    const updateLastActive = () => {
      const lastActive = new Date(status.lastActive);
      const now = new Date();
      const diffMs = now - lastActive;
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMinutes < 1) {
        setLastActiveText('just now');
      } else if (diffMinutes < 60) {
        setLastActiveText(`${diffMinutes}m ago`);
      } else if (diffHours < 24) {
        setLastActiveText(`${diffHours}h ago`);
      } else if (diffDays < 7) {
        setLastActiveText(`${diffDays}d ago`);
      } else {
        setLastActiveText(lastActive.toLocaleDateString());
      }
    };

    updateLastActive();
    const interval = setInterval(updateLastActive, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [status?.lastActive]);

  if (loading) {
    return <div className={`status-indicator loading ${size}`} />;
  }

  if (!status) {
    return <div className={`status-indicator offline ${size}`} />;
  }

  const isOnline = status.status === 'online';

  return (
    <div className={`user-status-container ${size}`}>
      <div
        className={`status-indicator ${isOnline ? 'online' : 'offline'} ${size}`}
        title={isOnline ? 'Online' : lastActiveText}
      >
        {isOnline && <span className="pulse" />}
      </div>

      {showLabel && (
        <div className="status-info">
          <span className={`status-label ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          {showLastActive && !isOnline && (
            <span className="last-active">{lastActiveText}</span>
          )}
        </div>
      )}

      {showDevice && status.device && (
        <span className="device-badge">{status.device}</span>
      )}
    </div>
  );
};

export default UserStatusIndicator;
