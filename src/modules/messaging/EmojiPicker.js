import React, { useState, useRef, useEffect } from 'react';

const EMOJI_CATEGORIES = {
  smileys: ['😀', '😃', '😄', '😁', '😆', '😂', '😊', '🙂', '😉', '😍', '😘', '🤗'],
  gestures: ['👋', '👌', '👍', '👏', '🙏', '✌️', '🤝', '🤟', '👊', '🙌', '🤙', '🫶'],
  hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🤎', '💕', '💖', '💯', '🔥'],
  extras: ['🎉', '✨', '🚀', '🎯', '💡', '📌', '✅', '❗', '🎵', '📎', '☕', '🌟'],
};

const CATEGORY_LABELS = {
  smileys: 'Faces',
  gestures: 'Hands',
  hearts: 'Hearts',
  extras: 'More',
};

const EmojiPicker = ({ onSelectEmoji, onClose, position }) => {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      className="emoji-picker"
      ref={pickerRef}
      style={position ? { top: `${position.y}px`, left: `${position.x}px` } : {}}
    >
      <div className="emoji-categories">
        {Object.keys(EMOJI_CATEGORIES).map((category) => (
          <button
            key={category}
            className={`category-btn ${activeCategory === category ? 'active' : ''}`}
            onClick={() => setActiveCategory(category)}
            type="button"
            title={CATEGORY_LABELS[category]}
          >
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      <div className="emoji-grid">
        {EMOJI_CATEGORIES[activeCategory].map((emoji) => (
          <button
            key={emoji}
            className="emoji-btn"
            onClick={() => {
              onSelectEmoji(emoji);
              onClose();
            }}
            type="button"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;
