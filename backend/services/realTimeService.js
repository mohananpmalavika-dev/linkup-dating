/**
 * Real-Time Service
 * Manages user presence, activity status, and real-time notifications
 */
const db = require('../config/database');

class RealTimeService {
  constructor() {
    // In-memory store for active users
    // Structure: { userId: { socketId, matchIds, status, lastActive, typing, typing_to } }
    this.activeUsers = new Map();
    // Activity cache: { userId: { activity, startTime, matchId } }
    this.userActivity = new Map();
    // Typing indicators: { matchId_userId: { typing, timestamp } }
    this.typingIndicators = new Map();
    // Profile change queue
    this.profileChanges = [];
  }

  /**
   * Register user as online
   */
  registerUserOnline(userId, socketId, deviceInfo = {}) {
    const previousSocket = this.activeUsers.get(userId)?.socketId;

    this.activeUsers.set(userId, {
      userId,
      socketId,
      matchIds: new Set(),
      status: 'online',
      lastActive: new Date(),
      device: deviceInfo.device || 'web',
      platform: deviceInfo.platform || 'unknown',
      typing: false,
      typingTo: null,
      viewingProfile: null,
      inCall: false,
      callWith: null
    });

    return {
      isReconnect: !!previousSocket,
      previousSocket
    };
  }

  /**
   * Mark user as offline
   */
  registerUserOffline(userId) {
    const user = this.activeUsers.get(userId);
    if (user) {
      user.status = 'offline';
      user.lastActive = new Date();
      user.typing = false;
      user.inCall = false;
      this.userActivity.delete(userId);
      this.typingIndicators.delete(`${userId}_typing`);
    }
  }

  /**
   * Remove user from active users
   */
  removeUser(userId) {
    this.activeUsers.delete(userId);
    this.userActivity.delete(userId);
    // Clean up typing indicators
    for (const [key] of this.typingIndicators) {
      if (key.includes(userId)) {
        this.typingIndicators.delete(key);
      }
    }
  }

  /**
   * Add match to user's active matches
   */
  addMatchToUser(userId, matchId) {
    const user = this.activeUsers.get(userId);
    if (user) {
      user.matchIds.add(matchId);
    }
  }

  /**
   * Remove match from user's active matches
   */
  removeMatchFromUser(userId, matchId) {
    const user = this.activeUsers.get(userId);
    if (user) {
      user.matchIds.delete(matchId);
    }
  }

  /**
   * Set user as typing in a match
   */
  setUserTyping(userId, matchId, isTyping) {
    const key = `${matchId}_${userId}`;

    if (isTyping) {
      this.typingIndicators.set(key, {
        userId,
        matchId,
        isTyping: true,
        timestamp: Date.now()
      });

      const user = this.activeUsers.get(userId);
      if (user) {
        user.typing = true;
        user.typingTo = matchId;
      }
    } else {
      this.typingIndicators.delete(key);
      const user = this.activeUsers.get(userId);
      if (user) {
        user.typing = false;
        user.typingTo = null;
      }
    }

    return this.getTypingUsers(matchId);
  }

  /**
   * Get users typing in a match
   */
  getTypingUsers(matchId) {
    const typing = [];
    for (const [key, data] of this.typingIndicators) {
      if (data.matchId === matchId && data.isTyping) {
        typing.push({
          userId: data.userId,
          timestamp: data.timestamp
        });
      }
    }
    return typing;
  }

  /**
   * Set user activity
   */
  setUserActivity(userId, activityType, data = {}) {
    const activity = {
      userId,
      type: activityType, // 'viewing_profile', 'voice_calling', 'video_calling', 'in_chat'
      startTime: Date.now(),
      matchId: data.matchId || null,
      targetUserId: data.targetUserId || null,
      metadata: data.metadata || {}
    };

    this.userActivity.set(userId, activity);

    const user = this.activeUsers.get(userId);
    if (user) {
      switch (activityType) {
        case 'viewing_profile':
          user.viewingProfile = data.targetUserId;
          break;
        case 'voice_calling':
        case 'video_calling':
          user.inCall = true;
          user.callWith = data.targetUserId;
          break;
      }
    }

    return activity;
  }

  /**
   * Clear user activity
   */
  clearUserActivity(userId, activityType = null) {
    if (activityType) {
      const activity = this.userActivity.get(userId);
      if (activity && activity.type === activityType) {
        this.userActivity.delete(userId);
      }
    } else {
      this.userActivity.delete(userId);
    }

    const user = this.activeUsers.get(userId);
    if (user) {
      user.viewingProfile = null;
      user.inCall = false;
      user.callWith = null;
    }
  }

