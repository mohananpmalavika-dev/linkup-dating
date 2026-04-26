import React, { useState, useRef } from 'react';
import messagingEnhancedService from '../../services/messagingEnhancedService';
import '../../styles/MessageSearch.css';

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
  const [currentPage, setCurrentPage] = useState(0);
  const searchTimeoutRef = useRef(null);

  const handleSearch = async (query) => {
    setSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        setError('');
        setCurrentPage(0);

        const searchFilters = {
          matchId,
          startDate: filters.startDate || null,
          endDate: filters.endDate || null,
          type: filters.type === 'all' ? null : filters.type,
          limit: 50,
          offset: 0
        };

        const response = await messagingEnhancedService.searchMessages(query, searchFilters);
        setResults(response.results);
      } catch (err) {
        setError(err || 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleFilterChange = (filterName, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterName]: value
    }));
    // Re-search with new filters
    if (searchQuery.trim()) {
      handleSearch(searchQuery);
    }
  };

  const getMessagePreview = (message) => {
    if (message.message_type === 'image') {
      return '[📷 Image]';
    }
    if (message.message_type === 'video') {
      return '[🎬 Video]';
    }
    if (message.message_type === 'location') {
      return `[📍 ${message.location_name || 'Location'}]`;
    }
    if (message.message_type === 'document') {
      return '[📄 Document]';
    }
    return message.message?.substring(0, 100) || '[Message]';
  };

  return (
    <div className="message-search">
      <div className="search-header">
        <h3>Search Messages</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="search-input"
          autoFocus
        />
        {loading && <span className="search-spinner">⟳</span>}
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="search-filters">
        <div className="filter-group">
          <label htmlFor="message-type">Type:</label>
          <select
            id="message-type"
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="text">Text</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="location">Locations</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="start-date">From:</label>
          <input
            id="start-date"
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="end-date">To:</label>
          <input
            id="end-date"
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
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
