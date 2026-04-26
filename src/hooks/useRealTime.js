/**
 * Real-Time Hooks
 * Custom React hooks for real-time subscriptions and status updates
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import realTimeService from '../services/realTimeService';

/**
 * Hook for user online status
 */
export const useUserStatus = (userId) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);

    // Get initial status
    realTimeService.getUserStatus(userId).then(setStatus).catch(console.error);

    // Subscribe to status updates
    const unsubscribe = realTimeService.on('user_status_updated', (data) => {
      if (data.userId === userId) {
        setStatus(data);
      }
    });

    return () => {
      unsubscribe();
      setLoading(false);
    };
  }, [userId]);

  return { status, loading };
};

/**
 * Hook for multiple users' status
 */
export const useUsersStatus = (userIds = []) => {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userIds.length) return;

    setLoading(true);

    realTimeService
      .requestUserStatus(userIds)
      .then(setStatuses)
      .catch(console.error);

    // Subscribe to all status updates
    const unsubscribe = realTimeService.on('user_status_updated', (data) => {
      setStatuses((prev) =>
        prev.map((status) =>
          status.userId === data.userId ? data : status
        )
      );
    });

    return () => {
      unsubscribe();
      setLoading(false);
    };
  }, [JSON.stringify(userIds)]);

  return { statuses, loading };
};

/**
 * Hook for typing indicators in a match
 */
export const useTypingIndicators = (matchId) => {
  const [typingUsers, setTypingUsers] = useState([]);

  useEffect(() => {
    if (!matchId) return;

    // Subscribe to typing indicators
    const unsubscribe = realTimeService.on('user_typing_indicator', (data) => {
      if (data.matchId === matchId) {
        setTypingUsers(data.typingUsers || []);
      }
    });

    return unsubscribe;
  }, [matchId]);

  return { typingUsers };
};

/**
 * Hook for sending typing indicator
 */
export const useTypingIndicator = (matchId) => {
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const startTyping = useCallback(() => {
    if (!matchId) return;

    if (!isTypingRef.current) {
      realTimeService.sendTyping(matchId);
      isTypingRef.current = true;
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [matchId]);

  const stopTyping = useCallback(() => {
    if (!matchId) return;

    realTimeService.stopTyping(matchId);
    isTypingRef.current = false;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [matchId]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      stopTyping();
    };
  }, [stopTyping]);

  return { startTyping, stopTyping };
};

/**
 * Hook for user activity (viewing profile, calling, etc.)
 */
export const useUserActivity = (activityType, matchId, targetUserId) => {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);

  const startActivity = useCallback(async () => {
    try {
      setError(null);
      await realTimeService.reportActivity(activityType, {
        matchId,
        targetUserId
      });
      setIsActive(true);
    } catch (err) {
      setError(err.message);
      console.error('Failed to start activity:', err);
    }
  }, [activityType, matchId, targetUserId]);

  const endActivity = useCallback(async () => {
    try {
      setError(null);
      await realTimeService.endActivity(activityType);
      setIsActive(false);
    } catch (err) {
      setError(err.message);
      console.error('Failed to end activity:', err);
    }
  }, [activityType]);

  return {
    isActive,
    startActivity,
    endActivity,
    error
  };
};

/**
 * Hook for match activity (who's typing, active, etc.)
 */
