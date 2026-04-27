/**
 * MessageReactionDisplay Component
 * Shows all reactions on a message with user details on hover
 */

import React, { useState, useEffect } from 'react';
import './MessageReactionDisplay.css';

const MessageReactionDisplay = ({ 
  messageId, 
  reactions = {},
  onRemoveReaction,
  currentUserId
}) => {
  const [expandedReaction, setExpandedReaction] = useState(null);
  const [reactionDetails, setReactionDetails] = useState({});

  useEffect(() => {
    // Build details for each reaction
    const details = {};
    Object.entries(reactions).forEach(([emoji, { count, users }]) => {
      details[emoji] = {
        count,
        users: Array.isArray(users) ? users : []
      };
    });
    setReactionDetails(details);
  }, [reactions]);

  const handleReactionClick = (emoji) => {
    const users = reactionDetails[emoji]?.users || [];
    const hasCurrentUserReacted = users.some(u => u.id === currentUserId);

    if (hasCurrentUserReacted) {
      onRemoveReaction(emoji);
    }
  };

  if (!reactions || Object.keys(reactions).length === 0) {
    return null;
  }

  return (
    <div className="message-reaction-display">
      {Object.entries(reactions).map(([emoji, reaction]) => {
        const users = reaction.users || [];
        const count = reaction.count || users.length;
        const userReacted = users.some(u => u.id === currentUserId);

        return (
          <div
            key={emoji}
            className={`reaction-bubble ${userReacted ? 'user-reacted' : ''}`}
            onMouseEnter={() => setExpandedReaction(emoji)}
            onMouseLeave={() => setExpandedReaction(null)}
            onClick={() => handleReactionClick(emoji)}
            title={userReacted ? 'Click to remove your reaction' : `Reacted by ${users.map(u => u.name).join(', ')}`}
          >
            <span className="reaction-emoji">{emoji}</span>
            <span className="reaction-count">{count}</span>

            {/* Expanded reaction detail */}
            {expandedReaction === emoji && (
              <div className="reaction-detail-popup">
                <div className="detail-header">
                  <span className="detail-emoji">{emoji}</span>
                  <span className="detail-count">{count} {count === 1 ? 'reaction' : 'reactions'}</span>
                </div>

                <div className="detail-users">
                  {users.map((user) => (
                    <div key={user.id} className="detail-user">
                      {user.profilePhoto && (
                        <img 
                          src={user.profilePhoto} 
                          alt={user.name}
                          className="user-avatar"
                        />
                      )}
                      <span className="user-name">{user.name}</span>
                      {user.id === currentUserId && (
                        <span className="you-badge">You</span>
                      )}
                    </div>
                  ))}
                </div>

                {userReacted && (
                  <div className="detail-action">
                    <button className="remove-reaction-btn">
                      Remove your reaction
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MessageReactionDisplay;
