import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';

const DEFAULT_MAX_MEMBERS = '-1';

const ChatroomCreation = ({
  onChatroomCreated,
  onCancel,
}) => {
  const { apiCall } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [tags, setTags] = useState('');
  const [maxMembers, setMaxMembers] = useState(DEFAULT_MAX_MEMBERS);
  const [allowFileSharing, setAllowFileSharing] = useState(true);
  const [allowMemberInvites, setAllowMemberInvites] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const resetFormFields = () => {
    setName('');
    setDescription('');
    setIsPrivate(false);
    setTags('');
    setMaxMembers(DEFAULT_MAX_MEMBERS);
    setAllowFileSharing(true);
    setAllowMemberInvites(false);
  };

  const handleCreateChatroom = async () => {
    if (!name.trim()) {
      setError('Chatroom name is required');
      return;
    }

    try {
      setError('');
      setSuccessMessage('');
      setIsCreating(true);

      const tagArray = tags
        ? tags
            .split(',')
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean)
        : [];
      const parsedMaxMembers = Number.parseInt(maxMembers, 10);

      const response = await apiCall('/messaging/chatrooms', 'POST', {
        name: name.trim(),
        description: description.trim(),
        isPrivate,
        tags: tagArray,
        maxMembers: Number.isNaN(parsedMaxMembers) ? -1 : parsedMaxMembers,
        settings: {
          allowFileSharing,
          allowMemberInvites,
        },
      });

      if (!response?.chatroom) {
        throw new Error('Failed to create chatroom');
      }

      setSuccessMessage(`Chatroom "${response.chatroom.name}" created successfully.`);
      resetFormFields();

      if (typeof onChatroomCreated === 'function') {
        onChatroomCreated(response.chatroom);
      }
    } catch (createError) {
      console.error('Error creating chatroom:', createError);
      setError(createError?.message || 'Failed to create chatroom');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="chatroom-creation-container">
      <div className="chatroom-creation-header">
        <h3>Create a New Chatroom</h3>
        <button
          className="btn-close"
          onClick={onCancel}
          title="Close"
          type="button"
          aria-label="Close chatroom creation"
        >
          x
        </button>
      </div>

      <div className="chatroom-creation-form">
        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        <div className="form-section">
          <h4>Basic Information</h4>

          <div className="form-group">
            <label htmlFor="chatroom-name">Chatroom Name *</label>
            <input
              id="chatroom-name"
              type="text"
              placeholder="Enter an engaging chatroom name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="form-input"
              disabled={isCreating}
              maxLength="100"
            />
            <small className="char-count">{name.length}/100</small>
          </div>

          <div className="form-group">
            <label htmlFor="chatroom-description">Description</label>
            <textarea
              id="chatroom-description"
              placeholder="Describe what this chatroom is about (optional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="form-textarea"
              disabled={isCreating}
              rows="3"
              maxLength="500"
            />
            <small className="char-count">{description.length}/500</small>
          </div>

          <div className="form-group">
            <label htmlFor="chatroom-tags">Tags (comma-separated)</label>
            <input
              id="chatroom-tags"
              type="text"
              placeholder="e.g., tech, gaming, music, business"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="form-input"
              disabled={isCreating}
            />
          </div>
        </div>

        <div className="form-section">
          <h4>Access Control</h4>

          <div className="form-group radio-group">
            <label className="radio-label" htmlFor="chatroom-public">
              <input
                id="chatroom-public"
                type="radio"
                name="chatroom-type"
                checked={!isPrivate}
                onChange={() => setIsPrivate(false)}
                disabled={isCreating}
              />
              <span className="radio-label-text">
                <strong>Public</strong> - Anyone can join directly.
              </span>
            </label>
          </div>

          <div className="form-group radio-group">
            <label className="radio-label" htmlFor="chatroom-private">
              <input
                id="chatroom-private"
                type="radio"
                name="chatroom-type"
                checked={isPrivate}
                onChange={() => setIsPrivate(true)}
                disabled={isCreating}
              />
              <span className="radio-label-text">
                <strong>Private</strong> - Users must request access first.
              </span>
            </label>
          </div>

          {isPrivate ? (
            <div className="info-box info">
              <p>
                Private chatrooms require an approval step before new members can join.
              </p>
            </div>
          ) : (
            <div className="info-box success">
              <p>
                Public chatrooms are visible in browsing and can be joined immediately.
              </p>
            </div>
          )}
        </div>

        <div className="form-section">
          <h4>Settings</h4>

          <div className="form-group">
            <label htmlFor="chatroom-max-members">
              Max Members (leave blank or use -1 for unlimited)
            </label>
            <input
              id="chatroom-max-members"
              type="number"
              placeholder="e.g., 50, 100"
              value={maxMembers}
              onChange={(event) => setMaxMembers(event.target.value)}
              className="form-input"
              disabled={isCreating}
              min="-1"
            />
          </div>

          <div className="form-group checkbox">
            <label htmlFor="chatroom-allow-files">
              <input
                id="chatroom-allow-files"
                type="checkbox"
                checked={allowFileSharing}
                onChange={(event) => setAllowFileSharing(event.target.checked)}
                disabled={isCreating}
              />
              <span>Allow members to share files</span>
            </label>
          </div>

          <div className="form-group checkbox">
            <label htmlFor="chatroom-allow-invites">
              <input
                id="chatroom-allow-invites"
                type="checkbox"
                checked={allowMemberInvites}
                onChange={(event) => setAllowMemberInvites(event.target.checked)}
                disabled={isCreating}
              />
              <span>Allow members to invite others</span>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            type="button"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreateChatroom}
            type="button"
            disabled={isCreating || !name.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Chatroom'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatroomCreation;
