import React, { useCallback, useEffect, useState } from 'react';
import socialService from '../services/socialService';
import '../styles/FriendsList.css';

const FriendsList = ({ onSelectFriend, onClose }) => {
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('friends');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const loadFriends = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (activeTab === 'friends') {
        const data = await socialService.getFriends('accepted', 100, 0, 'all');
        setFriends(Array.isArray(data.friends) ? data.friends : []);
      } else {
        const data = await socialService.getFriends('pending', 100, 0, 'incoming');
        setPendingRequests(Array.isArray(data.friends) ? data.friends : []);
      }
    } catch (err) {
      setError('Failed to load friends');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const handleRemoveFriend = async (friendshipId) => {
    if (!window.confirm('Remove this friend?')) {
      return;
    }

    try {
      await socialService.removeFriend(friendshipId);
      setFriends((currentFriends) =>
        currentFriends.filter((friend) => (friend.friendshipId || friend.friendship_id) !== friendshipId)
      );
    } catch (err) {
      setError('Failed to remove friend');
    }
  };

  const handleAcceptRequest = async (friendshipId) => {
    try {
      await socialService.acceptFriendRequest(friendshipId);
      await loadFriends();
    } catch (err) {
      setError('Failed to accept request');
    }
  };

  const handleDeclineRequest = async (friendshipId) => {
    try {
      await socialService.declineFriendRequest(friendshipId);
      await loadFriends();
    } catch (err) {
      setError('Failed to decline request');
    }
  };

  const currentItems = activeTab === 'friends' ? friends : pendingRequests;
  const filtered = currentItems.filter((friend) => {
    const searchable = [
      friend.firstName,
      friend.first_name,
      friend.displayName,
      friend.email,
      friend.username
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="friends-modal-overlay" onClick={onClose}>
      <div className="friends-modal" onClick={(event) => event.stopPropagation()}>
        <div className="friends-header">
          <h2>Connections</h2>
          <button className="close-btn" onClick={onClose}>x</button>
        </div>

        <div className="friends-tabs">
          <button
            className={`tab ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            Friends ({friends.length})
          </button>
          <button
            className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending ({pendingRequests.length})
          </button>
        </div>

        <div className="friends-search">
          <input
            type="text"
            placeholder={activeTab === 'friends' ? 'Search friends...' : 'Search requests...'}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="search-input"
          />
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="friends-content">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              {activeTab === 'friends'
                ? 'No friends yet. Add someone from their profile to start building your circle.'
                : 'No pending friend requests'}
            </div>
          ) : (
            <div className="friends-items">
              {filtered.map((friend) => {
                const friendshipId = friend.friendshipId || friend.friendship_id;
                const displayName = friend.firstName || friend.first_name || friend.displayName || friend.email;
                const requestedAt = friend.requestedAt || friend.requested_at;
                const acceptedAt = friend.acceptedAt || friend.accepted_at;

                return (
                  <div key={friendshipId} className="friend-item">
                    <div className="friend-info">
                      <div className="friend-avatar">
                        {displayName?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="friend-details">
                        <p className="friend-email">{displayName}</p>
                        <p className="friend-since">
                          {activeTab === 'friends'
                            ? `Friends since ${acceptedAt ? new Date(acceptedAt).toLocaleDateString() : 'recently'}`
                            : `Requested ${requestedAt ? new Date(requestedAt).toLocaleDateString() : 'recently'}`}
                        </p>
                      </div>
                    </div>

                    <div className="friend-actions">
                      {activeTab === 'friends' ? (
                        <>
                          <button
                            className="action-btn message"
                            onClick={() => onSelectFriend && onSelectFriend(friend)}
                            title="View friend profile"
                          >
                            View
                          </button>
                          <button
                            className="action-btn remove"
                            onClick={() => handleRemoveFriend(friendshipId)}
                            title="Remove friend"
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="action-btn accept"
                            onClick={() => handleAcceptRequest(friendshipId)}
                            title="Accept request"
                          >
                            Accept
                          </button>
                          <button
                            className="action-btn decline"
                            onClick={() => handleDeclineRequest(friendshipId)}
                            title="Decline request"
                          >
                            Decline
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsList;
