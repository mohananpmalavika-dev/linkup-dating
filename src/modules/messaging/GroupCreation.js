import React, { useState, useCallback, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { getAvatarLabel, isSameEntity, getEntityId } from './utils';

const GroupCreation = ({
  onGroupCreated,
  onCancel,
}) => {
  const { apiCall, currentUser } = useApp();
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [userBlockedList, setUserBlockedList] = useState(new Set());

  // Load blocked contacts
  useEffect(() => {
    loadBlockedContacts();
  }, []);

  const loadBlockedContacts = async () => {
    try {
      const response = await apiCall('/messaging/contacts?showBlocked=true', 'GET');
      if (response?.contacts) {
        const blockedIds = new Set(
          response.contacts.map((c) => getEntityId(c.contactUserId))
        );
        setUserBlockedList(blockedIds);
      }
    } catch (error) {
      console.error('Error loading blocked contacts:', error);
    }
  };

  const searchUsers = useCallback(
    async (query) => {
      if (!query.trim()) {
        setAvailableUsers([]);
        return;
      }
      try {
        setSearchingUsers(true);
        const response = await apiCall(
          `/socialmedia/search/users?q=${encodeURIComponent(query)}`,
          'GET'
        );
        if (response?.users) {
          const selectedIds = new Set(selectedMembers.map((m) => getEntityId(m)));
          const filtered = response.users.filter(
            (u) =>
              !isSameEntity(u, currentUser) &&
              !selectedIds.has(getEntityId(u)) &&
              !userBlockedList.has(getEntityId(u)) // Filter out blocked users
          );
          setAvailableUsers(filtered);
        }
      } catch (error) {
        console.error('Error searching users:', error);
        setAvailableUsers([]);
      } finally {
        setSearchingUsers(false);
      }
    },
    [apiCall, currentUser, selectedMembers, userBlockedList]
  );

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchUsers(query);
  };

  const handleAddMember = (user) => {
    setSelectedMembers((prev) => [...prev, user]);
    setAvailableUsers((prev) => prev.filter((u) => getEntityId(u) !== getEntityId(user)));
    setSearchQuery('');
  };

  const handleRemoveMember = (userId) => {
    setSelectedMembers((prev) => prev.filter((u) => getEntityId(u) !== userId));
    setSearchQuery('');
    setAvailableUsers([]);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    if (selectedMembers.length === 0) {
      setError('Please add at least one member to the group');
      return;
    }

    // Check for blocked users among selected members
    for (const member of selectedMembers) {
      if (userBlockedList.has(getEntityId(member))) {
        setError(`Cannot add ${member.name}: You have blocked this user`);
        return;
      }
    }

    try {
      setError('');
      setIsCreating(true);

      const response = await apiCall('/messaging/chats/group', 'POST', {
        groupName: groupName.trim(),
        groupDescription: groupDescription.trim(),
        participantIds: selectedMembers.map((m) => getEntityId(m)),
      });

      if (response?.chat) {
        setGroupName('');
        setGroupDescription('');
        setSelectedMembers([]);
        setSearchQuery('');
        setAvailableUsers([]);
        onGroupCreated(response.chat);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      setError(error?.message || 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="group-creation-container">
      <div className="group-creation-header">
        <h3>Create a New Group</h3>
        <button
          className="btn-close"
          onClick={onCancel}
          title="Close"
          type="button"
          aria-label="Close group creation"
        >
          ✕
        </button>
      </div>

      <div className="group-creation-form">
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label htmlFor="groupName">Group Name *</label>
          <input
            id="groupName"
            type="text"
            placeholder="Enter group name (e.g., Travel Squad, Study Group)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="form-input"
            disabled={isCreating}
            maxLength="100"
          />
          <span className="char-count">{groupName.length}/100</span>
        </div>

        <div className="form-group">
          <label htmlFor="groupDescription">Description</label>
          <textarea
            id="groupDescription"
            placeholder="Optional: What's this group about?"
            value={groupDescription}
            onChange={(e) => setGroupDescription(e.target.value)}
            className="form-textarea"
            disabled={isCreating}
            maxLength="250"
            rows="3"
          />
          <span className="char-count">{groupDescription.length}/250</span>
        </div>

        <div className="form-group">
          <label htmlFor="memberSearch">Add Members *</label>
          <input
            id="memberSearch"
            type="text"
            placeholder="Search for people to add..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="form-input"
            disabled={isCreating}
          />
        </div>

        {searchQuery.trim() && (
          <div className="search-results">
            {searchingUsers ? (
              <p className="loading">Searching...</p>
            ) : availableUsers.length > 0 ? (
              <div className="search-results-list">
                {availableUsers.map((user) => (
                  <div key={getEntityId(user)} className="user-search-result">
                    <span className="user-avatar">
                      {getAvatarLabel(user.name, user.username, user.avatar, 'U')}
                    </span>
                    <div className="user-info">
                      <h4>{user.name}</h4>
                      <p>{user.email}</p>
                    </div>
                    <button
                      className="btn-add-member"
                      onClick={() => handleAddMember(user)}
                      type="button"
                      title="Add to group"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-results">No users found</p>
            )}
          </div>
        )}

        <div className="selected-members">
          <label>Selected Members ({selectedMembers.length})</label>
          {selectedMembers.length === 0 ? (
            <p className="no-members">No members selected yet</p>
          ) : (
            <div className="members-list">
              {selectedMembers.map((member) => (
                <div key={getEntityId(member)} className="member-badge">
                  <span className="member-info">
                    <span className="member-avatar">
                      {getAvatarLabel(member.name, member.username, member.avatar, 'U')}
                    </span>
                    <span className="member-name">{member.name}</span>
                  </span>
                  <button
                    className="btn-remove-member"
                    onClick={() => handleRemoveMember(getEntityId(member))}
                    type="button"
                    title="Remove member"
                    disabled={isCreating}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button
            className="btn-cancel"
            onClick={onCancel}
            type="button"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            className="btn-create-group"
            onClick={handleCreateGroup}
            type="button"
            disabled={isCreating || !groupName.trim() || selectedMembers.length === 0}
          >
            {isCreating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupCreation;
