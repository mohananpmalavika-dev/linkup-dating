/**
 * VerifiedBadge Component
 * Displays ✅ Video Verified badge on profiles
 */
import React from 'react';
import '../styles/VerifiedBadge.css';

const VerifiedBadge = ({ 
  isVisible = false, 
  verified = false,
  timestamp = null,
  scores = null,
  showDetails = false 
}) => {
  if (!isVisible || !verified) {
    return null;
  }

  return (
    <div className="verified-badge-container">
      <div className="verified-badge">
        <span className="badge-icon">✅</span>
        <span className="badge-label">Video Verified</span>
        
        {showDetails && scores && (
          <div className="badge-tooltip">
            <div className="tooltip-content">
              <p className="tooltip-title">Verified Identity</p>
              <div className="score-details">
                <div className="score-item">
                  <span className="score-label">Face Match:</span>
                  <span className="score-value">{scores.facialMatch}%</span>
                </div>
                {scores.liveness !== undefined && (
                  <div className="score-item">
                    <span className="score-label">Liveness:</span>
                    <span className="score-value">{scores.liveness}%</span>
                  </div>
                )}
              </div>
              {timestamp && (
                <p className="verified-date">
                  Verified on {new Date(timestamp).toLocaleDateString()}
                </p>
              )}
              <p className="badge-description">
                This profile has been verified through a one-time video call. The person's face matches their profile photos.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifiedBadge;
