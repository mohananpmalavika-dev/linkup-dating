import React from 'react';
import './PassReasonTag.css';

/**
 * PassReasonTag Component
 * Displays the reason a profile was passed in a visual tag format
 */
const PassReasonTag = ({ reason, size = 'medium', variant = 'default' }) => {
  const reasonMap = {
    age: {
      label: 'Age Mismatch',
      icon: '📅',
      color: 'age'
    },
    distance: {
      label: 'Too Far Away',
      icon: '📍',
      color: 'distance'
    },
    interests: {
      label: 'Different Interests',
      icon: '🎯',
      color: 'interests'
    },
    goals: {
      label: 'Different Goals',
      icon: '💝',
      color: 'goals'
    },
    body_type: {
      label: 'Body Type',
      icon: '👤',
      color: 'body_type'
    },
    height: {
      label: 'Height',
      icon: '📏',
      color: 'height'
    },
    other: {
      label: 'Other',
      icon: '✨',
      color: 'other'
    }
  };

  const reasonData = reasonMap[reason] || reasonMap.other;

  return (
    <span className={`pass-reason-tag size-${size} variant-${variant} color-${reasonData.color}`}>
      <span className="icon">{reasonData.icon}</span>
      <span className="label">{reasonData.label}</span>
    </span>
  );
};

export default PassReasonTag;
