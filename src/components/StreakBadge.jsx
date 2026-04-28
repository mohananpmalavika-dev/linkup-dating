/**
 * StreakBadge Component
 * Displays flame counter and streak information with FOMO psychology
 * Features: Flame emoji progression, milestone badges, urgency indicators
 */

import React, { useState, useEffect } from 'react';
import useStreaks from '../hooks/useStreaks';
import './StreakBadge.css';

const StreakBadge = ({ 
  matchId, 
  matchName = 'Match',
  compact = false,
  onClick = null,
  showTooltip = true
}) => {
  const { currentStreak, loading } = useStreaks(matchId);
  const [showMilestoneAlert, setShowMilestoneAlert] = useState(false);
  const [milestoneData, setMilestoneData] = useState(null);
  const [daysUntilBroken, setDaysUntilBroken] = useState(null);

  useEffect(() => {
    if (currentStreak?.milestoneTrigger) {
      setMilestoneData(currentStreak.milestoneTrigger);
      setShowMilestoneAlert(true);
      
      // Auto-dismiss milestone alert after 5 seconds
      const timeout = setTimeout(() => {
        setShowMilestoneAlert(false);
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [currentStreak]);

  useEffect(() => {
    if (currentStreak?.lastMessageDate) {
      const lastDate = new Date(currentStreak.lastMessageDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      lastDate.setHours(0, 0, 0, 0);
      
      const daysSince = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
      setDaysUntilBroken(Math.max(0, 1 - daysSince));
    }
  }, [currentStreak]);

  if (loading || !currentStreak) {
    return null;
  }

  const {
    streakDays = 0,
    flameEmoji = '',
    isBadgeEarned = false,
    otherUser = null
  } = currentStreak;

  // Don't show badge until 3+ days
  if (!isBadgeEarned) {
    return null;
  }

  const getDaysSinceMessage = () => {
    if (!currentStreak.lastMessageDate) return null;
    const lastDate = new Date(currentStreak.lastMessageDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);
    return Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
  };

  const daysSince = getDaysSinceMessage();
  const urgencyLevel = daysUntilBroken <= 0 ? 'critical' : daysUntilBroken <= 1 ? 'high' : 'normal';

  const getMilestoneLabel = () => {
    if (streakDays >= 100) return '🔥🔥🔥🔥🔥 Century Legend';
    if (streakDays >= 30) return '🔥🔥🔥 Month Crusher';
    if (streakDays >= 7) return '🔥🔥 Week Warrior';
    if (streakDays >= 3) return '🔥 First Flame';
    return '';
  };

  if (compact) {
    return (
      <div 
        className={`streak-badge-compact ${urgencyLevel}`}
        onClick={onClick}
        title={`${streakDays}-day streak with ${matchName}`}
      >
        <span className="flame-emoji">{flameEmoji}</span>
        <span className="streak-count">{streakDays}</span>
        {daysSince === 0 && <span className="status-badge">Today</span>}
      </div>
    );
  }

  return (
    <div className="streak-badge-container">
      <div className={`streak-badge ${urgencyLevel}`}>
        <div className="badge-header">
          <div className="badge-title">
            <span className="title-emoji">🔥</span>
            <h3>Streak with {matchName}</h3>
          </div>
          {otherUser && (
            <div className="badge-user-info">
              {otherUser.profilePhotoUrl && (
                <img 
                  src={otherUser.profilePhotoUrl} 
                  alt={otherUser.firstName}
                  className="user-avatar"
                />
              )}
              <span>{otherUser.firstName}</span>
            </div>
          )}
        </div>

        <div className="badge-content">
          <div className="flame-section">
            <div className="flame-display">{flameEmoji}</div>
            <div className="streak-info">
              <span className="days-count">{streakDays} days</span>
              <span className="days-label">consecutive messaging</span>
              {getMilestoneLabel() && (
                <span className="milestone-label">{getMilestoneLabel()}</span>
              )}
            </div>
          </div>

          <div className="urgency-indicator">
            {daysSince === 0 && (
              <div className="urgency-safe">
                ✅ Keep the streak alive! Message today!
              </div>
            )}
            {daysSince >= 1 && daysUntilBroken > 0 && (
              <div className="urgency-warning">
                ⏰ Only {daysUntilBroken} day left before streak breaks!
              </div>
            )}
            {daysUntilBroken <= 0 && (
              <div className="urgency-critical">
                🚨 Streak at risk! Message now to save it!
              </div>
            )}
          </div>

          <div className="milestone-progress">
            <div className="milestone-item">
              <span className="milestone-flame">🔥</span>
              <span className="milestone-label">3-Day</span>
              <span className={streakDays >= 3 ? 'badge-earned' : 'badge-progress'}>
                {streakDays >= 3 ? '✓' : `${3 - streakDays}`}
              </span>
            </div>
            <div className="milestone-item">
              <span className="milestone-flame">🔥🔥</span>
              <span className="milestone-label">7-Day</span>
              <span className={streakDays >= 7 ? 'badge-earned' : 'badge-progress'}>
                {streakDays >= 7 ? '✓' : `${Math.max(0, 7 - streakDays)}`}
              </span>
            </div>
            <div className="milestone-item">
              <span className="milestone-flame">🔥🔥🔥</span>
              <span className="milestone-label">30-Day</span>
              <span className={streakDays >= 30 ? 'badge-earned' : 'badge-progress'}>
                {streakDays >= 30 ? '✓' : `${Math.max(0, 30 - streakDays)}`}
              </span>
            </div>
            <div className="milestone-item">
              <span className="milestone-flame">🔥🔥🔥🔥🔥</span>
              <span className="milestone-label">100-Day</span>
              <span className={streakDays >= 100 ? 'badge-earned' : 'badge-progress'}>
                {streakDays >= 100 ? '✓' : `${Math.max(0, 100 - streakDays)}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {showMilestoneAlert && milestoneData && (
        <div className="milestone-alert">
          <div className="alert-animation">
            <div className="alert-content">
              <h4>🎉 {milestoneData.description}</h4>
              <p>Keep it going!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreakBadge;
