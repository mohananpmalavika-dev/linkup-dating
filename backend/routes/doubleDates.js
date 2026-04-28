/**
 * Double Dates API Routes
 * Endpoints for managing double dates, friend verification, and group coordination
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const doubleDateService = require('../services/doubleDateService');

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/double-dates/request
 * Create a new double date request
 * Body: {
 *   matchId: number,
 *   friendId: number,
 *   friendMatchId: number,
 *   proposedDate?: string (ISO),
 *   proposedLocation?: string,
 *   proposedActivity?: string,
 *   message?: string
 * }
 */
router.post('/request', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await doubleDateService.createDoubleDateRequest(userId, req.body);
    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/double-dates/requests/pending
 * Get all pending double date requests for the user
 */
router.get('/requests/pending', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await doubleDateService.getPendingRequests(userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/double-dates/request/:requestId/approve
 * Approve a double date request
 */
router.post('/request/:requestId/approve', async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;
    const result = await doubleDateService.approveRequest(requestId, userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/double-dates/request/:requestId/reject
 * Reject a double date request
 */
router.post('/request/:requestId/reject', async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;
    const result = await doubleDateService.rejectRequest(requestId, userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/double-dates/groups
 * Get all active double date groups for the user
 */
router.get('/groups', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await doubleDateService.getActiveGroups(userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/double-dates/group/:groupId/complete
 * Mark a double date as completed
 */
router.post('/group/:groupId/complete', async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const result = await doubleDateService.markCompleted(groupId, userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error marking completed:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/double-dates/group/:groupId/rate
 * Rate a completed double date
 * Body: {
 *   overallRating: 1-5,
 *   ratingForUser2?: 1-5,
 *   ratingForFriend1?: 1-5,
 *   ratingForFriend2?: 1-5,
 *   review?: string,
 *   wouldDoAgain?: boolean
 * }
 */
router.post('/group/:groupId/rate', async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;

    // Validate overall rating
    if (!req.body.overallRating || req.body.overallRating < 1 || req.body.overallRating > 5) {
      return res.status(400).json({ success: false, message: 'Overall rating must be 1-5' });
    }

    const result = await doubleDateService.rateDoubleDate(groupId, userId, req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error rating double date:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/double-dates/friend-verification/enable
 * Enable friend verification (share match with a friend)
 * Body: {
 *   matchId: number,
 *   friendId: number
 * }
 */
router.post('/friend-verification/enable', async (req, res) => {
  try {
    const userId = req.user.id;
    const { matchId, friendId } = req.body;

    if (!matchId || !friendId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const result = await doubleDateService.enableFriendVerification(userId, matchId, friendId);
    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    console.error('Error enabling friend verification:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/double-dates/friend-verification/shared-with-me
 * Get all matches that friends have shared with you for verification
 */
router.get('/friend-verification/shared-with-me', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await doubleDateService.getFriendVerifications(userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching verifications:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/double-dates/friend-verification/:verificationId/respond
 * Respond to a friend verification (approve or reject with feedback)
 * Body: {
 *   approved: boolean,
 *   feedback?: string
 * }
 */
router.post('/friend-verification/:verificationId/respond', async (req, res) => {
  try {
    const userId = req.user.id;
    const { verificationId } = req.params;
    const { approved, feedback } = req.body;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ success: false, message: 'approved must be boolean' });
    }

    const result = await doubleDateService.respondToVerification(verificationId, userId, approved, feedback);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error responding to verification:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
