/**
 * TypingIndicator Component
 * Shows who is currently typing in a match
 */
import React from 'react';
import { useTypingIndicators } from '../hooks/useRealTime';
import './TypingIndicator.css';

const TypingIndicator = ({ matchId, userNames = {} }) => {
  const { typingUsers } = useTypingIndicators(matchId);

  if (!typingUsers || typingUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      const user = typingUsers[0];
      const name = userNames[user.userId] || `User ${user.userId}`;
      return `${name} is typing`;
    } else if (typingUsers.length === 2) {
      const names = typingUsers
        .map((u) => userNames[u.userId] || `User ${u.userId}`)
        .join(' and ');
      return `${names} are typing`;
    } else {
      return `${typingUsers.length} people are typing`;
    }
  };

  return (
    <div className="typing-indicator-container">
      <div className="typing-text">{getTypingText()}</div>
      <div className="typing-dots">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
};

export default TypingIndicator;
