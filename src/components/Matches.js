import React, { useEffect, useState } from 'react';
import '../styles/Matches.css';
import datingProfileService from '../services/datingProfileService';

/**
 * Matches Component
 * Display and manage user matches
 */
const Matches = ({ onSelectMatch, onUnmatch, onViewProfile, onStartVideoCall }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await datingProfileService.getMatches(50);
      setMatches(data.matches || []);
    } catch (loadError) {
      setError('Failed to load matches');
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  };

  const handleUnmatch = async (matchId) => {
    if (!window.confirm('Unmatch with this person?')) {
      return;
    }

    try {
      await datingProfileService.unmatch(matchId);
      setMatches((currentMatches) => currentMatches.filter((match) => match.id !== matchId));
      onUnmatch?.(matchId);
    } catch (unmatchError) {
      console.error('Failed to unmatch:', unmatchError);
    }
  };

  const filteredMatches = matches
    .filter((match) => {
      if (filter === 'unread') {
        return (match.unreadCount || 0) > 0;
      }

      return true;
    })
    .sort((leftMatch, rightMatch) => {
      if (filter === 'recent') {
        const leftDate = leftMatch.lastMessageAt || leftMatch.matchedAt || leftMatch.createdAt || '';
        const rightDate = rightMatch.lastMessageAt || rightMatch.matchedAt || rightMatch.createdAt || '';
        return new Date(rightDate).getTime() - new Date(leftDate).getTime();
      }

      return 0;
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
            className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread
          </button>
        </div>
      </div>

      {filteredMatches.length > 0 ? (
        <div className="matches-list">
          {filteredMatches.map((match) => (
            <div key={match.id} className="match-item">
              <div
                className="match-photo"
                onClick={() => onSelectMatch?.(match)}
                style={{
                  backgroundImage: match.photos?.[0]
                    ? `url(${match.photos[0]})`
                    : 'linear-gradient(135deg, #667eea, #764ba2)'
                }}
              >
                {match.profileVerified ? (
                  <div className="verified-indicator">✓</div>
                ) : null}
              </div>

              <div className="match-info">
                <div className="match-header-row">
                  <h3>{match.firstName}, {match.age}</h3>
                  {(match.unreadCount || 0) > 0 ? (
                    <span className="unread-badge">{match.unreadCount}</span>
                  ) : null}
                </div>
                <p className="match-location">📍 {match.location?.city}</p>
                <p className="last-message">
                  {match.lastMessage?.text
                    ? `${match.lastMessage.text.substring(0, 50)}${match.lastMessage.text.length > 50 ? '...' : ''}`
                    : 'Start the conversation'}
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
                  onClick={() => onStartVideoCall?.(match)}
                  title="Start Video Call"
                >
                  📹
                </button>
                <button
                  className="btn-more"
                  onClick={() => {
                    const menu = document.querySelector(`#menu-${match.id}`);
                    menu?.classList.toggle('visible');
                  }}
                  title="More options"
                >
                  ⋯
                </button>
                <div id={`menu-${match.id}`} className="action-menu">
                  <button onClick={() => onViewProfile?.(match)}>
                    View Profile
                  </button>
                  <button onClick={() => handleUnmatch(match.id)}>
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
