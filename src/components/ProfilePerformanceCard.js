import React from 'react';
import '../styles/ProfilePerformanceCard.css';

/**
 * Profile Performance Card Component
 * Shows how user's profile performs vs age group average
 */
const ProfilePerformanceCard = ({ performance, loading }) => {
  if (loading) {
    return (
      <div className="performance-card loading">
        <div className="skeleton-loader">
          <div className="skeleton"></div>
          <div className="skeleton"></div>
          <div className="skeleton"></div>
        </div>
      </div>
    );
  }

  if (!performance) {
    return (
      <div className="performance-card error">
        <p>Unable to load performance data</p>
      </div>
    );
  }

  const percentageAboveAvg = parseInt(performance.percentageAboveAverage);
  const isAboveAverage = percentageAboveAvg >= 0;

  // Create visual bar
  const barWidth = Math.min(Math.abs(percentageAboveAvg), 100);

  return (
    <div className="performance-card">
      {/* Header */}
      <div className="perf-header">
        <h3>📸 Profile Performance</h3>
        <span className="age-badge">{performance.ageGroup} years</span>
      </div>

      {/* Main Message */}
      <div className="performance-message">
        <p>{performance.performanceMessage}</p>
      </div>

      {/* Performance Comparison */}
      <div className="performance-comparison">
        <div className="comparison-row">
          <label>Views per day:</label>
          <div className="comparison-values">
            <span className="your-value">
              <strong>{performance.profileViewsPerDay}</strong>
              <span className="unit">views</span>
            </span>
            <span className="vs-text">vs</span>
            <span className="industry-value">
              <strong>{performance.industryAverageViewsPerDay}</strong>
              <span className="unit">avg</span>
            </span>
          </div>
        </div>

        {/* Visual Bar */}
        <div className="performance-bar">
          <div className={`bar-fill ${isAboveAverage ? 'above' : 'below'}`}
               style={{ width: `${barWidth}%` }}>
            <span className="bar-label">
              {isAboveAverage ? '+' : '-'}{Math.abs(percentageAboveAvg)}%
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="performance-stats">
        <div className="stat-box">
          <div className="stat-icon">📊</div>
          <div className="stat-details">
            <div className="stat-title">Sample Size</div>
            <div className="stat-content">{performance.benchmarkSampleSize} users</div>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-icon">📈</div>
          <div className="stat-details">
            <div className="stat-title">Your Ranking</div>
            <div className="stat-content">
              {isAboveAverage ? 'Top Performer' : 'Growing'}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="performance-tips">
        <h4>💡 How to Improve:</h4>
        <ul>
          <li>Ensure your main photo is clear and friendly</li>
          <li>Use natural lighting for better photo quality</li>
          <li>Show genuine personality in your photos</li>
          <li>Keep your profile updated regularly</li>
        </ul>
      </div>
    </div>
  );
};

export default ProfilePerformanceCard;
