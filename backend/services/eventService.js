/**
 * Event Service
 * Business logic for interest-based group events
 */

const { Op, Sequelize } = require('sequelize');
const db = require('../config/database');
const { DatingEvent, EventAttendees, User, Interest, DatingProfile } = require('../models');

const EVENT_CONFIG = {
  DEFAULT_PRIVACY_BUFFER_METERS: 500,
  DEFAULT_MAX_ATTENDEES: 50,
  DEFAULT_EVENT_DURATION_MINUTES: 120,
  LOCATION_SEARCH_RADIUS_KM: 50,
  ANALYTICS_WINDOW_DAYS: 7,
  UPCOMING_DAYS_LIMIT: 90
};

class EventService {
  /**
   * Create a new event under an interest
   */
  static async createEvent(userId, eventData) {
    try {
      // Verify user and interest exist
      const user = await User.findByPk(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      const interest = await Interest.findByPk(eventData.interest_id);
      if (!interest) {
        return { success: false, message: 'Interest not found' };
      }

      // Create event with transaction
      const event = await DatingEvent.create({
        creator_id: userId,
        interest_id: eventData.interest_id,
        event_name: eventData.event_name,
        event_description: eventData.event_description,
        event_category: eventData.event_category || 'other',
        location_address: eventData.location_address,
        location_latitude: eventData.location_latitude,
        location_longitude: eventData.location_longitude,
        privacy_buffer_meters: eventData.privacy_buffer_meters || EVENT_CONFIG.DEFAULT_PRIVACY_BUFFER_METERS,
        event_date: eventData.event_date,
        event_time_start: eventData.event_time_start,
        event_time_end: eventData.event_time_end,
        duration_minutes: eventData.duration_minutes || EVENT_CONFIG.DEFAULT_EVENT_DURATION_MINUTES,
        max_attendees: eventData.max_attendees || EVENT_CONFIG.DEFAULT_MAX_ATTENDEES,
        status: eventData.publish ? 'published' : 'draft',
        age_restriction_min: eventData.age_restriction_min,
        age_restriction_max: eventData.age_restriction_max,
        gender_preference: eventData.gender_preference || 'any',
        outdoor: eventData.outdoor || false,
        free_event: eventData.free_event !== false,
        entry_fee: eventData.entry_fee,
        event_photo_url: eventData.event_photo_url,
        hashtags: eventData.hashtags || []
      });

      // Auto-RSVP creator as attending
      await EventAttendees.create({
        event_id: event.id,
        user_id: userId,
        status: 'attending'
      });

      event.current_attendee_count = 1;
      await event.save();

      return {
        success: true,
        event: {
          id: event.id,
          name: event.event_name,
          date: event.event_date,
          time: event.event_time_start,
          location: event.location_address,
          status: event.status,
          message: 'Event created successfully'
        }
      };
    } catch (error) {
      console.error('Error creating event:', error);
      return { success: false, message: 'Failed to create event', error: error.message };
    }
  }

  /**
   * Get event details with attendees
   */
  static async getEventDetails(eventId, userId = null) {
    try {
      const event = await DatingEvent.findByPk(eventId, {
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'first_name', 'last_name', 'avatar_url']
          },
          {
            model: Interest,
            as: 'interest',
            attributes: ['id', 'name', 'icon_url']
          }
        ]
      });

      if (!event) {
        return { success: false, message: 'Event not found' };
      }

      // Track view if userId provided
      if (userId) {
        await event.increment('views_count');
      }

      // Get attendees with privacy considerations
      const attendees = await EventAttendees.findAll({
        where: { event_id: eventId, status: { [Op.in]: ['attending', 'interested'] } },
        include: [
          {
            model: User,
            attributes: ['id', 'first_name', 'last_name', 'avatar_url', 'age']
          }
        ],
        limit: 50
      });

      // User's RSVP status
      let userRsvpStatus = null;
      if (userId) {
        const userAttendance = await EventAttendees.findOne({
          where: { event_id: eventId, user_id: userId }
        });
        userRsvpStatus = userAttendance ? userAttendance.status : null;
      }

