import React, { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import '../styles/TemplatePerformance.css';

/**
 * TemplatePerformance Component
 * Shows analytics for message templates - which get the highest response rates
 * Helps users optimize their opening messages based on actual data
 */
const TemplatePerformance = ({ onClose }) => {
  const [topTemplates, setTopTemplates] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('top');

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      setError('');

      const [topResponse, recResponse] = await Promise.all([
        apiClient.get('/dating/opening-templates/top-performers', {
          params: { limit: 10 }
        }),
        apiClient.get('/dating/opening-templates/recommended', {
          params: { limit: 5 }
        })
      ]);

      setTopTemplates(topResponse.data.templates || []);
      setRecommendations(recResponse.data.recommendations || []);
    } catch (err) {
      console.error('Error fetching performance data:', err);
      setError(err.message || 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="template-performance loading">
        <div className="loader">Loading your template analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="template-performance error">
        <div className="error-content">
          <p>{error}</p>
          <button onClick={fetchPerformanceData} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="template-performance">
      <div className="performance-header">
        <h3>📊 Message Template Analytics</h3>
        <p className="performance-subtitle">
          Track which opening messages get the best response rates
        </p>
      </div>

      <div className="performance-tabs">
        <button
          className={`tab-button ${activeTab === 'top' ? 'active' : ''}`}
          onClick={() => setActiveTab('top')}
        >
          🏆 Top Performers ({topTemplates.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'recommendations' ? 'active' : ''}`}
          onClick={() => setActiveTab('recommendations')}
        >
          💡 Recommendations ({recommendations.length})
        </button>
      </div>

      <div className="performance-content">
        {activeTab === 'top' && (
          <TopPerformersTab templates={topTemplates} />
        )}
        {activeTab === 'recommendations' && (
          <RecommendationsTab recommendations={recommendations} />
        )}
      </div>

      <div className="performance-footer">
        <button onClick={onClose} className="close-button">
          Close
        </button>
        <p className="performance-tip">
          💡 Tip: Personalized, context-aware messages perform best. Share interests = Higher engagement!
        </p>
      </div>
    </div>
  );
};

/**
 * Top Performers Tab Component
 */
const TopPerformersTab = ({ templates }) => {
  if (!templates || templates.length === 0) {
    return (
      <div className="empty-state">
        <p>No templates yet. Start creating and using templates to track performance!</p>
      </div>
    );
  }

  return (
    <div className="templates-grid">
      {templates.map((template, index) => (
        <TemplateCard key={template.id} template={template} rank={index + 1} />
      ))}
    </div>
  );
};

/**
 * Recommendations Tab Component
 */
const RecommendationsTab = ({ recommendations }) => {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="empty-state">
        <p>No recommendations yet. Keep using your high-performing templates!</p>
      </div>
    );
  }

  return (
    <div className="recommendations-list">
      {recommendations.map((rec, index) => (
        <RecommendationCard key={rec.id} recommendation={rec} index={index} />
      ))}
    </div>
  );
};

/**
 * Template Card Component
 */
const TemplateCard = ({ template, rank }) => {
  const getResponseColor = (rate) => {
    if (rate >= 75) return '#27ae60'; // Green - Excellent
    if (rate >= 50) return '#f39c12'; // Orange - Good
    return '#e74c3c'; // Red - Fair
  };

  const getEngagementLevel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'New';
  };

  return (
    <div className="template-card">
      <div className="card-rank">
        <span className="rank-badge">#{rank}</span>
      </div>

      <div className="card-title">
        <span className="emoji">{template.emoji || '💬'}</span>
        <div className="title-info">
          {template.interestTrigger && (
            <span className="interest-tag">{template.interestTrigger}</span>
          )}
          <p className="category">{template.category}</p>
        </div>
      </div>

      <p className="card-content">{template.content}</p>

      <div className="card-metrics">
        <div className="metric">
          <label>Response Rate</label>
          <div className="metric-value" style={{ color: getResponseColor(template.responseRate) }}>
            <span className="rate">{template.responseRate}%</span>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${template.responseRate}%`,
                  backgroundColor: getResponseColor(template.responseRate)
                }}
              />
            </div>
          </div>
        </div>

        <div className="metric">
          <label>Engagement Score</label>
          <span className="score-badge" style={{ backgroundColor: getResponseColor(template.engagementScore) }}>
            {template.engagementScore} / 100
          </span>
        </div>

        <div className="metric">
          <label>Usage</label>
          <span className="usage-count">
            {template.usageCount} sent, {template.responseCount} replies
          </span>
        </div>
      </div>

      {template.lastUsedAt && (
        <p className="last-used">
          Last used: {new Date(template.lastUsedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};

/**
 * Recommendation Card Component
 */
const RecommendationCard = ({ recommendation, index }) => {
  return (
    <div className="recommendation-card">
      <div className="rec-badge">
        💡 {recommendation.reason}
      </div>

      <div className="rec-content">
        <span className="emoji">{recommendation.emoji || '💬'}</span>
        <div className="rec-text">
          {recommendation.interestTrigger && (
            <span className="interest-label">{recommendation.interestTrigger}</span>
          )}
          <p className="message">{recommendation.content}</p>
        </div>
      </div>

      <div className="rec-stats">
        <span className="stat">
          Response: <strong>{recommendation.responseRate}%</strong>
        </span>
        <span className="stat">
          Score: <strong>{recommendation.engagementScore}/100</strong>
        </span>
      </div>

      <button className="use-again-button">
        Try Again ↻
      </button>
    </div>
  );
};

export default TemplatePerformance;
