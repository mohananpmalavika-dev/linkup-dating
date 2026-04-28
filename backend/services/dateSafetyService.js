const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const DateSafetyKit = db.models.DateSafetyKit;
const User = db.models.User;
const Match = db.models.Match;

const dateSafetyService = {
  /**
   * Start a new date safety session
   * @param {string} userId - User ID initiating safety kit
   * @param {string} trustedFriendId - Friend to share location with
   * @param {string} matchId - Associated match ID (optional)
   * @param {number} durationMinutes - Duration of sharing (default 180)
   */
  async startSafetySession(userId, trustedFriendId, matchId = null, durationMinutes = 180) {
    try {
      // Verify user exists
      const user = await User.findByPk(userId);
      if (!user) throw new Error('User not found');

      // Verify trusted friend exists
      const friend = await User.findByPk(trustedFriendId);
      if (!friend) throw new Error('Trusted friend not found');

      // Check for active sessions (only one active at a time)
      const activeSession = await DateSafetyKit.findOne({
        where: {
          user_id: userId,
          session_status: 'active',
        },
      });

      if (activeSession) {
        throw new Error('You already have an active safety session');
      }

      const session = await DateSafetyKit.create({
        user_id: userId,
        trusted_friend_id: trustedFriendId,
        date_match_id: matchId,
        session_status: 'active',
        sharing_start_time: new Date(),
        share_duration_minutes: durationMinutes,
        safety_tips_acknowledged: false,
        location_history: [],
      });

      return {
        success: true,
        sessionId: session.id,
        message: 'Safety session started',
        session: {
          id: session.id,
          trustedFriend: friend.dataValues,
          durationMinutes,
          startTime: session.sharing_start_time,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Update live location during safety session
   * @param {string} sessionId - Safety session ID
   * @param {number} latitude - Current latitude
   * @param {number} longitude - Current longitude
   */
  async updateLiveLocation(sessionId, latitude, longitude) {
    try {
      const session = await DateSafetyKit.findByPk(sessionId);
      if (!session) throw new Error('Session not found');

      if (session.session_status === 'completed') {
        throw new Error('Cannot update location on completed session');
      }

      // Add to location history
      const locationPoint = {
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      };

      const history = Array.isArray(session.location_history) ? session.location_history : [];
      history.push(locationPoint);

      // Keep only last 100 points
      if (history.length > 100) {
        history.shift();
      }

      await session.update({
        current_latitude: latitude,
        current_longitude: longitude,
        last_location_update: new Date(),
        location_history: history,
      });

      return {
        success: true,
        message: 'Location updated',
        location: {
          latitude,
          longitude,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Send check-in message
   * @param {string} sessionId - Safety session ID
   * @param {string} status - 'good', 'ok', or 'help'
   * @param {string} message - Optional message
   */
  async sendCheckIn(sessionId, status, message = '') {
    try {
      if (!['good', 'ok', 'help'].includes(status)) {
        throw new Error('Invalid check-in status');
      }

      const session = await DateSafetyKit.findByPk(sessionId, {
        include: [
          { model: User, as: 'user' },
          { model: User, as: 'trustedFriend' },
        ],
      });

      if (!session) throw new Error('Session not found');
      if (session.session_status !== 'active') {
        throw new Error('Session is not active');
      }

      // Update session
      const updatedSession = await session.update({
        last_check_in_time: new Date(),
        last_check_in_status: status,
        check_in_count: session.check_in_count + 1,
      });

      // If help status, update to emergency
      if (status === 'help') {
        await session.update({ session_status: 'emergency' });
      }

      return {
        success: true,
        message: `Check-in sent: ${status}`,
        checkIn: {
          status,
          message,
          timestamp: new Date(),
          userName: session.user.first_name,
          userLocation: {
            lat: session.current_latitude,
            lng: session.current_longitude,
          },
        },
        notificationSent: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Activate SOS emergency button
   * @param {string} sessionId - Safety session ID
   * @param {number} latitude - Current latitude
   * @param {number} longitude - Current longitude
   */
  async activateSOS(sessionId, latitude, longitude) {
    try {
      const session = await DateSafetyKit.findByPk(sessionId, {
        include: [
          { model: User, as: 'user' },
          { model: User, as: 'trustedFriend' },
        ],
      });

      if (!session) throw new Error('Session not found');

      // Get emergency number based on user location/country
      const emergencyNumber = await getLocalEmergencyNumber(latitude, longitude);

      // Update session
      await session.update({
        sos_activated: true,
        sos_activated_time: new Date(),
        sos_location_latitude: latitude,
        sos_location_longitude: longitude,
        session_status: 'emergency',
        emergency_contact_number: emergencyNumber,
      });

      // Notify trusted friend immediately
      const notification = {
        type: 'sos_alert',
        userId: session.trusted_friend_id,
        data: {
          message: `${session.user.first_name} activated SOS!`,
          location: { latitude, longitude },
          sessionId: session.id,
          timestamp: new Date(),
        },
      };

      // In production, send push notification here
      // await pushNotificationService.send(notification);

      return {
        success: true,
        message: 'SOS activated - Emergency contact notified',
        sos: {
          activated: true,
          timestamp: new Date(),
          location: { latitude, longitude },
          emergencyNumber,
          trustedFriend: session.trustedFriend.email,
          sessionId: session.id,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * End safety session
   * @param {string} sessionId - Safety session ID
   * @param {string} notes - End notes (optional)
   */
  async endSafetySession(sessionId, notes = '') {
    try {
      const session = await DateSafetyKit.findByPk(sessionId);
      if (!session) throw new Error('Session not found');

      const endTime = new Date();
      const durationMs = endTime - session.sharing_start_time;
      const durationMinutes = Math.round(durationMs / 60000);

      const completedSession = await session.update({
        session_status: 'completed',
        sharing_end_time: endTime,
        session_end_notes: notes,
      });

      return {
        success: true,
        message: 'Safety session ended',
        session: {
          id: completedSession.id,
          duration: durationMinutes,
          checkInCount: completedSession.check_in_count,
          locationUpdates: completedSession.location_history?.length || 0,
          sosActivated: completedSession.sos_activated,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Get active session details
   * @param {string} sessionId - Safety session ID
   */
  async getSessionDetails(sessionId) {
    try {
      const session = await DateSafetyKit.findByPk(sessionId, {
        include: [
          { model: User, as: 'user', attributes: ['id', 'first_name', 'email'] },
          { model: User, as: 'trustedFriend', attributes: ['id', 'first_name', 'email'] },
        ],
      });

      if (!session) throw new Error('Session not found');

      return {
        success: true,
        session: {
          id: session.id,
          status: session.session_status,
          user: session.user,
          trustedFriend: session.trustedFriend,
          currentLocation: {
            latitude: session.current_latitude,
            longitude: session.current_longitude,
          },
          checkInCount: session.check_in_count,
          lastCheckIn: session.last_check_in_time,
          lastCheckInStatus: session.last_check_in_status,
          sosActivated: session.sos_activated,
          sosLocation: session.sos_activated ? {
            latitude: session.sos_location_latitude,
            longitude: session.sos_location_longitude,
          } : null,
          startTime: session.sharing_start_time,
          endTime: session.sharing_end_time,
          locationHistoryCount: session.location_history?.length || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Get shared location for trusted friend
   * @param {string} sessionId - Safety session ID
   * @param {string} trustedFriendId - Trusted friend's user ID
   */
  async getSharedLocation(sessionId, trustedFriendId) {
    try {
      const session = await DateSafetyKit.findByPk(sessionId);
      if (!session) throw new Error('Session not found');

      // Verify requester is the trusted friend
      if (session.trusted_friend_id !== trustedFriendId) {
        throw new Error('Unauthorized');
      }

      if (session.session_status === 'completed' || session.session_status === 'inactive') {
        throw new Error('Session is not active');
      }

      return {
        success: true,
        location: {
          latitude: session.current_latitude,
          longitude: session.current_longitude,
          timestamp: session.last_location_update,
          address: await reverseGeocodeLocation(session.current_latitude, session.current_longitude),
        },
        sessionStatus: session.session_status,
        lastUpdate: session.last_location_update,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Get safety tips
   */
  async getSafetyTips() {
    return {
      success: true,
      tips: [
        {
          id: 1,
          title: '👥 Meet in Public',
          description: 'Always meet at a public place like a cafe, restaurant, or park.',
          icon: 'location',
        },
        {
          id: 2,
          title: '📢 Tell Someone',
          description: 'Share your location with a trusted friend and let them know details about your date.',
          icon: 'share',
        },
        {
          id: 3,
          title: '✅ Verify Profile',
          description: 'Check the person\'s verified badge and review their complete profile carefully.',
          icon: 'shield',
        },
        {
          id: 4,
          title: '🚗 Arrange Your Own Transport',
          description: 'Drive yourself or use a trusted ride-sharing app. Don\'t accept rides from someone you just met.',
          icon: 'car',
        },
        {
          id: 5,
          title: '💬 Keep in Touch',
          description: 'Check in with your trusted friend during the date using the check-in feature.',
          icon: 'message',
        },
        {
          id: 6,
          title: '📱 Keep Your Phone Charged',
          description: 'Ensure your phone is fully charged and you have access to emergency services.',
          icon: 'battery',
        },
        {
          id: 7,
          title: '⏰ Set a Time Limit',
          description: 'Plan for a specific duration and let your trusted friend know when you\'ll check in.',
          icon: 'clock',
        },
        {
          id: 8,
          title: '🚨 Trust Your Gut',
          description: 'If something feels off, it\'s okay to leave. Your safety is the priority.',
          icon: 'alert',
        },
      ],
    };
  },

  /**
   * Mark safety tips as acknowledged
   * @param {string} sessionId - Safety session ID
   */
  async acknowledgeSafetyTips(sessionId) {
    try {
      const session = await DateSafetyKit.findByPk(sessionId);
      if (!session) throw new Error('Session not found');

      await session.update({
        safety_tips_acknowledged: true,
      });

      return {
        success: true,
        message: 'Safety tips acknowledged',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Get session history for user
   * @param {string} userId - User ID
   * @param {number} limit - Number of sessions to return
   */
  async getSessionHistory(userId, limit = 10) {
    try {
      const sessions = await DateSafetyKit.findAll({
        where: { user_id: userId },
        include: [
          { model: User, as: 'trustedFriend', attributes: ['id', 'first_name'] },
        ],
        order: [['created_at', 'DESC']],
        limit,
      });

      return {
        success: true,
        sessions: sessions.map(session => ({
          id: session.id,
          date: session.sharing_start_time,
          status: session.session_status,
          trustedFriend: session.trustedFriend?.first_name,
          checkInCount: session.check_in_count,
          sosActivated: session.sos_activated,
          duration: session.share_duration_minutes,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

/**
 * Get local emergency number based on location
 * @param {number} latitude
 * @param {number} longitude
 */
async function getLocalEmergencyNumber(latitude, longitude) {
  // This is a simplified version - in production, use geolocation API
  // to determine country and return appropriate emergency number
  const emergencyNumbers = {
    'US': '911',
    'UK': '999',
    'EU': '112',
    'CA': '911',
    'AU': '000',
    'IN': '112',
    'MX': '911',
    'BR': '190',
  };

  // For now, return US number as default
  return emergencyNumbers['US'];
}

/**
 * Reverse geocode coordinates to address
 * @param {number} latitude
 * @param {number} longitude
 */
async function reverseGeocodeLocation(latitude, longitude) {
  // This would integrate with a mapping service like Google Maps or Mapbox
  // For now, return coordinates
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

module.exports = dateSafetyService;
