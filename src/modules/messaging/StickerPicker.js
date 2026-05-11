import React, { useState, useRef, useEffect } from 'react';

const STICKER_CATEGORIES = {
  fun: [
    { value: '🎉', label: 'Celebrate' },
    { value: '🎈', label: 'Party' },
    { value: '🕺', label: 'Dance' },
    { value: '💥', label: 'Boom' },
    { value: '✨', label: 'Sparkle' },
    { value: '🥳', label: 'Birthday' },
  ],
  cute: [
    { value: '🐶', label: 'Puppy' },
    { value: '🐱', label: 'Kitty' },
    { value: '🐰', label: 'Bunny' },
    { value: '🦊', label: 'Fox' },
    { value: '🐼', label: 'Panda' },
    { value: '🦄', label: 'Unicorn' },
  ],
  love: [
    { value: '💌', label: 'Love Letter' },
    { value: '💘', label: 'Cupid' },
    { value: '💕', label: 'Hearts' },
    { value: '💖', label: 'Sparkling Heart' },
    { value: '😍', label: 'Heart Eyes' },
    { value: '🥰', label: 'Smiling Love' },
  ],
  cheers: [
    { value: '🍷', label: 'Cheers' },
    { value: '🍹', label: 'Cocktail' },
    { value: '☕', label: 'Coffee' },
    { value: '🍕', label: 'Pizza' },
    { value: '🍰', label: 'Cake' },
    { value: '🎁', label: 'Gift' },
  ],
};

const CATEGORY_LABELS = {
  fun: 'Fun',
  cute: 'Cute',
  love: 'Love',
  cheers: 'Cheers',
};

const StickerPicker = ({ onSelectSticker, onClose, position }) => {
  const [activeCategory, setActiveCategory] = useState('fun');
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
      className="emoji-picker sticker-picker"
      ref={pickerRef}
      style={position ? { top: `${position.y}px`, left: `${position.x}px` } : {}}
    >
      <div className="emoji-categories">
        {Object.keys(STICKER_CATEGORIES).map((category) => (
          <button
            key={category}
            className={`emoji-category-btn ${activeCategory === category ? 'active' : ''}`}
            onClick={() => setActiveCategory(category)}
            type="button"
            title={CATEGORY_LABELS[category]}
          >
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      <div className="emoji-grid">
        {STICKER_CATEGORIES[activeCategory].map((sticker) => (
          <button
            key={sticker.label}
            className="emoji-btn"
            type="button"
            onClick={() => {
              onSelectSticker(sticker.value);
              onClose();
            }}
            title={sticker.label}
          >
            <span style={{ fontSize: '1.75rem' }}>{sticker.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StickerPicker;
