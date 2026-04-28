/**
 * BoostAnalytics Component
 * Real-time analytics during boost
 */

import React, { useState, useEffect } from 'react';
import useBoosts from '../hooks/useBoosts';
import './BoostAnalytics.css';

const BoostAnalytics = ({ boostId, onClose, compact = false }) => {
  const { getAnalytics, cancelBoost } = useBoosts();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Fetch analytics
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      const result = await getAnalytics(boostId);
      if (result) {
        setAnalytics(result);
      } else {
        setError('Failed to load analytics');
      }
      setLoading(false);
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 10000); // Refresh every 10s

    return () => clearInterval(interval);
  }, [boostId, getAnalytics]);

  // Calculate time remaining
  useEffect(() => {
    if (!analytics) return;

    const updateTimer = () => {
      const now = new Date();
      const end = new Date(analytics.period.end);
      const remaining = Math.max(0, Math.floor((end - now) / 1000 / 60));

      if (remaining > 0) {
        setTimeRemaining(remaining);
      } else {
        setTimeRemaining(0);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [analytics]);

  const handleCancel = async () => {
    setCancelling(true);
    const result = await cancelBoost(boostId);
    if (result.success) {
      onClose?.();
    }
    setCancelling(false);
  };

  if (loading) {
    return (
      <div className={`boost-analytics ${compact ? 'compact' : ''}`}>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className={`boost-analytics ${compact ? 'compact' : ''}`}>
        <div className="error-message">
          <p>⚠️ {error || 'Unable to load analytics'}</p>
        </div>
      </div>
    );
  }

  const { period, impressions, clicks, ctr, likesReceived, messagesReceived, engagement, cost, roi, costPerClick, costPerEngagement } = analytics;
  const statusIcon = analytics.status === 'active' ? '🟢' : '⏹️';

  if (compact) {
    return (
      <div className="boost-analytics compact">
        <div className="compact-header">
          <span className="status-badge">
            {statusIcon} {analytics.type.toUpperCase()}
          </span>
          <span className="time-remaining">
            ⏱️ {timeRemaining}m remaining
          </span>
        </div>
        <div className="compact-stats">
          <div className="stat-item">
            <span className="stat-number">{impressions}</span>
            <span className="stat-label">Impressions</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{clicks}</span>
            <span className="stat-label">Clicks</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{likesReceived}</span>
            <span className="stat-label">Likes</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{messagesReceived}</span>
            <span className="stat-label">Messages</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="boost-analytics full">
      {/* Header */}
      <div className="analytics-header">
        <div className="header-title">
          <h2>📊 Boost Analytics</h2>
          <span className="status-badge">
            {statusIcon} {analytics.status.toUpperCase()}
          </span>
        </div>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>

      {/* Timer */}
      <div className={`boost-timer ${timeRemaining <= 5 ? 'critical' : ''}`}>
        <div className="timer-display">
          <span className="timer-icon">⏱️</span>
          <span className="timer-text">
            {timeRemaining > 0 ? `${timeRemaining} minutes remaining` : 'Boost completed!'}
          </span>
        </div>
        <div className="timer-bar">
          <div
            className="timer-fill"
            style={{
              width: `${Math.max(0, (timeRemaining / analytics.period.duration) * 100)}%`
            }}
          ></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="analytics-grid">
        {/* Impressions Card */}
        <div className="stat-card impressions">
          <div className="stat-icon">👁️</div>
          <div className="stat-content">
            <div className="stat-number">{impressions}</div>
            <div className="stat-label">Impressions</div>
            <div className="stat-detail">Profile shown {impressions}x</div>
          </div>
        </div>

        {/* Clicks Card */}
        <div className="stat-card clicks">
          <div className="stat-icon">🖱️</div>
          <div className="stat-content">
            <div className="stat-number">{clicks}</div>
            <div className="stat-label">Clicks</div>
            <div className="stat-detail">Viewed your profile</div>
          </div>
        </div>

        {/* CTR Card */}
        <div className="stat-card ctr">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-number">{ctr}%</div>
            <div className="stat-label">Click-Through Rate</div>
            <div className="stat-detail">Engagement rate</div>
          </div>
        </div>

        {/* Likes Card */}
        <div className="stat-card likes">
          <div className="stat-icon">❤️</div>
          <div className="stat-content">
            <div className="stat-number">{likesReceived}</div>
            <div className="stat-label">Likes</div>
            <div className="stat-detail">During this boost</div>
          </div>
        </div>

        {/* Messages Card */}
        <div className="stat-card messages">
          <div className="stat-icon">💬</div>
          <div className="stat-content">
            <div className="stat-number">{messagesReceived}</div>
            <div className="stat-label">Messages</div>
            <div className="stat-detail">Conversations started</div>
          </div>
        </div>

        {/* Engagement Card */}
        <div className="stat-card engagement">
          <div className="stat-icon">✨</div>
          <div className="stat-content">
            <div className="stat-number">{engagement}</div>
            <div className="stat-label">Total Engagement</div>
            <div className="stat-detail">Likes + Messages</div>
          </div>
        </div>
      </div>

      {/* ROI Section */}
      <div className="analytics-section roi-section">
        <h3>💰 Return on Investment</h3>
        <div className="roi-grid">
          <div className="roi-card">
            <span className="roi-label">Investment</span>
            <span className="roi-value">${cost.toFixed(2)}</span>
          </div>
          <div className="roi-card">
            <span className="roi-label">ROI</span>
            <span className={`roi-value ${roi >= 0 ? 'positive' : 'negative'}`}>
              {roi >= 0 ? '+' : ''}{roi}%
            </span>
          </div>
          <div className="roi-card">
            <span className="roi-label">Cost per Click</span>
            <span className="roi-value">${typeof costPerClick === 'number' ? costPerClick.toFixed(2) : costPerClick}</span>
          </div>
          <div className="roi-card">
            <span className="roi-label">Cost per Engagement</span>
            <span className="roi-value">${typeof costPerEngagement === 'number' ? costPerEngagement.toFixed(2) : costPerEngagement}</span>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="analytics-section insights-section">
        <h3>🔍 Quick Insights</h3>
        <div className="insights-list">
          {ctr > 5 && (
            <div className="insight positive">
              <span className="insight-icon">🎯</span>
              <span className="insight-text">Excellent engagement! Your profile is getting great attention.</span>
            </div>
          )}
          {likesReceived > 10 && (
            <div className="insight positive">
              <span className="insight-icon">❤️</span>
              <span className="insight-text">Popular boost! You're receiving lots of likes.</span>
            </div>
          )}
          {messagesReceived > 5 && (
            <div className="insight positive">
              <span className="insight-icon">💬</span>
              <span className="insight-text">Making connections! People want to chat with you.</span>
            </div>
          )}
          {engagement > 15 && (
            <div className="insight positive">
              <span className="insight-icon">🚀</span>
              <span className="insight-text">Exceptional performance! Consider boosting again soon.</span>
            </div>
          )}
          {engagement === 0 && (
            <div className="insight neutral">
              <span className="insight-icon">⏳</span>
              <span className="insight-text">Boost just started. Check back in a few minutes for updates.</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="analytics-actions">
        {!showCancelConfirm ? (
          <>
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            {analytics.status === 'active' && (
              <button
                className="btn btn-outline-danger"
                onClick={() => setShowCancelConfirm(true)}
              >
                ❌ Cancel Boost
              </button>
            )}
          </>
        ) : (
          <>
            <p className="cancel-confirmation">
              Cancel boost? You'll receive a pro-rata refund.
            </p>
            <button className="btn btn-secondary" onClick={() => setShowCancelConfirm(false)}>
              No, Keep It
            </button>
            <button
              className="btn btn-danger"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? '⏳ Cancelling...' : 'Yes, Cancel Boost'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default BoostAnalytics;
