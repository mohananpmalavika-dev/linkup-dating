/**
 * ReactionPicker Component
 * Displays emoji reactions and allows user to add reactions to messages
 */

import React, { useState, useEffect, useRef } from 'react';
import './ReactionPicker.css';
import { buildApiUrl } from '../utils/api';

const ReactionPicker = ({ 
  messageId, 
  onReactionSelected, 
  matchId,
  userFavorites = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([
    '👍', '❤️', '😂', '🔥'
  ]);
  const [allReactions, setAllReactions] = useState({});
  const pickerRef = useRef(null);

  useEffect(() => {
    // Fetch available reactions
    const fetchReactions = async () => {
      try {
        const response = await fetch(buildApiUrl('/reactions/emoji-list'));
        const data = await response.json();
        if (data.success) {
          setAllReactions(data.emojis);
        }
      } catch (error) {
        console.error('Error fetching reactions:', error);
      }
    };

    fetchReactions();
  }, []);

  useEffect(() => {
    // Close picker when clicking outside
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleReactionClick = (emoji) => {
    onReactionSelected(emoji);
    setIsOpen(false);
  };

  const primaryReactions = suggestions.slice(0, 4);
  const hasMore = Object.keys(allReactions).length > 4;

  return (
    <div className="reaction-picker-container" ref={pickerRef}>
      <div className="reaction-picker-buttons">
        {/* Quick reaction buttons */}
        {primaryReactions.map((emoji) => (
          <button
            key={emoji}
            className="reaction-quick-btn"
            onClick={() => handleReactionClick(emoji)}
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}

        {/* More reactions button */}
        {hasMore && (
          <button
            className="reaction-more-btn"
            onClick={() => setIsOpen(!isOpen)}
            title="More reactions"
          >
            <span className="more-dots">•••</span>
          </button>
        )}
      </div>

      {/* Reaction picker modal */}
      {isOpen && (
        <div className="reaction-picker-modal">
          <div className="reaction-picker-header">
            <h4>Choose a reaction</h4>
          </div>

          <div className="reaction-picker-grid">
            {Object.entries(allReactions).map(([name, emoji]) => (
              <button
                key={name}
                className="reaction-picker-item"
                onClick={() => handleReactionClick(emoji)}
                title={name}
              >
                <span className="reaction-emoji">{emoji}</span>
                <span className="reaction-name">{name}</span>
              </button>
            ))}
          </div>

          <div className="reaction-picker-footer">
            <small>Click to react</small>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReactionPicker;
