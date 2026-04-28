/**
 * AchievementNotification Component
 * Toast-style notification for achievement unlocks and rank changes
 */

import React, { useEffect, useState } from 'react';
import './AchievementNotification.css';

const AchievementNotification = ({ notification, type = 'achievement' }) => {
  const [isVisible, setIsVisible] = useState(Boolean(notification));
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      setIsExiting(false);

      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => {
          setIsVisible(false);
        }, 300);
      }, 4500);

      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (!isVisible || !notification) {
    return null;
  }

  if (type === 'achievement') {
    const { emoji, name, timestamp } = notification;
    return (
      <div className={`achievement-notification ${isExiting ? 'exit' : 'enter'}`}>
        <div className="notification-content">
          <div className="notification-emoji">{emoji}</div>
          <div className="notification-text">
            <div className="notification-title">Achievement Unlocked!</div>
            <div className="notification-message">{name}</div>
          </div>
          <div className="notification-confetti">
            {[...Array(5)].map((_, i) => (
              <span key={i} className="confetti-piece">✨</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === 'rank') {
    const { newRank, type: rankType, improved } = notification;
    return (
      <div className={`achievement-notification rank ${isExiting ? 'exit' : 'enter'} ${improved ? 'improved' : ''}`}>
        <div className="notification-content">
          <div className="notification-emoji">{improved ? '📈' : '📉'}</div>
          <div className="notification-text">
            <div className="notification-title">
              {improved ? 'Rank Improved!' : 'Rank Updated'}
            </div>
            <div className="notification-message">
              You're now #{newRank} in {rankType}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AchievementNotification;
