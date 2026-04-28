/**
 * useActivityStatus Hook
 * Manages activity status and privacy preferences for a match
 * Real-time updates with privacy filtering
 */

import { useState, useEffect, useCallback } from 'react';
import realTimeService from '../services/realTimeService';
import { getStoredAuthToken } from '../utils/auth';
import { buildApiUrl } from '../utils/api';

const buildAuthenticatedFetchOptions = (options = {}) => {
  const token = getStoredAuthToken();

  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };
};

export const useActivityStatus = (userId, matchId, enableRealTime = true) => {
  const [status, setStatus] = useState(null);
  const [privacy, setPrivacy] = useState(null);
  const [formatted, setFormatted] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const socket = realTimeService.socket;

  const fetchStatus = useCallback(async () => {
    if (!userId || !matchId) return;

    try {
      setLoading(true);
      const response = await fetch(
        buildApiUrl(`/dating/activity-status/${matchId}/${userId}`),
        buildAuthenticatedFetchOptions()
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setStatus(data.status);
        setPrivacy(data.privacy);
        setFormatted(data.formatted);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching activity status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, matchId]);

  useEffect(() => {
    fetchStatus();

    if (enableRealTime && socket) {
      const handleStatusUpdate = (update) => {
        if (update.userId === userId && update.matchId === matchId) {
          setStatus(update.status);
          setPrivacy(update.privacy);
          setFormatted(update.formatted);
        }
      };

      socket.on('user_activity_update_with_privacy', handleStatusUpdate);
      socket.on('user_activity_ended_with_privacy', () => fetchStatus());
      socket.on('user_last_active_update_with_privacy', handleStatusUpdate);

      return () => {
        socket.off('user_activity_update_with_privacy', handleStatusUpdate);
        socket.off('user_activity_ended_with_privacy');
        socket.off('user_last_active_update_with_privacy', handleStatusUpdate);
      };
    }

    // Fallback polling if real-time not available
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [userId, matchId, fetchStatus, socket, enableRealTime]);

  return {
    status,
    privacy,
    formatted,
    loading,
    error,
    refetch: fetchStatus,
    isVideoDating: status?.isVideoDating || false,
    lastActiveFormatted: status?.lastActiveFormatted,
    isOnline: status?.isOnline,
    currentActivity: status?.currentActivity
  };
};

/**
 * useStatusPreference Hook
 * Manage status privacy preferences for a match
 */
export const useStatusPreference = (matchId) => {
  const [preference, setPreference] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetchPreference = useCallback(async () => {
    if (!matchId) return;

    try {
      setLoading(true);
      const response = await fetch(
        buildApiUrl(`/dating/status-preferences/${matchId}`),
        buildAuthenticatedFetchOptions()
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setPreference(data.preference);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching preference:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  const updatePreference = useCallback(
    async (updates) => {
      try {
        setSaving(true);
        const response = await fetch(buildApiUrl('/dating/status-preferences'), {
          method: 'POST',
          ...buildAuthenticatedFetchOptions({
            headers: { 'Content-Type': 'application/json' }
          }),
          body: JSON.stringify({
            matchId,
            ...updates
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
          setPreference(data.preference);
          setError(null);
          return data.preference;
        } else {
          throw new Error(data.error);
        }
      } catch (err) {
        console.error('Error updating preference:', err);
        setError(err.message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [matchId]
  );

  const setPrivacyLevel = useCallback(
    async (level) => {
      try {
        setSaving(true);
        const response = await fetch(
          buildApiUrl(`/dating/status-preferences/${matchId}/quick-set`),
          {
            method: 'POST',
            ...buildAuthenticatedFetchOptions({
              headers: { 'Content-Type': 'application/json' }
            }),
            body: JSON.stringify({ privacyLevel: level })
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
          setPreference(data.preference);
          setError(null);
          return data.preference;
        } else {
          throw new Error(data.error);
        }
      } catch (err) {
        console.error('Error setting privacy level:', err);
        setError(err.message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [matchId]
  );

  const deletePreference = useCallback(async () => {
    try {
      setSaving(true);
      const response = await fetch(buildApiUrl(`/dating/status-preferences/${matchId}`), {
        method: 'DELETE',
        ...buildAuthenticatedFetchOptions()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        // Revert to defaults
        setPreference({
          showOnlineStatus: true,
          showLastActive: true,
          showTypingIndicator: true,
          showActivityStatus: true,
          showReadReceipts: true,
          shareDetailedStatus: true,
          privacyLevel: 'full'
        });
        setError(null);
        return true;
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Error deleting preference:', err);
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchPreference();
  }, [fetchPreference]);

  return {
    preference,
    loading,
    saving,
    error,
    refetch: fetchPreference,
    updatePreference,
    setPrivacyLevel,
    deletePreference,
    privacyLevel: preference?.privacy_level || 'full'
  };
};

/**
 * useAllStatusPreferences Hook
 * Get all status preferences for the current user
 */
export const useAllStatusPreferences = () => {
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        buildApiUrl('/dating/status-preferences'),
        buildAuthenticatedFetchOptions()
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setPreferences(data.preferences);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return {
    preferences,
    loading,
    error,
    refetch: fetchPreferences,
    count: preferences.length,
    getPreferenceForMatch: (matchId) => preferences.find(p => p.match_id === matchId)
  };
};

export default useActivityStatus;
