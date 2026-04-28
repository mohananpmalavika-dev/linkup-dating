/**
 * Content Moderation Warning Dialog
 * Shows when text/image is flagged and allows user to proceed or cancel
 */

import React from 'react';
import '../styles/ModerationWarning.css';

const ModerationWarning = ({ 
  isOpen = false,
  severity = 'medium',
  issues = [],
  contentType = 'message',
  onContinue = () => {},
  onCancel = () => {},
  loading = false
}) => {
  if (!isOpen) {
    return null;
  }

  const isHighSeverity = severity === 'high';
  const icon = severity === 'high' ? '❌' : '⚠️';
  
  const getTitle = () => {
    if (contentType === 'image') {
      return 'Image Content Warning';
    } else if (contentType === 'profile') {
      return 'Profile Content Warning';
    }
    return 'Message Content Warning';
  };

  const getDescription = () => {
    if (isHighSeverity) {
      return 'This content contains inappropriate material and may violate our Community Guidelines. Do you want to send it anyway?';
    }
    return 'This content may contain potentially flagged material. Are you sure you want to send it?';
  };

  const getContinueLabel = () => {
    return isHighSeverity ? 'Send Anyway' : 'Send';
  };

  const renderIssues = () => {
    return issues.map((issue, index) => (
      <div key={index} className="issue-item">
        <span className="issue-type">{issue.type}</span>
        <span className="issue-message">{issue.message}</span>
      </div>
    ));
  };

  return (
    <div className="moderation-warning-overlay">
      <div className={`moderation-warning-dialog severity-${severity}`}>
        {/* Header */}
        <div className="warning-header">
          <span className="warning-icon">{icon}</span>
          <h2 className="warning-title">{getTitle()}</h2>
          <button 
            className="close-btn" 
            onClick={onCancel}
            disabled={loading}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="warning-content">
          <p className="warning-description">{getDescription()}</p>
          
          {issues.length > 0 && (
            <div className="issues-container">
              <h3 className="issues-title">Detected Issues:</h3>
              <div className="issues-list">
                {renderIssues()}
              </div>
            </div>
          )}

          {isHighSeverity && (
            <div className="severity-notice">
              <p>
                ⚠️ <strong>Note:</strong> Your account may be flagged or suspended if you continue to send inappropriate content. Please review our <a href="/guidelines" target="_blank" rel="noopener noreferrer">Community Guidelines</a>.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="warning-actions">
          <button 
            className="btn btn-secondary" 
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            className={`btn btn-primary ${isHighSeverity ? 'btn-danger' : ''}`}
            onClick={onContinue}
            disabled={loading}
          >
            {loading ? 'Sending...' : getContinueLabel()}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModerationWarning;
