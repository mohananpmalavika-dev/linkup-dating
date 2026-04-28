import React, { useState, useEffect } from 'react';
import '../styles/MonthlyReportCard.css';
import analyticsService from '../services/analyticsService';

/**
 * Monthly Report Card Component
 * Shows monthly trends: likes, matches, message response time
 */
const MonthlyReportCard = ({ year, month, loading: initialLoading }) => {
  const [loading, setLoading] = useState(initialLoading);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await analyticsService.getMonthlyReport(year, month);
        setReport(data);
      } catch (err) {
        console.error('Error fetching monthly report:', err);
        setError('Failed to load monthly report');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [year, month]);

  if (loading) {
    return (
      <div className="monthly-report loading">
        <div className="skeleton-loader">
          <div className="skeleton"></div>
          <div className="skeleton"></div>
          <div className="skeleton"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="monthly-report error">
        <p>{error}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="monthly-report no-data">
        <p>No data available for this month</p>
      </div>
    );
  }

  const getTrendIcon = (trend) => {
    if (trend === 'up') return '📈';
    if (trend === 'down') return '📉';
    return '➡️';
  };

  return (
    <div className="monthly-report">
      {/* Month Title */}
      <h3 className="report-month">{report.month}</h3>

      {/* Summary Stats */}
      <div className="summary-stats">
        <div className="stat-card likes-card">
          <div className="stat-icon">❤️</div>
          <div className="stat-info">
            <div className="stat-label">Likes Received</div>
            <div className="stat-value">{report.summary.totalLikes}</div>
            <div className="stat-trend">{getTrendIcon(report.trends.likesTrend)} {report.trends.likesTrend}</div>
          </div>
        </div>

        <div className="stat-card matches-card">
          <div className="stat-icon">💑</div>
          <div className="stat-info">
            <div className="stat-label">Matches Made</div>
            <div className="stat-value">{report.summary.totalMatches}</div>
            <div className="stat-trend">{getTrendIcon(report.trends.matchesTrend)} {report.trends.matchesTrend}</div>
          </div>
        </div>

        <div className="stat-card messages-card">
          <div className="stat-icon">💬</div>
          <div className="stat-info">
            <div className="stat-label">Messages Received</div>
            <div className="stat-value">{report.summary.totalMessages}</div>
          </div>
        </div>

        <div className="stat-card response-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-info">
            <div className="stat-label">Avg Response Time</div>
            <div className="stat-value">{report.summary.avgResponseTime}</div>
          </div>
        </div>
      </div>

      {/* Weekly Breakdown */}
      <div className="weekly-breakdown">
        <h4>📊 Weekly Breakdown</h4>
        <div className="weekly-grid">
          {report.trends.weeklyData.map((week, index) => (
            <div key={index} className="weekly-card">
              <div className="week-number">Week {index + 1}</div>
              <div className="week-stats">
                <div className="week-stat">
                  <span className="week-icon">❤️</span>
                  <span className="week-value">{week.likes}</span>
                </div>
                <div className="week-stat">
                  <span className="week-icon">💑</span>
                  <span className="week-value">{week.matches}</span>
                </div>
                <div className="week-stat">
                  <span className="week-icon">👁️</span>
                  <span className="week-value">{week.views}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Chart */}
      <div className="daily-chart">
        <h4>📈 Daily Trend</h4>
        <div className="chart-container">
          <div className="chart-legend">
            <span className="legend-item"><span className="legend-color likes"></span>Likes</span>
            <span className="legend-item"><span className="legend-color superlikes"></span>Superlikes</span>
            <span className="legend-item"><span className="legend-color matches"></span>Matches</span>
          </div>
          <div className="chart-bars">
            {report.dailyData.map((day, index) => {
              const maxValue = Math.max(...report.dailyData.map(d => d.likes));
              const likeHeight = (day.likes / (maxValue || 1)) * 100;
              
              return (
                <div key={index} className="bar-group" title={day.date}>
                  <div className="bar likes-bar" style={{ height: `${likeHeight}%` }}>
                    {day.likes > 0 && <span className="bar-value">{day.likes}</span>}
                  </div>
                  <div className="bar-date">{new Date(day.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Video Call Stats */}
      {report.summary.totalVideoCallMinutes > 0 && (
        <div className="video-call-section">
          <h4>📹 Video Calls</h4>
          <div className="video-stats">
            <div className="video-stat">
              <span className="video-label">Total Duration:</span>
              <span className="video-value">{report.summary.totalVideoCallMinutes} minutes</span>
            </div>
            <div className="video-stat">
              <span className="video-label">Initiation Rate:</span>
              <span className="video-value">{report.summary.videoCallRate}</span>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="report-summary">
        <h4>📝 Summary</h4>
        <p>
          This month you received {report.summary.totalLikes} likes across {report.dailyData.filter(d => d.likes > 0).length} active days.
          Your average response time was {report.summary.avgResponseTime}, showing strong engagement.
          Keep being active to maintain momentum!
        </p>
      </div>
    </div>
  );
};

export default MonthlyReportCard;
