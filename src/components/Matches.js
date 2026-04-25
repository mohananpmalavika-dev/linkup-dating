import React, { useState, useEffect } from 'react';
import '../styles/Matches.css';
import datingProfileService from '../services/datingProfileService';

/**
 * Matches Component
 * Display and manage user matches
 */
const Matches = ({ onSelectMatch, onUnmatch }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, recent, favorites

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await datingProfileService.getMatches(50);
      setMatches(data.matches || []);
    } catch (err) {
      setError('Failed to load matches');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnmatch = async (userId) => {
    if (window.confirm('Unmatch with this person?')) {
      try {
        await datingProfileService.unmatch(userId);
        setMatches(matches.filter(m => m.userId !== userId));
        onUnmatch?.(userId);
      } catch (err) {
        console.error('Failed to unmatch:', err);
      }
    }
  };

  const filteredMatches = matches.filter(match => {
    if (filter === 'recent') {
      return true; // Sort by recent
    }
    return true;
  });

  if (loading) {
    return (
      <div className="matches-container loading">
        <div className="spinner"></div>
        <p>Loading matches...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="matches-container error">
        <p>{error}</p>
        <button onClick={loadMatches}>Retry</button>
      </div>
    );
  }

  return (
    <div className="matches-container">
      <div className="matches-header">
        <h2>My Matches ({matches.length})</h2>
        <div className="filter-tabs">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'recent' ? 'active' : ''}`}
            onClick={() => setFilter('recent')}
          >
            Recent
          </button>
          <button
            className={`filter-btn ${filter === 'favorites' ? 'active' : ''}`}
            onClick={() => setFilter('favorites')}
          >
            Favorites
          </button>
        </div>
      </div>

      {filteredMatches.length > 0 ? (
        <div className="matches-list">
          {filteredMatches.map((match) => (
            <div key={match.userId} className="match-item">
              <div
                className="match-photo"
                onClick={() => onSelectMatch?.(match)}
                style={{
                  backgroundImage: match.photos?.[0]
                    ? `url(${match.photos[0]})`
                    : 'linear-gradient(135deg, #667eea, #764ba2)'
                }}
              >
                {match.profileVerified && (
                  <div className="verified-indicator">✓</div>
                )}
              </div>

              <div className="match-info">
                <div className="match-header-row">
                  <h3>{match.firstName}, {match.age}</h3>
                  {match.lastMessage && (
                    <span className="unread-badge">●</span>
                  )}
                </div>
                <p className="match-location">📍 {match.location?.city}</p>
                <p className="last-message">
                  {match.lastMessage?.text?.substring(0, 50)}...
                </p>
              </div>

              <div className="match-actions">
                <button
                  className="btn-message"
                  onClick={() => onSelectMatch?.(match)}
                  title="Send Message"
                >
                  💬
                </button>
                <button
                  className="btn-video"
                  title="Start Video Call"
                >
                  📹
                </button>
                <button
                  className="btn-more"
                  onClick={() => {
                    const menu = document.querySelector(`#menu-${match.userId}`);
                    menu?.classList.toggle('visible');
                  }}
                  title="More options"
                >
                  ⋯
                </button>
                <div id={`menu-${match.userId}`} className="action-menu">
                  <button onClick={() => onSelectMatch?.(match)}>
                    View Profile
                  </button>
                  <button onClick={() => handleUnmatch(match.userId)}>
                    Unmatch
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-matches">
          <p>No matches yet. Start swiping to find someone!</p>
        </div>
      )}
    </div>
  );
};

export default Matches;
