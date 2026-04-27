/**
 * StreakBadge Component
 * Displays streak information with heart emoji (3+ days) or fire emoji (30+ days)
 */

import React, { useState, useEffect } from 'react';
import './StreakBadge.css';

const StreakBadge = ({ 
  matchId, 
  streakDays, 
  emoji = '❤️',
  isActive = true,
  totalMessages = 0,
  engagementScore = 0,
  onMilestoneReached = null
}) => {
  const [displayEmoji, setDisplayEmoji] = useState(emoji);
  const [streakText, setStreakText] = useState('');
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    // Determine emoji based on streak days
    if (streakDays >= 30) {
      setDisplayEmoji('🔥');
    } else if (streakDays >= 7) {
      setDisplayEmoji('❤️');
    } else if (streakDays >= 3) {
      setDisplayEmoji('❤️');
    }

    // Set streak text
    if (isActive && streakDays >= 3) {
      setStreakText(`${streakDays}${displayEmoji} Day Streak!`);
      setShowAnimation(true);
    }
  }, [streakDays, displayEmoji, isActive]);

  const getMilestoneMessage = () => {
    if (streakDays === 3) return '3-day streak reached! 💫';
    if (streakDays === 7) return '7-day streak! Amazing! 💎';
    if (streakDays === 30) return '30-day streak! Incredible! 🚀';
    return null;
  };

  if (!isActive || streakDays < 3) {
    return null;
  }

  return (
    <div className={`streak-badge ${showAnimation ? 'animate-in' : ''}`}>
      <div className="streak-content">
        <span className="streak-emoji">{displayEmoji}</span>
        <span className="streak-text">{streakText}</span>
      </div>

      {/* Streak details tooltip */}
      <div className="streak-tooltip">
        <div className="tooltip-header">
          <span className="tooltip-emoji">{displayEmoji}</span>
          <span className="tooltip-days">{streakDays}-Day Streak</span>
        </div>

        <div className="tooltip-stats">
          <div className="stat">
            <span className="stat-label">Messages:</span>
            <span className="stat-value">{totalMessages}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Engagement:</span>
            <span className="stat-value">{Math.round(engagementScore)}%</span>
          </div>
        </div>

        {getMilestoneMessage() && (
          <div className="milestone-badge">
            ✨ {getMilestoneMessage()}
          </div>
        )}

        <div className="tooltip-message">
          Keep messaging to continue your streak! 💬
        </div>
      </div>

      {/* Streak indicator line */}
      <div className="streak-indicator">
        <div className="indicator-filled" style={{
          width: `${Math.min((streakDays / 30) * 100, 100)}%`
        }}></div>
      </div>
    </div>
  );
};

export default StreakBadge;
