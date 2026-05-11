import React, { useState } from 'react';
import { useNavigate } from '../router';
import useAchievements from '../hooks/useAchievements';
import LeaderboardDisplay from './LeaderboardDisplay';
import './AchievementNotification.css';

const AchievementsPage = ({ defaultTab = 'achievements' }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const {
    unlockedAchievements,
    leaderboardRanks,
    achievementNotification,
    rankNotification,
    checkAndUnlockAchievements,
    featureAchievement,
    getUserRank
  } = useAchievements();

  const handleFeatureAchievement = async (achievementId) => {
    await featureAchievement(achievementId);
  };

  const handleCheckAchievements = async () => {
    await checkAndUnlockAchievements();
  };

  return (
    <div className="achievements-page">
      <div className="achievements-header">
        <button className="btn-back" onClick={() => navigate('/discover')}>
          ← Back
        </button>
        <h1>Achievements & Rankings</h1>
        <div className="achievements-tabs">
          <button
            className={activeTab === 'achievements' ? 'active' : ''}
            onClick={() => setActiveTab('achievements')}
          >
            🏆 My Achievements
          </button>
          <button
            className={activeTab === 'leaderboards' ? 'active' : ''}
            onClick={() => setActiveTab('leaderboards')}
          >
            🥇 Leaderboards
          </button>
        </div>
      </div>

      {/* Achievement notification toast */}
      {achievementNotification && (
        <div className="achievement-notification-toast">
          <span className="achievement-emoji">{achievementNotification.emoji}</span>
          <div className="achievement-info">
            <strong>Achievement Unlocked!</strong>
            <span>{achievementNotification.name}</span>
          </div>
        </div>
      )}

      {/* Rank notification toast */}
      {rankNotification && (
        <div className="rank-notification-toast">
          <span className="rank-emoji">{rankNotification.improved ? '📈' : '📉'}</span>
          <div className="rank-info">
            <strong>Rank {rankNotification.improved ? 'Improved!' : 'Updated'}</strong>
            <span>#{rankNotification.newRank} in {rankNotification.type}</span>
          </div>
        </div>
      )}

      {activeTab === 'achievements' && (
        <div className="achievements-content">
          <div className="achievements-actions">
            <button className="btn btn-primary" onClick={handleCheckAchievements}>
              Check for New Achievements
            </button>
          </div>

          {unlockedAchievements.length === 0 ? (
            <div className="empty-state">
              <p>No achievements unlocked yet. Keep using DatingHub to earn badges!</p>
            </div>
          ) : (
            <div className="achievements-grid">
              {unlockedAchievements.map((achievement, index) => (
                <div key={achievement.code || index} className="achievement-card">
                  <div className="achievement-icon">{achievement.emoji || '🏆'}</div>
                  <h3>{achievement.name || achievement.achievementName}</h3>
                  <p>{achievement.description || achievement.achievementCode}</p>
                  {achievement.timestamp && (
                    <span className="achievement-date">
                      Unlocked {new Date(achievement.timestamp).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    className="btn-feature"
                    onClick={() => handleFeatureAchievement(achievement.id || achievement.code)}
                  >
                    Feature on Profile
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'leaderboards' && (
        <LeaderboardDisplay ranks={leaderboardRanks} onGetUserRank={getUserRank} />
      )}
    </div>
  );
};

export default AchievementsPage;
