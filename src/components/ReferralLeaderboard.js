import React, { useState, useEffect } from 'react';
import { referralService } from '../services/referralService';
import '../styles/ReferralLeaderboard.css';

const ReferralLeaderboard = ({ limit = 10, onClose }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRank, setUserRank] = useState(null);
  const [timeframe, setTimeframe] = useState('all-time');

  useEffect(() => {
    loadLeaderboard();
  }, [timeframe]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const result = await referralService.getLeaderboard(limit, timeframe);
      if (result.success) {
        setLeaderboard(result.data || []);
        setUserRank(result.userRank || null);
      } else {
        setError(result.message || 'Failed to load leaderboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getMedalEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const renderLeaderboardItem = (item, index) => {
    const isTopThree = index < 3;
    return (
      <div key={item.id} className={`leaderboard-item ${isTopThree ? 'top-three' : ''}`}>
        <div className="rank-badge">
          <span className="medal">{getMedalEmoji(index + 1)}</span>
        </div>

        <div className="user-info">
          {item.profilePicture && (
            <img 
              src={item.profilePicture} 
              alt={item.name} 
              className="user-avatar"
            />
          )}
          <div className="user-details">
            <div className="user-name">{item.name}</div>
            <div className="user-location">{item.location || 'Location unknown'}</div>
          </div>
        </div>

        <div className="referral-stats">
          <div className="stat">
            <span className="stat-value">{item.totalInvited || 0}</span>
            <span className="stat-label">Invited</span>
          </div>
          <div className="stat">
            <span className="stat-value">{item.totalCompleted || 0}</span>
            <span className="stat-label">Converted</span>
          </div>
          <div className="stat reward">
            <span className="stat-value">
              {item.totalRewardsEarned || 0}
            </span>
            <span className="stat-label">Points</span>
          </div>
        </div>

        {item.badge && (
          <div className="user-badge" title={item.badge.description}>
            {item.badge.emoji} {item.badge.name}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="referral-leaderboard">
      <div className="leaderboard-header">
        <h2>🏆 Referral Leaderboard</h2>
        <button 
          className="close-btn" 
          onClick={onClose}
          aria-label="Close leaderboard"
        >
          ✕
        </button>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {/* Timeframe Filter */}
      <div className="timeframe-filter">
        <button 
          className={`timeframe-btn ${timeframe === 'all-time' ? 'active' : ''}`}
          onClick={() => setTimeframe('all-time')}
        >
          All Time
        </button>
        <button 
          className={`timeframe-btn ${timeframe === 'month' ? 'active' : ''}`}
          onClick={() => setTimeframe('month')}
        >
          This Month
        </button>
        <button 
          className={`timeframe-btn ${timeframe === 'week' ? 'active' : ''}`}
          onClick={() => setTimeframe('week')}
        >
          This Week
        </button>
      </div>

      {/* User's Current Rank */}
      {userRank && (
        <div className="user-rank-card">
          <div className="user-rank-content">
            <span className="rank-label">Your Rank:</span>
            <span className="rank-display">#{userRank.rank}</span>
          </div>
          <div className="user-rank-stats">
            <span>{userRank.totalInvited} invited</span>
            <span>•</span>
            <span>{userRank.totalCompleted} converted</span>
          </div>
        </div>
      )}

      {/* Leaderboard Content */}
      <div className="leaderboard-content">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading leaderboard...</p>
          </div>
        ) : leaderboard.length > 0 ? (
          <div className="leaderboard-list">
            {leaderboard.map((item, index) => renderLeaderboardItem(item, index))}
          </div>
        ) : (
          <div className="empty-state">
            <p>📊 No leaderboard data available yet</p>
            <small>Start inviting friends to appear on the leaderboard!</small>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="leaderboard-info">
        <div className="info-item">
          <span className="info-icon">💡</span>
          <span>Refer more friends to climb the leaderboard</span>
        </div>
        <div className="info-item">
          <span className="info-icon">🎁</span>
          <span>Top referrers unlock exclusive rewards</span>
        </div>
        <div className="info-item">
          <span className="info-icon">⭐</span>
          <span>Reach milestones for special badges</span>
        </div>
      </div>

      {/* Achievement Badges Reference */}
      <div className="badges-reference">
        <h4>📌 Achievement Badges</h4>
        <div className="badges-grid">
          <div className="badge-item">
            <span className="badge">🌟</span>
            <span>Rising Star (5 referrals)</span>
          </div>
          <div className="badge-item">
            <span className="badge">✨</span>
            <span>Top Referrer (20 referrals)</span>
          </div>
          <div className="badge-item">
            <span className="badge">👑</span>
            <span>Referral Champion (50 referrals)</span>
          </div>
          <div className="badge-item">
            <span className="badge">🚀</span>
            <span>Viral Ambassador (100 referrals)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralLeaderboard;
