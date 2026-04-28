import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/ConversationQualityMeter.css';

const ConversationQualityMeter = ({ matchId, partnerId }) => {
  const [quality, setQuality] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (matchId) {
      fetchConversationQuality();
      // Refresh every 30 seconds for real-time updates
      const interval = setInterval(fetchConversationQuality, 30000);
      return () => clearInterval(interval);
    }
  }, [matchId]);

  const fetchConversationQuality = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/conversation-quality/${matchId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQuality(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching conversation quality:', err);
      setError('Could not load conversation metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !quality) {
    return (
      <div className="quality-meter-loading">
        <div className="spinner"></div>
        <p>Analyzing conversation...</p>
      </div>
    );
  }

  if (error && !quality) {
    return null;
  }

  if (!quality || quality.totalMessages === 0) {
    return (
      <div className="quality-meter-empty">
        <p>💬 Start the conversation to see quality metrics</p>
      </div>
    );
  }

  const getQualityColor = (score) => {
    if (score >= 75) return '#51cf66'; // Green - Excellent
    if (score >= 55) return '#74b9ff'; // Blue - Good
    if (score >= 35) return '#ffa500'; // Orange - Moderate
    return '#ff6b6b'; // Red - Developing
  };

  const getQualityLabel = (connectionQuality) => {
    const labels = {
      excellent: '🔥 Excellent Connection',
      good: '👍 Good Connection',
      moderate: '💭 Moderate Connection',
      developing: '🌱 Developing'
    };
    return labels[connectionQuality] || 'Unknown';
  };

  const depthScore = Math.round(quality.conversationDepthScore || 0);
  const engagementScore = Math.round(quality.engagementScore || 0);
  const avgScore = Math.round((depthScore + engagementScore) / 2);

  return (
    <div className="quality-meter-container">
      <div className="quality-meter-header">
        <h3>Conversation Quality</h3>
        <button 
          className="refresh-btn" 
          onClick={fetchConversationQuality}
          title="Refresh metrics"
        >
          🔄
        </button>
      </div>

      {/* Main Quality Score */}
      <div className="quality-score-display">
        <div className="score-circle" style={{ borderColor: getQualityColor(avgScore) }}>
          <span className="score-number">{avgScore}</span>
          <span className="score-label">Score</span>
        </div>
        <div className="quality-text">
          <p className="quality-label">{getQualityLabel(quality.connectionQuality)}</p>
          <p className="percentile">
            {quality.percentileRank > 0 
              ? `Top ${100 - quality.percentileRank}% of conversations` 
              : 'Calculating rank...'}
          </p>
        </div>
      </div>

      {/* Depth and Engagement Scores */}
      <div className="quality-metrics">
        <div className="metric-item">
          <div className="metric-label">
            <span>📏 Depth</span>
            <span className="metric-value">{depthScore}</span>
          </div>
          <div className="metric-bar">
            <div 
              className="metric-fill" 
              style={{ 
                width: `${depthScore}%`,
                backgroundColor: getQualityColor(depthScore)
              }}
            ></div>
          </div>
          <p className="metric-hint">{quality.depthMetrics?.messageLength || 'Analyzing...'}</p>
        </div>

        <div className="metric-item">
          <div className="metric-label">
            <span>⚡ Engagement</span>
            <span className="metric-value">{engagementScore}</span>
          </div>
          <div className="metric-bar">
            <div 
              className="metric-fill" 
              style={{ 
                width: `${engagementScore}%`,
                backgroundColor: getQualityColor(engagementScore)
              }}
            ></div>
          </div>
          <p className="metric-hint">{quality.depthMetrics?.questions || 'Analyzing...'}</p>
        </div>
      </div>

      {/* Key Statistics */}
      <div className="quality-stats">
        <div className="stat">
          <span className="stat-icon">💬</span>
          <span className="stat-label">Messages</span>
          <span className="stat-value">{quality.totalMessages}</span>
        </div>
        <div className="stat">
          <span className="stat-icon">✏️</span>
          <span className="stat-label">Avg Length</span>
          <span className="stat-value">{quality.avgMessageLength} chars</span>
        </div>
        <div className="stat">
          <span className="stat-icon">⏱️</span>
          <span className="stat-label">Response</span>
          <span className="stat-value">{quality.avgResponseTime}m</span>
        </div>
        <div className="stat">
          <span className="stat-icon">❓</span>
          <span className="stat-label">Questions</span>
          <span className="stat-value">{quality.questionsAsked}</span>
        </div>
      </div>

      {/* Topics Discussed */}
      {quality.topicsDiscussed && quality.topicsDiscussed.length > 0 && (
        <div className="topics-section">
          <p className="topics-label">Topics Discussed ({quality.topicsDiscussed.length})</p>
          <div className="topics-list">
            {quality.topicsDiscussed.map((topic, idx) => (
              <span key={idx} className="topic-tag">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Depth Metrics Details */}
      {quality.depthMetrics && (
        <div className="depth-details">
          <p className="details-title">Connection Strength</p>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Message Depth</span>
              <span className={`detail-value ${quality.depthMetrics.messageLength.toLowerCase()}`}>
                {quality.depthMetrics.messageLength}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Response Time</span>
              <span className={`detail-value ${quality.depthMetrics.responseTime.toLowerCase()}`}>
                {quality.depthMetrics.responseTime}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Curiosity</span>
              <span className={`detail-value ${quality.depthMetrics.questions.toLowerCase()}`}>
                {quality.depthMetrics.questions}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Variety</span>
              <span className={`detail-value ${quality.depthMetrics.variety.toLowerCase()}`}>
                {quality.depthMetrics.variety}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationQualityMeter;
