import React, { useCallback, useEffect, useState } from 'react';
import '../styles/Chatrooms.css';
import chatroomService from '../services/chatroomService';

/**
 * ChatRooms Component
 * Display and manage group chatrooms
 */
const ChatRooms = ({ onSelectChatroom, onBack }) => {
  const [chatrooms, setChatrooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChatroomName, setNewChatroomName] = useState('');
  const [newChatroomDesc, setNewChatroomDesc] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadChatrooms = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await chatroomService.getChatrooms(page, 20);
      if (page === 1) {
        setChatrooms(data.chatrooms);
      } else {
        setChatrooms(prev => [...prev, ...data.chatrooms]);
      }
      setHasMore(data.chatrooms.length === 20);
    } catch (loadError) {
      setError('Failed to load chatrooms');
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadChatrooms();
  }, [loadChatrooms]);

  const handleCreateChatroom = async () => {
    // Trim whitespace
    const trimmedName = newChatroomName.trim();
    const trimmedDesc = newChatroomDesc.trim();

    if (!trimmedName) {
      setError('Chatroom name is required');
      return;
    }

    if (trimmedName.length < 1) {
      setError('Chatroom name cannot be empty');
      return;
    }

    if (trimmedName.length > 255) {
      setError('Chatroom name must be less than 255 characters');
      return;
    }

    try {
      console.log('handleCreateChatroom - Creating chatroom:', {
        name: trimmedName,
        description: trimmedDesc
      });

      setError('');
      setLoading(true);
      const newRoom = await chatroomService.createChatroom(
        trimmedName,
        trimmedDesc,
        true,
        100
      );

      console.log('handleCreateChatroom - Success:', newRoom);
      setChatrooms((currentChatrooms) => [newRoom, ...currentChatrooms]);
      setNewChatroomName('');
      setNewChatroomDesc('');
      setShowCreateModal(false);
      setError('');
    } catch (createError) {
      console.error('handleCreateChatroom - Error:', createError);
      const errorMsg = typeof createError === 'string' 
        ? createError 
        : createError?.message || 'Failed to create chatroom';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinChatroom = async (chatroom) => {
    try {
      await chatroomService.joinChatroom(chatroom.id);
      onSelectChatroom(chatroom);
    } catch (joinError) {
      setError('Failed to join chatroom');
      console.error(joinError);
    }
  };

  return (
    <div className="chatrooms-container">
      {/* Header */}
      <div className="chatrooms-header">
        <button className="btn-back" onClick={onBack} title="Back">
          ← Back
        </button>
        <h2>Chat Rooms</h2>
        <button 
          className="btn-create-room"
          onClick={() => setShowCreateModal(true)}
          title="Create Room"
        >
          ➕ New Room
        </button>
      </div>

      {/* Create Chatroom Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Create New Chatroom</h3>
            <input
              type="text"
              placeholder="Room Name *"
              value={newChatroomName}
              onChange={(e) => setNewChatroomName(e.target.value)}
              className="modal-input"
              maxLength={255}
            />
            <textarea
              placeholder="Description (optional)"
              value={newChatroomDesc}
              onChange={(e) => setNewChatroomDesc(e.target.value)}
              className="modal-textarea"
              maxLength={500}
              rows={3}
            />
            <div className="modal-actions">
              <button 
                className="btn-cancel" 
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-submit" 
                onClick={handleCreateChatroom}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Loading */}
      {loading && page === 1 ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading chatrooms...</p>
        </div>
      ) : null}

      {/* Chatrooms List */}
      {chatrooms.length > 0 ? (
        <div className="chatrooms-list">
          {chatrooms.map((chatroom) => (
            <div key={chatroom.id} className="chatroom-card">
              <div className="chatroom-info">
                <div className="chatroom-header-info">
                  <h3>{chatroom.name}</h3>
                  <span className="member-badge">{chatroom.member_count}/{chatroom.max_members}</span>
                </div>
                {chatroom.description && (
                  <p className="chatroom-description">{chatroom.description}</p>
                )}
                <div className="chatroom-meta">
                  <span className="created-by">by {chatroom.first_name || chatroom.username}</span>
                  <span className="created-at">
                    {new Date(chatroom.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button
                className={`btn-join ${chatroom.isMember ? 'joined' : ''}`}
                onClick={() => handleJoinChatroom(chatroom)}
                disabled={chatroom.member_count >= chatroom.max_members && !chatroom.isMember}
              >
                {chatroom.isMember ? '✓ Joined' : chatroom.member_count >= chatroom.max_members ? 'Full' : 'Join'}
              </button>
            </div>
          ))}
        </div>
      ) : !loading ? (
        <div className="no-chatrooms">
          <p>📭 No chatrooms yet</p>
          <p>Create one to get started!</p>
        </div>
      ) : null}

      {/* Load More */}
      {hasMore && !loading && chatrooms.length > 0 && (
        <div className="load-more">
          <button onClick={() => setPage(p => p + 1)}>Load More</button>
        </div>
      )}
    </div>
  );
};

export default ChatRooms;
