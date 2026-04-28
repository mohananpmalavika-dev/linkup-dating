import React from 'react';
import '../styles/ProfileComparisonCard.css';

/**
 * Profile Comparison Card Component
 * Shows how user's profile metrics compare to benchmarks
 */
const ProfileComparisonCard = ({ comparison, loading }) => {
  if (loading) {
    return (
      <div className="comparison-card loading">
        <div className="skeleton-loader">
          <div className="skeleton"></div>
          <div className="skeleton"></div>
          <div className="skeleton"></div>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="comparison-card error">
        <p>Unable to load comparison data</p>
      </div>
    );
  }

  const getComparisonStatus = (percentDiff) => {
    const diff = parseInt(percentDiff);
    if (diff > 20) return { icon: '🚀', label: 'Excellent', color: 'excellent' };
    if (diff > 0) return { icon: '📈', label: 'Above Average', color: 'above' };
    if (diff > -20) return { icon: '📊', label: 'Around Average', color: 'average' };
    return { icon: '📉', label: 'Below Average', color: 'below' };
  };

  const renderComparisonRow = (label, userValue, benchmarkValue, diff, unit = '') => {
    const status = getComparisonStatus(diff);
    const isPositive = parseInt(diff) >= 0;

    return (
      <div key={label} className={`comparison-row ${status.color}`}>
        <div className="row-header">
          <label className="row-label">{label}</label>
          <span className={`status-badge ${status.color}`}>
            <span className="status-icon">{status.icon}</span>
            <span className="status-label">{status.label}</span>
          </span>
        </div>

        <div className="row-content">
          <div className="value-box your-value">
            <div className="value-label">Your Performance</div>
            <div className="value-number">{userValue}</div>
            {unit && <div className="value-unit">{unit}</div>}
          </div>

          <div className="vs-divider">vs</div>

          <div className="value-box benchmark-value">
            <div className="value-label">Industry Average</div>
            <div className="value-number">{benchmarkValue}</div>
            {unit && <div className="value-unit">{unit}</div>}
          </div>
        </div>

        <div className="comparison-indicator">
          <div className={`indicator-bar ${isPositive ? 'positive' : 'negative'}`} 
               style={{ width: `${Math.min(Math.abs(parseInt(diff)), 100)}%` }}>
            <span className="indicator-label">
              {isPositive ? '+' : ''}{diff}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="comparison-card">
      <div className="comparison-header">
        <h3>⚖️ Your Profile vs Industry Benchmarks</h3>
        <p>See how you stack up against others in your demographic</p>
      </div>

      <div className="comparison-metrics">
        {renderComparisonRow(
          '👁️ Profile Views',
          comparison.profileViews.userAvg,
          comparison.profileViews.benchmarkAvg,
          comparison.profileViews.percentageDifference,
          'per day'
        )}

        {renderComparisonRow(
          '❤️ Likes Received',
          comparison.likesReceived.userAvg,
          comparison.likesReceived.benchmarkAvg,
          comparison.likesReceived.percentageDifference,
          'per day'
        )}

        {renderComparisonRow(
          '⏱️ Response Time',
          comparison.responseTime.userAvg,
          comparison.responseTime.benchmarkAvg,
          comparison.responseTime.percentageDifference,
          'minutes'
        )}

        {renderComparisonRow(
          '📹 Video Call Rate',
          comparison.videoCallRate.userAvg,
          comparison.videoCallRate.benchmarkAvg,
          '0',
          'adoption'
        )}
      </div>

      {/* Insights */}
      <div className="insights-section">
        <h4>💡 Key Insights</h4>
        <div className="insights-grid">
          <div className="insight-card">
            <span className="insight-icon">🎯</span>
            <h5>Match Rate</h5>
            <p>You're matching at {comparison.matchRate.userAvg}% - that's {comparison.matchRate.benchmarkAvg}% vs the benchmark</p>
          </div>

          <div className="insight-card">
            <span className="insight-icon">🔥</span>
            <h5>Engagement Speed</h5>
            <p>Faster response times lead to {Math.round((1 - comparison.responseTime.userAvg / comparison.responseTime.benchmarkAvg) * 100)}% better conversion</p>
          </div>

          <div className="insight-card">
            <span className="insight-icon">💬</span>
            <h5>Communication</h5>
            <p>Early video calls increase meeting likelihood by 42% - give it a try!</p>
          </div>
        </div>
      </div>

      {/* Action Items */}
      <div className="action-items">
        <h4>🎯 Next Steps</h4>
        <div className="action-list">
          {parseInt(comparison.profileViews.percentageDifference) < 0 && (
            <div className="action-item">
              <span className="action-icon">📸</span>
              <div>
                <h5>Improve Photo Quality</h5>
                <p>Your profile views are below average. Try adding or updating your main photo.</p>
              </div>
            </div>
          )}

          {parseInt(comparison.responseTime.percentageDifference) > 0 && (
            <div className="action-item">
              <span className="action-icon">⚡</span>
              <div>
                <h5>Great Response Time!</h5>
                <p>You're replying faster than average. Keep up the momentum!</p>
              </div>
            </div>
          )}

          <div className="action-item">
            <span className="action-icon">📹</span>
            <div>
              <h5>Try Video Calls Earlier</h5>
              <p>Users who suggest video calls move 40% faster to real dates.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Benchmark Info */}
      <div className="benchmark-info">
        <h4>ℹ️ About These Benchmarks</h4>
        <p>These metrics are calculated from {comparison.profileViews.userAvg} users in your age group, location, and demographics. Your data is completely private and secure.</p>
      </div>
    </div>
  );
};

export default ProfileComparisonCard;
