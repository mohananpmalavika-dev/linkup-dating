import React, { useState, useEffect, useCallback } from 'react';
import { referralService } from '../services/referralService';
import '../styles/ReferralInviteModal.css';

const ReferralInviteModal = ({ isOpen, onClose, onSuccess }) => {
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [inviteMethod, setInviteMethod] = useState('link'); // 'link', 'sms', 'email'
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      getReferralCode();
    }
  }, [isOpen]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      // This would call a service to get the user's friends list
      // For now, we'll use mock data - replace with actual API call
      const result = await referralService.getFriends();
      if (result.success) {
        setFriends(result.data || []);
      } else {
        setError('Failed to load friends list');
      }
    } catch (err) {
      console.error('Error loading friends:', err);
      // For demo purposes, create mock friends
      setFriends([
        { id: 1, name: 'Alice Johnson', email: 'alice@example.com', phone: '+1234567890', avatar: '👩' },
        { id: 2, name: 'Bob Smith', email: 'bob@example.com', phone: '+1234567891', avatar: '👨' },
        { id: 3, name: 'Carol Davis', email: 'carol@example.com', phone: '+1234567892', avatar: '👩‍🦱' },
        { id: 4, name: 'David Miller', email: 'david@example.com', phone: '+1234567893', avatar: '👨‍🦲' },
        { id: 5, name: 'Eve Wilson', email: 'eve@example.com', phone: '+1234567894', avatar: '👩‍🦰' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getReferralCode = async () => {
    try {
      const result = await referralService.getReferralCode();
      if (result.success) {
        setReferralCode(result.code);
      }
    } catch (err) {
      console.error('Error getting referral code:', err);
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleFriendSelection = useCallback((friendId) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedFriends.length === filteredFriends.length) {
      setSelectedFriends([]);
    } else {
      setSelectedFriends(filteredFriends.map(f => f.id));
    }
  }, [selectedFriends, filteredFriends]);

  const handleSendInvites = async () => {
    if (selectedFriends.length === 0) {
      setError('Please select at least one friend');
      return;
    }

    setSending(true);
    setError('');
    setSuccessMessage('');

    try {
      const selectedFriendsList = friends.filter(f => selectedFriends.includes(f.id));

      const result = await referralService.sendInvites(
        selectedFriendsList,
        inviteMethod,
        referralCode
      );

      if (result.success) {
        setSuccessMessage(`✅ Invitations sent to ${selectedFriends.length} friend(s)!`);
        setSelectedFriends([]);
        setSearchQuery('');

        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
        }, 2000);
      } else {
        setError(result.message || 'Failed to send invites');
      }
    } catch (err) {
      setError(err.message || 'Error sending invites');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="referral-invite-overlay">
      <div className="invite-modal">
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-header">
          <h2>👥 Invite Friends</h2>
          <p>Send your referral code and earn rewards when they sign up!</p>
        </div>

        {error && <div className="error-alert">{error}</div>}
        {successMessage && <div className="success-alert">{successMessage}</div>}

        {/* Invite Method Selection */}
        <div className="invite-method-section">
          <label>How would you like to invite?</label>
          <div className="method-buttons">
            <button
              className={`method-btn ${inviteMethod === 'link' ? 'active' : ''}`}
              onClick={() => setInviteMethod('link')}
            >
              🔗 Link
            </button>
            <button
              className={`method-btn ${inviteMethod === 'sms' ? 'active' : ''}`}
              onClick={() => setInviteMethod('sms')}
            >
              💬 SMS
            </button>
            <button
              className={`method-btn ${inviteMethod === 'email' ? 'active' : ''}`}
              onClick={() => setInviteMethod('email')}
            >
              ✉️ Email
            </button>
          </div>
        </div>

        {/* Search Friends */}
        <div className="search-section">
          <input
            type="text"
            placeholder="Search friends by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <span className="friend-count">
            {filteredFriends.length} friends
          </span>
        </div>

        {/* Friends List */}
        <div className="friends-list-container">
          {loading ? (
            <div className="loading-state">
              <p>Loading friends...</p>
            </div>
          ) : filteredFriends.length > 0 ? (
            <>
              {/* Select All */}
              <div className="select-all-row">
                <input
                  type="checkbox"
                  id="select-all"
                  checked={selectedFriends.length === filteredFriends.length && filteredFriends.length > 0}
                  onChange={handleSelectAll}
                  className="friend-checkbox"
                />
                <label htmlFor="select-all" className="select-all-label">
                  Select All ({selectedFriends.length}/{filteredFriends.length})
                </label>
              </div>

              {/* Friends List */}
              <div className="friends-list">
                {filteredFriends.map(friend => (
                  <div
                    key={friend.id}
                    className={`friend-item ${selectedFriends.includes(friend.id) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      id={`friend-${friend.id}`}
                      checked={selectedFriends.includes(friend.id)}
                      onChange={() => toggleFriendSelection(friend.id)}
                      className="friend-checkbox"
                    />
                    <label htmlFor={`friend-${friend.id}`} className="friend-label">
                      <span className="friend-avatar">{friend.avatar}</span>
                      <div className="friend-info">
                        <div className="friend-name">{friend.name}</div>
                        <div className="friend-contact">
                          {inviteMethod === 'email' && friend.email}
                          {inviteMethod === 'sms' && friend.phone}
                          {inviteMethod === 'link' && friend.email}
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>😔 No friends found</p>
              <small>Try adjusting your search</small>
            </div>
          )}
        </div>

        {/* Referral Code Display */}
        <div className="referral-code-display">
          <p>Your referral code:</p>
          <div className="code-display">
            <code>{referralCode}</code>
            <button
              className="copy-code-btn"
              onClick={() => {
                navigator.clipboard.writeText(referralCode);
                // Show copy feedback
              }}
            >
              📋
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="modal-footer">
          <button
            className="btn-cancel"
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </button>
          <button
            className="btn-send"
            onClick={handleSendInvites}
            disabled={sending || selectedFriends.length === 0}
          >
            {sending ? '📤 Sending...' : `✈️ Send to ${selectedFriends.length} Friend${selectedFriends.length !== 1 ? 's' : ''}`}
          </button>
        </div>

        {/* Benefits Section */}
        <div className="benefits-section">
          <h4>🎁 Benefits</h4>
          <ul>
            <li>
              <span>You get:</span>
              <strong>+7 days premium, +5 superlikes</strong>
            </li>
            <li>
              <span>They get:</span>
              <strong>+7 days premium, +5 superlikes</strong>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ReferralInviteModal;
