/**
 * Frontend Real-Time Service
 * Manages socket.io connection and real-time events
 */
import io from 'socket.io-client';

// Use BACKEND_URL for socket.io (base URL without /api path)
// Fall back to REACT_APP_API_URL if BACKEND_URL not available, stripping /api
const getSocketURL = () => {
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }
  
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  // Remove /api suffix if present
  return apiUrl.replace(/\/api\/?$/, '') || 'http://localhost:5000';
};

const SOCKET_URL = getSocketURL();
const CONNECT_TIMEOUT_MS = 15000;
const SOCKET_EVENT_ALIASES = {
  incoming_call_request: ['incoming_call_request', 'call:incoming'],
  'call:incoming': ['call:incoming', 'incoming_call_request'],
  'call:rejected': ['call:rejected', 'call:declined'],
  'call:declined': ['call:declined', 'call:rejected']
};

const getEventAliases = (eventName) => Array.from(
  new Set([eventName, ...(SOCKET_EVENT_ALIASES[eventName] || [])])
);

class RealTimeService {
  constructor() {
    this.socket = null;
    this.userId = null;
    this.listeners = new Map(); // { eventName: [callbacks] }
    this.socketListeners = new Set(); // Track which socket event names are registered
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.connectPromise = null;
  }

  /**
   * Connect to real-time server
   */
  connect(userId, deviceInfo = {}) {
    if (this.socket?.connected) {
      return Promise.resolve(this.socket);
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise((resolve, reject) => {
      let settled = false;
      let connectTimeout = null;

      const settle = (callback) => (value) => {
        if (settled) {
          return;
        }

        settled = true;
        this.connectPromise = null;

        if (connectTimeout) {
          clearTimeout(connectTimeout);
        }

        callback(value);
      };

      const resolveOnce = settle(resolve);
      const rejectOnce = settle(reject);

      try {
        this.userId = userId;

        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.close();
        }

        this.socketListeners = new Set();

        console.log(`[RealTimeService] Connecting to socket.io at: ${SOCKET_URL}`);

        this.socket = io(SOCKET_URL, {
          reconnection: true,
          reconnectionDelay: this.reconnectDelay,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: this.maxReconnectAttempts,
          transports: ['polling', 'websocket'],
          timeout: CONNECT_TIMEOUT_MS,
          query: {
            userId,
            device: deviceInfo.device || 'web'
          }
        });

        connectTimeout = setTimeout(() => {
          const timeoutError = new Error('Real-time connection timed out');
          console.error('[RealTimeService] Connection timeout');
          this._emit('connection_error', { error: timeoutError.message });
          rejectOnce(timeoutError);
        }, CONNECT_TIMEOUT_MS);

        this.socket.on('connect', () => {
          console.log('[RealTimeService] Connected to real-time server');
          this.reconnectAttempts = 0;

          this._registerAllSocketListeners();
          this.socket.emit('user_online', userId, deviceInfo);
          this._emit('connected', { userId });
          resolveOnce(this.socket);
        });

        this.socket.on('disconnect', (reason) => {
          console.warn('[RealTimeService] Disconnected from real-time server:', reason);
          this._emit('disconnected', { reason });
        });

        this.socket.on('reconnect_attempt', () => {
          this.reconnectAttempts++;
          console.log(
            `[RealTimeService] Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
          );
        });

        this.socket.on('connect_error', (error) => {
          console.error('[RealTimeService] Connection error:', error);
          this._emit('connection_error', { error: error.message });
        });

        this.socket.on('error', (error) => {
          console.error('[RealTimeService] Socket error:', error);
          this._emit('error', { error });
        });
      } catch (error) {
        console.error('[RealTimeService] Error during connection setup:', error);
        rejectOnce(error);
      }
    });

    return this.connectPromise;
  }

  /**
   * Disconnect from real-time server
   */
  disconnect() {
    this.connectPromise = null;
    this.socketListeners = new Set();

    if (this.socket?.connected) {
      this.socket.emit('user_offline', this.userId);
      this.socket.disconnect();
      this._emit('disconnecting', {});
    }
  }

  /**
   * Subscribe to event
   */
  on(eventName, callback) {
    // Add to listeners map
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);

    // Register socket listener if socket is connected
    if (this.socket?.connected) {
      this._registerSocketListener(eventName);
    }

    // Return unsubscribe function
    return () => this.off(eventName, callback);
  }

  /**
   * Unsubscribe from event
   */
  off(eventName, callback) {
    if (this.listeners.has(eventName)) {
      const callbacks = this.listeners.get(eventName);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Register a socket listener for a specific event
   */
  _registerSocketListener(eventName) {
    if (!this.socket) {
      return;
    }

    const eventAliases = getEventAliases(eventName);

    eventAliases.forEach((socketEventName) => {
      if (this.socketListeners.has(socketEventName)) {
        return;
      }

      this.socketListeners.add(socketEventName);
      console.log(`Registering socket listener for event: ${socketEventName}`);

      this.socket.on(socketEventName, (data) => {
        console.log(`Received event: ${socketEventName}`, data);
        eventAliases.forEach((aliasEventName) => {
          this._emit(aliasEventName, data);
        });
      });
    });
  }

  /**
   * Register all socket listeners for events that have active subscribers
   */
  _registerAllSocketListeners() {
    if (!this.socket?.connected) {
      return;
    }

    // Register listeners for all events that have callbacks
    for (const eventName of this.listeners.keys()) {
      if (!this.socketListeners.has(eventName)) {
        this._registerSocketListener(eventName);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  _emit(eventName, data) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in listener for ${eventName}:`, error);
        }
      });
    }
  }

  /**
   * Send message to server
   */
  emit(eventName, data, callback) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected');
      callback?.({ success: false, error: 'Socket not connected' });
      return;
    }

