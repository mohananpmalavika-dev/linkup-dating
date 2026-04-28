/**
 * useNotifications Hook
 * Manage notification preferences and smart notifications
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const useNotifications = (userId) => {
  const [preferences, setPreferences] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notificationQueue, setNotificationQueue] = useState([]);
  const notificationTimeoutRef = useRef(null);

  // Fetch notification preferences
  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications/preferences', {
        method: 'GET'
      });
      const data = await response.json();
      if (data.success) {
        setPreferences(data.preferences);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch notification statistics
  const fetchStats = useCallback(async (days = 30) => {
    try {
      const response = await fetch(`/api/notifications/stats?days=${days}`, {
        method: 'GET'
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  // Update notification preferences
  const updatePreferences = useCallback(async (updates) => {
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      const data = await response.json();
      if (data.success) {
        setPreferences(data.preferences);
        return true;
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
    return false;
  }, []);

  // Send smart notification
  const sendSmartNotification = useCallback(async (notificationData) => {
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationData)
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error sending notification:', error);
      return { sent: false, error: error.message };
    }
  }, []);

  // Record notification opened
  const recordNotificationOpened = useCallback(async (notificationId, action = null) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error recording notification open:', error);
      return false;
    }
  }, []);

  // Get optimal send time
  const getOptimalSendTime = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/optimal-time', {
        method: 'POST'
      });

      const data = await response.json();
      if (data.success) {
        return new Date(data.optimalTime);
      }
    } catch (error) {
      console.error('Error getting optimal time:', error);
    }
    return null;
  }, []);

  // Check if should send notification
  const shouldSendNotification = useCallback((notificationType) => {
    if (!preferences) return false;

    const typeKey = `notify_${notificationType}`;
    if (!preferences[typeKey]) {
      return false;
    }

    // Check quiet hours
    if (preferences.quiet_hours_enabled) {
      const now = new Date();
      const currentHour = now.getHours();
      const isInQuietHours =
        preferences.quiet_hours_start > preferences.quiet_hours_end
          ? currentHour >= preferences.quiet_hours_start || currentHour < preferences.quiet_hours_end
          : currentHour >= preferences.quiet_hours_start && currentHour < preferences.quiet_hours_end;

      if (isInQuietHours) {
        return false;
      }
    }

    return true;
  }, [preferences]);

  // Initialize preferences on mount
  useEffect(() => {
    if (userId) {
      fetchPreferences();
      fetchStats();
    }
  }, [userId, fetchPreferences, fetchStats]);

  return {
    preferences,
    stats,
    loading,
    notificationQueue,
    fetchPreferences,
    fetchStats,
    updatePreferences,
    sendSmartNotification,
    recordNotificationOpened,
    getOptimalSendTime,
    shouldSendNotification
  };
};

export default useNotifications;
