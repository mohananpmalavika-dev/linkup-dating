import React from 'react';
import './VideoAuthenticationResult.css';

/**
 * VideoAuthenticationResult Component
 * Displays fraud detection results and authenticity scores
 */
export const VideoAuthenticationResult = ({ 
  authentication, 
  onRetry = null,
  isPremium = false,
  onDelete = null 
}) => {
  if (!authentication) {
    return null;
  }

  const {
    overallScore,
    isAuthentic,
    needsReview,
    isFraud,
    scores = {},
    riskFlags = [],
    message,
    status
  } = authentication;

  const getScoreColor = (score) => {
    if (score >= 0.75) return 'success';
    if (score >= 0.6) return 'warning';
    return 'danger';
  };

  const getScoreLabel = (score) => {
    if (score >= 0.75) return 'Authentic ✓';
    if (score >= 0.6) return 'Under Review';
    return 'Flagged ✗';
  };

  const getScorePercentage = (score) => {
    return Math.round((score || 0) * 100);
  };

  const scoreColor = getScoreColor(overallScore);

  return (
    <div className={`video-auth-result auth-${scoreColor}`}>
      <div className="auth-result-header">
        <div className="auth-main-score">
          <div className={`auth-score-circle ${scoreColor}`}>
            <span className="auth-score-value">
              {getScorePercentage(overallScore)}%
            </span>
          </div>
          <div className="auth-score-label">
            <strong>{getScoreLabel(overallScore)}</strong>
            <p>{message}</p>
          </div>
        </div>
      </div>

      {/* Detailed Scores */}
      <div className="auth-scores-grid">
        <div className="score-item">
          <div className="score-icon">👤</div>
          <div className="score-info">
            <div className="score-name">Facial Match</div>
            <div className={`score-bar score-bar-${getScoreColor(scores.facial)}`}>
              <div 
                className="score-bar-fill" 
                style={{ width: `${getScorePercentage(scores.facial)}%` }}
              />
            </div>
            <div className="score-percentage">{getScorePercentage(scores.facial)}%</div>
          </div>
        </div>

        <div className="score-item">
          <div className="score-icon">👁️</div>
          <div className="score-info">
            <div className="score-name">Liveness</div>
            <div className={`score-bar score-bar-${getScoreColor(scores.liveness)}`}>
              <div 
                className="score-bar-fill" 
                style={{ width: `${getScorePercentage(scores.liveness)}%` }}
              />
            </div>
            <div className="score-percentage">{getScorePercentage(scores.liveness)}%</div>
          </div>
        </div>

        <div className="score-item">
          <div className="score-icon">🎬</div>
          <div className="score-info">
            <div className="score-name">Frame Consistency</div>
            <div className={`score-bar score-bar-${getScoreColor(scores.frameConsistency)}`}>
              <div 
                className="score-bar-fill" 
                style={{ width: `${getScorePercentage(scores.frameConsistency)}%` }}
              />
            </div>
            <div className="score-percentage">{getScorePercentage(scores.frameConsistency)}%</div>
          </div>
        </div>

        <div className="score-item">
          <div className="score-icon">🏠</div>
          <div className="score-info">
            <div className="score-name">Background</div>
            <div className={`score-bar score-bar-${getScoreColor(scores.background)}`}>
              <div 
                className="score-bar-fill" 
                style={{ width: `${getScorePercentage(scores.background)}%` }}
              />
            </div>
            <div className="score-percentage">{getScorePercentage(scores.background)}%</div>
          </div>
        </div>
      </div>

      {/* Risk Flags */}
      {riskFlags && riskFlags.length > 0 && (
        <div className="auth-risk-flags">
          <div className="risk-header">⚠️ Detected Issues:</div>
          <ul className="risk-list">
            {riskFlags.map((flag, idx) => (
              <li key={idx} className={`risk-item risk-${flag}`}>
                {getRiskFlagLabel(flag)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Status Badge */}
      <div className={`auth-status-badge status-${status}`}>
        {status === 'pending' && '⏳ Analysis pending...'}
        {status === 'analyzing' && '🔍 Analyzing video...'}
        {status === 'completed' && '✅ Analysis complete'}
        {status === 'failed' && '❌ Analysis failed'}
      </div>

      {/* Actions */}
      <div className="auth-result-actions">
        {onRetry && needsReview && (
          <button 
            type="button" 
            className="btn-retry"
            onClick={onRetry}
          >
            🔄 Retry Analysis
          </button>
        )}
        {onDelete && (
          <button 
            type="button" 
            className="btn-delete"
            onClick={onDelete}
          >
            🗑️ Remove Video
          </button>
        )}
      </div>

      {/* Info Box */}
      <div className="auth-info-box">
        <div className="info-icon">ℹ️</div>
        <div className="info-text">
          {isAuthentic && (
            <p>Your video has been verified as authentic! It's now live on your profile and helps increase matches.</p>
          )}
          {needsReview && (
            <p>Your video is under manual review. Our moderation team will check it within 24 hours.</p>
          )}
          {isFraud && (
            <p>The video doesn't appear to match your profile photos. Please try uploading a different video where your face is clearly visible.</p>
          )}
        </div>
      </div>

      {isPremium && (
        <div className="premium-feature-badge">
          ⭐ Premium Feature: Video authenticity verification
        </div>
      )}
    </div>
  );
};

/**
 * Get user-friendly label for risk flag
 */
function getRiskFlagLabel(flag) {
  const labels = {
    'face_mismatch': 'Face doesn\'t match profile photos',
    'deepfake_detected': 'Possible deepfake or edited video',
    'multiple_faces_or_face_swap': 'Multiple faces detected or face swap',
    'suspicious_background_editing': 'Background appears heavily edited',
    'poor_lighting': 'Poor lighting conditions',
    'video_edited': 'Video appears heavily edited'
  };
  return labels[flag] || flag;
}

export default VideoAuthenticationResult;
