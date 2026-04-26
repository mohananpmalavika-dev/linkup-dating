import React, { useEffect, useState } from 'react';
import { useLocation } from '../router';
import '../styles/Matches.css';
import datingProfileService from '../services/datingProfileService';

/**
 * Matches Component
 * Display and manage user matches
 */
const buildLikeProfileContext = (like) => ({
  userId: like.from_user_id,
  firstName: like.first_name || '',
  age: like.age ?? null,
  photos: like.photo_url ? [like.photo_url] : [],
  location: {
    city: like.location_city || ''
  }
});

const Matches = ({ onMatchCreated, onSelectMatch, onUnmatch, onViewProfile, onStartVideoCall }) => {
  const location = useLocation();
  const [matches, setMatches] = useState([]);
  const [likesReceived, setLikesReceived] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [likingBackUserId, setLikingBackUserId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [navigationNotice, setNavigationNotice] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadMatches();
    loadLikesReceived();
  }, []);

  useEffect(() => {
    if (!location.state?.focusMessages) {
      setNavigationNotice('');
      return;
    }

    if (matches.length > 0) {
      setNavigationNotice('Opening messages is available once you choose a match.');
      return;
    }

    setNavigationNotice('No conversations yet. Match with someone first, then tap Messages to open the chat.');
  }, [location.state?.focusMessages, location.state?.messagesRequestedAt, matches.length]);

  const loadMatches = async () => {
    setLoading(true);
    setLoadError('');

    try {
      const data = await datingProfileService.getMatches(50);
      setMatches(data.matches || []);
    } catch (loadError) {
      setLoadError('Failed to load matches');
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  };

  const loadLikesReceived = async () => {
    setLoadingLikes(true);

    try {
      const data = await datingProfileService.getLikesReceived(20);
      setLikesReceived(Array.isArray(data) ? data : []);
    } catch (loadError) {
      console.error('Failed to load likes received:', loadError);
    } finally {
      setLoadingLikes(false);
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

  const handleLikeBack = async (like) => {
    if (!like?.from_user_id) {
      return;
    }

    setLikingBackUserId(like.from_user_id);
    setActionError('');

    try {
      const result = await datingProfileService.likeProfile(like.from_user_id);

      if (!result.isMatch) {
        setActionError('Like sent. We will show the match here once it is mutual.');
        return;
      }

      setLikesReceived((currentLikes) => (
        currentLikes.filter((currentLike) => currentLike.from_user_id !== like.from_user_id)
      ));
      await loadMatches();
      onMatchCreated?.();
    } catch (likeError) {
      setActionError('Failed to like this profile back');
      console.error('Failed to like back:', likeError);
    } finally {
      setLikingBackUserId(null);
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

  if (loadError) {
    return (
      <div className="matches-container error">
        <p>{loadError}</p>
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

      <div className="likes-you-section">
        <div className="likes-you-header">
          <div>
            <h3>Likes You</h3>
            <p>People who already showed interest in you.</p>
          </div>
          <button type="button" className="likes-refresh-btn" onClick={loadLikesReceived}>
            Refresh
          </button>
        </div>

        {actionError ? (
          <div className="likes-you-feedback" role="status">
            {actionError}
          </div>
        ) : null}

        {navigationNotice ? (
          <div className="matches-navigation-notice" role="status">
            {navigationNotice}
          </div>
        ) : null}

        {loadingLikes ? (
          <div className="likes-you-empty">
            <p>Loading likes...</p>
          </div>
        ) : likesReceived.length > 0 ? (
          <div className="likes-you-list">
            {likesReceived.map((like) => (
              <div key={`${like.from_user_id}-${like.created_at}`} className="like-card">
                <div
                  className="like-card-photo"
                  style={{
                    backgroundImage: like.photo_url
                      ? `url(${like.photo_url})`
                      : 'linear-gradient(135deg, #f97316, #fb7185)'
                  }}
                />
                <div className="like-card-body">
                  <h4>
                    {like.first_name}
                    {like.age ? `, ${like.age}` : ''}
                  </h4>
                  <p>{like.location_city || 'Nearby'}</p>
                  <div className="like-card-actions">
                    <button
                      type="button"
                      className="like-card-secondary"
                      onClick={() => onViewProfile?.(buildLikeProfileContext(like))}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="like-card-primary"
                      onClick={() => handleLikeBack(like)}
                      disabled={likingBackUserId === like.from_user_id}
                    >
                      {likingBackUserId === like.from_user_id ? 'Matching...' : 'Like Back'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="likes-you-empty">
            <p>No likes yet. Keep your profile active and check back soon.</p>
          </div>
        )}
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