  /**
   * Get user online status
   */
  getUserStatus(userId) {
    const user = this.activeUsers.get(userId);
    if (!user) {
      // Check last active from database
      return {
        userId,
        status: 'offline',
        lastActive: null,
        isOnline: false
      };
    }

    return {
      userId,
      status: user.status,
      lastActive: user.lastActive,
      isOnline: user.status === 'online',
      device: user.device,
      platform: user.platform,
      activity: user.typing ? 'typing' : user.inCall ? 'calling' : null
    };
  }

  /**
   * Get status for multiple users
   */
  getUsersStatus(userIds) {
    return userIds.map((userId) => this.getUserStatus(userId));
  }

  /**
   * Get users viewing a specific profile
   */
  getUsersViewingProfile(targetUserId) {
    const viewers = [];
    for (const [userId, activity] of this.userActivity) {
      if (
        activity.type === 'viewing_profile' &&
        activity.targetUserId === targetUserId
      ) {
        viewers.push({
          userId,
          viewTime: Date.now() - activity.startTime
        });
      }
    }
    return viewers;
  }

  /**
   * Get match-specific activity
   */
  getMatchActivity(matchId) {
    const activity = {
      matchId,
      typing: this.getTypingUsers(matchId),
      activeUsers: [],
      updatedAt: new Date()
    };

    // Get active users in this match
    for (const [userId, user] of this.activeUsers) {
      if (user.matchIds.has(matchId)) {
        activity.activeUsers.push({
          userId,
          status: user.status,
          isTyping: user.typing && user.typingTo === matchId,
          lastActive: user.lastActive
        });
      }
    }

    return activity;
  }

  /**
   * Queue profile change notification
   */
  queueProfileChange(userId, changeType, data = {}) {
    this.profileChanges.push({
      userId,
      changeType, // 'profile_updated', 'photo_added', 'bio_updated', etc.
      data,
      timestamp: new Date(),
      id: `${userId}_${Date.now()}`
    });

    // Keep only last 100 changes
    if (this.profileChanges.length > 100) {
      this.profileChanges.shift();
    }

    return this.profileChanges[this.profileChanges.length - 1];
  }

  /**
   * Get profile changes
   */
  getProfileChanges(userId = null, limit = 50) {
    let changes = this.profileChanges;
    if (userId) {
      changes = changes.filter((c) => c.userId === userId);
    }
    return changes.slice(-limit).reverse();
  }

  /**
   * Get connection health metrics
   */
  getHealthMetrics() {
    const totalUsers = this.activeUsers.size;
    const typingUsers = new Set();
    const callingUsers = new Set();
    const viewingProfiles = new Set();

    for (const [userId, user] of this.activeUsers) {
      if (user.typing) typingUsers.add(userId);
      if (user.inCall) callingUsers.add(userId);
      if (user.viewingProfile) viewingProfiles.add(userId);
    }

    return {
      timestamp: new Date(),
      totalActiveUsers: totalUsers,
      typingUsers: typingUsers.size,
      ongoingCalls: callingUsers.size,
      viewingProfiles: viewingProfiles.size,
      memoryUsage: {
        activeUsers: this.activeUsers.size,
        activities: this.userActivity.size,
        typingIndicators: this.typingIndicators.size
      }
    };
  }

  /**
   * Clean up stale data
   */
  cleanup(stalenessThreshold = 30 * 60 * 1000) {
    // Remove stale typing indicators (30+ minutes)
    const now = Date.now();
    for (const [key, data] of this.typingIndicators) {
      if (now - data.timestamp > stalenessThreshold) {
        this.typingIndicators.delete(key);
      }
    }

    // Mark users as stale if no activity
    for (const [userId, user] of this.activeUsers) {
      const lastActivityTime = user.lastActive?.getTime() || 0;
      if (now - lastActivityTime > stalenessThreshold) {
        user.status = 'away';
      }
    }

    return {
      cleaned: true,
      timestamp: new Date()
    };
  }

  /**
   * Get real-time stats for dashboard
   */
  getRealTimeStats() {
    const metrics = this.getHealthMetrics();
    const matchStats = {};

    // Group stats by match
    for (const [userId, user] of this.activeUsers) {
      for (const matchId of user.matchIds) {
        if (!matchStats[matchId]) {
          matchStats[matchId] = {
            activeUsers: 0,
            typing: 0,
            inCall: 0
          };
        }
        matchStats[matchId].activeUsers++;
        if (user.typing && user.typingTo === matchId) {
          matchStats[matchId].typing++;
        }
        if (user.inCall && user.callWith) {
          matchStats[matchId].inCall++;
        }
      }
    }

    return {
      ...metrics,
      matchStats,
      topMatches: Object.entries(matchStats)
        .sort((a, b) => b[1].activeUsers - a[1].activeUsers)
        .slice(0, 10)
        .map(([matchId, stats]) => ({ matchId: parseInt(matchId), ...stats }))
    };
  }
}

module.exports = new RealTimeService();
