/**
 * Daily Challenges Widget
 * Displays today's challenges and point balance in a compact widget
 */

import React, { useState } from 'react';
import useDailyChallenges from '../hooks/useDailyChallenges';
import DailyChallengesModal from './DailyChallengesModal';
import '../styles/DailyChallengesWidget.css';

const DailyChallengesWidget = ({ onClose }) => {
  const {
    todayChallenges,
    pointsBalance,
    loading,
    updateProgress,
    leaderboard
  } = useDailyChallenges();

  const [showModal, setShowModal] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);

  const completedCount = todayChallenges.filter(c => c.isCompleted).length;
  const completionRate = todayChallenges.length > 0 
    ? Math.round((completedCount / todayChallenges.length) * 100) 
    : 0;

  const handleChallengeClick = (challenge) => {
    setSelectedChallenge(challenge);
    setShowModal(true);
  };

  const handleQuickAction = async (challenge) => {
    try {
      const result = await updateProgress(challenge.id, 1);
      if (result.completed) {
        // Show celebration
        showCelebration();
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const showCelebration = () => {
    const celebration = document.createElement('div');
    celebration.className = 'challenge-celebration';
    celebration.innerHTML = '🎉 Challenge Completed! +Points Earned!';
    document.body.appendChild(celebration);
    setTimeout(() => celebration.remove(), 3000);
  };

  if (loading && !todayChallenges.length) {
    return <div className="challenges-widget loading">Loading challenges...</div>;
  }

  return (
    <>
      <div className="challenges-widget">
        <div className="widget-header">
          <div className="widget-title">
            <span className="title-icon">🎯</span>
            <h3>Daily Challenges</h3>
          </div>
          <div className="widget-stats">
            <div className="stat">
              <span className="stat-value">{completedCount}/{todayChallenges.length}</span>
              <span className="stat-label">Completed</span>
            </div>
            <div className="stat">
              <span className="stat-value">{pointsBalance.availablePoints}</span>
              <span className="stat-label">Points</span>
            </div>
          </div>
        </div>

        <div className="widget-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <span className="progress-text">{completionRate}% Complete</span>
        </div>

        <div className="challenges-list">
          {todayChallenges.map(challenge => (
            <div 
              key={challenge.id} 
              className={`challenge-item ${challenge.isCompleted ? 'completed' : ''}`}
              onClick={() => handleChallengeClick(challenge)}
            >
              <div className="challenge-content">
                <div className="challenge-icon">{challenge.icon}</div>
                <div className="challenge-info">
                  <h4>{challenge.name}</h4>
                  <div className="challenge-meta">
                    <span className="progress">
                      {challenge.progressCount}/{challenge.targetCount}
                    </span>
                    <span className="points">+{challenge.rewardPoints}pts</span>
                  </div>
                </div>
              </div>
              <div className="challenge-status">
                {challenge.isCompleted ? (
                  <span className="badge-completed">✓ Done</span>
                ) : (
                  <button 
                    className="btn-quick-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickAction(challenge);
                    }}
                  >
                    {challenge.progressCount > 0 ? `+1` : 'Start'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="widget-footer">
          <button 
            className="btn-view-all"
            onClick={() => setShowModal(true)}
          >
            View All & Redeem
          </button>
          {onClose && (
            <button 
              className="btn-close"
              onClick={onClose}
            >
              ×
            </button>
          )}
        </div>

        {leaderboard.length > 0 && (
          <div className="mini-leaderboard">
            <h4>Top Earners This Week 🏆</h4>
            <div className="leaderboard-list">
              {leaderboard.slice(0, 3).map(entry => (
                <div key={entry.rank} className="leaderboard-entry">
                  <span className="rank">#{entry.rank}</span>
                  <span className="name">{entry.User?.firstName || 'User'}</span>
                  <span className="points">{entry.weeklyPoints}pts</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <DailyChallengesModal 
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          selectedChallenge={selectedChallenge}
        />
      )}
    </>
  );
};

export default DailyChallengesWidget;
