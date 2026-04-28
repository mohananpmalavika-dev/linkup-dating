/**
 * MilestoneNotification Component
 * Displays real-time notifications for streak milestones
 * Shows celebratory animations for 3-day, 7-day, and 30-day streaks
 */

import React, { useState, useEffect } from 'react';
import './MilestoneNotification.css';

const MilestoneNotification = ({ 
  milestone, 
  userName,
  onDismiss 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [displayEmoji, setDisplayEmoji] = useState('❤️');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [animationClass, setAnimationClass] = useState('');

  useEffect(() => {
    // Parse milestone and set display properties
    if (milestone === 3) {
      setDisplayEmoji('❤️');
      setTitle('🎉 3-Day Streak!');
      setMessage(`You and ${userName} are on a roll! 3 days of continuous connection. Keep it up! ❤️`);
      setAnimationClass('pulse-heart');
    } else if (milestone === 7) {
      setDisplayEmoji('❤️');
      setTitle('💎 7-Day Streak!');
      setMessage(`Incredible consistency! 7 days with ${userName}. You're building something special! 💎`);
      setAnimationClass('pulse-heart-large');
    } else if (milestone === 30) {
      setDisplayEmoji('🔥');
      setTitle('🔥 30-Day Streak! 🔥');
      setMessage(`AMAZING! 30 consecutive days with ${userName}! This is a remarkable connection! 🚀`);
      setAnimationClass('pulse-fire');
    }
  }, [milestone, userName]);

  useEffect(() => {
    // Auto-dismiss after 6 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300); // Allow fade-out animation
    }, 6000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`milestone-notification ${animationClass}`}>
      <div className="milestone-content">
        <div className="milestone-emoji-container">
          <span className="milestone-emoji">{displayEmoji}</span>
        </div>
        <div className="milestone-text">
          <h3 className="milestone-title">{title}</h3>
          <p className="milestone-message">{message}</p>
        </div>
        <button
          type="button"
          className="milestone-close"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
      <div className="milestone-progress-bar" />
    </div>
  );
};

export default MilestoneNotification;
