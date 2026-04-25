import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { getAvatarLabel, getEntityId } from './utils';

const ChatroomPanel = ({
  chatroom,
  onLeaveChatroom,
  onClose,
  onRefreshChatroom,
}) => {
  const { apiCall, currentUser } = useApp();
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadPendingRequests = useCallback(async () => {
    if (!chatroom?._id) {
      return;
    }

    try {
      setLoadingRequests(true);
      const response = await apiCall(
        `/messaging/chatrooms/${chatroom._id}/pending-requests`,
        'GET'
      );

      if (response?.pendingRequests) {
        setPendingRequests(response.pendingRequests);
      }
    } catch (loadError) {
      console.error('Error loading pending requests:', loadError);
    } finally {
      setLoadingRequests(false);
    }
  }, [apiCall, chatroom?._id]);

  useEffect(() => {
    if (!chatroom) {
      setIsAdmin(false);
      setPendingRequests([]);
      setActiveTab('info');
      setError('');
      setSuccessMessage('');
      return;
    }

    setActiveTab('info');
    setError('');
    setSuccessMessage('');

    const admin = chatroom.admins?.some(
      (entry) => getEntityId(entry) === getEntityId(currentUser)
    );

    setIsAdmin(admin);

    if (admin) {
      loadPendingRequests();
      return;
    }

    setPendingRequests([]);
  }, [chatroom, currentUser, loadPendingRequests]);

  const handleApproveRequest = async (userId) => {
    try {
      setError('');
      await apiCall(
        `/messaging/chatrooms/${chatroom._id}/approve-request/${userId}`,
        'POST'
      );

      setSuccessMessage('Request approved!');
      setPendingRequests((prevRequests) =>
        prevRequests.filter((request) => request.userId._id !== userId)
      );
      await onRefreshChatroom?.(chatroom._id);

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (approveError) {
      setError(approveError?.message || 'Failed to approve request');
    }
  };

  const handleRejectRequest = async (userId) => {
    try {
      setError('');
      await apiCall(
        `/messaging/chatrooms/${chatroom._id}/reject-request/${userId}`,
        'POST',
        { reason: 'Request rejected by admin' }
      );

      setSuccessMessage('Request rejected');
      setPendingRequests((prevRequests) =>
        prevRequests.filter((request) => request.userId._id !== userId)
      );
      await onRefreshChatroom?.(chatroom._id);

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (rejectError) {
      setError(rejectError?.message || 'Failed to reject request');
    }
  };

  const handleBlockMember = async (userId) => {
    if (!window.confirm('Block this member? They will be removed and cannot rejoin.')) {
      return;
    }

    try {
      setError('');
      await apiCall(
        `/messaging/chatrooms/${chatroom._id}/block-member/${userId}`,
        'POST'
      );

      setSuccessMessage('Member blocked successfully');
      await onRefreshChatroom?.(chatroom._id);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (blockError) {
      setError(blockError?.message || 'Failed to block member');
    }
  };

  const handleLeaveCurrentChatroom = async () => {
    if (!window.confirm('Leave this chatroom? You will need to rejoin if it is public.')) {
      return;
    }

    try {
      setError('');
      await apiCall(`/messaging/chatrooms/${chatroom._id}/leave`, 'POST');
      onLeaveChatroom(chatroom._id);
    } catch (leaveError) {
      setError(leaveError?.message || 'Failed to leave chatroom');
    }
  };

  if (!chatroom) {
    return (
      <div className="chatroom-panel empty-state">
        <p>Select a chatroom to view details</p>
      </div>
    );
  }

  return (
    <div className="chatroom-panel">
      <div className="chatroom-panel-header">
        <div className="chatroom-header-info">
          <div className="chatroom-panel-avatar">
            {getAvatarLabel(chatroom.name, chatroom.name, '', chatroom.icon, 'C')}
          </div>
          <div>
            <h3>{chatroom.name}</h3>
            <p className="chatroom-meta">
              {chatroom.isPrivate ? 'Private' : 'Public'} | {chatroom.memberCount} members
            </p>
          </div>
        </div>
        <button
          className="btn-close"
          onClick={onClose}
          title="Close"
          type="button"
        >
          x
        </button>
      </div>

      <div className="chatroom-panel-tabs">
        <button
          className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
          type="button"
        >
          Info
        </button>
        {isAdmin && (
          <button
            className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
            type="button"
          >
            Admin
          </button>
        )}
        <button
          className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
          type="button"
        >
          Members ({chatroom.members?.length || 0})
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="chatroom-panel-content">
        {activeTab === 'info' && (
          <div className="tab-content">
            <div className="info-section">
              <h4>About</h4>
              <p>{chatroom.description || 'No description'}</p>
            </div>

            {chatroom.tags && chatroom.tags.length > 0 && (
              <div className="info-section">
                <h4>Tags</h4>
                <div className="tags-list">
                  {chatroom.tags.map((tag) => (
                    <span key={tag} className="tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="info-section">
              <h4>Creator</h4>
              <p>{chatroom.createdBy?.name || 'Unknown'}</p>
            </div>

            <div className="info-section">
              <h4>Created</h4>
              <p>{new Date(chatroom.createdAt).toLocaleDateString()}</p>
            </div>

            <div className="chatroom-panel-actions">
              <button
                className="btn btn-danger"
                onClick={handleLeaveCurrentChatroom}
                type="button"
              >
                Leave Chatroom
              </button>
            </div>
          </div>
        )}

        {activeTab === 'admin' && isAdmin && (
          <div className="tab-content admin-tab">
            <div className="admin-section">
              <h4>Pending Join Requests</h4>
              {loadingRequests ? (
                <p>Loading requests...</p>
              ) : pendingRequests.length > 0 ? (
                <div className="requests-list">
                  {pendingRequests.map((request) => (
                    <div key={request.userId._id} className="request-item">
                      <div className="request-user">
                        <div className="user-avatar">
                          {getAvatarLabel(
                            request.userId.name,
                            request.userId.name,
                            request.userId.username,
                            request.userId.avatar,
                            'U'
                          )}
                        </div>
                        <div className="user-info">
                          <strong>{request.userId.name}</strong>
                          <p>@{request.userId.username}</p>
                          <small>
                            Requested:{' '}
                            {new Date(request.requestedAt).toLocaleDateString()}
                          </small>
                        </div>
                      </div>
                      <div className="request-actions">
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleApproveRequest(request.userId._id)}
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRejectRequest(request.userId._id)}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state-text">No pending requests</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="tab-content members-tab">
            <div className="members-list">
              {chatroom.members?.map((member) => {
                const isCreator = getEntityId(member) === getEntityId(chatroom.createdBy);
                const memberAdmin = chatroom.admins?.some(
                  (entry) => getEntityId(entry) === getEntityId(member)
                );

                return (
                  <div key={getEntityId(member)} className="member-item">
                    <div className="member-info">
                      <div className="member-avatar">
                        {getAvatarLabel(
                          member.name,
                          member.name,
                          member.username,
                          member.avatar,
                          'U'
                        )}
                      </div>
                      <div className="member-details">
                        <strong>{member.name}</strong>
                        <p>@{member.username}</p>
                        {isCreator && (
                          <span className="badge badge-creator">Creator</span>
                        )}
                        {memberAdmin && (
                          <span className="badge badge-admin">Admin</span>
                        )}
                      </div>
                    </div>

                    {isAdmin &&
                      !isCreator &&
                      getEntityId(member) !== getEntityId(currentUser) && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleBlockMember(getEntityId(member))}
                          type="button"
                          title="Block this member"
                        >
                          Block
                        </button>
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatroomPanel;
