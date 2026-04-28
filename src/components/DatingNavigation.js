import React from 'react';
import '../styles/DatingNavigation.css';

const DiscoverIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" opacity={active ? 1 : 0.3} />
    <path d="M12 8v8M8 12h8" opacity={active ? 0.8 : 0.5} />
  </svg>
);

const BrowseIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" opacity={active ? 1 : 0.6} />
    <rect x="14" y="3" width="7" height="7" rx="1.5" opacity={active ? 1 : 0.6} />
    <rect x="3" y="14" width="7" height="7" rx="1.5" opacity={active ? 1 : 0.6} />
    <rect x="14" y="14" width="7" height="7" rx="1.5" opacity={active ? 1 : 0.6} />
  </svg>
);

const MatchesIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill={active ? 'currentColor' : 'none'} opacity={active ? 0.2 : 1} />
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeWidth="2" />
  </svg>
);

const MessagesIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill={active ? 'currentColor' : 'none'} opacity={active ? 0.15 : 1} />
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const SocialIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" opacity={active ? 1 : 0.6} />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" opacity={active ? 1 : 0.6} />
  </svg>
);

const SOSIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="currentColor" opacity="0.15" />
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" strokeWidth="2.5" />
    <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" />
  </svg>
);

const ProfileIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" fill={active ? 'currentColor' : 'none'} opacity={active ? 0.15 : 1} />
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MoreIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" fill="currentColor" opacity={active ? 1 : 0.7} />
    <circle cx="19" cy="12" r="1" fill="currentColor" opacity={active ? 1 : 0.7} />
    <circle cx="5" cy="12" r="1" fill="currentColor" opacity={active ? 1 : 0.7} />
  </svg>
);

const NAV_ITEMS = [
  { key: 'discover', label: 'Discover', Icon: DiscoverIcon },
  { key: 'browse', label: 'Browse', Icon: BrowseIcon },
  { key: 'matches', label: 'Matches', Icon: MatchesIcon, showBadge: 'matchCount' },
  { key: 'messages', label: 'Inbox', Icon: MessagesIcon, showBadge: 'unreadCount' },
  { key: 'social', label: 'Social', Icon: SocialIcon },
  { key: 'sosalert', label: 'SOS', Icon: SOSIcon, isSOS: true },
  { key: 'profile', label: 'Profile', Icon: ProfileIcon },
  { key: 'more', label: 'More', Icon: MoreIcon },
];

const DatingNavigation = ({ currentPage, onPageChange, unreadCount = 0, matchCount = 0 }) => {
  return (
    <nav className="dating-navigation" role="tablist" aria-label="Main navigation">
      {NAV_ITEMS.map(({ key, label, Icon, showBadge, isSOS }) => {
        const isActive = currentPage === key;
        const badgeValue = showBadge === 'matchCount' ? matchCount : showBadge === 'unreadCount' ? unreadCount : 0;
        const showBadgeIndicator = badgeValue > 0;

        return (
          <button
            key={key}
            className={`nav-btn ${isActive ? 'active' : ''} ${isSOS ? 'nav-btn-sos' : ''}`}
            onClick={() => onPageChange(key)}
            title={label}
            role="tab"
            aria-selected={isActive}
            aria-label={label}
          >
            <span className="nav-icon-wrapper">
              <Icon active={isActive} />
              {showBadgeIndicator && (
                <span className="nav-badge" aria-label={`${badgeValue} ${label.toLowerCase()}`}>
                  {badgeValue > 99 ? '99+' : badgeValue}
                </span>
              )}
            </span>
            <span className="nav-label">{label}</span>
            {isActive && <span className="nav-indicator" />}
          </button>
        );
      })}
    </nav>
  );
};

export default DatingNavigation;