      return {
        success: true,
        event: {
          ...event.toJSON(),
          attendees: attendees.map(a => ({
            user_id: a.User.id,
            name: `${a.User.first_name} ${a.User.last_name}`,
            avatar: a.User.avatar_url,
            age: a.User.age,
            status: a.status
          })),
          userRsvpStatus,
          attendeeCount: event.current_attendee_count,
          interestedCount: event.interested_count
        }
      };
    } catch (error) {
      console.error('Error getting event details:', error);
      return { success: false, message: 'Failed to get event details' };
    }
  }

  /**
   * RSVP to event (interested, attending, or decline)
   */
  static async rsvpEvent(userId, eventId, status = 'interested') {
    try {
      const event = await DatingEvent.findByPk(eventId);
      if (!event) {
        return { success: false, message: 'Event not found' };
      }

      // Check capacity if confirming attendance
      if (status === 'attending' && event.max_attendees) {
        const attendingCount = await EventAttendees.count({
          where: { event_id: eventId, status: 'attending' }
        });
        if (attendingCount >= event.max_attendees) {
          return { success: false, message: 'Event is full' };
        }
      }

      // Find or create attendance record
      let attendance = await EventAttendees.findOne({
        where: { event_id: eventId, user_id: userId }
      });

      if (attendance) {
        // Update existing
        const oldStatus = attendance.status;
        attendance.status = status;
        await attendance.save();

        // Update counts
        if (oldStatus === 'interested' && status === 'attending') {
          event.interested_count--;
          event.current_attendee_count++;
        } else if (oldStatus === 'attending' && status === 'interested') {
          event.interested_count++;
          event.current_attendee_count--;
        } else if (oldStatus !== 'declined' && status === 'declined') {
          if (oldStatus === 'attending') event.current_attendee_count--;
          else event.interested_count--;
        } else if (oldStatus === 'declined') {
          if (status === 'attending') event.current_attendee_count++;
          else event.interested_count++;
        }
      } else {
        // Create new
        attendance = await EventAttendees.create({
          event_id: eventId,
          user_id: userId,
          status
        });

        if (status === 'attending') {
          event.current_attendee_count++;
        } else if (status === 'interested') {
          event.interested_count++;
        }
      }

      await event.save();

      return {
        success: true,
        message: `Successfully marked as ${status}`,
        rsvpStatus: status,
        attendeeCount: event.current_attendee_count,
        interestedCount: event.interested_count
      };
    } catch (error) {
      console.error('Error RSVP to event:', error);
      return { success: false, message: 'Failed to RSVP' };
    }
  }

  /**
   * Find events near user's location (by interest or category)
   */
  static async getNearbyEvents(userId, latitude, longitude, filters = {}) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Build query
      let where = {
        status: 'published',
        event_date: {
          [Op.gte]: new Date()
        }
      };

      // Location filter (using haversine distance)
      if (latitude && longitude) {
        const searchRadiusKm = filters.radius_km || EVENT_CONFIG.LOCATION_SEARCH_RADIUS_KM;
        const earthRadiusKm = 6371;
        const latOffset = searchRadiusKm / earthRadiusKm;
        const lonOffset = searchRadiusKm / (earthRadiusKm * Math.cos(latitude * Math.PI / 180));

        where = {
          ...where,
          location_latitude: {
            [Op.between]: [latitude - latOffset, latitude + latOffset]
          },
          location_longitude: {
            [Op.between]: [longitude - lonOffset, longitude + lonOffset]
          }
        };
      }

      // Filter by interest
      if (filters.interest_id) {
        where.interest_id = filters.interest_id;
      }

      // Filter by category
      if (filters.category) {
        where.event_category = filters.category;
      }

      // Filter by date range
      if (filters.start_date) {
        where.event_date = { [Op.gte]: filters.start_date };
      }
      if (filters.end_date) {
        where.event_date = {
          ...where.event_date,
          [Op.lte]: filters.end_date
        };
      }

      // Filter by availability
      if (filters.available_only) {
        where = {
          ...where,
          [Op.where]: Sequelize.where(
            Sequelize.fn('COALESCE', Sequelize.col('max_attendees'), 9999),
            Op.gt,
            Sequelize.col('current_attendee_count')
          )
        };
      }

      const events = await DatingEvent.findAll({
        where,
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'first_name', 'last_name', 'avatar_url']
          },
          {
            model: Interest,
            as: 'interest',
            attributes: ['id', 'name', 'icon_url']
          }
        ],
        order: [
          ['event_date', 'ASC'],
          ['event_time_start', 'ASC']
        ],
        limit: filters.limit || 20,
        offset: filters.offset || 0
      });

      // Calculate distance for each event
      const eventsWithDistance = events.map(event => {
        const distance = this._calculateDistance(
          latitude,
          longitude,
          parseFloat(event.location_latitude),
          parseFloat(event.location_longitude)
        );

        return {
          ...event.toJSON(),
          distance_km: Math.round(distance * 100) / 100,
          spotsAvailable: event.max_attendees
            ? event.max_attendees - event.current_attendee_count
            : null
        };
      });

      // Sort by distance
      if (latitude && longitude) {
        eventsWithDistance.sort((a, b) => a.distance_km - b.distance_km);
      }

      return {
        success: true,
        events: eventsWithDistance,
        total: eventsWithDistance.length
      };
    } catch (error) {
      console.error('Error getting nearby events:', error);
      return { success: false, message: 'Failed to fetch events' };
    }
  }

  /**
   * Get attendees of an event, filtering for single people near organizer
   */
  static async getEventAttendees(eventId, userId = null) {
    try {
      const event = await DatingEvent.findByPk(eventId);
      if (!event) {
        return { success: false, message: 'Event not found' };
      }

      // Get attending users
      const attendances = await EventAttendees.findAll({
        where: {
          event_id: eventId,
          status: 'attending'
        },
        include: [
          {
            model: User,
            attributes: ['id', 'first_name', 'last_name', 'age', 'avatar_url', 'bio']
          }
        ]
      });

      // Filter for single status and get profile info
      const attendees = await Promise.all(
        attendances.map(async (attendance) => {
          const profile = await DatingProfile.findOne({
            where: { user_id: attendance.User.id }
          });

          return {
            user_id: attendance.User.id,
            name: `${attendance.User.first_name} ${attendance.User.last_name}`,
            age: attendance.User.age,
            avatar: attendance.User.avatar_url,
            bio: attendance.User.bio,
            status: profile?.relationship_status || 'single'
          };
        })
      );

      // Filter for single/looking for relationship
      const singleAttendees = attendees.filter(a =>
        a.status === 'single' || a.status === 'looking'
      );

      return {
        success: true,
        attendees: singleAttendees,
        totalAttending: attendances.length
      };
    } catch (error) {
      console.error('Error getting event attendees:', error);
      return { success: false, message: 'Failed to get attendees' };
    }
  }

  /**
   * Get events user has RSVP'd to
   */
  static async getUserEvents(userId, status = null, limit = 20, offset = 0) {
    try {
      const where = { user_id: userId };
      if (status) {
        where.status = status;
      }

      const attendances = await EventAttendees.findAll({
        where,
        include: [
          {
            model: DatingEvent,
            include: [
              { model: User, as: 'creator', attributes: ['first_name', 'last_name'] },
              { model: Interest, as: 'interest', attributes: ['name', 'icon_url'] }
            ]
          }
        ],
        order: [[{ model: DatingEvent }, 'event_date', 'ASC']],
        limit,
        offset
      });

      return {
        success: true,
        events: attendances.map(a => ({
          ...a.DatingEvent.toJSON(),
          userRsvpStatus: a.status
        })),
        total: attendances.length
      };
    } catch (error) {
      console.error('Error getting user events:', error);
      return { success: false, message: 'Failed to get user events' };
    }
  }

  /**
   * Rate an event
   */
  static async rateEvent(userId, eventId, rating, review = '') {
    try {
      const event = await DatingEvent.findByPk(eventId);
      if (!event) {
        return { success: false, message: 'Event not found' };
      }

      // Verify user attended
      const attendance = await EventAttendees.findOne({
        where: { event_id: eventId, user_id: userId }
      });

      if (!attendance) {
        return { success: false, message: 'Must attend event to rate' };
      }

      // Update event rating
      const currentTotal = event.total_ratings * (event.avg_rating || 0);
      const newAvg = (currentTotal + rating) / (event.total_ratings + 1);

      event.avg_rating = Math.round(newAvg * 100) / 100;
      event.total_ratings += 1;
      await event.save();

      return {
        success: true,
        avgRating: event.avg_rating,
        totalRatings: event.total_ratings,
        message: 'Event rated successfully'
      };
    } catch (error) {
      console.error('Error rating event:', error);
      return { success: false, message: 'Failed to rate event' };
    }
  }

  /**
   * Get event analytics
   */
  static async getEventAnalytics(userId, eventId) {
    try {
      const event = await DatingEvent.findByPk(eventId);
      if (!event) {
        return { success: false, message: 'Event not found' };
      }

      // Verify creator
      if (event.creator_id !== userId) {
        return { success: false, message: 'Unauthorized' };
      }

      const attendingCount = await EventAttendees.count({
        where: { event_id: eventId, status: 'attending' }
      });

      const interestedCount = await EventAttendees.count({
        where: { event_id: eventId, status: 'interested' }
      });

      return {
        success: true,
        analytics: {
          views: event.views_count,
          attendingCount,
          interestedCount,
          spotsAvailable: event.max_attendees
            ? event.max_attendees - attendingCount
            : null,
          avgRating: event.avg_rating,
          totalRatings: event.total_ratings,
          matchesGenerated: event.matches_generated
        }
      };
    } catch (error) {
      console.error('Error getting event analytics:', error);
      return { success: false, message: 'Failed to get analytics' };
    }
  }

  /**
   * Get all published events for a specific interest.
   * Uses the raw Postgres tables directly because the Sequelize event models
   * are currently behind the latest events schema.
   */
  static async getEventsByInterest(interestId, options = {}) {
    try {
      const normalizedInterestId = Number.parseInt(interestId, 10);

      if (!Number.isFinite(normalizedInterestId) || normalizedInterestId <= 0) {
        return { success: false, message: 'Invalid interest id' };
      }

      const limit = Math.max(1, Math.min(Number.parseInt(options.limit, 10) || 20, 100));
      const offset = Math.max(0, Number.parseInt(options.offset, 10) || 0);
      const sortBy = ['date', 'popularity', 'recent'].includes(options.sortBy) ? options.sortBy : 'date';

      const tableExistsResult = await db.query(
        `SELECT EXISTS (
           SELECT 1
           FROM information_schema.tables
           WHERE table_schema = 'public'
             AND table_name = 'dating_events'
         ) AS exists`
      );

      if (!tableExistsResult.rows[0]?.exists) {
        return {
          success: true,
          interestId: normalizedInterestId,
          events: [],
          total: 0,
          pagination: { limit, offset, hasMore: false }
        };
      }

      const orderByClause = {
        date: 'e.event_date ASC, e.event_time_start ASC NULLS LAST, e.id DESC',
        popularity: 'e.current_attendee_count DESC, e.interested_count DESC, e.event_date ASC, e.id DESC',
        recent: 'e.created_at DESC, e.id DESC'
      }[sortBy];

      const baseParams = [normalizedInterestId];
      const currentUserJoin =
        options.userId && Number.isFinite(Number(options.userId))
          ? 'LEFT JOIN event_attendees viewer_attendee ON viewer_attendee.event_id = e.id AND viewer_attendee.user_id = $2'
          : 'LEFT JOIN event_attendees viewer_attendee ON 1 = 0';

      if (options.userId && Number.isFinite(Number(options.userId))) {
        baseParams.push(Number(options.userId));
      }

      const countResult = await db.query(
        `SELECT COUNT(*)::int AS total
         FROM dating_events e
         WHERE e.interest_id = $1
           AND e.status = 'published'
           AND e.event_date >= CURRENT_DATE`,
        [normalizedInterestId]
      );

      const paginationParams = [...baseParams, limit, offset];
      const limitParamIndex = paginationParams.length - 1;
      const offsetParamIndex = paginationParams.length;

      const eventsResult = await db.query(
        `SELECT e.*,
                creator.first_name AS creator_first_name,
                creator.last_name AS creator_last_name,
                creator.avatar_url AS creator_avatar_url,
                viewer_attendee.status AS user_rsvp_status
         FROM dating_events e
         LEFT JOIN users creator ON creator.id = e.creator_id
         ${currentUserJoin}
         WHERE e.interest_id = $1
           AND e.status = 'published'
           AND e.event_date >= CURRENT_DATE
         ORDER BY ${orderByClause}
         LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
        paginationParams
      );

      const total = Number.parseInt(countResult.rows[0]?.total, 10) || 0;

      return {
        success: true,
        interestId: normalizedInterestId,
        events: eventsResult.rows.map((row) => ({
          ...row,
          creator: row.creator_first_name
            ? {
                first_name: row.creator_first_name,
                last_name: row.creator_last_name,
                avatar_url: row.creator_avatar_url
              }
            : null,
          userRsvpStatus: row.user_rsvp_status || null,
          spotsAvailable: row.max_attendees
            ? Math.max(0, Number(row.max_attendees) - Number(row.current_attendee_count || 0))
            : null
        })),
        total,
        pagination: {
          limit,
          offset,
          hasMore: offset + eventsResult.rows.length < total
        }
      };
    } catch (error) {
      console.error('Error getting events by interest:', error);
      return { success: false, message: 'Failed to get events by interest' };
    }
  }

  /**
   * Helper: Calculate distance between two coordinates (Haversine formula)
   */
  static _calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get recommended events based on user interests
   */
  static async getRecommendedEvents(userId) {
    try {
      const user = await User.findByPk(userId, {
        include: [
          {
            model: Interest,
            through: { attributes: [] },
            attributes: ['id']
          }
        ]
      });

      if (!user || !user.Interests || user.Interests.length === 0) {
        return { success: true, events: [] };
      }

      const interestIds = user.Interests.map(i => i.id);

      const events = await DatingEvent.findAll({
        where: {
          interest_id: { [Op.in]: interestIds },
          status: 'published',
          event_date: { [Op.gte]: new Date() }
        },
        include: [
          { model: User, as: 'creator', attributes: ['first_name', 'last_name'] },
          { model: Interest, as: 'interest', attributes: ['name'] }
        ],
        order: [['event_date', 'ASC']],
        limit: 10
      });

      return {
        success: true,
        events: events.map(e => ({
          ...e.toJSON(),
          recommendedReason: `Matching your interest: ${e.Interest.name}`
        }))
      };
    } catch (error) {
      console.error('Error getting recommended events:', error);
      return { success: false, message: 'Failed to get recommendations' };
    }
  }
}

module.exports = EventService;
