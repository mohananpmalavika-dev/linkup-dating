import React, { useState, useEffect } from 'react';
import { getAvatarLabel } from './utils';

const ContactsList = ({
  contacts,
  onSelectContact,
  onBlockContact,
  onUnblockContact,
  onToggleFavorite,
  searchQuery,
  onSearchChange,
  onFilterChange,
  onScheduleBlock,
  filterType = 'all',
}) => {
  const [filteredContacts, setFilteredContacts] = useState(contacts);
  const [localFavorites, setLocalFavorites] = useState({}); // Track local favorite state changes

  useEffect(() => {
    let filtered = contacts;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((contact) =>
        contact.contactUserId?.name?.toLowerCase().includes(query) ||
        contact.contactUserId?.username?.toLowerCase().includes(query) ||
        contact.contactUserId?.email?.toLowerCase().includes(query) ||
        contact.displayName?.toLowerCase().includes(query)
      );
    }

    if (filterType === 'favorites') {
      filtered = filtered.filter((contact) => contact.isFavorite && !contact.isBlocked);
    } else if (filterType === 'blocked') {
      filtered = filtered.filter((contact) => contact.isBlocked);
    } else {
      // For 'all', exclude blocked contacts by default
      filtered = filtered.filter((contact) => !contact.isBlocked);
    }

    setFilteredContacts(filtered);
  }, [contacts, searchQuery, filterType]);

  // Helper function to get display identifier for contact
  const getContactIdentifier = (contact) => {
    const username = contact.contactUserId?.username;
    const email = contact.contactUserId?.email;
    const name = contact.contactUserId?.name;

    // Return identifier in priority order
    return username || email || name || 'Unknown';
  };

  // Handle favorite toggle with immediate visual feedback
  const handleFavoriteClick = (contactId, currentFavorite) => {
    // Update local state immediately for UI feedback
    setLocalFavorites((prev) => ({
      ...prev,
      [contactId]: !currentFavorite,
    }));

    // Call the actual toggle function
    if (onToggleFavorite) {
      onToggleFavorite(contactId);
    }
  };

  return (
    <div className="contacts-list-container">
      <div className="contacts-header">
        <div className="contacts-header-copy">
          <h2>Contacts</h2>
          <p className="contacts-subtitle">People you can reach in LinkUp</p>
        </div>
        <div className="contacts-filters">
          <button
            className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => {
              if (onFilterChange) {
                onFilterChange('all');
              }
            }}
            type="button"
            title="Show all contacts"
            aria-pressed={filterType === 'all'}
          >
            All
          </button>
          <button
            className={`filter-btn ${filterType === 'favorites' ? 'active' : ''}`}
            onClick={() => {
              if (onFilterChange) {
                onFilterChange('favorites');
              }
            }}
            type="button"
            title="Show favorite contacts"
            aria-pressed={filterType === 'favorites'}
          >
            ⭐ Favorites
          </button>
          <button
            className={`filter-btn ${filterType === 'blocked' ? 'active' : ''}`}
            onClick={() => {
              if (onFilterChange) {
                onFilterChange('blocked');
              }
            }}
            type="button"
            title="Show blocked contacts"
            aria-pressed={filterType === 'blocked'}
          >
            🚫 Blocked
          </button>
        </div>
      </div>

      <div className="contacts-search">
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="search-input"
        />
      </div>

      <div className="contacts-list">
        {filteredContacts.length > 0 ? (
          filteredContacts.map((contact) => {
            const contactUserId = contact.contactUserId?._id;
            const isFavorite = localFavorites[contactUserId] !== undefined ? localFavorites[contactUserId] : contact.isFavorite;
            
            return (
              <div key={contact._id} className="contact-item">
                <div
                  className="contact-info"
                  onClick={() => onSelectContact(contact.contactUserId)}
                  role="button"
                  tabIndex="0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelectContact(contact.contactUserId);
                    }
                  }}
                >
                  <span className="contact-avatar">
                    {getAvatarLabel(
                      contact.displayName,
                      contact.contactUserId?.name,
                      contact.contactUserId?.username,
                      contact.contactUserId?.avatar,
                      'U'
                    )}
                  </span>
                  <div className="contact-details">
                    <h4 className="contact-name">
                      {contact.displayName || contact.contactUserId?.name || 'Unknown'}
                    </h4>
                    <p className="contact-identifier">
                      @{getContactIdentifier(contact)}
                    </p>
                    <p className="contact-category">{contact.category || 'Contact'}</p>
                  </div>
                </div>
                <div className="contact-actions">
                  <button
                    className="btn-action-sm favorite-btn"
                    onClick={() => handleFavoriteClick(contactUserId, isFavorite)}
                    title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    type="button"
                    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {isFavorite ? '⭐' : '☆'}
                  </button>
                  <button
                    className="btn-action-sm schedule-btn"
                    onClick={() => onScheduleBlock && onScheduleBlock(contact)}
                    title="Manage scheduled blocks"
                    type="button"
                    aria-label="Manage scheduled blocks"
                  >
                    ⏰
                  </button>
                  {contact.isBlocked ? (
                    <button
                      className="btn-action-sm unblock-btn"
                      onClick={() => onUnblockContact(contactUserId)}
                      title="Unblock this contact"
                      type="button"
                      aria-label="Unblock this contact"
                    >
                      Unblock
                    </button>
                  ) : (
                    <button
                      className="btn-action-sm block-btn"
                      onClick={() => onBlockContact(contactUserId)}
                      title="Block this contact"
                      type="button"
                      aria-label="Block this contact"
                    >
                      Block
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-contacts">
            <p>
              {searchQuery
                ? 'No contacts match your search.'
                : `No ${filterType} contacts yet.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactsList;
