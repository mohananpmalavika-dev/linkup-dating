import React, { useState } from 'react';
import { useNavigate } from '../router';
import LeaderboardDisplay from './LeaderboardDisplay';
import '../styles/AchievementNotification.css';

const AchievementsPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('achievements');

  return (
    <div className="achievements-page">
      <div className="achievements-header">
        <button className="btn-back" onClick={() => navigate('/discover')}>
          ← Back
        </button>
        <h1>Achievements & Rankings</h1>
        <div className="achievements-tabs">
          <button className={activeTab === 'achievements' ? 'active' : ''} onClick={() => setActiveTab('achievements')}>
            🏆 My Achievements
          </button>
          <button className={activeTab === 'leaderboards' ? 'active' : ''} onClick={() => setActiveTab('leaderboards')}>
            🥇 Leaderboards
          </button>
        </div>
      </div>

      {activeTab === 'achievements' && (
        <div className="empty-state">
          <p>Achievements panel coming soon.</p>
        </div>
      )}

      {activeTab === 'leaderboards' && <LeaderboardDisplay />}
    </div>
  );
};

export default AchievementsPage;

