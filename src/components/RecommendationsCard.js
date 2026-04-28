import React from 'react';
import '../styles/RecommendationsCard.css';

/**
 * Recommendations Card Component
 * Shows personalized recommendations to improve profile and engagement
 */
const RecommendationsCard = ({ recommendations, loading }) => {
  if (loading) {
    return (
      <div className="recommendations-card loading">
        <div className="skeleton-loader">
          <div className="skeleton"></div>
          <div className="skeleton"></div>
          <div className="skeleton"></div>
        </div>
      </div>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="recommendations-card no-data">
        <div className="no-data-message">
          <span className="no-data-icon">✨</span>
          <p>Your profile is looking great! Keep it up.</p>
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority) => {
    const colors = {
      high: '#ff6b6b',
      medium: '#ffa500',
      low: '#4ecdc4'
    };
    return colors[priority] || '#999';
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      high: '🔴 HIGH IMPACT',
      medium: '🟠 MEDIUM IMPACT',
      low: '🟢 LOW PRIORITY'
    };
    return labels[priority] || priority;
  };

  return (
    <div className="recommendations-card">
      <div className="recommendations-header">
        <h3>💡 Personalized Recommendations</h3>
        <p>Here are {recommendations.length} ways to improve your dating success</p>
      </div>

      <div className="recommendations-list">
        {recommendations.map((rec, index) => (
          <div key={index} className={`recommendation-item priority-${rec.priority}`}>
            {/* Priority Badge */}
            <div className="priority-badge" style={{ borderLeftColor: getPriorityColor(rec.priority) }}>
              <span className="priority-label">{getPriorityLabel(rec.priority)}</span>
            </div>

            {/* Content */}
            <div className="recommendation-content">
              <div className="rec-header">
                <h4>{rec.title}</h4>
                {rec.expectedIncrease && (
                  <span className="impact-badge">
                    +{rec.expectedIncrease}% improvement
                  </span>
                )}
              </div>

              <p className="rec-description">{rec.description}</p>

              {/* Stats */}
              <div className="rec-stats">
                <div className="rec-stat">
                  <span className="stat-icon">📈</span>
                  <span className="stat-text">{rec.impact}</span>
                </div>
              </div>

              {/* Action */}
              <div className="rec-action">
                <button className="action-btn">
                  {rec.action} →
                </button>
              </div>
            </div>

            {/* Type Badge */}
            <div className="rec-type-badge">{rec.type}</div>
          </div>
        ))}
      </div>

      {/* Pro Tips */}
      <div className="pro-tips-section">
        <h4>💎 Pro Tips for Dating Success</h4>
        <ul className="tips-list">
          <li>Update your profile at least once a month</li>
          <li>Reply to messages within 2 hours for better conversion</li>
          <li>Use clear, recent photos where people can see your face</li>
          <li>Write a bio that shows your personality (100-200 characters)</li>
          <li>Be active on the app at least 3-4 times per week</li>
          <li>Ask thoughtful questions in initial messages</li>
          <li>Video call before meeting in person for safety and chemistry</li>
        </ul>
      </div>

      {/* Implementation Guide */}
      <div className="implementation-guide">
        <h4>🎯 How to Use These Recommendations</h4>
        <div className="guide-steps">
          <div className="guide-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h5>Prioritize High-Impact items first</h5>
              <p>Focus on recommendations marked as HIGH IMPACT for fastest results</p>
            </div>
          </div>
          <div className="guide-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h5>Implement one change at a time</h5>
              <p>Test each recommendation separately to measure its impact</p>
            </div>
          </div>
          <div className="guide-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h5>Track your progress</h5>
              <p>Check back weekly to see how your changes affect your stats</p>
            </div>
          </div>
          <div className="guide-step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h5>Keep what works, adjust what doesn't</h5>
              <p>Double down on successful changes and refine underperforming ones</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecommendationsCard;
