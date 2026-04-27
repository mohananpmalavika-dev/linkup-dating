/**
 * Activity Status Formatting Service
 * Handles enhanced status display with privacy controls
 * Formats statuses like "Last active 2 minutes ago", "On a video call", etc.
 */

const db = require('../config/database');

class ActivityStatusFormatterService {
  /**
   * Format activity type to user-friendly label
   */
  static formatActivityLabel(activityType) {
    const labels = {
      'viewing_profile': '👁️ Viewing a profile',
      'voice_calling': '☎️ On a voice call',
      'video_calling': '🎥 Video dating',
      'in_chat': '💬 In chat',
      'typing': '✍️ Typing...',
      'idle': 'Idle'
    };
    return labels[activityType] || 'Active';
  }

  /**
   * Get emoji for activity type
   */
  static getActivityEmoji(activityType) {
    const emojis = {
      'viewing_profile': '👁️',
      'voice_calling': '☎️',
      'video_calling': '🎥',
      'in_chat': '💬',
      'typing': '✍️'
    };
    return emojis[activityType] || '🔄';
  }

  /**
   * Format time difference to readable string
   * Examples: "just now", "2 minutes ago", "1 hour ago", "yesterday", "3 days ago"
   */
  static formatLastActive(timestamp) {
    if (!timestamp) return 'Never';

    const now = new Date();
    const lastActive = new Date(timestamp);
    const diffMs = now - lastActive;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffSeconds < 10) {
      return 'just now';
    }
    if (diffSeconds < 60) {
      return `${diffSeconds} second${diffSeconds !== 1 ? 's' : ''} ago`;
    }
    if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    }
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
    if (diffDays < 7) {
      if (diffDays === 1) {
        return 'yesterday';
      }
      return `${diffDays} days ago`;
    }
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    }

    return lastActive.toLocaleDateString();
  }

  /**
   * Build comprehensive status object based on user activity and privacy settings
   */
  static async buildStatusForMatch(userId, matchId, includePrivacy = true) {
    try {
      // Get user's current activity
      const userStatus = await this.getUserCurrentActivity(userId);

      // Get privacy preferences if requested
      let privacySettings = null;
      if (includePrivacy) {
        privacySettings = await this.getStatusPrivacy(userId, matchId);
      }

      // Build status object
      const statusObj = {
        userId,
        matchId,
        isOnline: userStatus.isOnline,
        status: userStatus.status, // 'online' | 'offline'
        lastActive: userStatus.lastActive,
        lastActiveFormatted: this.formatLastActive(userStatus.lastActive),
        
        // Activity information
        currentActivity: userStatus.currentActivity,
        activityLabel: userStatus.currentActivity ? 
          this.formatActivityLabel(userStatus.currentActivity) : null,
        activityEmoji: userStatus.currentActivity ? 
          this.getActivityEmoji(userStatus.currentActivity) : null,
        inCall: userStatus.inCall,
        callType: userStatus.callType, // 'voice' | 'video' | null
        isVideoDating: userStatus.callType === 'video',
        
        // Device information
        device: userStatus.device,
        platform: userStatus.platform,
        
        // Privacy-filtered status
        privacy: privacySettings,
        visibleStatus: includePrivacy ? 
          this.filterStatusByPrivacy(userStatus, privacySettings) : userStatus,
        
        timestamp: new Date()
      };

      return statusObj;
    } catch (error) {
      console.error('Error building status for match:', error);
      return {
        userId,
        matchId,
        isOnline: false,
        status: 'offline',
        lastActive: null,
        lastActiveFormatted: 'Unknown',
        currentActivity: null,
        privacy: null,
        error: error.message
      };
    }
  }

  /**
   * Get user's current activity from real-time service
   */
  static async getUserCurrentActivity(userId) {
    try {
      // Query UserActivity for most recent activity
      const activity = await db.query(
        `SELECT user_id, activity_type, start_time, end_time, target_user_id
         FROM user_activities
         WHERE user_id = $1 AND end_time IS NULL
         ORDER BY start_time DESC
         LIMIT 1`,
        [userId]
      );

      if (activity.rows.length > 0) {
        const act = activity.rows[0];
        return {
          userId,
          currentActivity: act.activity_type,
          inCall: act.activity_type === 'voice_calling' || act.activity_type === 'video_calling',
          callType: act.activity_type === 'voice_calling' ? 'voice' : 
                   act.activity_type === 'video_calling' ? 'video' : null,
          isOnline: true,
          status: 'online',
          lastActive: new Date()
        };
      }

      // Get last active timestamp
      const lastActive = await db.query(
        `SELECT last_active FROM user_presence_sessions
         WHERE user_id = $1 AND is_active = true
         ORDER BY last_activity_timestamp DESC
         LIMIT 1`,
        [userId]
      );

      return {
        userId,
        currentActivity: null,
        inCall: false,
        callType: null,
        isOnline: lastActive.rows.length > 0,
        status: lastActive.rows.length > 0 ? 'online' : 'offline',
        lastActive: lastActive.rows.length > 0 ? lastActive.rows[0].last_active : null
      };
    } catch (error) {
      console.error('Error getting user activity:', error);
      return {
        userId,
        currentActivity: null,
        inCall: false,
        callType: null,
        isOnline: false,
        status: 'offline',
        lastActive: null
      };
    }
  }

  /**
   * Get user's status privacy settings for a match
   */
  static async getStatusPrivacy(userId, matchId) {
    try {
      const result = await db.query(
        `SELECT user_id, match_id, show_online_status, show_last_active, 
                show_typing_indicator, show_activity_status, show_read_receipts,
                share_detailed_status, privacy_level
         FROM match_status_preferences
         WHERE user_id = $1 AND match_id = $2`,
        [userId, matchId]
      );

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Return defaults if no preference set
      return {
        show_online_status: true,
        show_last_active: true,
        show_typing_indicator: true,
        show_activity_status: true,
        show_read_receipts: true,
        share_detailed_status: true,
        privacy_level: 'full'
      };
    } catch (error) {
      console.error('Error getting privacy settings:', error);
      // Return full privacy by default
      return {
        show_online_status: true,
        show_last_active: true,
        show_typing_indicator: true,
        show_activity_status: true,
        show_read_receipts: true,
        share_detailed_status: true,
        privacy_level: 'full'
      };
    }
  }

  /**
   * Filter status object based on privacy settings
   */
  static filterStatusByPrivacy(userStatus, privacySettings) {
    const filtered = { ...userStatus };

    if (!privacySettings.show_online_status) {
      filtered.isOnline = null;
    }

    if (!privacySettings.show_last_active) {
      filtered.lastActive = null;
      filtered.lastActiveFormatted = null;
    }

    if (!privacySettings.show_activity_status) {
      filtered.currentActivity = null;
      filtered.activityLabel = null;
      filtered.activityEmoji = null;
    }

    if (!privacySettings.show_read_receipts) {
      // Would be filtered elsewhere in message display
    }

    return filtered;
  }

  /**
   * Build match activity summary
   * Shows what both users are doing in a match
   */
  static async getMatchActivitySummary(matchId) {
    try {
      const result = await db.query(
        `SELECT user_id_1, user_id_2 FROM matches WHERE id = $1`,
        [matchId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const { user_id_1, user_id_2 } = result.rows[0];

      // Get status for both users
      const status1 = await this.buildStatusForMatch(user_id_1, matchId, true);
      const status2 = await this.buildStatusForMatch(user_id_2, matchId, true);

      return {
        matchId,
        user1: status1,
        user2: status2,
        bothOnline: status1.isOnline && status2.isOnline,
        onCallTogether: status1.inCall && status2.inCall && 
                       status1.callType === status2.callType,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting match activity summary:', error);
      return null;
    }
  }

  /**
   * Check if status should be visible to viewer
   */
  static shouldShowStatus(statusOwnerSettings, viewerSettings = {}) {
    if (statusOwnerSettings.privacy_level === 'hidden') {
      return false;
    }

    // Apply individual visibility settings
    return statusOwnerSettings.share_detailed_status !== false;
  }

  /**
   * Format status for UI display
   */
  static formatStatusForDisplay(statusObj) {
    if (!statusObj) {
      return { text: 'Unknown', badge: null, emoji: null };
    }

    // Video dating gets special badge
    if (statusObj.isVideoDating) {
      return {
        text: '🎥 Video dating',
        badge: 'video-dating',
        emoji: '🎥',
        priority: 1
      };
    }

    // In call
    if (statusObj.inCall && statusObj.callType === 'voice') {
      return {
        text: '☎️ On a voice call',
        badge: 'in-call',
        emoji: '☎️',
        priority: 1
      };
    }

    // Current activity
    if (statusObj.currentActivity && statusObj.currentActivity !== 'idle') {
      return {
        text: statusObj.activityLabel,
        badge: statusObj.currentActivity,
        emoji: statusObj.activityEmoji,
        priority: 2
      };
    }

    // Online
    if (statusObj.isOnline) {
      return {
        text: 'Online now',
        badge: 'online',
        emoji: '🟢',
        priority: 3
      };
    }

    // Last active
    if (statusObj.lastActiveFormatted) {
      return {
        text: `Last active ${statusObj.lastActiveFormatted}`,
        badge: 'last-active',
        emoji: '🕐',
        priority: 4
      };
    }

    return {
      text: 'Offline',
      badge: 'offline',
      emoji: '⚪',
      priority: 5
    };
  }
}

module.exports = ActivityStatusFormatterService;