    this.socket.emit(eventName, data, callback);
  }

  /**
   * Request user status
   */
  requestUserStatus(userIds) {
    return new Promise((resolve, reject) => {
      this.emit('request_user_status', userIds, (result) => {
        if (result.success) {
          resolve(result.statuses);
        } else {
          reject(new Error(result.error));
        }
      });
    });
  }

  /**
   * Get user status
   */
  async getUserStatus(userId) {
    const statuses = await this.requestUserStatus([userId]);
    return statuses[0];
  }

  /**
   * Signal typing
   */
  sendTyping(matchId) {
    this.emit('user_typing', {
      userId: this.userId,
      matchId
    });
  }

  /**
   * Signal stopped typing
   */
  stopTyping(matchId) {
    this.emit('user_stopped_typing', {
      userId: this.userId,
      matchId
    });
  }

  /**
   * Report user activity
   */
  reportActivity(activityType, data = {}) {
    return new Promise((resolve, reject) => {
      this.emit(
        'user_activity',
        {
          userId: this.userId,
          activityType,
          ...data
        },
        (result) => {
          if (result.success) {
            resolve(result.activity);
          } else {
            reject(new Error(result.error));
          }
        }
      );
    });
  }

  /**
   * End activity
   */
  endActivity(activityType) {
    return new Promise((resolve, reject) => {
      this.emit(
        'activity_ended',
        {
          userId: this.userId,
          activityType
        },
        (result) => {
          if (result.success) {
            resolve(true);
          } else {
            reject(new Error(result.error));
          }
        }
      );
    });
  }

  /**
   * Get match activity
   */
  getMatchActivity(matchId) {
    return new Promise((resolve, reject) => {
      this.emit('get_match_activity', matchId, (result) => {
        if (result.success) {
          resolve(result.activity);
        } else {
          reject(new Error(result.error));
        }
      });
    });
  }

  /**
   * Subscribe to match
   */
  subscribeMatch(matchId) {
    this.emit('subscribe_match', matchId);
  }

  /**
   * Unsubscribe from match
   */
  unsubscribeMatch(matchId) {
    this.emit('unsubscribe_match', matchId);
  }

  /**
   * Broadcast profile change
   */
  broadcastProfileChange(changeType, profileData) {
    this.emit('profile_changed', {
      userId: this.userId,
      changeType,
      profileData
    });
  }

  /**
   * Broadcast photo added
   */
  broadcastPhotoAdded(photoUrl) {
    this.emit('photo_added', {
      userId: this.userId,
      photoUrl
    });
  }

  /**
   * Broadcast bio updated
   */
  broadcastBioUpdated(bio) {
    this.emit('bio_updated', {
      userId: this.userId,
      bio
    });
  }

  /**
   * Notify new match
   */
  notifyNewMatch(userId1, userId2, match) {
    this.emit('new_match', {
      userId1,
      userId2,
      match
    });
  }

  /**
   * Notify like received
   */
  notifyLikeReceived(toUserId, fromUser) {
    this.emit('like_received', {
      toUserId,
      fromUser
    });
  }

  /**
   * Notify match request
   */
  notifyMatchRequest(matchId, userId1, userId2) {
    this.emit('match_request', {
      matchId,
      userId1,
      userId2
    });
  }

  /**
   * Check connection health
   */
  ping() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      this.emit('ping', null, (response) => {
        const latency = Date.now() - startTime;
        resolve({
          connected: !!response?.pong,
          latency,
          timestamp: response?.timestamp
        });
      });
    });
  }

  /**
   * Get real-time statistics
   */
  getRealTimeStats() {
    return new Promise((resolve, reject) => {
      this.emit('get_realtime_stats', null, (result) => {
        if (result?.success) {
          resolve(result.stats);
        } else {
          reject(new Error(result?.error || 'Failed to get stats'));
        }
      });
    });
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.socket?.connected || false;
  }

  /**
   * Check if connecting
   */
  isConnecting() {
    return this.socket?.connecting || false;
  }

  /**
   * Get socket ID
   */
  getSocketId() {
    return this.socket?.id || null;
  }
}

export default new RealTimeService();
