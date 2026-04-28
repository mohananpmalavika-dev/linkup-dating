/**
 * StreakLeaderboard Component
 * Displays top streaks to drive competition and FOMO
 */

import React, { useState, useEffect } from 'react';
import useStreaks from '../hooks/useStreaks';
import '../styles/StreakLeaderboard.css';

const StreakLeaderboard = ({ limit = 10 }) => {
  const { leaderboard, loading, refetch } = useStreaks();
  const [selectedStreak, setSelectedStreak] = useState(null);

  if (loading) {
    return <div className="leaderboard-loading">Loading streaks...</div>;
  }

  if (!leaderboard || leaderboard.length === 0) {
    return <div className="leaderboard-empty">No streaks yet. Be the first!</div>;
  }

  const displayLeaderboard = leaderboard.slice(0, limit);

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getFlameColor = (streakDays) => {
    if (streakDays >= 100) return 'legendary';
    if (streakDays >= 30) return 'gold';
    if (streakDays >= 7) return 'silver';
    return 'bronze';
  };

  return (
    <div className="streak-leaderboard">
      <div className="leaderboard-header">
        <h2>🔥 Streak Leaderboard</h2>
        <p>Top messaging streaks</p>
      </div>

      <div className="leaderboard-list">
        {displayLeaderboard.map((streak, index) => (
          <div
            key={streak.id || index}
            className={`leaderboard-item rank-${getMedalEmoji(streak.rank).replace('#', '').replace(/\D/g, '')}`}
            onClick={() => setSelectedStreak(streak)}
          >
            <div className="item-rank">
              <span className="medal">{getMedalEmoji(streak.rank)}</span>
            </div>

            <div className="item-info">
              <div className="item-match-names">
                {streak.matchNames}
              </div>
              <div className="item-details">
                <span className="detail-stat">
                  {streak.totalMessages} messages
                </span>
                <span className="detail-separator">•</span>
                <span className="detail-stat">
                  {Math.round(streak.engagementScore)} engagement
                </span>
              </div>
            </div>

            <div className={`item-flame flame-${getFlameColor(streak.streakDays)}`}>
              <span className="flame-emoji">{streak.flameEmoji}</span>
              <span className="flame-days">{streak.streakDays}</span>
            </div>
          </div>
        ))}
      </div>

      {selectedStreak && (
        <div className="leaderboard-modal-overlay" onClick={() => setSelectedStreak(null)}>
          <div className="leaderboard-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setSelectedStreak(null)}
            >
              ✕
            </button>

            <div className="modal-content">
              <div className="modal-header">
                <h3>{selectedStreak.matchNames}</h3>
                <div className="modal-flame">
                  {selectedStreak.flameEmoji} {selectedStreak.streakDays} days
                </div>
              </div>

              <div className="modal-stats">
                <div className="stat-card">
                  <span className="stat-icon">💬</span>
                  <span className="stat-label">Total Messages</span>
                  <span className="stat-value">{selectedStreak.totalMessages}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-icon">⚡</span>
                  <span className="stat-label">Engagement Score</span>
                  <span className="stat-value">{Math.round(selectedStreak.engagementScore)}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-icon">📅</span>
                  <span className="stat-label">Streak Started</span>
                  <span className="stat-value">
                    {new Date(selectedStreak.streakStartDate).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="modal-achievements">
                <h4>Achievements Unlocked</h4>
                <div className="achievements-list">
                  {selectedStreak.milestone3Days && (
                    <div className="achievement">
                      <span className="achievement-icon">🔥</span>
                      <span>3-Day Flame</span>
                    </div>
                  )}
                  {selectedStreak.milestone7Days && (
                    <div className="achievement">
                      <span className="achievement-icon">🔥🔥</span>
                      <span>Week Warrior</span>
                    </div>
                  )}
                  {selectedStreak.milestone30Days && (
                    <div className="achievement">
                      <span className="achievement-icon">🔥🔥🔥</span>
                      <span>Month Crusher</span>
                    </div>
                  )}
                  {selectedStreak.streakDays >= 100 && (
                    <div className="achievement">
                      <span className="achievement-icon">🔥🔥🔥🔥🔥</span>
                      <span>Century Legend</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreakLeaderboard;
