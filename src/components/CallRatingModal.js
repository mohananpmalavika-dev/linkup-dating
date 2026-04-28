import React, { useState } from 'react';
import videoCallInsightsService from '../services/videoCallInsightsService';
import './VideoCallAnalytics.css';

const CallRatingModal = ({ videoDeteId, matchName, onClose, onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [wouldDateAgain, setWouldDateAgain] = useState(null);
  const [communicationQuality, setCommunicationQuality] = useState(0);
  const [chemistryLevel, setChemistryLevel] = useState(0);
  const [appearanceMatch, setAppearanceMatch] = useState(0);
  const [personalityMatch, setPersonalityMatch] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitRating = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const result = await videoCallInsightsService.submitCallRating(
        videoDeteId,
        rating,
        comment,
        wouldDateAgain,
        communicationQuality,
        chemistryLevel,
        appearanceMatch,
        personalityMatch
      );

      if (result.success) {
        setSubmitted(true);
        if (onSubmit) {
          onSubmit(result);
        }
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(result.error || 'Failed to submit rating');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rating-modal-overlay">
        <div className="rating-modal success">
          <div className="success-icon">✓</div>
          <h2>Rating Submitted!</h2>
          <p>Thank you for rating your video call. Your feedback helps us improve matches.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rating-modal-overlay" onClick={onClose}>
      <div className="rating-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>How was your video call with {matchName}?</h2>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-content">
          {error && (
            <div className="error-message">
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {/* Overall Rating */}
          <div className="rating-section">
            <label>Overall Experience</label>
            <div className="star-rating">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  className={`star-btn ${
                    star <= (hoveredRating || rating) ? 'active' : ''
                  }`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                >
                  ⭐
                </button>
              ))}
            </div>
            <div className="rating-label">
              {hoveredRating > 0 || rating > 0
                ? ['Terrible', 'Poor', 'Average', 'Good', 'Excellent'][
                    (hoveredRating || rating) - 1
                  ]
                : 'Select a rating'}
            </div>
          </div>

          {/* Quality Metrics */}
          <div className="quality-section">
            <h4>How would you rate these aspects?</h4>

            <div className="quality-item">
              <label>Communication Quality</label>
              <div className="small-star-rating">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    className={`small-star ${
                      star <= communicationQuality ? 'active' : ''
                    }`}
                    onClick={() => setCommunicationQuality(star)}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>

            <div className="quality-item">
              <label>Chemistry / Connection</label>
              <div className="small-star-rating">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    className={`small-star ${star <= chemistryLevel ? 'active' : ''}`}
                    onClick={() => setChemistryLevel(star)}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>

            <div className="quality-item">
              <label>How Well Appearance Matched Profile</label>
              <div className="small-star-rating">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    className={`small-star ${star <= appearanceMatch ? 'active' : ''}`}
                    onClick={() => setAppearanceMatch(star)}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>

            <div className="quality-item">
              <label>Personality Match</label>
              <div className="small-star-rating">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    className={`small-star ${star <= personalityMatch ? 'active' : ''}`}
                    onClick={() => setPersonalityMatch(star)}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Would Date Again */}
          <div className="date-again-section">
            <label>Would you want to go on a date with them?</label>
            <div className="button-group">
              <button
                className={`btn-yes ${wouldDateAgain === true ? 'selected' : ''}`}
                onClick={() => setWouldDateAgain(true)}
              >
                👍 Yes!
              </button>
              <button
                className={`btn-maybe ${wouldDateAgain === null && wouldDateAgain !== false ? 'selected' : ''}`}
                onClick={() => setWouldDateAgain(null)}
              >
                🤷 Maybe
              </button>
              <button
                className={`btn-no ${wouldDateAgain === false ? 'selected' : ''}`}
                onClick={() => setWouldDateAgain(false)}
              >
                👎 No
              </button>
            </div>
          </div>

          {/* Comment */}
          <div className="comment-section">
            <label>Additional Comments (Optional)</label>
            <textarea
              placeholder="Share your thoughts about the call..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <small>{comment.length}/500</small>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-submit"
            onClick={handleSubmitRating}
            disabled={submitting || rating === 0}
          >
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallRatingModal;
