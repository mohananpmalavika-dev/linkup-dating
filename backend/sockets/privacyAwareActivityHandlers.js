/**
 * Privacy-Aware Real-Time Activity Events
 * Socket.io handlers for broadcasting user activity while respecting privacy preferences
 * Ensures that user status updates only go to matches who have permission to see them
 */

const db = require('../config/database');
const ActivityStatusFormatterService = require('../services/activityStatusFormatterService');

const privacyAwareActivityHandlers = {
  /**
   * Handle user activity updates with privacy filtering
   * Called when user's activity status changes (video call, typing, etc.)
   */
  async handleUserActivityUpdate(io, socket, { userId, matchId, activityType, targetUserId, callType = null }) {
    try {
      // Get user's privacy preference for this match
      const privacyResult = await db.query(
        `SELECT privacy_level, share_detailed_status, show_activity_status
         FROM match_status_preferences
         WHERE user_id = $1 AND match_id = $2`,
        [userId, matchId]
      );

      if (privacyResult.rows.length === 0) {
        console.warn(`No privacy preferences found for user ${userId} in match ${matchId}`);
        return; // Don't broadcast if no preferences
      }

      const privacy = privacyResult.rows[0];

      // Check if user wants to share activity status
      if (privacy.privacy_level === 'hidden' || !privacy.share_detailed_status) {
        // Don't broadcast detailed activity
        console.log(`User ${userId} has activity status hidden for match ${matchId}`);
        return;
      }

      if (!privacy.show_activity_status) {
        // Don't broadcast specific activity types
        return;
      }

      // Get match details to find the other user
      const matchResult = await db.query(
        `SELECT user_id_1, user_id_2 FROM matches WHERE id = $1`,
        [matchId]
      );

      if (matchResult.rows.length === 0) {
        console.error(`Match ${matchId} not found`);
        return;
      }

      const { user_id_1, user_id_2 } = matchResult.rows[0];
      const otherUserId = userId === user_id_1 ? user_id_2 : user_id_1;

      // Build formatted activity status
      const status = await ActivityStatusFormatterService.buildStatusForMatch(userId, matchId, false);
      const formatted = ActivityStatusFormatterService.formatStatusForDisplay(status);

      // Emit to match's connected sockets only
      const matchRoom = `match_${matchId}`;
      
      io.to(matchRoom).emit('user_activity_update_with_privacy', {
        userId,
        matchId,
        otherUserId,
        activityType,
        callType,
        formatted,
        timestamp: new Date(),
        privacyLevel: privacy.privacy_level,
        // Video dating gets special handling
        isVideoDating: callType === 'video' && activityType === 'video_calling'
      });

      // Special event for video dating badge
      if (callType === 'video' && activityType === 'video_calling') {
        io.to(matchRoom).emit('video_dating_started', {
          userId,
          matchId,
          timestamp: new Date()
        });
      }

    } catch (error) {
      console.error('Error handling user activity update:', error);
    }
  },

  /**
   * Handle activity ended event (respects privacy)
   */
  async handleActivityEnded(io, socket, { userId, matchId, activityType }) {
    try {
      const matchRoom = `match_${matchId}`;
      
      io.to(matchRoom).emit('user_activity_ended_with_privacy', {
        userId,
        matchId,
        activityType,
        timestamp: new Date()
      });

      // Broadcast video dating ended
      if (activityType === 'video_calling') {
        io.to(matchRoom).emit('video_dating_ended', {
          userId,
          matchId,
          timestamp: new Date()
        });
      }

    } catch (error) {
      console.error('Error handling activity ended:', error);
    }
  },

  /**
   * Handle last active update (respects show_last_active privacy)
   */
  async handleLastActiveUpdate(io, socket, { userId, matchId, timestamp }) {
    try {
      // Get user's privacy preference
      const privacyResult = await db.query(
        `SELECT show_last_active, privacy_level
         FROM match_status_preferences
         WHERE user_id = $1 AND match_id = $2`,
        [userId, matchId]
      );

      if (privacyResult.rows.length === 0) return;

      const privacy = privacyResult.rows[0];

      // Only broadcast if user has enabled last active sharing
      if (privacy.privacy_level === 'hidden' || !privacy.show_last_active) {
        return;
      }

      const matchRoom = `match_${matchId}`;
      const formattedTime = ActivityStatusFormatterService.formatLastActive(timestamp);

      io.to(matchRoom).emit('user_last_active_update_with_privacy', {
        userId,
        matchId,
        timestamp,
        formattedTime,
        privacyLevel: privacy.privacy_level
      });

    } catch (error) {
      console.error('Error handling last active update:', error);
    }
  },

  /**
   * Handle typing indicator (respects show_typing_indicator privacy)
   */
  async handleTypingIndicator(io, socket, { userId, matchId, isTyping }) {
    try {
      // Get user's privacy preference
      const privacyResult = await db.query(
        `SELECT show_typing_indicator, privacy_level
         FROM match_status_preferences
         WHERE user_id = $1 AND match_id = $2`,
        [userId, matchId]
      );

      if (privacyResult.rows.length === 0) return;

      const privacy = privacyResult.rows[0];

      // Only broadcast if user has enabled typing indicator
      if (privacy.privacy_level === 'hidden' || !privacy.show_typing_indicator) {
        return;
      }

      const matchRoom = `match_${matchId}`;

      io.to(matchRoom).emit('user_typing_with_privacy', {
        userId,
        matchId,
        isTyping,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error handling typing indicator:', error);
    }
  },

  /**
   * Handle online status update (respects show_online_status privacy)
   */
  async handleOnlineStatusUpdate(io, socket, { userId, matchId, isOnline }) {
    try {
      // Get user's privacy preference
      const privacyResult = await db.query(
        `SELECT show_online_status, privacy_level
         FROM match_status_preferences
         WHERE user_id = $1 AND match_id = $2`,
        [userId, matchId]
      );

      if (privacyResult.rows.length === 0) return;

      const privacy = privacyResult.rows[0];

      // Only broadcast if user has enabled online status sharing
      if (privacy.privacy_level === 'hidden' || !privacy.show_online_status) {
        return;
      }

      const matchRoom = `match_${matchId}`;

      io.to(matchRoom).emit('user_online_status_with_privacy', {
        userId,
        matchId,
        isOnline,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error handling online status update:', error);
    }
  },

  /**
   * Get visible status for a user (filtered by privacy settings)
   */
  async getVisibleStatus(userId, matchId) {
    try {
      const status = await ActivityStatusFormatterService.buildStatusForMatch(userId, matchId, true);
      const filtered = ActivityStatusFormatterService.filterStatusByPrivacy(
        status,
        status.privacy
      );
      return filtered;
    } catch (error) {
      console.error('Error getting visible status:', error);
      return null;
    }
  },

  /**
   * Validate if requester can see status
   */
  async canViewStatus(viewerId, targetUserId, matchId) {
    try {
      // Get target user's privacy preferences
      const privacyResult = await db.query(
        `SELECT privacy_level, share_detailed_status
         FROM match_status_preferences
         WHERE user_id = $1 AND match_id = $2`,
        [targetUserId, matchId]
      );

      if (privacyResult.rows.length === 0) {
        return true; // Default to allowing view
      }

      const privacy = privacyResult.rows[0];
      return privacy.privacy_level !== 'hidden' && privacy.share_detailed_status;

    } catch (error) {
      console.error('Error checking view permissions:', error);
      return true; // Default to allowing view on error
    }
  },

  /**
   * Broadcast privacy level change event
   */
  async handlePrivacyLevelChange(io, socket, { userId, matchId, newPrivacyLevel }) {
    try {
      const matchRoom = `match_${matchId}`;

      io.to(matchRoom).emit('user_privacy_level_changed', {
        userId,
        matchId,
        newPrivacyLevel,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error handling privacy level change:', error);
    }
  },

  /**
   * Request current status from user (respects privacy)
   */
  async handleStatusRequest(io, socket, { requesterId, requestedUserId, matchId }) {
    try {
      // Check if requester can view the status
      const canView = await this.canViewStatus(requesterId, requestedUserId, matchId);
      
      if (!canView) {
        socket.emit('status_request_denied', {
          reason: 'User has privacy mode enabled',
          userId: requestedUserId,
          matchId
        });
        return;
      }

      // Get visible status
      const visibleStatus = await this.getVisibleStatus(requestedUserId, matchId);

      socket.emit('status_request_response', {
        userId: requestedUserId,
        matchId,
        status: visibleStatus
      });

    } catch (error) {
      console.error('Error handling status request:', error);
    }
  }
};

module.exports = privacyAwareActivityHandlers;
