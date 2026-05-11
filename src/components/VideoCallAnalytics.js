import React, { useState, useEffect } from 'react';
import videoCallInsightsService from '../services/videoCallInsightsService';
import './VideoCallAnalytics.css';

const VideoCallAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await videoCallInsightsService.getUserAnalytics();
      
      if (result.success) {
        setAnalytics(result.analytics);
      } else {
        setError(result.error || 'Failed to load analytics');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="video-analytics-container loading">
        <div className="spinner"></div>
        <p>Loading your video call insights...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-analytics-container error">
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <button onClick={fetchAnalytics} className="btn-retry">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="video-analytics-container empty">
        <div className="empty-state">
          <span className="empty-icon">📞</span>
          <h2>No Video Calls Yet</h2>
          <p>Start your first video call to see insights!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-analytics-container">
      <div className="analytics-header">
        <h1>📞 Video Call Insights</h1>
        <p>Your video dating performance & compatibility analysis</p>
      </div>

      <div className="analytics-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'ratings' ? 'active' : ''}`}
          onClick={() => setActiveTab('ratings')}
        >
          Ratings
        </button>
        <button
          className={`tab-btn ${activeTab === 'conversion' ? 'active' : ''}`}
          onClick={() => setActiveTab('conversion')}
        >
          Conversion
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="tab-content">
          {/* Call Duration Card */}
          <div className="insight-card duration-card">
            <div className="card-header">
              <h3>⏱️ Average Call Duration</h3>
              <span className="comparison-badge">
                {analytics.comparisonStatus === 'above_average' ? '📈 Above Average' : '📉 Below Average'}
              </span>
            </div>
            <div className="duration-comparison">
              <div className="duration-item your-duration">
                <span className="label">Your Average</span>
                <span className="value">{analytics.averageCallDuration} min</span>
              </div>
              <div className="duration-separator">vs</div>
              <div className="duration-item industry-duration">
                <span className="label">Industry Average</span>
                <span className="value">{analytics.industryAverage} min</span>
              </div>
            </div>
            <div className="duration-insight">
              <p>
                You average <strong>{analytics.averageCallDuration} minutes</strong> per call,{' '}
                {analytics.comparisonStatus === 'above_average' ? (
                  <>
                    which is <strong>{Math.abs(analytics.differenceMinutes)} minutes MORE</strong> than the industry
                    average! 🎉 This suggests great engagement and chemistry.
                  </>
                ) : (
                  <>
                    which is <strong>{Math.abs(analytics.differenceMinutes)} minutes LESS</strong> than the industry
                    average. Consider extending call duration for deeper connections.
                  </>
                )}
              </p>
            </div>
            <div className="duration-stats">
              <div className="stat">
                <span className="label">Longest Call</span>
                <span className="value">{analytics.longestCall} min</span>
              </div>
              <div className="stat">
                <span className="label">Total Calls</span>
                <span className="value">{analytics.totalCalls}</span>
              </div>
              <div className="stat">
                <span className="label">This Month</span>
                <span className="value">{analytics.callsThisMonth}</span>
              </div>
            </div>
          </div>

          {/* Activity Card */}
          <div className="insight-card activity-card">
            <h3>📊 Activity Overview</h3>
            <div className="activity-grid">
              <div className="activity-item">
                <span className="icon">📞</span>
                <div className="info">
                  <span className="label">Total Calls</span>
                  <span className="value">{analytics.totalCalls}</span>
                </div>
              </div>
              <div className="activity-item">
                <span className="icon">⏱️</span>
                <div className="info">
                  <span className="label">Total Time</span>
                  <span className="value">{analytics.totalDurationMinutes} min</span>
                </div>
              </div>
              <div className="activity-item">
                <span className="icon">📅</span>
                <div className="info">
                  <span className="label">This Week</span>
                  <span className="value">{analytics.callsThisWeek} calls</span>
                </div>
              </div>
              <div className="activity-item">
                <span className="icon">🗓️</span>
                <div className="info">
                  <span className="label">This Month</span>
                  <span className="value">{analytics.callsThisMonth} calls</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ratings Tab */}
      {activeTab === 'ratings' && (
        <div className="tab-content">
          {/* Ratings Card */}
          <div className="insight-card ratings-card">
            <div className="card-header">
              <h3>⭐ Your Ratings</h3>
              <span className="rating-badge">{analytics.averageRating} / 5.0</span>
            </div>

            {/* Star Rating Display */}
            <div className="star-rating-display">
              <div className="stars">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={`star ${i < Math.round(analytics.averageRating) ? 'filled' : ''}`}
                  >
                    ⭐
                  </span>
                ))}
              </div>
              <p className="rating-count">{analytics.totalRatingsReceived} ratings from matches</p>
            </div>

            {/* Rating Distribution */}
            <div className="rating-distribution">
              {[5, 4, 3, 2, 1].map(stars => (
                <div key={stars} className="rating-bar">
                  <div className="bar-label">
                    <span className="stars-text">{stars} ⭐</span>
                    <span className="count">{analytics.ratingDistribution[`${stars}Star`]} ratings</span>
                  </div>
                  <div className="bar-container">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${(analytics.ratingDistribution[`${stars}Star`] /
                          analytics.totalRatingsReceived) *
                          100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quality Metrics */}
            <div className="quality-metrics">
              <h4>Quality Metrics</h4>
              <div className="metric">
                <label>Chemistry Score:</label>
                <div className="score-bar">
                  <div
                    className="score-fill"
                    style={{
                      width: `${(analytics.averageChemistryScore / 5) * 100}%`,
                    }}
                  ></div>
                </div>
                <span className="score-value">{analytics.averageChemistryScore}/5</span>
              </div>
              <div className="metric">
                <label>Communication Score:</label>
                <div className="score-bar">
                  <div
                    className="score-fill"
                    style={{
                      width: `${(analytics.averageCommunicationScore / 5) * 100}%`,
                    }}
                  ></div>
                </div>
                <span className="score-value">{analytics.averageCommunicationScore}/5</span>
              </div>
            </div>
          </div>

          {/* Willingness to Date Card */}
          <div className="insight-card willingness-card">
            <h3>💕 Would Date Again?</h3>
            <div className="willingness-stat">
              <span className="percentage">{analytics.wouldDateAgainPercent}%</span>
              <p>of your matches expressed interest in dating again</p>
            </div>
          </div>
        </div>
      )}

      {/* Conversion Tab */}
      {activeTab === 'conversion' && (
        <div className="tab-content">
          <div className="insight-card conversion-card">
            <div className="card-header">
              <h3>💑 Conversion to Real Dates</h3>
              <span className="conversion-badge">{analytics.conversionRate}%</span>
            </div>

            <div className="conversion-stats">
              <div className="conversion-stat">
                <span className="icon">💑</span>
                <div>
                  <span className="label">Real Dates from Video Calls</span>
                  <span className="value">{analytics.conversionToDateCount}</span>
                </div>
              </div>
              <div className="conversion-stat">
                <span className="icon">📈</span>
                <div>
                  <span className="label">Conversion Rate</span>
                  <span className="value">{analytics.conversionRate}%</span>
                </div>
              </div>
            </div>

            <div className="conversion-insight">
              <p>
                Out of <strong>{analytics.totalCalls}</strong> video calls, you've converted to{' '}
                <strong>{analytics.conversionToDateCount}</strong> real dates. That's a solid connection rate!
              </p>
            </div>
          </div>

          {/* Percentile Card */}
          <div className="insight-card percentile-card">
            <h3>📊 Industry Comparison</h3>
            <div className="percentile-display">
              <span className="percentile">{analytics.percentileVsIndustry}th</span>
              <p>percentile in average call duration</p>
            </div>
            <div className="percentile-insight">
              <p>
                You're doing{' '}
                {analytics.percentileVsIndustry > 50
                  ? 'better than average'
                  : 'below average'}{' '}
                compared to other users on DatingHub.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCallAnalytics;
