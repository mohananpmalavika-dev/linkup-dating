import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import './AISmartReplies.css';

const AISmartReplies = ({ chatId, messageId, onSelectReply }) => {
  const { apiCall } = useApp();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState('');

  useEffect(() => {
    if (!chatId || !messageId) {
      setSuggestions([]);
      return;
    }

    const loadSuggestions = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await apiCall('/messaging/ai/replies/generate', 'POST', {
          chatId,
          messageId,
        });

        setSuggestions(
          (response?.suggestions || []).map((suggestion) => ({
            ...suggestion,
            replyId: response?.replyId,
          }))
        );
      } catch (loadError) {
        console.error('Failed to load AI suggestions:', loadError);
        setError('Failed to generate smart replies.');
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, [apiCall, chatId, messageId]);

  const handleSelectSuggestion = async (suggestion) => {
    setSelectedSuggestion(suggestion.id);
    onSelectReply(suggestion.text);

    if (!suggestion.replyId) {
      return;
    }

    try {
      await apiCall(`/messaging/ai/replies/${suggestion.replyId}/rate`, 'POST', {
        suggestionId: suggestion.id,
        rating: 5,
      });
    } catch (ratingError) {
      console.error('Failed to rate suggestion:', ratingError);
    }
  };

  if (loading) {
    return (
      <div className="ai-suggestions-loading">
        <div className="loading-spinner"></div>
        <p>Generating smart replies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-suggestions-error">
        <p>{error}</p>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="ai-smart-replies">
      <div className="suggestions-header">
        <span className="header-text">Smart Replies</span>
      </div>
      <div className="suggestions-list">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className={`suggestion-item ${selectedSuggestion === suggestion.id ? 'selected' : ''}`}
            onClick={() => handleSelectSuggestion(suggestion)}
          >
            <div className="suggestion-content">
              <p className="suggestion-text">{suggestion.text}</p>
              <div className="suggestion-meta">
                <span className="tone-badge">{suggestion.tone}</span>
              </div>
            </div>
            <button className="btn-use-suggestion" type="button">
              Use
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AISmartReplies;
