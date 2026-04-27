import React, { useRef, useState } from 'react';
import messagingEnhancedService from '../services/messagingEnhancedService';
import '../styles/MessageSearch.css';

/**
 * MessageSearch Component
 * Search and filter messages in conversations
 */
const MessageSearch = ({ matchId, onSelectMessage, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    type: 'all'
  });
  const searchTimeoutRef = useRef(null);

  const handleSearch = async (query) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        setError('');

        const response = await messagingEnhancedService.searchMessages(query, {
          matchId,
          startDate: filters.startDate || null,
          endDate: filters.endDate || null,
          type: filters.type === 'all' ? null : filters.type,
          limit: 50,
          offset: 0
        });

        setResults(response.results);
      } catch (searchError) {
        setError(searchError || 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleFilterChange = (filterName, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [filterName]: value
    }));

    if (searchQuery.trim()) {
      handleSearch(searchQuery);
    }
  };

  const getMessagePreview = (message) => {
    if (message.message_type === 'image') {
      return '[Image]';
    }
    if (message.message_type === 'video') {
      return '[Video]';
    }
    if (message.message_type === 'audio') {
      return '[Audio]';
    }
    if (message.message_type === 'location') {
      return `[Location] ${message.location_name || 'Shared location'}`;
    }
    if (message.message_type === 'document') {
      return '[Document]';
    }

    return message.message?.substring(0, 100) || '[Message]';
  };

  return (
    <div className="message-search">
      <div className="search-header">
        <h3>Search Messages</h3>
        <button type="button" className="close-btn" onClick={onClose}>x</button>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(event) => handleSearch(event.target.value)}
          className="search-input"
          autoFocus
        />
        {loading && <span className="search-spinner">...</span>}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="search-filters">
        <div className="filter-group">
          <label htmlFor="message-type">Type:</label>
          <select
            id="message-type"
            value={filters.type}
            onChange={(event) => handleFilterChange('type', event.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="text">Text</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
            <option value="document">Documents</option>
            <option value="location">Locations</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="start-date">From:</label>
          <input
            id="start-date"
            type="date"
            value={filters.startDate}
            onChange={(event) => handleFilterChange('startDate', event.target.value)}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="end-date">To:</label>
          <input
            id="end-date"
            type="date"
            value={filters.endDate}
            onChange={(event) => handleFilterChange('endDate', event.target.value)}
            className="filter-input"
          />
        </div>
      </div>

      <div className="search-results">
        {searchQuery.trim().length < 2 ? (
          <div className="empty-state">
            <p>Type at least 2 characters to search</p>
          </div>
        ) : loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Searching...</p>
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="results-info">
              Found {results.length} message{results.length !== 1 ? 's' : ''}
            </div>
            <div className="results-list">
              {results.map((message) => (
                <div
                  key={message.id}
                  className="result-item"
                  onClick={() => onSelectMessage(message)}
                >
                  <div className="result-sender">
                    {message.fromUser?.first_name || 'User'}
                  </div>
                  <div className="result-preview">
                    {getMessagePreview(message)}
                  </div>
                  <div className="result-time">
                    {new Date(message.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>No messages found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageSearch;
