import React, { useState } from 'react';
import '../styles/DatingNavigation.css';

/**
 * DatingNavigation Component
 * Bottom navigation for dating app
 */
const DatingNavigation = ({ currentPage, onPageChange, unreadCount = 0, matchCount = 0 }) => {
  return (
    <nav className="dating-navigation">
      <button
        className={`nav-btn ${currentPage === 'discover' ? 'active' : ''}`}
        onClick={() => onPageChange('discover')}
        title="Discover"
      >
        <span className="nav-icon">🔥</span>
        <span className="nav-label">Discover</span>
      </button>

      <button
        className={`nav-btn ${currentPage === 'browse' ? 'active' : ''}`}
        onClick={() => onPageChange('browse')}
        title="Browse"
      >
        <span className="nav-icon">👀</span>
        <span className="nav-label">Browse</span>
      </button>

      <button
        className={`nav-btn ${currentPage === 'matches' ? 'active' : ''}`}
        onClick={() => onPageChange('matches')}
        title="Matches"
      >
        <span className="nav-icon">❤️</span>
        <span className="nav-label">Matches</span>
        {matchCount > 0 && <span className="badge">{matchCount}</span>}
      </button>

      <button
        className={`nav-btn ${currentPage === 'messages' ? 'active' : ''}`}
        onClick={() => onPageChange('messages')}
        title="Messages"
      >
        <span className="nav-icon">💬</span>
        <span className="nav-label">Messages</span>
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>

      <button
        className={`nav-btn ${currentPage === 'profile' ? 'active' : ''}`}
        onClick={() => onPageChange('profile')}
        title="Profile"
      >
        <span className="nav-icon">👤</span>
        <span className="nav-label">Profile</span>
      </button>
    </nav>
  );
};

export default DatingNavigation;
