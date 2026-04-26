/**
 * ActivityStatus Component
 * Shows current user activity (viewing profile, in call, etc.)
 */
import React, { useState, useCallback } from 'react';
import { useUserActivity } from '../hooks/useRealTime';
import './ActivityStatus.css';

const ActivityStatus = ({
  activityType, // 'viewing_profile', 'voice_calling', 'video_calling', 'in_chat'
  matchId,
  targetUserId,
  onActivityChange,
  displayName = 'Activity',
  icon = '🔄'
}) => {
  const [isActive, setIsActive] = useState(false);
  const { startActivity, endActivity, error } = useUserActivity(
    activityType,
    matchId,
    targetUserId
  );

  const handleToggle = useCallback(async () => {
    try {
      if (isActive) {
        await endActivity();
        setIsActive(false);
      } else {
        await startActivity();
        setIsActive(true);
      }
      onActivityChange?.(activityType, !isActive);
    } catch (err) {
      console.error('Activity toggle error:', err);
    }
  }, [isActive, startActivity, endActivity, activityType, onActivityChange]);

  const getActivityEmoji = () => {
    switch (activityType) {
      case 'viewing_profile':
        return '👁️';
      case 'voice_calling':
        return '☎️';
      case 'video_calling':
        return '📹';
      case 'in_chat':
        return '💬';
      default:
        return icon;
    }
  };

  const getActivityLabel = () => {
    switch (activityType) {
      case 'viewing_profile':
        return 'Viewing Profile';
      case 'voice_calling':
        return 'Voice Call';
      case 'video_calling':
        return 'Video Call';
      case 'in_chat':
        return 'In Chat';
      default:
        return displayName;
    }
  };

  return (
    <div className={`activity-status ${isActive ? 'active' : 'inactive'}`}>
      <button
        className="activity-button"
        onClick={handleToggle}
        title={`${isActive ? 'Stop' : 'Start'} ${getActivityLabel()}`}
      >
        <span className="activity-emoji">{getActivityEmoji()}</span>
        <span className="activity-label">{getActivityLabel()}</span>
        {isActive && <span className="activity-pulse" />}
      </button>

      {error && (
        <div className="activity-error">
          {error}
        </div>
      )}
    </div>
  );
};

export default ActivityStatus;
