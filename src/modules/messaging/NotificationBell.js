import React, { useState } from 'react';
import NotificationPanel from './NotificationPanel';

const NotificationBell = ({ notifications = [], onClear, onSelectNotification }) => {
  const [showPanel, setShowPanel] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <div className="notification-bell-container">
      <button
        className="notification-bell-btn"
        onClick={() => setShowPanel((current) => !current)}
        type="button"
        title="Notifications"
      >
        Alerts
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {showPanel && (
        <div className="notification-panel-dropdown">
          <NotificationPanel
            notifications={notifications}
            onClear={() => {
              onClear();
              setShowPanel(false);
            }}
            onSelectNotification={(notification) => {
              onSelectNotification(notification);
              setShowPanel(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
