/**
 * Event Routes
 * Interest-based group events for organic meetups
 * 11 endpoints for event creation, discovery, and management
 */

const express = require('express');
const router = express.Router();
const eventService = require('../services/eventService');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

/**
 * 1. CREATE EVENT
 * POST /api/events
 * Create a new interest-based group event
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      interest_id,
      event_name,
      event_description,
      event_category,
      location_address,
      location_latitude,
      location_longitude,
      privacy_buffer_meters,
      event_date,
      event_time_start,
      event_time_end,
      duration_minutes,
      max_attendees,
      age_restriction_min,
      age_restriction_max,
      gender_preference,
      outdoor,
      free_event,
      entry_fee,
      event_photo_url,
      hashtags,
      publish
    } = req.body;

    // Validate required fields
    if (!interest_id || !event_name || !event_date || !event_time_start) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const result = await eventService.createEvent(userId, {
      interest_id,
      event_name,
      event_description,
      event_category,
      location_address,
      location_latitude,
      location_longitude,
      privacy_buffer_meters,
      event_date,
      event_time_start,
      event_time_end,
      duration_minutes,
      max_attendees,
      age_restriction_min,
      age_restriction_max,
      gender_preference,
      outdoor,
      free_event,
      entry_fee,
      event_photo_url,
      hashtags,
      publish
    });

    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 2. GET EVENT DETAILS
 * GET /api/events/:eventId
 * Get full event details with attendees
 */
router.get('/:eventId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId } = req.params;

    const result = await eventService.getEventDetails(eventId, userId);

    res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    console.error('Error getting event details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 3. LIST NEARBY EVENTS
 * GET /api/events/discover/nearby
 * Discover events near user's location
 * Query params: latitude, longitude, radius_km, interest_id, category, start_date, end_date, available_only, limit, offset
 */
router.get('/discover/nearby', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      latitude,
      longitude,
      radius_km,
      interest_id,
      category,
      start_date,
      end_date,
      available_only,
      limit,
      offset
    } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude required'
      });
    }

    const result = await eventService.getNearbyEvents(userId, parseFloat(latitude), parseFloat(longitude), {
      radius_km: radius_km ? parseInt(radius_km) : 50,
      interest_id,
      category,
      start_date,
      end_date,
      available_only: available_only === 'true',
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0
    });

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error discovering nearby events:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 4. GET RECOMMENDED EVENTS
 * GET /api/events/discover/recommended
 * Get events matching user's interests
 */
router.get('/discover/recommended', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await eventService.getRecommendedEvents(userId);

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error getting recommended events:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 5. RSVP TO EVENT
 * POST /api/events/:eventId/rsvp
 * RSVP to an event (interested, attending, or decline)
 * Body: { status: 'interested' | 'attending' | 'declined' }
 */
router.post('/:eventId/rsvp', async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId } = req.params;
    const { status = 'interested' } = req.body;

    if (!['interested', 'attending', 'declined'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid RSVP status'
      });
    }

    const result = await eventService.rsvpEvent(userId, eventId, status);

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error RSVP to event:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 6. GET EVENT ATTENDEES
 * GET /api/events/:eventId/attendees
 * Get list of attendees (filtered for single people)
 */
router.get('/:eventId/attendees', async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId } = req.params;

    const result = await eventService.getEventAttendees(eventId, userId);

    res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    console.error('Error getting event attendees:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 7. GET USER'S EVENTS
 * GET /api/events/my/list
 * Get all events user has RSVP'd to
 * Query params: status (interested|attending|declined), limit, offset
 */
router.get('/my/list', async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit, offset } = req.query;

    const result = await eventService.getUserEvents(
      userId,
      status,
      limit ? parseInt(limit) : 20,
      offset ? parseInt(offset) : 0
    );

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error getting user events:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 8. RATE EVENT
 * POST /api/events/:eventId/rate
 * Rate an event after attending
 * Body: { rating: 1-5, review: string }
 */
router.post('/:eventId/rate', async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId } = req.params;
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const result = await eventService.rateEvent(userId, eventId, rating, review);

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error rating event:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 9. GET EVENT ANALYTICS
 * GET /api/events/:eventId/analytics
 * Get event analytics (creator only)
 */
router.get('/:eventId/analytics', async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId } = req.params;

    const result = await eventService.getEventAnalytics(userId, eventId);

    res.status(result.success ? 200 : result.message === 'Unauthorized' ? 403 : 404).json(result);
  } catch (error) {
    console.error('Error getting event analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 10. GET EVENTS BY INTEREST
 * GET /api/events/interest/:interestId
 * Get all events under an interest
 * Query params: limit, offset, sort_by (date|popularity|recent)
 */
router.get('/interest/:interestId', async (req, res) => {
  try {
    const { interestId } = req.params;
    const { limit = 20, offset = 0, sort_by = 'date' } = req.query;

    // This would call a service method to get events by interest
    // For now returning placeholder
    res.status(200).json({
      success: true,
      events: [],
      message: 'Feature coming soon'
    });
  } catch (error) {
    console.error('Error getting events by interest:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 11. GET MATCHING SINGLE ATTENDEES
 * GET /api/events/:eventId/singles
 * Get single attendees at event for potential matches
 * Returns non-binding interest data
 */
router.get('/:eventId/singles', async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId } = req.params;

    const result = await eventService.getEventAttendees(eventId, userId);

    // Filter further for singles (already done in service)
    res.status(result.success ? 200 : 404).json({
      ...result,
      message: 'Single attendees at this event'
    });
  } catch (error) {
    console.error('Error getting single attendees:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
