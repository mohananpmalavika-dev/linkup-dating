import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/PhotoABTestResults.css';

const PhotoABTestResults = ({ testId, onClose }) => {
  const [testData, setTestData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (testId) {
      fetchTestData();
      const interval = setInterval(fetchTestData, 15000); // Refresh every 15 seconds
      return () => clearInterval(interval);
    }
  }, [testId]);

  const fetchTestData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [testRes, insightsRes, resultsRes] = await Promise.all([
        axios.get(
          `${process.env.REACT_APP_API_URL}/api/photo-ab-testing/${testId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `${process.env.REACT_APP_API_URL}/api/photo-ab-testing/${testId}/insights`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `${process.env.REACT_APP_API_URL}/api/photo-ab-testing/${testId}/results`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      ]);

      setTestData(testRes.data.test);
      setInsights(insightsRes.data.insights);
      setResults(resultsRes.data);
    } catch (err) {
      setError('Failed to load test data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="photo-ab-test-results loading">
        <div className="spinner-container">
          <div className="spinner"></div>
          <p>Loading test data...</p>
        </div>
      </div>
    );
  }

  if (!testData) {
    return (
      <div className="photo-ab-test-results error">
        <p>{error}</p>
        {onClose && <button onClick={onClose}>Close</button>}
      </div>
    );
  }

  const getWinnerColor = (winner) => {
    if (winner === 'A') return '#4CAF50';
    if (winner === 'B') return '#2196F3';
    return '#FFC107';
  };

  const timeElapsed = Math.floor((new Date() - new Date(testData.startedAt)) / (1000 * 60 * 60));
  const totalEngagementA = testData.likesA + testData.viewsA;
  const totalEngagementB = testData.likesB + testData.viewsB;
  const percentageA =
    totalEngagementA + totalEngagementB > 0
      ? ((testData.likesA + testData.viewsA) / (totalEngagementA + totalEngagementB)) * 100
      : 50;
  const percentageB = 100 - percentageA;

  return (
    <div className="photo-ab-test-results">
      {/* Header */}
      <div className="results-header">
        <div className="header-content">
          <h2>{testData.testName || `Test #${testData.id}`}</h2>
          <p className="test-info">
            Status: <span className={`status-${testData.status}`}>{testData.status}</span>
            {testData.status === 'completed' && ` • Completed`}
            {testData.status === 'active' && ` • Running for ${timeElapsed} hours`}
          </p>
        </div>
        {onClose && (
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Tabs */}
      <div className="results-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`tab ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          📈 Metrics
        </button>
        <button
          className={`tab ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          💡 Insights
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-section">
            {/* Winner Announcement */}
            {testData.winner && (
              <div className={`winner-announcement winner-${testData.winner}`}>
                <h3>🏆 Test Complete!</h3>
                <p className="winner-text">
                  Photo <strong>{testData.winner}</strong> is the winner!
                </p>
                <p className="win-margin">
                  {testData.winMargin.toFixed(1)}% better engagement
                </p>
                {testData.autoPromoted && (
                  <p className="promoted-text">✨ Winner auto-promoted to position 1</p>
                )}
              </div>
            )}

            {/* Comparison Cards */}
            <div className="comparison-cards">
              {/* Photo A */}
              <div className="comparison-card">
                <div className="card-label">Photo A</div>
                <div className="card-stats">
                  <div className="stat-row">
                    <span className="stat-name">Likes</span>
                    <span className="stat-value">{testData.likesA}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-name">Views</span>
                    <span className="stat-value">{testData.viewsA}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-name">Engagement</span>
                    <span className="stat-value">{testData.engagementA.toFixed(1)}%</span>
                  </div>
                </div>
                {testData.winner === 'A' && <div className="winner-badge">WINNER</div>}
              </div>

              {/* VS */}
              <div className="vs-divider">
                <span>vs</span>
              </div>

              {/* Photo B */}
              <div className="comparison-card">
                <div className="card-label">Photo B</div>
                <div className="card-stats">
                  <div className="stat-row">
                    <span className="stat-name">Likes</span>
                    <span className="stat-value">{testData.likesB}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-name">Views</span>
                    <span className="stat-value">{testData.viewsB}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-name">Engagement</span>
                    <span className="stat-value">{testData.engagementB.toFixed(1)}%</span>
                  </div>
                </div>
                {testData.winner === 'B' && <div className="winner-badge">WINNER</div>}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="progress-section">
              <p className="progress-label">Distribution of engagement</p>
              <div className="progress-bar-container">
                <div
                  className="progress-segment photo-a"
                  style={{ width: `${percentageA}%` }}
                >
                  <span className="percentage">{percentageA.toFixed(0)}%</span>
                </div>
                <div
                  className="progress-segment photo-b"
                  style={{ width: `${percentageB}%` }}
                >
                  <span className="percentage">{percentageB.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && results && (
          <div className="metrics-section">
            <h3>Detailed Metrics</h3>

            <div className="metrics-grid">
              <div className="metric-card">
                <h4>Photo A Performance</h4>
                <div className="metric-item">
                  <span>Total Likes</span>
                  <strong>{results.likesA}</strong>
                </div>
                <div className="metric-item">
                  <span>Total Views</span>
                  <strong>{results.viewsA}</strong>
                </div>
                <div className="metric-item">
                  <span>Engagement Rate</span>
                  <strong>{results.engagementA.toFixed(2)}%</strong>
                </div>
              </div>

              <div className="metric-card">
                <h4>Photo B Performance</h4>
                <div className="metric-item">
                  <span>Total Likes</span>
                  <strong>{results.likesB}</strong>
                </div>
                <div className="metric-item">
                  <span>Total Views</span>
                  <strong>{results.viewsB}</strong>
                </div>
                <div className="metric-item">
                  <span>Engagement Rate</span>
                  <strong>{results.engagementB.toFixed(2)}%</strong>
                </div>
              </div>
            </div>

            <div className="timeline-section">
              <h4>Event Timeline</h4>
              <div className="events-list">
                {results.timeline && results.timeline.length > 0 ? (
                  results.timeline.slice(0, 10).map((event, idx) => (
                    <div key={idx} className="event-item">
                      <span className="event-type">{event.eventType.toUpperCase()}</span>
                      <span className="event-photo">Photo {event.photoVersion}</span>
                      <span className="event-time">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <p>No events yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && insights && (
          <div className="insights-section">
            <h3>Insights & Recommendations</h3>

            {/* Key Insights */}
            {insights.insights && insights.insights.length > 0 && (
              <div className="insights-list">
                <h4>💡 Key Findings</h4>
                {insights.insights.map((insight, idx) => (
                  <div key={idx} className="insight-item">
                    <span className="insight-icon">→</span>
                    <p>{insight}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {insights.recommendations && insights.recommendations.length > 0 && (
              <div className="recommendations-list">
                <h4>🎯 Recommendations</h4>
                {insights.recommendations.map((rec, idx) => (
                  <div key={idx} className="recommendation-item">
                    <span className="rec-icon">✓</span>
                    <p>{rec}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Next Steps */}
            <div className="next-steps">
              <h4>🚀 What's Next?</h4>
              <ul>
                <li>Use the winning photo in your main profile</li>
                <li>Test other variations with different photos</li>
                <li>Analyze what made the winning photo successful</li>
                <li>Run periodic tests to keep your profile optimized</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoABTestResults;
