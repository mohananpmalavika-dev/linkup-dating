import React, { useState, useEffect } from 'react';
import videoCallInsightsService from '../services/videoCallInsightsService';
import './VideoCallAnalytics.css';

const VideoCallCompatibility = ({ videoDeteId, matchName }) => {
  const [compatibility, setCompatibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (videoDeteId) {
      fetchCompatibility();
    }
  }, [videoDeteId]);

  const fetchCompatibility = async () => {
    try {
      setLoading(true);
      const result = await videoCallInsightsService.getCompatibilityScore(videoDeteId);
      
      if (result.success) {
        setCompatibility(result.compatibilityScore);
      } else {
        setError(result.error || 'Failed to load compatibility');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="compatibility-container loading">
        <div className="spinner"></div>
        <p>Analyzing video chemistry...</p>
      </div>
    );
  }

  if (error || !compatibility) {
    return null;
  }

  const getCategoryColor = (category) => {
    const colors = {
      perfect_match: '#4CAF50',
      very_likely: '#8BC34A',
      likely: '#FFC107',
      possible: '#FF9800',
      unlikely: '#F44336',
    };
    return colors[category] || '#999';
  };

  const getCategoryLabel = (category) => {
    const labels = {
      perfect_match: '💚 Perfect Match!',
      very_likely: '💛 Very Likely',
      likely: '🧡 Likely',
      possible: '😊 Possible',
      unlikely: '🤔 Unlikely',
    };
    return labels[category] || 'Unknown';
  };

  return (
    <div className="compatibility-container">
      <div className="compatibility-card">
        <div className="card-header">
          <h3>💕 Video Chemistry Analysis</h3>
        </div>

        {/* Main Compatibility Score */}
        <div className="main-score">
          <div className="score-circle" style={{ borderColor: getCategoryColor(compatibility.compatibility_category) }}>
            <span className="score-number">{compatibility.overall_compatibility_score}</span>
            <span className="score-label">/ 100</span>
          </div>
          <div className="score-info">
            <h4 style={{ color: getCategoryColor(compatibility.compatibility_category) }}>
              {getCategoryLabel(compatibility.compatibility_category)}
            </h4>
            <p className="prediction">
              {compatibility.will_date_probability_percent}% chance you'll go on a real date
            </p>
            <p className="recommendation">{compatibility.recommendation}</p>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="metrics-grid">
          <div className="metric-item">
            <label>Chemistry</label>
            <div className="metric-bar">
              <div
                className="metric-fill"
                style={{ width: `${compatibility.chemistry_score}%` }}
              ></div>
            </div>
            <span className="metric-value">{Math.round(compatibility.chemistry_score)}%</span>
          </div>

          <div className="metric-item">
            <label>Communication</label>
            <div className="metric-bar">
              <div
                className="metric-fill"
                style={{ width: `${compatibility.communication_compatibility}%` }}
              ></div>
            </div>
            <span className="metric-value">{Math.round(compatibility.communication_compatibility)}%</span>
          </div>

          <div className="metric-item">
            <label>Personality Match</label>
            <div className="metric-bar">
              <div
                className="metric-fill"
                style={{ width: `${compatibility.personality_alignment}%` }}
              ></div>
            </div>
            <span className="metric-value">{Math.round(compatibility.personality_alignment)}%</span>
          </div>

          <div className="metric-item">
            <label>Attraction</label>
            <div className="metric-bar">
              <div
                className="metric-fill"
                style={{ width: `${compatibility.attraction_match}%` }}
              ></div>
            </div>
            <span className="metric-value">{Math.round(compatibility.attraction_match)}%</span>
          </div>

          <div className="metric-item">
            <label>Conversation Flow</label>
            <div className="metric-bar">
              <div
                className="metric-fill"
                style={{ width: `${compatibility.conversation_flow_score}%` }}
              ></div>
            </div>
            <span className="metric-value">{Math.round(compatibility.conversation_flow_score)}%</span>
          </div>

          <div className="metric-item">
            <label>Engagement</label>
            <div className="metric-bar">
              <div
                className="metric-fill"
                style={{ width: `${compatibility.engagement_level}%` }}
              ></div>
            </div>
            <span className="metric-value">{Math.round(compatibility.engagement_level)}%</span>
          </div>
        </div>

        {/* Engagement Details */}
        <div className="engagement-details">
          <h4>Engagement Levels</h4>
          <div className="engagement-row">
            <div className="engagement-col">
              <span className="label">Your Engagement</span>
              <span className="value">{Math.round(compatibility.user1_engagement)}%</span>
            </div>
            <div className="engagement-col">
              <span className="label">Their Engagement</span>
              <span className="value">{Math.round(compatibility.user2_engagement)}%</span>
            </div>
          </div>
        </div>

        {/* Confidence */}
        <div className="confidence-section">
          <p>
            🔍 Our analysis is <strong>{compatibility.confidence_level}% confident</strong> in this prediction
            based on video chemistry indicators.
          </p>
        </div>

        {/* Next Steps */}
        <div className="next-steps">
          {compatibility.overall_compatibility_score >= 70 ? (
            <>
              <h4>💡 Recommendation</h4>
              <p>Great compatibility! Consider scheduling a real date soon while the connection is strong.</p>
            </>
          ) : (
            <>
              <h4>💡 Suggestion</h4>
              <p>Fair connection potential. You might try another video call or keep exploring other matches.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCallCompatibility;
