import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/api';
import { getStoredAuthToken } from '../../utils/auth';

const ChatUsernameSettings = ({ user, onUpdate }) => {
  const [editMode, setEditMode] = useState(false);
  const [chatUsername, setChatUsername] = useState(user?.chatUsername || '');
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setChatUsername(user?.chatUsername || '');
  }, [user]);

  const validateChatUsername = (value) => {
    if (value && (value.length < 3 || value.length > 20)) {
      return 'Chat username must be between 3 and 20 characters';
    }
    if (value && !/^[a-zA-Z0-9_-]+$/.test(value)) {
      return 'Chat username can only contain letters, numbers, underscores, and dashes';
    }
    return '';
  };

  const checkAvailability = async (username) => {
    if (!username) {
      setAvailabilityStatus(null);
      setAvailabilityError('');
      return;
    }

    const validationError = validateChatUsername(username);
    if (validationError) {
      setAvailabilityStatus(null);
      setAvailabilityError(validationError);
      return;
    }

    try {
      setCheckingAvailability(true);
      setAvailabilityError('');
      const response = await axios.get(
        `${API_BASE_URL}/auth/check-chat-username?chatUsername=${encodeURIComponent(username)}`
      );

      if (response.data.available) {
        setAvailabilityStatus('available');
        setAvailabilityError('');
      } else {
        setAvailabilityStatus('taken');
        setAvailabilityError(response.data.message || 'Chat username is already taken');
      }
    } catch (err) {
      setAvailabilityStatus(null);
      setAvailabilityError('Error checking availability');
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleInputChange = (value) => {
    setChatUsername(value);
    if (value !== user?.chatUsername) {
      checkAvailability(value);
    } else {
      setAvailabilityStatus(null);
      setAvailabilityError('');
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const validationError = validateChatUsername(chatUsername);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (chatUsername !== user?.chatUsername && availabilityStatus !== 'available') {
      setError('Please choose an available chat username');
      return;
    }

    setSaving(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/set-chat-username`,
        { chatUsername: chatUsername || null },
        {
          headers: {
            Authorization: `Bearer ${getStoredAuthToken()}`,
          },
        }
      );

      if (response.data.success) {
        setSuccess(response.data.message);
        setEditMode(false);
        if (onUpdate) {
          onUpdate(response.data.user);
        }
      } else {
        setError(response.data.message || 'Failed to update chat username');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating chat username');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setChatUsername(user?.chatUsername || '');
    setEditMode(false);
    setAvailabilityStatus(null);
    setAvailabilityError('');
    setError('');
    setSuccess('');
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove your chat-specific username?')) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/set-chat-username`,
        { chatUsername: null },
        {
          headers: {
            Authorization: `Bearer ${getStoredAuthToken()}`,
          },
        }
      );

      if (response.data.success) {
        setSuccess(response.data.message);
        setChatUsername('');
        setEditMode(false);
        if (onUpdate) {
          onUpdate(response.data.user);
        }
      } else {
        setError(response.data.message || 'Failed to remove chat username');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error removing chat username');
    } finally {
      setSaving(false);
    }
  };

  if (!editMode) {
    return (
      <div className="chat-username-display">
        <div className="setting-item">
          <div className="setting-label">
            <span className="label-text">Chat-Specific Username</span>
            <span className="label-hint">(Optional, unique to chat module)</span>
          </div>
          <div className="setting-value">
            {chatUsername ? (
              <span className="username-value">@{chatUsername}</span>
            ) : (
              <span className="no-username">Not set</span>
            )}
          </div>
          <button
            className="btn-edit"
            onClick={() => setEditMode(true)}
          >
            {chatUsername ? 'Change' : 'Add'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-username-edit">
      <div className="edit-container">
        <h4>Chat-Specific Username</h4>
        <p className="hint">
          This username is unique to the chat module only. 
          Leave empty to use your global username instead.
        </p>

        <div className="input-group">
          <input
            type="text"
            placeholder="Enter chat username (3-20 characters)"
            value={chatUsername}
            onChange={(e) => handleInputChange(e.target.value)}
            maxLength="20"
          />
          {checkingAvailability && (
            <span className="checking">Checking...</span>
          )}
        </div>

        {availabilityStatus === 'available' && (
          <div className="status available">✓ Username is available</div>
        )}
        {availabilityStatus === 'taken' && (
          <div className="status taken">✗ Username is taken</div>
        )}
        {availabilityError && (
          <div className="error-text">{availabilityError}</div>
        )}

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="button-group">
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || !chatUsername}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {chatUsername && (
            <button
              className="btn-secondary"
              onClick={handleRemove}
              disabled={saving}
            >
              Remove
            </button>
          )}
          <button
            className="btn-outline"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatUsernameSettings;
