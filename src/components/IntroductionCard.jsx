/**
 * IntroductionCard Component
 * Displays a single introduction suggestion with match details
 */

import React, { useState } from 'react';
import './IntroductionCard.css';

const IntroductionCard = ({
  introduction,
  onLike,
  onPass,
  onRate,
  compact = false
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);

  if (!introduction || !introduction.profile) {
    return null;
  }

  const {
    id,
    profile,
    conciergeNote,
    reasons = [],
    suggestedActivity,
    starters = []
  } = introduction;

  const handleLike = async () => {
    await onLike(id);
  };

  const handlePass = async () => {
    setShowDetails(true);
  };

  const handleConfirmPass = async (feedback = null) => {
    await onPass(id, feedback);
    setShowDetails(false);
  };

  const handleRateSubmit = async () => {
    if (rating > 0) {
      await onRate(id, rating);
      setShowRating(false);
      setRating(0);
    }
  };

  if (compact) {
    return (
      <div className="introduction-card compact">
        <div className="intro-compact-header">
          <img
            src={profile.photoUrl || '/default-avatar.png'}
            alt={profile.username}
            className="intro-compact-photo"
          />
          <div className="intro-compact-info">
            <h4>{profile.username}</h4>
            <p>{profile.age}, {profile.location}</p>
            <div className="intro-reason-badge">
              {reasons[0]?.label && <span>{reasons[0].label}</span>}
            </div>
          </div>
        </div>
        <div className="intro-compact-actions">
          <button
            className="btn-icon btn-pass"
            onClick={handlePass}
            title="Not interested"
          >
            ✕
          </button>
          <button
            className="btn-icon btn-like"
            onClick={handleLike}
            title="Interested"
          >
            ❤️
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="introduction-card">
        {/* Header Section */}
        <div className="intro-header">
          <img
            src={profile.photoUrl || '/default-avatar.png'}
            alt={profile.username}
            className="intro-profile-photo"
          />
          <div className="intro-header-info">
            <div className="intro-name-location">
              <h3>{profile.username}</h3>
              <p className="intro-age-location">{profile.age}, {profile.location}</p>
            </div>
            <div className="intro-badge">🎯 Curated Match</div>
          </div>
        </div>

        {/* Concierge Note */}
        {conciergeNote && (
          <div className="intro-note">
            <p>💡 {conciergeNote}</p>
          </div>
        )}

        {/* Match Reasons */}
        {reasons.length > 0 && (
          <div className="intro-reasons">
            <h4>Why we matched:</h4>
            <div className="reasons-list">
              {reasons.map((reason, idx) => (
                <div key={idx} className="reason-tag">
                  <span className="reason-icon">
                    {reason.type === 'shared_interests' && '🎯'}
                    {reason.type === 'location' && '📍'}
                    {reason.type === 'age' && '✨'}
                  </span>
                  <span>{reason.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <div className="intro-bio">
            <p>{profile.bio}</p>
          </div>
        )}

        {/* Interests */}
        {profile.interests && (
          <div className="intro-interests">
            <div className="interests-chips">
              {(typeof profile.interests === 'string'
                ? profile.interests.split(',').map((i) => i.trim())
                : profile.interests
              )
                .slice(0, 5)
                .map((interest, idx) => (
                  <span key={idx} className="interest-chip">{interest}</span>
                ))}
            </div>
          </div>
        )}

        {/* Suggested Activity */}
        {suggestedActivity && (
          <div className="intro-activity">
            <span className="activity-icon">📅</span>
            <span>{suggestedActivity}</span>
          </div>
        )}

        {/* Conversation Starters */}
        {starters.length > 0 && (
          <div className="intro-starters">
            <h4>💬 Conversation Starters:</h4>
            <div className="starters-list">
              {starters.slice(0, 2).map((starter, idx) => (
                <div key={idx} className="starter-item">
                  <div className="starter-title">{starter.title}</div>
                  <div className="starter-text">"{starter.content}"</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="intro-actions">
          <button
            className="btn btn-secondary"
            onClick={handlePass}
          >
            ✕ Not For Me
          </button>
          <button
            className="btn btn-primary"
            onClick={handleLike}
          >
            ❤️ Interested
          </button>
        </div>

        {/* Rating Option */}
        <button
          className="btn-rate"
          onClick={() => setShowRating(!showRating)}
        >
          ⭐ Rate This Match
        </button>
      </div>

      {/* Rating Modal */}
      {showRating && (
        <div className="intro-modal-overlay" onClick={() => setShowRating(false)}>
          <div className="intro-modal" onClick={(e) => e.stopPropagation()}>
            <h4>How was this introduction?</h4>
            <div className="rating-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  className={`rating-star ${star <= (hoveredStar || rating) ? 'active' : ''}`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                >
                  ⭐
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowRating(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={rating === 0}
                onClick={handleRateSubmit}
              >
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pass Feedback Modal */}
      {showDetails && (
        <div className="intro-modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="intro-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Why not interested?</h4>
            <div className="feedback-options">
              <label>
                <input type="radio" name="feedback" value="Not my type" />
                <span>Not my type</span>
              </label>
              <label>
                <input type="radio" name="feedback" value="Live too far away" />
                <span>Live too far away</span>
              </label>
              <label>
                <input type="radio" name="feedback" value="Different goals" />
                <span>Different goals</span>
              </label>
              <label>
                <input type="radio" name="feedback" value="Not ready" />
                <span>Not ready to date</span>
              </label>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDetails(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const feedback = document.querySelector('input[name="feedback"]:checked')?.value;
                  handleConfirmPass(feedback);
                }}
              >
                Pass
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default IntroductionCard;
