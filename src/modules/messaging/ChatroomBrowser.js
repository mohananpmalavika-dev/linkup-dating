import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { getAvatarLabel, getEntityId } from './utils';

const ChatroomBrowser = ({
  onJoinChatroom,
  onRequestAccess,
  onCancel,
}) => {
  const { apiCall } = useApp();
  const [chatrooms, setChatrooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [joiningRoom, setJoiningRoom] = useState(null);
  const [requestingRoom, setRequestingRoom] = useState(null);
  const [myRooms, setMyRooms] = useState(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    loadMyRooms();
  }, []);

  const loadMyRooms = async () => {
    try {
      const response = await apiCall('/messaging/chatrooms/my-rooms', 'GET');
      if (response?.chatrooms) {
        const roomIds = new Set(response.chatrooms.map((room) => getEntityId(room._id)));
        setMyRooms(roomIds);
      }
    } catch (loadError) {
      console.error('Error loading my rooms:', loadError);
    }
  };

  const loadChatrooms = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true);
      setError('');

      let url = `/messaging/chatrooms/public/list?page=${pageNum}&limit=12`;

      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }

      if (selectedTags.length > 0) {
        url += `&tags=${selectedTags.join(',')}`;
      }

      const response = await apiCall(url, 'GET');

      if (response?.chatrooms) {
        setChatrooms(response.chatrooms);
        setTotalPages(response.pagination?.pages || 1);
        setPage(pageNum);
      }
    } catch (loadError) {
      console.error('Error loading chatrooms:', loadError);
      setError('Failed to load chatrooms');
    } finally {
      setLoading(false);
    }
  }, [apiCall, searchQuery, selectedTags]);

  useEffect(() => {
    loadChatrooms(1);
  }, [loadChatrooms]);

  const handleJoinChatroom = async (chatroomId) => {
    try {
      setJoiningRoom(chatroomId);
      const response = await apiCall(`/messaging/chatrooms/${chatroomId}/join`, 'POST');

      if (response?.chatroom) {
        await loadMyRooms();

        if (typeof onJoinChatroom === 'function') {
          onJoinChatroom(response.chatroom);
        }

        setError('');
      }
    } catch (joinError) {
      setError(joinError?.message || 'Failed to join chatroom');
      console.error('Error joining chatroom:', joinError);
    } finally {
      setJoiningRoom(null);
    }
  };

  const handleRequestAccess = async (chatroomId) => {
    try {
      setRequestingRoom(chatroomId);
      await apiCall(`/messaging/chatrooms/${chatroomId}/request-join`, 'POST');

      if (typeof onRequestAccess === 'function') {
        onRequestAccess(chatroomId);
      }

      setError('');
      alert('Access request sent. Waiting for admin approval.');
    } catch (requestError) {
      setError(requestError?.message || 'Failed to request access');
      console.error('Error requesting access:', requestError);
    } finally {
      setRequestingRoom(null);
    }
  };

  const toggleTag = (tag) => {
    setSelectedTags((prevTags) =>
      prevTags.includes(tag)
        ? prevTags.filter((entry) => entry !== tag)
        : [...prevTags, tag]
    );
    setPage(1);
  };

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
    setPage(1);
  };

  return (
    <div className="chatroom-browser-container">
      <div className="chatroom-browser-header">
        <h3>Browse Chatrooms</h3>
        <button
          className="btn-close"
          onClick={onCancel}
          title="Close"
          type="button"
          aria-label="Close chatroom browser"
        >
          x
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="chatroom-search-section">
        <input
          type="text"
          placeholder="Search chatrooms..."
          value={searchQuery}
          onChange={handleSearch}
          className="search-input"
        />
      </div>

      <div className="chatroom-browser">
        {loading ? (
          <div className="loading-spinner">Loading chatrooms...</div>
        ) : chatrooms.length > 0 ? (
          <div className="chatroom-grid">
            {chatrooms.map((room) => {
              const isMember = myRooms.has(getEntityId(room._id));

              return (
                <div key={room._id} className="chatroom-card">
                  <div className="chatroom-card-header">
                    <div className="chatroom-avatar">
                      {getAvatarLabel(room.name, room.name, '', room.icon, 'C')}
                    </div>
                    <span className={`room-type-badge ${room.isPrivate ? 'private' : 'public'}`}>
                      {room.isPrivate ? 'Private' : 'Public'}
                    </span>
                  </div>

                  <div className="chatroom-card-body">
                    <h4 className="chatroom-name">{room.name}</h4>
                    {room.description && (
                      <p className="chatroom-description">{room.description}</p>
                    )}

                    <div className="chatroom-stats">
                      <span className="stat">{room.memberCount} members</span>
                      {room.maxMembers > 0 && (
                        <span className="stat">max: {room.maxMembers}</span>
                      )}
                    </div>

                    {room.tags && room.tags.length > 0 && (
                      <div className="chatroom-tags">
                        {room.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="tag" onClick={() => toggleTag(tag)}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="chatroom-creator">
                      Created by <strong>{room.createdBy?.name || 'Unknown'}</strong>
                    </div>
                  </div>

                  <div className="chatroom-card-footer">
                    {isMember ? (
                      <button className="btn btn-success" disabled>
                        Member
                      </button>
                    ) : room.isPrivate ? (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleRequestAccess(room._id)}
                        disabled={requestingRoom === room._id}
                      >
                        {requestingRoom === room._id ? 'Requesting...' : 'Request Access'}
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleJoinChatroom(room._id)}
                        disabled={joiningRoom === room._id}
                      >
                        {joiningRoom === room._id ? 'Joining...' : 'Join'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p>No chatrooms found. Try searching or creating one!</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => loadChatrooms(page - 1)}
            disabled={page === 1 || loading}
            className="btn-pagination"
          >
            Previous
          </button>

          <span className="page-info">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => loadChatrooms(page + 1)}
            disabled={page === totalPages || loading}
            className="btn-pagination"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatroomBrowser;
