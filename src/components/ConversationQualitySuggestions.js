import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/ConversationQualitySuggestions.css';

const ConversationQualitySuggestions = ({ matchId }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(null);

  useEffect(() => {
    if (matchId) {
      fetchSuggestions();
    }
  }, [matchId]);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/conversation-quality/${matchId}/suggestions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuggestions(response.data.suggestions || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setError('Could not load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleUseSuggestion = async (suggestionId, suggestionText) => {
    try {
      const token = localStorage.getItem('authToken');
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/conversation-quality/${matchId}/suggestions/${suggestionId}/use`,
        { used: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Copy suggestion to clipboard and show feedback
      navigator.clipboard.writeText(suggestionText);
      alert('✅ Suggestion copied! Ready to send.');
    } catch (err) {
      console.error('Error marking suggestion used:', err);
    }
  };

  const getSuggestionIcon = (type) => {
    const icons = {
      icebreaker: '❄️',
      question: '❓',
      topic_continuation: '🔄',
      deep_dive: '🌊',
      light_topic: '💡',
      connection_builder: '💕'
    };
    return icons[type] || '💬';
  };

  const getSuggestionTitle = (type) => {
    const titles = {
      icebreaker: 'Icebreaker',
      question: 'Ask a Question',
      topic_continuation: 'Continue Topic',
      deep_dive: 'Go Deeper',
      light_topic: 'Fun Topic',
      connection_builder: 'Next Level'
    };
    return titles[type] || 'Suggestion';
  };

  if (loading) {
    return (
      <div className="suggestions-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error && suggestions.length === 0) {
    return null;
  }

  if (suggestions.length === 0) {
    return (
      <div className="suggestions-empty">
        <p>Keep the conversation flowing naturally!</p>
      </div>
    );
  }

  return (
    <div className="suggestions-container">
      <div className="suggestions-header">
        <h3>💡 AI Suggestions</h3>
        <p className="suggestions-subtitle">Spark deeper conversations</p>
      </div>

      <div className="suggestions-list">
        {suggestions.map((suggestion, index) => (
          <div 
            key={index}
            className={`suggestion-card ${suggestion.type}`}
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
          >
            <div className="suggestion-header">
              <span className="suggestion-icon">
                {getSuggestionIcon(suggestion.type)}
              </span>
              <div className="suggestion-info">
                <p className="suggestion-title">
                  {getSuggestionTitle(suggestion.type)}
                </p>
                <p className="suggestion-reason">
                  {suggestion.reason}
                </p>
              </div>
              <span className={`expand-icon ${expandedIndex === index ? 'expanded' : ''}`}>
                ⌃
              </span>
            </div>

            {expandedIndex === index && (
              <div className="suggestion-content">
                <p className="suggestion-text">
                  "{suggestion.text}"
                </p>
                <button 
                  className="use-suggestion-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUseSuggestion(suggestion.id, suggestion.text);
                  }}
                >
                  Use This Suggestion 📋
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="suggestions-tip">
        <p>💡 <strong>Tip:</strong> Use these suggestions to deepen your connection!</p>
      </div>
    </div>
  );
};

export default ConversationQualitySuggestions;
