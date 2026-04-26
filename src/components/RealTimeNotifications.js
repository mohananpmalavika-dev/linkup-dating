/**
 * RealTimeNotifications Component
 * Displays real-time notifications (matches, profile changes, etc.)
 */
import React, { useEffect, useState } from 'react';
import { useRealTimeNotifications } from '../hooks/useRealTime';
import './RealTimeNotifications.css';

const NotificationItem = ({ notification, onDismiss }) => {
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    // Auto-dismiss after 5 seconds
    const timeout = setTimeout(() => {
      setAnimate(false);
      setTimeout(() => {
        onDismiss(notification.id);
      }, 300);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [notification.id, onDismiss]);

  const getNotificationContent = () => {
    switch (notification.type) {
      case 'new_match':
        return {
          icon: '💕',
          title: 'New Match!',
          message: 'You have a new match',
          color: 'success'
        };
      case 'like_received':
        return {
          icon: '❤️',
          title: 'Like Received!',
          message: `${notification.fromUser?.name || 'Someone'} liked you`,
          color: 'like'
        };
      case 'match_request':
        return {
          icon: '🤝',
          title: 'Match Request',
          message: 'Someone wants to connect with you',
          color: 'info'
        };
      case 'profile_update':
        return {
          icon: '🔄',
          title: 'Profile Updated',
          message: `${
            notification.changeType === 'photo_added'
              ? 'New photo added'
              : 'Profile information updated'
          }`,
          color: 'update'
        };
      case 'profile_viewed':
        return {
          icon: '👁️',
          title: 'Profile Viewed',
          message: 'Someone viewed your profile',
          color: 'info'
        };
      case 'call_started':
        return {
          icon: notification.callType === 'video_calling' ? '📹' : '☎️',
          title: `${notification.callType === 'video_calling' ? 'Video' : 'Voice'} Call`,
          message: 'You have an incoming call',
          color: 'call'
        };
      default:
        return {
          icon: 'ℹ️',
          title: 'Notification',
          message: notification.message || 'New notification',
          color: 'default'
        };
    }
  };

  const content = getNotificationContent();

  return (
    <div
      className={`notification-item ${content.color} ${animate ? 'slide-in' : 'slide-out'}`}
    >
      <div className="notification-icon">{content.icon}</div>
      <div className="notification-content">
        <div className="notification-title">{content.title}</div>
        <div className="notification-message">{content.message}</div>
      </div>
      <button
        className="notification-close"
        onClick={() => {
          setAnimate(false);
          setTimeout(() => onDismiss(notification.id), 300);
        }}
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
};

const RealTimeNotifications = ({ position = 'top-right' }) => {
  const { notifications, dismissNotification } =
    useRealTimeNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className={`notifications-container ${position}`}>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={dismissNotification}
        />
      ))}
    </div>
  );
};

export default RealTimeNotifications;
