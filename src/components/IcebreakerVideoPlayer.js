import React, { useState, useRef, useEffect } from 'react';
import '../styles/IcebreakerVideos.css';

/**
 * IcebreakerVideoPlayer
 * View and rate an icebreaker video from a matched user
 */
function IcebreakerVideoPlayer({ video, user, onRate, onClose }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rating, setRating] = useState(0);
  const [authenticityStar, setAuthenticityRating] = useState(0);
  const [reaction, setReaction] = useState(null);
  const [isHelpful, setIsHelpful] = useState(false);
  const [wouldMatch, setWouldMatch] = useState(false);
  const [comment, setComment] = useState('');
  const [showRating, setShowRating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const REACTIONS = ['like', 'love', 'funny', 'wow', 'inspiring'];
  const REACTION_EMOJIS = {
    like: '👍',
    love: '❤️',
    funny: '😂',
    wow: '🤩',
    inspiring: '✨',
  };

  /**
   * Handle video play
   */
  const handleVideoPlay = () => {
    setIsPlaying(true);
  };

  /**
   * Handle video pause
   */
  const handleVideoPause = () => {
    setIsPlaying(false);
  };

  /**
   * Handle rating submission
   */
  const handleSubmitRating = async () => {
    if (!rating) {
      setSubmitError('Please select a rating');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      await onRate({
        rating,
        authenticity_rating: authenticityStar,
        reaction,
        is_helpful: isHelpful,
        would_match: wouldMatch,
        comment: comment || null,
      });

      // Close after brief delay
      setTimeout(() => onClose(), 800);
    } catch (error) {
      setSubmitError('Failed to submit rating. Please try again.');
      console.error('Rating submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Quick reaction button
   */
  const QuickReaction = ({ type, emoji }) => (
    <button
      onClick={() => setReaction(reaction === type ? null : type)}
      className={`reaction-btn ${reaction === type ? 'active' : ''}`}
      title={type}
    >
      {emoji}
    </button>
  );

  return (
    <div className="video-player-overlay">
      <div className="video-player">
        {/* Close button */}
        <button onClick={onClose} className="btn-player-close">
          ✕
        </button>

        {/* Video container */}
        <div className="video-container">
          <video
            ref={videoRef}
            src={video.video_url}
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            controls
            autoPlay
            className="main-video"
          />
        </div>

        {/* User info */}
        <div className="player-user-info">
          <div className="user-avatar">
            <img src={user?.photo_url} alt={user?.first_name} />
          </div>
          <div className="user-details">
            <h3 className="user-name">{user?.first_name}, {user?.age}</h3>
            <p className="video-prompt">Why I'm looking for someone</p>
            <div className="video-meta">
              <span>⏱ {video.duration_seconds}s</span>
              <span>👁 {video.view_count} views</span>
              <span>⭐ {video.average_rating?.toFixed(1) || 'New'}</span>
            </div>
          </div>
        </div>

        {/* Rating section */}
        {!showRating ? (
          <div className="player-actions">
            <button
              onClick={() => setShowRating(true)}
              className="btn-rate-video"
            >
              ⭐ Rate This Video
            </button>
            <button onClick={onClose} className="btn-pass">
              ← Back
            </button>
          </div>
        ) : (
          <div className="rating-section">
            <h4>What do you think?</h4>

            {/* Star rating */}
            <div className="star-rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`star ${rating >= star ? 'active' : ''}`}
                >
                  ★
                </button>
              ))}
              {rating && <span className="rating-text">{rating} stars</span>}
            </div>

            {/* Authenticity rating */}
            <div className="authenticity-rating">
              <label>How authentic did they seem?</label>
              <div className="authenticity-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setAuthenticityRating(star)}
                    className={`authenticity-star ${
                      authenticityStar >= star ? 'active' : ''
                    }`}
                    title={
                      {
                        1: 'Not authentic',
                        2: 'Somewhat fake',
                        3: 'Neutral',
                        4: 'Pretty authentic',
                        5: 'Very authentic',
                      }[star]
                    }
                  >
                    ✓
                  </button>
                ))}
              </div>
            </div>

            {/* Quick reactions */}
            <div className="reactions">
              <label>Quick reaction:</label>
              <div className="reaction-buttons">
                {REACTIONS.map((type) => (
                  <QuickReaction
                    key={type}
                    type={type}
                    emoji={REACTION_EMOJIS[type]}
                  />
                ))}
              </div>
            </div>

            {/* Helpful toggle */}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isHelpful}
                onChange={(e) => setIsHelpful(e.target.checked)}
              />
              This video helped me understand them better
            </label>

            {/* Would match toggle */}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={wouldMatch}
                onChange={(e) => setWouldMatch(e.target.checked)}
              />
              More likely to match after seeing this
            </label>

            {/* Comment */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.slice(0, 200))}
              placeholder="Optional comment (max 200 chars)"
              className="rating-comment"
              maxLength={200}
            />
            {comment && (
              <small>{comment.length}/200 characters</small>
            )}

            {/* Error message */}
            {submitError && (
              <div className="error-message">{submitError}</div>
            )}

            {/* Submit actions */}
            <div className="rating-actions">
              <button
                onClick={() => {
                  setShowRating(false);
                  setRating(0);
                  setAuthenticityRating(0);
                  setReaction(null);
                  setComment('');
                  setSubmitError(null);
                }}
                className="btn-cancel-rating"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRating}
                className="btn-submit-rating"
                disabled={isSubmitting || !rating}
              >
                {isSubmitting ? 'Submitting...' : '✓ Submit Rating'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default IcebreakerVideoPlayer;
