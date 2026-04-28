import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/ConversationQualityInsights.css';

const ConversationQualityInsights = ({ matchId }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (matchId) {
      fetchInsights();
    }
  }, [matchId]);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/conversation-quality/${matchId}/insights`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInsights(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching insights:', err);
      setError('Could not load insights');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="insights-loading"><div className="spinner"></div></div>;
  }

  if (error || !insights || !insights.insights || insights.insights.length === 0) {
    return null;
  }

  const getInsightColor = (type) => {
    const colors = {
      excellent: '#51cf66',
      good: '#74b9ff',
      developing: '#ffa500',
      caution: '#ff6b6b',
      engagement: '#667eea',
      variety: '#c084fc'
    };
    return colors[type] || '#666';
  };

  return (
    <div className="insights-container">
      <div className="insights-header">
        <h3>📊 Connection Insights</h3>
      </div>

      <div className="insights-list">
        {insights.insights.map((insight, index) => (
          <div 
            key={index}
            className={`insight-card insight-${insight.type}`}
            style={{ borderLeftColor: getInsightColor(insight.type) }}
          >
            <div className="insight-message">
              {insight.message}
            </div>
            <div className="insight-detail">
              {insight.detail}
            </div>
          </div>
        ))}
      </div>

      {/* Display quality metrics if available */}
      {insights.quality && (
        <div className="quality-summary">
          <div className="summary-row">
            <span>Total Messages</span>
            <strong>{insights.quality.total_messages}</strong>
          </div>
          <div className="summary-row">
            <span>Connection Level</span>
            <strong className={`level-${insights.quality.connection_quality}`}>
              {insights.quality.connection_quality}
            </strong>
          </div>
          <div className="summary-row">
            <span>Your Percentile</span>
            <strong>{insights.quality.percentile_rank}th</strong>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationQualityInsights;
