import React, { useEffect, useState } from 'react';
import socialService from '../services/socialService';
import '../styles/FriendsList.css';

const FriendsList = ({ onSelectFriend, onClose }) => {
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('friends'); // friends | pending
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFriends();
  }, [activeTab]);

  const loadFriends = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'friends') {
        const data = await socialService.getFriends('accepted', 100);
        setFriends(data.friends || []);
      } else {
        const data = await socialService.getFriends('pending', 100);
        setPendingRequests(data.friends || []);
      }
    } catch (err) {
      setError('Failed to load friends');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFriend = async (friendshipId) => {
    if (!window.confirm('Remove this friend?')) return;

    try {
      await socialService.removeFriend(friendshipId);
      setFriends(friends.filter(f => f.friendship_id !== friendshipId));
    } catch (err) {
      setError('Failed to remove friend');
    }
  };

  const handleAcceptRequest = async (friendshipId) => {
    try {
      await socialService.acceptFriendRequest(friendshipId);
      loadFriends();
    } catch (err) {
      setError('Failed to accept request');
    }
  };

  const handleDeclineRequest = async (friendshipId) => {
    try {
      await socialService.declineFriendRequest(friendshipId);
      loadFriends();
    } catch (err) {
      setError('Failed to decline request');
    }
  };

  const filtered = (activeTab === 'friends' ? friends : pendingRequests).filter(f =>
    (f.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="friends-modal-overlay" onClick={onClose}>
      <div className="friends-modal" onClick={(e) => e.stopPropagation()}>
        <div className="friends-header">
          <h2>Friends</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
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

        {/* Search */}
        <div className="friends-search">
          <input
            type="text"
            placeholder="Search friends..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        {error && <div className="error-banner">{error}</div>}

        {/* Friends List */}
        <div className="friends-content">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              {activeTab === 'friends' 
                ? "No friends yet. Start by adding friends!" 
                : "No pending friend requests"}
            </div>
          ) : (
            <div className="friends-items">
              {filtered.map((friend) => (
                <div key={friend.friend_id} className="friend-item">
                  <div className="friend-info">
                    <div className="friend-avatar">
                      {friend.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="friend-details">
                      <p className="friend-email">{friend.email}</p>
                      <p className="friend-since">
                        Friends since {new Date(friend.accepted_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="friend-actions">
                    {activeTab === 'friends' ? (
                      <>
                        <button
                          className="action-btn message"
                          onClick={() => onSelectFriend && onSelectFriend(friend)}
                          title="Message friend"
                        >
                          💬
                        </button>
                        <button
                          className="action-btn remove"
                          onClick={() => handleRemoveFriend(friend.friendship_id)}
                          title="Remove friend"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="action-btn accept"
                          onClick={() => handleAcceptRequest(friend.friendship_id)}
                          title="Accept request"
                        >
                          ✓
                        </button>
                        <button
                          className="action-btn decline"
                          onClick={() => handleDeclineRequest(friend.friendship_id)}
                          title="Decline request"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsList;
