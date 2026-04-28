import React from 'react';
import '../styles/PersonalStatsCard.css';

/**
 * Personal Stats Card Component
 * Displays match rate, industry average, and personal engagement metrics
 */
const PersonalStatsCard = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="stats-card loading">
        <div className="skeleton-loader">
          <div className="skeleton"></div>
          <div className="skeleton"></div>
          <div className="skeleton"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="stats-card error">
        <p>Unable to load personal stats</p>
      </div>
    );
  }

  const matchRateDiff = stats.matchRate - stats.industryAverageMatchRate;
  const isAboveAverage = matchRateDiff > 0;

  return (
    <div className="stats-card personal-stats">
      {/* Main Stat */}
      <div className="main-stat">
        <div className="stat-display">
          <div className={`stat-number ${isAboveAverage ? 'above-average' : 'below-average'}`}>
            {stats.matchRate}%
          </div>
          <div className="stat-label">Your Match Rate</div>
          <div className="stat-comparison">
            Industry Average: {stats.industryAverageMatchRate}%
          </div>
        </div>

        {/* Comparison Badge */}
        <div className={`comparison-badge ${isAboveAverage ? 'positive' : 'negative'}`}>
          <span className="badge-icon">
            {isAboveAverage ? '🎯' : '📉'}
          </span>
          <span className="badge-text">
            {isAboveAverage 
              ? `${(stats.matchRate / stats.industryAverageMatchRate * 100 - 100).toFixed(0)}% above average`
              : `${(100 - stats.matchRate / stats.industryAverageMatchRate * 100).toFixed(0)}% below average`
            }
          </span>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="engagement-metrics">
        <div className="metric">
          <span className="metric-icon">👁️</span>
          <div className="metric-info">
            <div className="metric-value">{stats.profileViews}</div>
            <div className="metric-label">Profile Views</div>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon">❤️</span>
          <div className="metric-info">
            <div className="metric-value">{stats.likesReceived}</div>
            <div className="metric-label">Likes Received</div>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon">💑</span>
          <div className="metric-info">
            <div className="metric-value">{stats.matchesMade}</div>
            <div className="metric-label">Matches</div>
          </div>
        </div>
        <div className="metric">
          <span className="metric-icon">💬</span>
          <div className="metric-info">
            <div className="metric-value">{stats.messagesReceived}</div>
            <div className="metric-label">Messages Received</div>
          </div>
        </div>
      </div>

      {/* Response Time */}
      <div className="response-time">
        <span className="time-icon">⏱️</span>
        <span className="time-label">Avg Response Time:</span>
        <span className="time-value">{stats.avgResponseTime} min</span>
      </div>

      {/* Info Box */}
      <div className="info-box">
        <p>Match rate = Matches ÷ Profile Views. A higher rate means your profile is more attractive!</p>
      </div>
    </div>
  );
};

export default PersonalStatsCard;
