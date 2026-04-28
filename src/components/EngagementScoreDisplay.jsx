/**
 * EngagementScoreDisplay Component
 * Shows engagement score, streak status, and connection health
 * Provides a visual representation of relationship momentum
 */

import React, { useState, useEffect } from 'react';
import './EngagementScoreDisplay.css';

const EngagementScoreDisplay = ({ 
  matchId, 
  streakDays = 0, 
  engagementScore = 0,
  totalMessages = 0,
  reactionCount = 0,
  isActive = true
}) => {
  const [scorePercentage, setScorePercentage] = useState(0);
  const [scoreLevel, setScoreLevel] = useState('Low');
  const [scoreColor, setScoreColor] = useState('gray');
  const [nextMilestone, setNextMilestone] = useState(null);
  const [daysUntilMilestone, setDaysUntilMilestone] = useState(0);

  useEffect(() => {
    // Calculate score percentage (normalized to 0-100)
    const percentage = Math.min(Math.round((engagementScore / 1000) * 100), 100);
    setScorePercentage(percentage);

    // Determine score level
    if (percentage >= 80) {
      setScoreLevel('Fire');
      setScoreColor('fire');
    } else if (percentage >= 60) {
      setScoreLevel('Strong');
      setScoreColor('strong');
    } else if (percentage >= 40) {
      setScoreLevel('Growing');
      setScoreColor('growing');
    } else if (percentage >= 20) {
      setScoreLevel('Building');
      setScoreColor('building');
    } else {
      setScoreLevel('Low');
      setScoreColor('low');
    }

    // Calculate next milestone
    if (streakDays < 3) {
      setNextMilestone(3);
      setDaysUntilMilestone(3 - streakDays);
    } else if (streakDays < 7) {
      setNextMilestone(7);
      setDaysUntilMilestone(7 - streakDays);
    } else if (streakDays < 30) {
      setNextMilestone(30);
      setDaysUntilMilestone(30 - streakDays);
    } else {
      setNextMilestone(null);
      setDaysUntilMilestone(0);
    }
  }, [engagementScore, streakDays]);

  const getMilestoneEmoji = (days) => {
    if (days >= 30) return '🔥';
    if (days >= 7) return '💎';
    if (days >= 3) return '❤️';
    return '🔄';
  };

  const getScoreIcon = () => {
    if (scorePercentage >= 80) return '🔥';
    if (scorePercentage >= 60) return '⚡';
    if (scorePercentage >= 40) return '✨';
    if (scorePercentage >= 20) return '🌱';
    return '💫';
  };

  return (
    <div className="engagement-score-display">
      <div className="score-header">
        <h3 className="score-title">Connection Momentum</h3>
        <span className="score-value">{scorePercentage}%</span>
      </div>

      <div className="score-container">
        {/* Main circular progress */}
        <div className="score-circle-wrapper">
          <svg className="score-circle" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              className={`score-background ${scoreColor}`}
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              className={`score-progress ${scoreColor}`}
              style={{
                strokeDasharray: `${(scorePercentage / 100) * 339.29} 339.29`
              }}
            />
          </svg>
          <div className="score-center">
            <span className="score-icon">{getScoreIcon()}</span>
            <span className="score-level">{scoreLevel}</span>
          </div>
        </div>

        {/* Metrics breakdown */}
        <div className="score-metrics">
          <div className="metric-item">
            <span className="metric-icon">❤️</span>
            <div className="metric-content">
              <span className="metric-label">Streak</span>
              <span className="metric-value">
                {streakDays} {streakDays === 1 ? 'day' : 'days'}
              </span>
            </div>
          </div>

          <div className="metric-item">
            <span className="metric-icon">💬</span>
            <div className="metric-content">
              <span className="metric-label">Messages</span>
              <span className="metric-value">{totalMessages}</span>
            </div>
          </div>

          <div className="metric-item">
            <span className="metric-icon">😊</span>
            <div className="metric-content">
              <span className="metric-label">Reactions</span>
              <span className="metric-value">{reactionCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Next milestone card */}
      {nextMilestone && (
        <div className="next-milestone">
          <div className="milestone-indicator">
            <span className="milestone-emoji">{getMilestoneEmoji(nextMilestone)}</span>
            <div className="milestone-info">
              <span className="milestone-text">
                {nextMilestone} days to unlock
              </span>
              <span className="milestone-countdown">
                {daysUntilMilestone} {daysUntilMilestone === 1 ? 'day' : 'days'} away
              </span>
            </div>
          </div>
          <div className="milestone-progress">
            <div 
              className="milestone-bar"
              style={{
                width: `${((streakDays / nextMilestone) * 100).toFixed(0)}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Milestone achieved card */}
      {streakDays >= 30 && !nextMilestone && (
        <div className="milestone-achieved">
          <div className="achieved-icon">🏆</div>
          <div className="achieved-content">
            <span className="achieved-title">Legendary Status!</span>
            <span className="achieved-message">
              You've maintained a 30+ day streak. This is a remarkable connection!
            </span>
          </div>
        </div>
      )}

      {/* Inactive state */}
      {!isActive && streakDays > 0 && (
        <div className="streak-alert">
          <span className="alert-icon">⏸️</span>
          <span className="alert-text">Streak paused - message to continue</span>
        </div>
      )}
    </div>
  );
};

export default EngagementScoreDisplay;
