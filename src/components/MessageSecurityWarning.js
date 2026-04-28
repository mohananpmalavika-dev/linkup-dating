import React, { useState, useEffect } from 'react';
import '../styles/MessageSecurityWarning.css';

/**
 * MessageSecurityWarning Component
 * Shows a warning badge when a message contains red flags for catfishing/scams
 * Allows users to dismiss or report the message
 */
const MessageSecurityWarning = ({ 
  flag, 
  onDismiss, 
  onReport, 
  isExpanded = false 
}) => {
  const [expanded, setExpanded] = useState(isExpanded);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('scam');

  // Get warning color based on risk level
  const getWarningColor = (riskLevel) => {
    switch (riskLevel) {
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

  const getRiskEmoji = (riskLevel) => {
    switch (riskLevel) {
      case 'critical':
        return '🚨';
      case 'high':
        return '⚠️';
      case 'medium':
        return '⚡';
      default:
        return 'ℹ️';
    }
  };

  const handleReport = async (e) => {
    e.preventDefault();
    setReporting(true);

    try {
      await onReport(flag.id, reportReason);
      alert('Message reported. Thank you for helping keep LinkUp safe!');
      setReporting(false);
      setExpanded(false);
      setReportReason('scam');
    } catch (error) {
      console.error('Error reporting message:', error);
      alert('Failed to report message. Please try again.');
      setReporting(false);
    }
  };

  const handleDismiss = async (e) => {
    e.preventDefault();
    try {
      await onDismiss(flag.id);
      setExpanded(false);
    } catch (error) {
      console.error('Error dismissing flag:', error);
    }
  };

  return (
    <div 
      className="message-security-warning" 
      style={{ borderLeftColor: getWarningColor(flag.risk_level) }}
    >
      {/* Collapsed View */}
      {!expanded && (
        <div className="warning-header" onClick={() => setExpanded(true)}>
          <span className="warning-icon">{getRiskEmoji(flag.risk_level)}</span>
          <span className="warning-text">
            {flag.risk_level === 'critical' ? 'CRITICAL: ' : ''}
            This message might be suspicious
          </span>
          <button className="expand-btn" title="View details">
            ▼
          </button>
        </div>
      )}

      {/* Expanded View */}
      {expanded && (
        <div className="warning-expanded">
          <div className="warning-header" onClick={() => setExpanded(false)}>
            <span className="warning-icon">{getRiskEmoji(flag.risk_level)}</span>
            <span className="warning-text">Suspicious Activity Alert</span>
            <button className="expand-btn" title="Collapse">
              ▲
            </button>
          </div>

          <div className="warning-details">
            <p className="detail-title">Why is this flagged?</p>
            <p className="detail-description">
              This message contains patterns commonly used in scams:
            </p>

            <div className="red-flags-list">
              {flag.red_flags && flag.red_flags.map((flagItem, idx) => (
                <div key={idx} className="flag-item">
                  <span className="flag-icon">🚩</span>
                  <span className="flag-text">{flagItem}</span>
                </div>
              ))}
            </div>

            <div className="risk-info">
              <span className="risk-label">Risk Level:</span>
              <span 
                className={`risk-badge risk-${flag.risk_level}`}
                style={{ backgroundColor: getWarningColor(flag.risk_level) }}
              >
                {flag.risk_level.toUpperCase()}
              </span>
              <span className="confidence">
                {Math.round(flag.ai_confidence_score * 100)}% confidence
              </span>
            </div>

            <div className="warning-message">
              <p className="detail-title">What should you do?</p>
              <ul>
                <li>Never send money to someone you haven't met</li>
                <li>Don't share personal information (SSN, bank account, etc.)</li>
                <li>Don't download files from unknown sources</li>
                <li>If it seems suspicious, it probably is</li>
              </ul>
            </div>

            {/* Report Section */}
            {!reporting && (
              <div className="warning-actions">
                <button 
                  className="action-btn dismiss-btn"
                  onClick={handleDismiss}
                  title="Dismiss this warning"
                >
                  Dismiss
                </button>
                <button 
                  className="action-btn report-btn"
                  onClick={() => setReporting(true)}
                  title="Report this message"
                >
                  🚩 Report Message
                </button>
              </div>
            )}

            {/* Report Form */}
            {reporting && (
              <form className="report-form" onSubmit={handleReport}>
                <div className="form-group">
                  <label htmlFor="report-reason">Report as:</label>
                  <select
                    id="report-reason"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="form-control"
                  >
                    <option value="scam">Scam / Money Request</option>
                    <option value="catfishing">Catfishing</option>
                    <option value="harassment">Harassment</option>
                    <option value="identity_theft">Identity Theft Attempt</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-actions">
                  <button 
                    type="button"
                    className="form-btn cancel-btn"
                    onClick={() => setReporting(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="form-btn submit-btn"
                    disabled={reporting}
                  >
                    {reporting ? 'Reporting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageSecurityWarning;
