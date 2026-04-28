/**
 * QuickViewMode Component
 * 3-second rapid-fire profile browsing with swipe gestures
 */

import React, { useState, useEffect, useRef } from 'react';
import './QuickViewMode.css';

const QuickViewMode = ({ profiles = [], onLike, onPass, onViewProfile, onExit }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayTime, setDisplayTime] = useState(3);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [gestureStart, setGestureStart] = useState(null);
  const timerRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });

  const currentProfile = profiles[currentIndex];

  // Auto-advance timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setDisplayTime((prev) => {
        if (prev <= 1) {
          advance('pass');
          return 3;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [currentIndex, profiles.length]);

  const advance = (action) => {
    if (isAnimating) return;
    setIsAnimating(true);

    if (action === 'like') {
      setSwipeDirection('right');
      onLike?.(currentProfile);
    } else if (action === 'pass') {
      setSwipeDirection('left');
      onPass?.(currentProfile);
    }

    setTimeout(() => {
      if (currentIndex + 1 < profiles.length) {
        setCurrentIndex((prev) => prev + 1);
        setSwipeDirection(null);
        setDisplayTime(3);
        setIsAnimating(false);
      } else {
        onExit?.();
      }
    }, 300);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') advance('like');
      if (e.key === 'ArrowLeft') advance('pass');
      if (e.key === 'Escape') onExit?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, profiles.length]);

  // Touch/Swipe handling
  const handleTouchStart = (e) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchEnd = (e) => {
    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };

    const deltaX = touchEnd.x - touchStartRef.current.x;
    const deltaY = Math.abs(touchEnd.y - touchStartRef.current.y);

    // Swipe is primarily horizontal
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        advance('like');
      } else {
        advance('pass');
      }
    }
  };

  if (!currentProfile || profiles.length === 0) {
    return (
      <div className="quick-view-empty">
        <div className="empty-content">
          <div className="empty-icon">👀</div>
          <div className="empty-message">No more profiles in Quick View</div>
          <button onClick={onExit} className="exit-button">
            Back to Discovery
          </button>
        </div>
      </div>
    );
  }

  const progressPercent = ((3 - displayTime) / 3) * 100;

  return (
    <div className="quick-view-mode">
      {/* Exit Button */}
      <button className="quick-view-exit" onClick={onExit} title="Exit Quick View">
        ✕
      </button>

      {/* Profile Counter */}
      <div className="quick-view-counter">
        {currentIndex + 1} / {profiles.length}
      </div>

      {/* Progress Bar */}
      <div className="quick-view-progress">
        <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
      </div>

      {/* Card Container */}
      <div
        className={`quick-view-card-container ${swipeDirection || ''}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => onViewProfile?.(currentProfile)}
      >
        <div className="quick-view-card">
          {/* Photo */}
          <div className="quick-view-photo">
            {currentProfile.photos?.[0] ? (
              <img
                src={currentProfile.photos[0].photo_url}
                alt={currentProfile.first_name}
                loading="lazy"
              />
            ) : (
              <div className="no-photo">📷</div>
            )}
          </div>

          {/* Info Overlay */}
          <div className="quick-view-info">
            <div className="quick-view-name">
              {currentProfile.first_name}, {currentProfile.age}
            </div>
            {currentProfile.location && (
              <div className="quick-view-location">📍 {currentProfile.location.city}</div>
            )}
          </div>

          {/* Swipe Indicators */}
          <div className="swipe-indicators">
            <div className="left-indicator">👎 Pass</div>
            <div className="right-indicator">❤️ Like</div>
          </div>

          {/* Bottom Info */}
          <div className="quick-view-bottom">
            <div className="timer">
              {displayTime}s
            </div>
            <div className="swipe-hint">Swipe or use ← →</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="quick-view-actions">
        <button
          className="action-pass"
          onClick={() => advance('pass')}
          title="Pass (← or Swipe Left)"
        >
          👎 Pass
        </button>

        <button
          className="action-view"
          onClick={() => onViewProfile?.(currentProfile)}
          title="View Full Profile"
        >
          👁️ View Profile
        </button>

        <button
          className="action-like"
          onClick={() => advance('like')}
          title="Like (→ or Swipe Right)"
        >
          ❤️ Like
        </button>
      </div>

      {/* Keyboard Hint */}
      <div className="quick-view-hint">
        Press <kbd>→</kbd> to like • <kbd>←</kbd> to pass • <kbd>ESC</kbd> to exit
      </div>
    </div>
  );
};

export default QuickViewMode;
