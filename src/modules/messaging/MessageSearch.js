import React, { useState, useEffect } from 'react';

const MessageSearch = ({
  messages = [],
  chatId,
  onSearch,
  onSelectMessage,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const runSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setSelectedResultIndex(-1);
        setLoading(false);
        return;
      }

      if (typeof onSearch === 'function') {
        setLoading(true);
        try {
          const results = await onSearch(searchQuery.trim(), chatId);
          if (isMounted) {
            setSearchResults(Array.isArray(results) ? results : []);
            setSelectedResultIndex(-1);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
        return;
      }

      const query = searchQuery.toLowerCase();
      const results = messages.filter((message) =>
        String(message?.content || '').toLowerCase().includes(query)
      );
      setSearchResults(results);
      setSelectedResultIndex(-1);
    };

    const timeoutId = window.setTimeout(runSearch, 180);
    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [chatId, messages, onSearch, searchQuery]);

  const handleSelectResult = (message) => {
    onSelectMessage(message);
    setSearchQuery('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedResultIndex((prev) =>
        prev < searchResults.length - 1 ? prev + 1 : prev
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedResultIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (event.key === 'Enter' && selectedResultIndex >= 0) {
      handleSelectResult(searchResults[selectedResultIndex]);
    }
  };

  return (
    <div className="message-search-container">
      <div className="search-header">
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="search-input-field"
        />
        <button
          className="search-close-btn"
          onClick={onClose}
          type="button"
          title="Close search"
        >
          X
        </button>
      </div>

      {loading && (
        <div className="search-loading-state">
          <p>Searching messages...</p>
        </div>
      )}

      {!loading && searchResults.length > 0 && (
        <div className="search-results-container">
          <p className="search-results-count">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          </p>
          <div className="search-results-list">
            {searchResults.map((result, index) => (
              <div
                key={result._id || index}
                className={`search-result-item ${
                  selectedResultIndex === index ? 'selected' : ''
                }`}
                onClick={() => handleSelectResult(result)}
              >
                <div className="result-content">
                  <p className="result-text">
                    {String(result.content || '').substring(0, 100)}
                    {String(result.content || '').length > 100 ? '...' : ''}
                  </p>
                  <span className="result-time">
                    {new Date(result.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && searchQuery.trim() && searchResults.length === 0 && (
        <div className="no-search-results">
          <p>No messages found</p>
        </div>
      )}
    </div>
  );
};

export default MessageSearch;
