/**
 * Frontend Real-Time Service
 * Manages socket.io connection and real-time events
 */
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

class RealTimeService {
  constructor() {
    this.socket = null;
    this.userId = null;
    this.listeners = new Map(); // { eventName: [callbacks] }
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
  }

  /**
   * Connect to real-time server
   */
  connect(userId, deviceInfo = {}) {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(this.socket);
        return;
      }

      try {
        this.userId = userId;

        this.socket = io(SOCKET_URL, {
          reconnection: true,
          reconnectionDelay: this.reconnectDelay,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: this.maxReconnectAttempts,
          transports: ['websocket', 'polling'],
          query: {
            userId,
            device: deviceInfo.device || 'web'
          }
        });

        // Connection established
        this.socket.on('connect', () => {
          console.log('Connected to real-time server');
          this.reconnectAttempts = 0;

          // Send online status
          this.socket.emit('user_online', userId, deviceInfo);
          this._emit('connected', { userId });
          resolve(this.socket);
        });

        // Connection lost
        this.socket.on('disconnect', (reason) => {
          console.warn('Disconnected from real-time server:', reason);
          this._emit('disconnected', { reason });
        });

        // Reconnection attempt
        this.socket.on('reconnect_attempt', () => {
          this.reconnectAttempts++;
          console.log(
            `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
          );
        });

        // Connection error
        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          this._emit('connection_error', { error: error.message });
          reject(error);
        });

        // Generic error
        this.socket.on('error', (error) => {
          console.error('Socket error:', error);
          this._emit('error', { error });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from real-time server
   */
  disconnect() {
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
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);

      // Set up socket listener if not already done
      if (this.socket && !this.socket._events?.[eventName]) {
        this.socket.on(eventName, (data) => {
          this._emit(eventName, data);
        });
      }
    }

    this.listeners.get(eventName).push(callback);

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
