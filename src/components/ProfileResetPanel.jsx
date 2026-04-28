/**
 * ProfileResetPanel Component
 * UI for initiating and managing profile resets
 */

import React, { useState } from 'react';
import useProfileReset from '../hooks/useProfileReset';
import './ProfileResetPanel.css';

const RESET_REASONS = [
  { value: 'burnt_out', label: '😴 Feeling burnt out' },
  { value: 'no_matches', label: '😞 Not getting matches' },
  { value: 'starting_over', label: '🔄 Starting fresh' },
  { value: 'moved_town', label: '🚚 Just moved' },
  { value: 'personal_change', label: '✨ Personal changes' },
  { value: 'just_want_to', label: '🤷 Just want to' }
];

const ProfileResetPanel = ({ onClose, onResetComplete }) => {
  const {
    resetStatus,
    featureInfo,
    stats,
    loading,
    error,
    initiateReset,
    checkResetStatus
  } = useProfileReset();

  const [resetLoading, setResetLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [resetError, setResetError] = useState(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  /**
   * Handle reset confirmation
   */
  const handleReset = async () => {
    setResetLoading(true);
    setResetError(null);

    const result = await initiateReset(selectedReason);

    if (result.success) {
      setResetSuccess(true);
      onResetComplete?.(result.reset);

      // Auto-close after delay
      setTimeout(() => {
        onClose?.();
      }, 2000);
    } else {
      setResetError(result.message);
    }

    setResetLoading(false);
  };

  // Loading state
  if (loading || !resetStatus || !featureInfo) {
    return (
      <div className="profile-reset-panel profile-reset-panel-loading">
        <div className="spinner"></div>
        <p>Loading reset options...</p>
      </div>
    );
  }

  // Success state
  if (resetSuccess) {
    return (
      <div className="profile-reset-panel profile-reset-panel-success">
        <div className="success-icon">🎉</div>
        <h2>Profile Reset Complete!</h2>
        <div className="success-message">
          <p>✅ Swipe history cleared</p>
          <p>✅ Profile impression count reset</p>
          <p>✅ Now appearing fresh to new matches</p>
        </div>
        <p className="success-note">
          Your profile is ready for a fresh start. Check back in a few hours to see new interactions!
        </p>
      </div>
    );
  }

  // Get reset info
  const canReset = resetStatus?.canResetNow;
  const freeResetsRemaining = resetStatus?.freeResetsRemaining;
  const isPremium = resetStatus?.isPremium;

  // Cannot reset state
  if (!canReset && !isPremium) {
    return (
      <div className="profile-reset-panel profile-reset-panel-limited">
        <button className="close-btn" onClick={onClose}>×</button>

        <div className="limited-icon">⏳</div>
        <h2>Come Back Next Month</h2>

        <div className="reset-info">
          <p className="info-text">
            You've used your free monthly reset. Premium members get unlimited resets.
          </p>

          <div className="next-reset-box">
            <p className="label">Next free reset available:</p>
            <p className="date">
              {new Date(resetStatus?.nextResetAvailable).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="premium-cta">
          <h3>Upgrade to Premium</h3>
          <p>Get unlimited profile resets + other benefits</p>
          <button className="btn btn-primary btn-upgrade">
            Upgrade Now
          </button>
        </div>

        <button className="btn btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  // Main reset panel
  return (
    <div className="profile-reset-panel profile-reset-panel-main">
      <button className="close-btn" onClick={onClose}>×</button>

      <div className="header-section">
        <div className="header-icon">🔄</div>
        <h2>Profile Reset</h2>
        <p className="tagline">{featureInfo?.description}</p>
      </div>

      {freeResetsRemaining !== null && (
        <div className="reset-counter">
          <span className="counter-badge">
            {freeResetsRemaining} free reset{freeResetsRemaining !== 1 ? 's' : ''} left this month
          </span>
        </div>
      )}

      <div className="features-section">
        <h3>This Reset Will:</h3>
        {featureInfo?.whatItDoes && (
          <ul className="features-list">
            {featureInfo.whatItDoes.map((feature, idx) => (
              <li key={idx} className="feature-item">
                <span className="check-icon">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="info-section">
        <h3>This Reset Will NOT:</h3>
        {featureInfo?.whatItDoesntDo && (
          <ul className="info-list">
            {featureInfo.whatItDoesntDo.map((item, idx) => (
              <li key={idx}>
                <span className="x-icon">✗</span>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="reason-section">
        <h3>Why are you resetting? (optional)</h3>
        <p className="reason-note">Helps us improve the feature</p>
        <div className="reason-options">
          {RESET_REASONS.map(reason => (
            <button
              key={reason.value}
              className={`reason-btn ${selectedReason === reason.value ? 'selected' : ''}`}
              onClick={() => setSelectedReason(reason.value)}
            >
              {reason.label}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="stats-section">
          <h3>Your Reset History</h3>
          <div className="stat-item">
            <span className="stat-label">Total resets:</span>
            <span className="stat-value">{stats.totalResets}</span>
          </div>
          {stats.totalResets > 0 && (
            <div className="stat-item">
              <span className="stat-label">Swipes cleared:</span>
              <span className="stat-value">{stats.totalSwipesCleared}</span>
            </div>
          )}
        </div>
      )}

      {resetError && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span>{resetError}</span>
        </div>
      )}

      {!showConfirm ? (
        <>
          <button
            className="btn btn-primary btn-reset"
            onClick={() => setShowConfirm(true)}
            disabled={resetLoading}
          >
            🔄 Reset My Profile
          </button>
          <p className="warning-text">
            This action will clear your recent swipe history. Your matches and conversations are preserved.
          </p>
        </>
      ) : (
        <div className="confirmation-box">
          <h3>⚠️ Confirm Reset</h3>
          <p>
            Are you sure? This will:
          </p>
          <ul>
            <li>Clear your recent swipes</li>
            <li>Reset your impression count</li>
            <li>Make your profile appear fresh</li>
          </ul>
          <p className="confirm-note">
            Your profile information and existing matches will be preserved.
          </p>
          <div className="button-group">
            <button
              className="btn btn-danger"
              onClick={handleReset}
              disabled={resetLoading}
            >
              {resetLoading ? 'Resetting...' : 'Yes, Reset Profile'}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setShowConfirm(false)}
              disabled={resetLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isPremium && (
        <div className="premium-badge">
          <span className="badge-icon">👑</span>
          <span>Premium: Unlimited resets</span>
        </div>
      )}
    </div>
  );
};

export default ProfileResetPanel;
