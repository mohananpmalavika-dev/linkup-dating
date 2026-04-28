/**
 * Daily Challenges Modal
 * Detailed view of challenges with redemption options
 */

import React, { useState, useMemo } from 'react';
import useDailyChallenges from '../hooks/useDailyChallenges';
import '../styles/DailyChallengesModal.css';

const REWARD_OPTIONS = [
  { id: 'premium_week', label: '1 Week Premium', points: 100, value: '1 week premium' },
  { id: 'premium_month', label: '1 Month Premium', points: 300, value: '1 month premium' },
  { id: 'super_likes', label: '5 Super Likes', points: 50, value: '5 super likes' },
  { id: 'boost', label: '1 Boost', points: 75, value: '1 profile boost' },
  { id: 'rewind', label: '1 Rewind', points: 60, value: '1 rewind' },
  { id: 'spotlight', label: '1 Spotlight', points: 150, value: '1 spotlight listing' }
];

const DailyChallengesModal = ({ isOpen, onClose, selectedChallenge }) => {
  const {
    todayChallenges,
    weeklyChallenges,
    pointsBalance,
    redemptionHistory,
    loading,
    updateProgress,
    redeemPoints,
    applyRedemption,
    fetchRedemptionHistory
  } = useDailyChallenges();

  const [activeTab, setActiveTab] = useState('today');
  const [selectedReward, setSelectedReward] = useState(null);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const completedCount = todayChallenges.filter(c => c.isCompleted).length;
  const totalTodayPoints = todayChallenges.reduce((sum, c) => 
    sum + (c.isCompleted ? c.rewardPoints : 0), 0
  );

  const handleRedeemReward = async (reward) => {
    try {
      setRedeemLoading(true);
      const result = await redeemPoints(reward.points, reward.id, reward.value);
      if (result) {
        setSuccessMessage(`Successfully redeemed ${reward.label}!`);
        setTimeout(() => setSuccessMessage(''), 3000);
        await fetchRedemptionHistory();
      }
    } catch (error) {
      console.error('Error redeeming reward:', error);
    } finally {
      setRedeemLoading(false);
    }
  };

  const canRedeem = (rewardPoints) => {
    return pointsBalance.availablePoints >= rewardPoints;
  };

  const renderChallengeItem = (challenge) => (
    <div key={challenge.id} className={`challenge-card ${challenge.isCompleted ? 'completed' : ''}`}>
      <div className="challenge-card-header">
        <div className="challenge-title">
          <span className="icon">{challenge.icon}</span>
          <h4>{challenge.name}</h4>
        </div>
        {challenge.isCompleted && <span className="badge-done">✓</span>}
      </div>

      <p className="challenge-description">{challenge.description}</p>

      <div className="challenge-card-footer">
        <div className="progress-section">
          <div className="progress-bar-small">
            <div 
              className="progress-fill-small"
              style={{ 
                width: `${Math.min((challenge.progressCount / challenge.targetCount) * 100, 100)}%` 
              }}
            />
          </div>
          <span className="progress-text">{challenge.progressCount}/{challenge.targetCount}</span>
        </div>
        <div className="reward-badge">+{challenge.rewardPoints}pts</div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="challenges-modal-overlay" onClick={onClose}>
      <div className="challenges-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Daily Challenges</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          <button 
            className={`tab ${activeTab === 'today' ? 'active' : ''}`}
            onClick={() => setActiveTab('today')}
          >
            Today ({completedCount})
          </button>
          <button 
            className={`tab ${activeTab === 'weekly' ? 'active' : ''}`}
            onClick={() => setActiveTab('weekly')}
          >
            This Week
          </button>
          <button 
            className={`tab ${activeTab === 'redeem' ? 'active' : ''}`}
            onClick={() => setActiveTab('redeem')}
          >
            Rewards
          </button>
          <button 
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </div>

        <div className="modal-content">
          {successMessage && (
            <div className="success-message">{successMessage}</div>
          )}

          {activeTab === 'today' && (
            <div className="challenges-grid">
              {todayChallenges.map(renderChallengeItem)}
              {todayChallenges.length === 0 && (
                <div className="empty-state">
                  <p>No challenges available today</p>
                </div>
              )}
              {completedCount > 0 && (
                <div className="today-summary">
                  <span className="summary-text">
                    You've earned <strong>{totalTodayPoints} points</strong> today!
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'weekly' && (
            <div className="weekly-challenges">
              {Object.entries(weeklyChallenges).map(([day, challenges]) => (
                <div key={day} className="day-section">
                  <h3 className="day-title">{day.charAt(0).toUpperCase() + day.slice(1)}</h3>
                  <div className="challenges-grid">
                    {challenges.map(renderChallengeItem)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'redeem' && (
            <div className="redeem-section">
              <div className="points-display">
                <h3>Your Balance</h3>
                <div className="points-info">
                  <div className="points-card">
                    <span className="points-label">Available Points</span>
                    <span className="points-amount">{pointsBalance.availablePoints}</span>
                  </div>
                  <div className="points-card">
                    <span className="points-label">Weekly Points</span>
                    <span className="points-amount">{pointsBalance.weeklyPoints}</span>
                  </div>
                  <div className="points-card">
                    <span className="points-label">Streak</span>
                    <span className="points-amount">{pointsBalance.monthlyStreak}w</span>
                  </div>
                </div>
              </div>

              <div className="rewards-grid">
                {REWARD_OPTIONS.map(reward => (
                  <div 
                    key={reward.id}
                    className={`reward-card ${canRedeem(reward.points) ? 'available' : 'unavailable'}`}
                  >
                    <h4>{reward.label}</h4>
                    <div className="reward-points">{reward.points} pts</div>
                    <button
                      className="btn-redeem"
                      onClick={() => handleRedeemReward(reward)}
                      disabled={!canRedeem(reward.points) || redeemLoading}
                    >
                      {redeemLoading ? 'Redeeming...' : 'Redeem'}
                    </button>
                  </div>
                ))}
              </div>

              {pointsBalance.availablePoints === 0 && (
                <div className="empty-state">
                  <p>Complete challenges to earn points!</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="history-section">
              {redemptionHistory.length > 0 ? (
                <div className="history-list">
                  {redemptionHistory.map(item => (
                    <div key={item.id} className="history-item">
                      <div className="history-info">
                        <h4>{item.rewardValue}</h4>
                        <span className="history-date">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="history-meta">
                        <span className={`status status-${item.status}`}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </span>
                        <span className="points-cost">-{item.pointsRedeemed}pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No redemption history yet</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p className="footer-text">
            💡 Complete daily challenges to unlock premium features without spending money!
          </p>
        </div>
      </div>
    </div>
  );
};

export default DailyChallengesModal;
