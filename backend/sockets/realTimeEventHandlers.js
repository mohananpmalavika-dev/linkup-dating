/**
 * Real-Time Socket.io Event Handlers
 * Manages all real-time communication between clients
 */
const realTimeService = require('../services/realTimeService');
const db = require('../config/database');

class SocketEventHandlers {
  static registerHandlers(io) {
    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // ============================================
      // CONNECTION & PRESENCE
      // ============================================

      /**
       * User comes online
       */
      socket.on('user_online', (userId, deviceInfo = {}) => {
        try {
          const result = realTimeService.registerUserOnline(userId, socket.id, deviceInfo);

          // Join user room for targeted broadcasts
          socket.join(`user_${userId}`);

          console.log(`User ${userId} registered online (socket: ${socket.id})`);

          // Broadcast to all connected users in user's matches
          io.emit('user_status_changed', {
            userId,
            status: 'online',
            timestamp: new Date(),
            isReconnect: result.isReconnect
          });

          // Send connection confirmation
          socket.emit('user_online_confirmed', {
            success: true,
            userId,
            socketId: socket.id,
            timestamp: new Date()
          });
        } catch (error) {
          console.error('user_online error:', error);
          socket.emit('error', { message: 'Failed to register online' });
        }
      });

      /**
       * User goes offline
       */
      socket.on('user_offline', (userId) => {
        try {
          realTimeService.registerUserOffline(userId);

          // Broadcast offline status
          io.emit('user_status_changed', {
            userId,
            status: 'offline',
            lastActive: new Date(),
            timestamp: new Date()
          });

          socket.leave(`user_${userId}`);
          console.log(`User ${userId} registered offline`);
        } catch (error) {
          console.error('user_offline error:', error);
        }
      });

      /**
       * Request user status
       */
      socket.on('request_user_status', (userIds, callback) => {
        try {
          const statuses = realTimeService.getUsersStatus(userIds);
          callback({ success: true, statuses });
        } catch (error) {
          console.error('request_user_status error:', error);
          callback({ success: false, error: error.message });
        }
      });

      /**
       * Broadcast user online status
       */
      socket.on('broadcast_status', (userId, callback) => {
        try {
          const status = realTimeService.getUserStatus(userId);
          io.emit('user_status_updated', status);
          callback?.({ success: true });
        } catch (error) {
          callback?.({ success: false, error: error.message });
        }
      });

      // ============================================
      // TYPING INDICATORS
      // ============================================

      /**
       * User started typing
       */
      socket.on('user_typing', (data) => {
        try {
          const { userId, matchId } = data;

          // Register typing indicator
          const typingUsers = realTimeService.setUserTyping(userId, matchId, true);

          // Add to match room
          socket.join(`match_${matchId}`);

          // Broadcast to other users in match
          io.to(`match_${matchId}`).emit('user_typing_indicator', {
            matchId,
            userId,
            isTyping: true,
            typingUsers,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('user_typing error:', error);
        }
      });

      /**
       * User stopped typing
       */
      socket.on('user_stopped_typing', (data) => {
        try {
          const { userId, matchId } = data;

          // Clear typing indicator
          const typingUsers = realTimeService.setUserTyping(userId, matchId, false);

          // Broadcast to other users in match
          io.to(`match_${matchId}`).emit('user_typing_indicator', {
            matchId,
            userId,
            isTyping: false,
            typingUsers,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('user_stopped_typing error:', error);
        }
      });

      // ============================================
      // USER ACTIVITY
      // ============================================

      /**
       * User activity update (viewing profile, calling, etc.)
       */
      socket.on('user_activity', (data, callback) => {
        try {
          const { userId, activityType, matchId, targetUserId } = data;

          // Record activity
          const activity = realTimeService.setUserActivity(userId, activityType, {
            matchId,
            targetUserId
          });

          // Broadcast activity
          const eventName = `activity_${activityType}`;
          io.emit(eventName, {
            userId,
            activityType,
            matchId,
            targetUserId,
            timestamp: Date.now()
          });

          // If viewing profile, notify profile owner
          if (activityType === 'viewing_profile') {
            io.to(`user_${targetUserId}`).emit('profile_viewed', {
              byUserId: userId,
              timestamp: Date.now()
            });
          }

          // If in call, notify match partner
          if (
            activityType === 'voice_calling' ||
            activityType === 'video_calling'
          ) {
            io.to(`user_${targetUserId}`).emit('call_started', {
              callerId: userId,
              callType: activityType,
              matchId,
              timestamp: Date.now()
            });
          }

          callback?.({ success: true, activity });
        } catch (error) {
          console.error('user_activity error:', error);
          callback?.({ success: false, error: error.message });
        }
      });

      /**
       * User activity ended
       */
      socket.on('activity_ended', (data, callback) => {
        try {
          const { userId, activityType } = data;

          // Clear activity
          realTimeService.clearUserActivity(userId, activityType);

          // Broadcast activity end
          io.emit('activity_ended', {
            userId,
            activityType,
            timestamp: Date.now()
          });

          callback?.({ success: true });
        } catch (error) {
          console.error('activity_ended error:', error);
          callback?.({ success: false, error: error.message });
        }
      });

      /**
       * Get match activity status
       */
      socket.on('get_match_activity', (matchId, callback) => {
        try {
          const activity = realTimeService.getMatchActivity(matchId);
          callback({ success: true, activity });
        } catch (error) {
          callback({ success: false, error: error.message });
        }
      });

      // ============================================
      // MATCH NOTIFICATIONS
      // ============================================

      /**
       * Real-time match notification
       */
      socket.on('new_match', (data) => {
        try {
          const { userId1, userId2, match } = data;

          // Notify both users
          io.to(`user_${userId1}`).emit('match_notification', {
            type: 'new_match',
            match,
            timestamp: new Date()
          });

          io.to(`user_${userId2}`).emit('match_notification', {
            type: 'new_match',
            match,
            timestamp: new Date()
          });

          // Subscribe both to match room
          io.to(`user_${userId1}`).socketsJoin(`match_${match.id}`);
          io.to(`user_${userId2}`).socketsJoin(`match_${match.id}`);
        } catch (error) {
          console.error('new_match error:', error);
        }
      });

      /**
       * Like received notification
       */
      socket.on('like_received', (data) => {
        try {
          const { toUserId, fromUser } = data;

          io.to(`user_${toUserId}`).emit('match_notification', {
            type: 'like_received',
            fromUser,
            timestamp: new Date()
          });
        } catch (error) {
          console.error('like_received error:', error);
        }
      });

      /**
       * Match request notification
       */
      socket.on('match_request', (data) => {
        try {
          const { matchId, userId1, userId2 } = data;

          io.to(`user_${userId1}`).emit('match_notification', {
            type: 'match_request',
            matchId,
            initiatorId: userId2,
            timestamp: new Date()
          });

          io.to(`user_${userId2}`).emit('match_notification', {
            type: 'match_request',
            matchId,
            initiatorId: userId1,
            timestamp: new Date()
          });
        } catch (error) {
          console.error('match_request error:', error);
        }
      });

      // ============================================
      // PROFILE CHANGES
      // ============================================

      /**
       * Broadcast profile change to interested users
       */
      socket.on('profile_changed', (data) => {
        try {
          const { userId, changeType, profileData } = data;

          // Queue the change
          realTimeService.queueProfileChange(userId, changeType, profileData);

          // Broadcast to interested users (matches, people viewing profile)
          io.emit('profile_update_notification', {
            userId,
            changeType,
            profileData,
            timestamp: new Date()
          });

          // Also emit to specific user's followers/matches
          io.to(`user_${userId}`).emit('profile_changed_confirmation', {
            changeType,
            timestamp: new Date()
          });
        } catch (error) {
          console.error('profile_changed error:', error);
        }
      });

      /**
       * Photo added to profile
       */
      socket.on('photo_added', (data) => {
        try {
          const { userId, photoUrl } = data;

          io.emit('profile_update_notification', {
            userId,
            changeType: 'photo_added',
            photoUrl,
            timestamp: new Date()
          });
        } catch (error) {
          console.error('photo_added error:', error);
        }
      });

      /**
       * Bio updated
       */
      socket.on('bio_updated', (data) => {
        try {
          const { userId, bio } = data;

          io.emit('profile_update_notification', {
            userId,
            changeType: 'bio_updated',
            bio,
            timestamp: new Date()
          });
        } catch (error) {
          console.error('bio_updated error:', error);
        }
      });

      // ============================================
      // UTILITIES
      // ============================================

      /**
       * Ping/Pong for connection health
       */
      socket.on('ping', (callback) => {
        callback?.({
          pong: true,
          timestamp: Date.now(),
          latency: 0
        });
      });

      /**
       * Get real-time stats
       */
      socket.on('get_realtime_stats', (callback) => {
        try {
          const stats = realTimeService.getRealTimeStats();
          callback?.({ success: true, stats });
        } catch (error) {
          callback?.({ success: false, error: error.message });
        }
      });

      /**
       * Subscribe to match
       */
      socket.on('subscribe_match', (matchId) => {
        try {
          socket.join(`match_${matchId}`);
          console.log(`Socket ${socket.id} subscribed to match ${matchId}`);
        } catch (error) {
          console.error('subscribe_match error:', error);
        }
      });

      /**
       * Unsubscribe from match
       */
      socket.on('unsubscribe_match', (matchId) => {
        try {
          socket.leave(`match_${matchId}`);
          console.log(`Socket ${socket.id} unsubscribed from match ${matchId}`);
        } catch (error) {
          console.error('unsubscribe_match error:', error);
        }
      });

      /**
       * Handle disconnection
       */
      socket.on('disconnect', () => {
        try {
          // Find and remove user
          for (const [userId, user] of realTimeService.activeUsers) {
            if (user.socketId === socket.id) {
              realTimeService.removeUser(userId);
              io.emit('user_status_changed', {
                userId,
                status: 'offline',
                timestamp: new Date()
              });
              console.log(`User ${userId} disconnected`);
              break;
            }
          }
        } catch (error) {
          console.error('disconnect error:', error);
        }
      });

      /**
       * Handle errors
       */
      socket.on('error', (error) => {
        console.error(`Socket ${socket.id} error:`, error);
      });
    });

    // ============================================
    // PERIODIC CLEANUP
    // ============================================

    // Cleanup stale data every 5 minutes
    setInterval(() => {
      realTimeService.cleanup(30 * 60 * 1000);
    }, 5 * 60 * 1000);

    console.log('Socket.io event handlers registered');
  }
}

module.exports = SocketEventHandlers;
