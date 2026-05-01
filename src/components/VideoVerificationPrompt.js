/**
 * VideoVerificationPrompt Component
 * Prompts users to verify their identity via video call
 * Shows benefits and requirements
 */
import React, { useState, useEffect } from 'react';
import '../styles/VideoVerificationPrompt.css';

const VideoVerificationPrompt = ({ 
  onInitiateVerification = () => {}, 
  onDismiss = () => {},
  isVerified = false,
  userIsPremium = false
}) => {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.log('VideoVerificationPrompt mounted', { 
      hasOnInitiateVerification: !!onInitiateVerification,
      hasDismiss: !!onDismiss,
      isVerified,
      userIsPremium
    });
  }, [onInitiateVerification, onDismiss, isVerified, userIsPremium]);

  const handleStartVerification = (e) => {
    console.log('Start Verification button clicked', e);
    e.preventDefault();
    e.stopPropagation();
    
    if (typeof onInitiateVerification === 'function') {
      console.log('Calling onInitiateVerification');
      onInitiateVerification();
    } else {
      console.error('onInitiateVerification is not a function:', onInitiateVerification);
    }
  };

  const handleDismiss = (e) => {
    console.log('Remind Me Later button clicked');
    e.preventDefault();
    e.stopPropagation();
    
    if (typeof onDismiss === 'function') {
      onDismiss();
    }
  };

  if (isVerified) {
    return (
      <div className="verification-complete">
        <div className="complete-header">
          <span className="check-icon">✅</span>
          <h3>You're Video Verified!</h3>
        </div>
        <p className="complete-message">
          Your profile is now marked as verified. This helps build trust with other users and increases your match quality.
        </p>
        <div className="verified-benefits">
          <div className="benefit-item">
            <span className="benefit-icon">📈</span>
            <span className="benefit-text">Your profile gets 3x more message requests</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">💬</span>
            <span className="benefit-text">Premium users prioritize verified profiles</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">🛡️</span>
            <span className="benefit-text">Safer, more authentic connections</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="video-verification-prompt">
      <div className="prompt-header">
        <span className="header-icon">📹</span>
        <h3>Get Your ✅ Video Verified Badge</h3>
      </div>

      <p className="prompt-description">
        Verify your identity with a one-time video call. Your face will be checked against your profile photos.
      </p>

      <div className="benefits-grid">
        <div className="benefit-card">
          <span className="benefit-icon">📈</span>
          <h4>3x More Messages</h4>
          <p>Verified profiles get significantly more interest</p>
        </div>
        <div className="benefit-card">
          <span className="benefit-icon">🛡️</span>
          <h4>Build Trust</h4>
          <p>Show you're real and authentic to potential matches</p>
        </div>
        <div className="benefit-card">
          <span className="benefit-icon">⭐</span>
          <h4>Premium Prioritized</h4>
          <p>Premium members see verified profiles first</p>
        </div>
        <div className="benefit-card">
          <span className="benefit-icon">💚</span>
          <h4>Reduce Fraud</h4>
          <p>Verification helps prevent catfishing and scams</p>
        </div>
      </div>

      <div className="how-it-works">
        <button 
          type="button"
          className="details-toggle"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowDetails(!showDetails);
          }}
        >
          {showDetails ? '▼' : '▶'} How it works
        </button>

        {showDetails && (
          <div className="details-content">
            <ol className="steps-list">
              <li>
                <strong>Start Video Call:</strong> We'll initiate a short video call with you
              </li>
              <li>
                <strong>AI Face Detection:</strong> Our AI analyzes your face in real-time
              </li>
              <li>
                <strong>Photo Comparison:</strong> Your video face is compared to your profile photos
              </li>
              <li>
                <strong>Get Badge:</strong> If faces match (>90% confidence), you get the ✅ badge
              </li>
              <li>
                <strong>Profile Boost:</strong> Your verified status appears on your profile and in discovery
              </li>
            </ol>

            <div className="requirements">
              <h5>What You Need:</h5>
              <ul>
                <li>📷 A device with a camera (phone, laptop, or tablet)</li>
                <li>💡 Good lighting on your face</li>
                <li>📍 Quiet location for the call</li>
                <li>⏱️ About 5 minutes of your time</li>
              </ul>
            </div>

            <div className="privacy-note">
              <strong>🔒 Privacy:</strong> Your video is analyzed using AI but not stored permanently. Only verification results are kept.
            </div>
          </div>
        )}
      </div>

      <div className="prompt-actions">
        <button 
          type="button"
          className="btn-verify"
          onClick={handleStartVerification}
        >
          Start Verification
        </button>
        <button 
          type="button"
          className="btn-dismiss"
          onClick={handleDismiss}
        >
          Remind Me Later
        </button>
      </div>

      {userIsPremium && (
        <div className="premium-incentive">
          <span className="premium-badge">👑 PREMIUM</span>
          <p>As a premium member, verified profiles are shown first to you!</p>
        </div>
      )}
    </div>
  );
};

export default VideoVerificationPrompt;
