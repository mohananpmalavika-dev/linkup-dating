import React, { useState, useEffect } from 'react';
import catfishDetectionService from '../services/catfishDetectionService';
import '../styles/CatfishDetectionDashboard.css';

/**
 * CatfishDetectionDashboard Component
 * Shows user's suspicious activity alerts and statistics
 * Displays flagged messages and allows user to manage them
 */
const CatfishDetectionDashboard = () => {
  const [stats, setStats] = useState(null);
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'dismissed'
  const [dismissedCount, setDismissedCount] = useState(0);

  useEffect(() => {
    loadData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [statsData, flagsData, dismissedData] = await Promise.all([
        catfishDetectionService.getStats(),
        catfishDetectionService.getFlags(50, 0, false),
        catfishDetectionService.getFlags(50, 0, true).catch(() => [])
      ]);

      setStats(statsData);
      setFlags(flagsData);
      setDismissedCount(dismissedData.length);
    } catch (err) {
      console.error('Error loading security data:', err);
      setError('Failed to load security alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleDismissFlag = async (flagId) => {
    try {
      await catfishDetectionService.dismissFlag(flagId);
      setFlags(flags.filter(f => f.id !== flagId));
    } catch (err) {
      console.error('Error dismissing flag:', err);
      alert('Failed to dismiss alert');
    }
  };

  const handleReportFlag = async (flagId, reason) => {
    try {
      await catfishDetectionService.reportFlag(flagId, reason);
      setFlags(flags.filter(f => f.id !== flagId));
    } catch (err) {
      console.error('Error reporting flag:', err);
      alert('Failed to report message');
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'critical':
        return '#ff4444';
      case 'high':
        return '#ff8c00';
      case 'medium':
        return '#ffb84d';
      default:
        return '#ffc107';
    }
  };

  if (loading) {
    return (
      <div className="catfish-detection-dashboard loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading security alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="catfish-detection-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h2>🛡️ Trust & Safety</h2>
          <p>Monitor suspicious activity and protect yourself from scams</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon alert">⚠️</div>
            <div className="stat-content">
              <div className="stat-label">Active Alerts</div>
              <div className="stat-value">{stats.totalFlags}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon critical">🚨</div>
            <div className="stat-content">
              <div className="stat-label">Critical</div>
              <div className="stat-value">{stats.criticalFlags}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon high">⚡</div>
            <div className="stat-content">
              <div className="stat-label">High Risk</div>
              <div className="stat-value">{stats.highRiskFlags}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon reported">📋</div>
            <div className="stat-content">
              <div className="stat-label">Reported</div>
              <div className="stat-value">{stats.reportedFlags}</div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Tabs */}
      <div className="alerts-section">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active Alerts ({flags.length})
          </button>
          <button
            className={`tab ${activeTab === 'dismissed' ? 'active' : ''}`}
            onClick={() => setActiveTab('dismissed')}
          >
            Dismissed ({dismissedCount})
          </button>
        </div>

        {/* Active Alerts */}
        {activeTab === 'active' && (
          <div className="alerts-list">
            {error && (
              <div className="error-message">
                <p>{error}</p>
              </div>
            )}

            {flags.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✨</div>
                <h3>No Active Alerts</h3>
                <p>You're all caught up! No suspicious activity detected.</p>
              </div>
            ) : (
              flags.map(flag => (
                <div
                  key={flag.id}
                  className="alert-item"
                  style={{ borderLeftColor: getRiskColor(flag.risk_level) }}
                >
                  <div className="alert-header">
                    <div className="alert-info">
                      <span className="alert-type">
                        {flag.flag_type === 'money_request' && '💰 Money Request'}
                        {flag.flag_type === 'payment_app' && '📱 Payment App'}
                        {flag.flag_type === 'crypto' && '₿ Cryptocurrency'}
                        {flag.flag_type === 'suspicious_link' && '🔗 Suspicious Link'}
                        {flag.flag_type === 'identity_theft' && '🆔 Identity Theft'}
                        {flag.flag_type === 'other' && '⚠️ Other'}
                      </span>
                      <span
                        className={`risk-badge risk-${flag.risk_level}`}
                        style={{ backgroundColor: getRiskColor(flag.risk_level) }}
                      >
                        {flag.risk_level.toUpperCase()}
                      </span>
                    </div>
                    <div className="alert-meta">
                      <span className="confidence">
                        {Math.round(flag.ai_confidence_score * 100)}% confidence
                      </span>
                      <span className="timestamp">
                        {new Date(flag.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="alert-message">
                    <p className="message-preview">
                      {flag.message_text.substring(0, 150)}
                      {flag.message_text.length > 150 ? '...' : ''}
                    </p>
                  </div>

                  {flag.red_flags && flag.red_flags.length > 0 && (
                    <div className="flags-preview">
                      <span className="flags-label">Detected:</span>
                      <div className="flags-tags">
                        {flag.red_flags.slice(0, 3).map((f, idx) => (
                          <span key={idx} className="flag-tag">
                            {f}
                          </span>
                        ))}
                        {flag.red_flags.length > 3 && (
                          <span className="flag-tag more">
                            +{flag.red_flags.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="alert-actions">
                    <button
                      className="action-link dismiss"
                      onClick={() => handleDismissFlag(flag.id)}
                    >
                      Dismiss
                    </button>
                    <button
                      className="action-link report"
                      onClick={() => handleReportFlag(flag.id, 'scam')}
                    >
                      Report & Block
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Dismissed Alerts */}
        {activeTab === 'dismissed' && (
          <div className="alerts-list">
            <div className="empty-state">
              <div className="empty-icon">📁</div>
              <h3>Dismissed Alerts</h3>
              <p>Alerts you've reviewed and dismissed appear here</p>
            </div>
          </div>
        )}
      </div>

      {/* Safety Tips */}
      <div className="safety-tips">
        <h3>💡 Safety Tips</h3>
        <ul>
          <li>Never send money to someone you haven't met in person</li>
          <li>Be cautious of requests for personal information (SSN, bank details)</li>
          <li>Don't share payment app IDs or cryptocurrency wallet addresses</li>
          <li>If you meet someone, verify their identity through video call</li>
          <li>Trust your instincts - if something feels wrong, it probably is</li>
          <li>Report suspicious profiles immediately</li>
        </ul>
      </div>
    </div>
  );
};

export default CatfishDetectionDashboard;