export const useMatchActivity = (matchId) => {
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshActivity = useCallback(async () => {
    if (!matchId) return;

    try {
      setLoading(true);
      const matchActivity = await realTimeService.getMatchActivity(matchId);
      setActivity(matchActivity);
    } catch (error) {
      console.error('Failed to get match activity:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    refreshActivity();
  }, [refreshActivity]);

  return { activity, loading, refresh: refreshActivity };
};

/**
 * Hook for real-time notifications
 */
export const useRealTimeNotifications = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const handlers = {
      match_notification: (data) => {
        setNotifications((prev) => [
          ...prev,
          {
            id: `${Date.now()}_${Math.random()}`,
            ...data
          }
        ]);
      },
      profile_update_notification: (data) => {
        setNotifications((prev) => [
          ...prev,
          {
            id: `${Date.now()}_${Math.random()}`,
            type: 'profile_update',
            ...data
          }
        ]);
      },
      profile_viewed: (data) => {
        setNotifications((prev) => [
          ...prev,
          {
            id: `${Date.now()}_${Math.random()}`,
            type: 'profile_viewed',
            ...data
          }
        ]);
      },
      call_started: (data) => {
        setNotifications((prev) => [
          ...prev,
          {
            id: `${Date.now()}_${Math.random()}`,
            type: 'call_started',
            ...data
          }
        ]);
      }
    };

    const unsubscribes = Object.entries(handlers).map(([event, handler]) =>
      realTimeService.on(event, handler)
    );

    return () => unsubscribes.forEach((unsub) => unsub());
  }, []);

  const dismissNotification = useCallback((notificationId) => {
    setNotifications((prev) =>
      prev.filter((n) => n.id !== notificationId)
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    dismissNotification,
    clearNotifications
  };
};

/**
 * Hook for profile view tracking
 */
export const useProfileViewTracker = (targetUserId) => {
  const [isViewing, setIsViewing] = useState(false);
  const { startActivity, endActivity } = useUserActivity(
    'viewing_profile',
    null,
    targetUserId
  );

  const startViewingProfile = useCallback(async () => {
    await startActivity();
    setIsViewing(true);
  }, [startActivity]);

  const stopViewingProfile = useCallback(async () => {
    await endActivity();
    setIsViewing(false);
  }, [endActivity]);

  useEffect(() => {
    return () => {
      if (isViewing) {
        endActivity();
      }
    };
  }, [isViewing, endActivity]);

  return {
    isViewing,
    startViewingProfile,
    stopViewingProfile
  };
};

/**
 * Hook for connection health monitoring
 */
export const useConnectionHealth = () => {
  const [health, setHealth] = useState({
    connected: false,
    latency: null,
    lastCheck: null
  });

  useEffect(() => {
    // Check immediately
    const checkHealth = async () => {
      try {
        const result = await realTimeService.ping();
        setHealth({
          connected: result.connected,
          latency: result.latency,
          lastCheck: new Date()
        });
      } catch (error) {
        setHealth({
          connected: false,
          latency: null,
          lastCheck: new Date()
        });
      }
    };

    checkHealth();

    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    // Also subscribe to connection events
    const connectUnsub = realTimeService.on('connected', () => {
      setHealth((prev) => ({ ...prev, connected: true }));
    });

    const disconnectUnsub = realTimeService.on('disconnected', () => {
      setHealth((prev) => ({ ...prev, connected: false }));
    });

    return () => {
      clearInterval(interval);
      connectUnsub();
      disconnectUnsub();
    };
  }, []);

  return health;
};

/**
 * Hook for real-time connection management
 */
export const useRealTimeConnection = (userId) => {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    const connectToRealTime = async () => {
      try {
        setConnecting(true);
        await realTimeService.connect(userId, {
          device: 'web'
        });
        setConnected(true);
      } catch (err) {
        setError(err.message);
        setConnected(false);
      } finally {
        setConnecting(false);
      }
    };

    connectToRealTime();

    const handleConnected = () => setConnected(true);
    const handleDisconnected = () => setConnected(false);

    realTimeService.on('connected', handleConnected);
    realTimeService.on('disconnected', handleDisconnected);

    return () => {
      realTimeService.off('connected', handleConnected);
      realTimeService.off('disconnected', handleDisconnected);
      // Don't disconnect on unmount - user may navigate but want to stay connected
    };
  }, [userId]);

  const disconnect = useCallback(() => {
    realTimeService.disconnect();
    setConnected(false);
  }, []);

  return {
    connected,
    connecting,
    error,
    disconnect
  };
};

export default {
  useUserStatus,
  useUsersStatus,
  useTypingIndicators,
  useTypingIndicator,
  useUserActivity,
  useMatchActivity,
  useRealTimeNotifications,
  useProfileViewTracker,
  useConnectionHealth,
  useRealTimeConnection
};
