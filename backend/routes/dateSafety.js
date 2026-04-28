const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const dateSafetyService = require('../services/dateSafetyService');

// All routes require authentication
router.use(authenticateUser);

/**
 * POST /api/date-safety/start-session
 * Start a new date safety session
 */
router.post('/start-session', async (req, res) => {
  try {
    const { trustedFriendId, matchId, durationMinutes } = req.body;
    const userId = req.user.id;

    if (!trustedFriendId) {
      return res.status(400).json({ error: 'trustedFriendId is required' });
    }

    const result = await dateSafetyService.startSafetySession(
      userId,
      trustedFriendId,
      matchId,
      durationMinutes
    );

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/date-safety/update-location
 * Update live location during session
 */
router.post('/update-location', async (req, res) => {
  try {
    const { sessionId, latitude, longitude } = req.body;

    if (!sessionId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ 
        error: 'sessionId, latitude, and longitude are required' 
      });
    }

    const result = await dateSafetyService.updateLiveLocation(
      sessionId,
      latitude,
      longitude
    );

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/date-safety/check-in
 * Send a check-in message
 */
router.post('/check-in', async (req, res) => {
  try {
    const { sessionId, status, message } = req.body;

    if (!sessionId || !status) {
      return res.status(400).json({ 
        error: 'sessionId and status are required' 
      });
    }

    const result = await dateSafetyService.sendCheckIn(
      sessionId,
      status,
      message
    );

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/date-safety/sos
 * Activate SOS emergency button
 */
router.post('/sos', async (req, res) => {
  try {
    const { sessionId, latitude, longitude } = req.body;

    if (!sessionId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ 
        error: 'sessionId, latitude, and longitude are required' 
      });
    }

    const result = await dateSafetyService.activateSOS(
      sessionId,
      latitude,
      longitude
    );

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/date-safety/end-session
 * End the current safety session
 */
router.post('/end-session', async (req, res) => {
  try {
    const { sessionId, notes } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const result = await dateSafetyService.endSafetySession(
      sessionId,
      notes
    );

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/date-safety/session/:sessionId
 * Get active session details
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await dateSafetyService.getSessionDetails(sessionId);

    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/date-safety/shared-location/:sessionId
 * Get shared location (for trusted friend)
 */
router.get('/shared-location/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const trustedFriendId = req.user.id;

    const result = await dateSafetyService.getSharedLocation(
      sessionId,
      trustedFriendId
    );

    return res.status(result.success ? 200 : 403).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/date-safety/safety-tips
 * Get safety tips
 */
router.get('/safety-tips', async (req, res) => {
  try {
    const result = await dateSafetyService.getSafetyTips();
    return res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/date-safety/acknowledge-tips
 * Acknowledge safety tips
 */
router.post('/acknowledge-tips', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const result = await dateSafetyService.acknowledgeSafetyTips(sessionId);

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/date-safety/history
 * Get user's session history
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit } = req.query;

    const result = await dateSafetyService.getSessionHistory(
      userId,
      limit ? parseInt(limit) : 10
    );

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
