import React, { useState, useEffect } from 'react';

const MentionSuggestions = ({ 
  searchTerm, 
  participants = [], 
  onSelectMention,
  position = { x: 0, y: 0 }
}) => {
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 1) {
      setFilteredSuggestions([]);
      return;
    }

    const filtered = participants.filter(participant =>
      participant.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    setFilteredSuggestions(filtered);
    setSelectedIndex(0);
  }, [searchTerm, participants]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (filteredSuggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredSuggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
          break;
        case 'Enter':
          e.preventDefault();
          onSelectMention(filteredSuggestions[selectedIndex]);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredSuggestions, selectedIndex, onSelectMention]);

  if (filteredSuggestions.length === 0) {
    return null;
  }

  return (
    <div 
      className="mention-suggestions"
      style={{
        position: 'absolute',
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
    >
      <div className="mention-suggestions-list">
        {filteredSuggestions.map((participant, index) => (
          <div
            key={participant._id || participant.id}
            className={`mention-suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => onSelectMention(participant)}
            role="option"
            aria-selected={index === selectedIndex}
          >
            <span className="mention-avatar">{participant.avatar || 'U'}</span>
            <span className="mention-name">{participant.name}</span>
            {participant.isOnline && <span className="mention-online">●</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MentionSuggestions;
