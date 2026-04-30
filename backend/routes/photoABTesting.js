const express = require('express');
const router = express.Router();
const photoABTestService = require('../services/photoABTestService');
const { authenticateToken } = require('../middleware/auth');

/**
 * POST /api/photo-ab-testing
 * Create a new A/B test
 * Body: { photoAId, photoBId, testName?, durationHours? }
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { photoAId, photoBId, testName, durationHours = 48 } = req.body;
    const userId = req.user.id;

    if (!photoAId || !photoBId) {
      return res.status(400).json({ error: 'photoAId and photoBId are required' });
    }

    if (photoAId === photoBId) {
      return res.status(400).json({ error: 'Photos must be different' });
    }

    if (durationHours && (durationHours < 1 || durationHours > 720)) {
      return res.status(400).json({ error: 'Duration must be between 1 and 720 hours' });
    }

    const test = await photoABTestService.createTest(userId, photoAId, photoBId, testName, durationHours);
    
    res.status(201).json({
      success: true,
      message: 'A/B test created successfully',
      test
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/photo-ab-testing/user/all
 * Get all tests for the user with filters
 * Query: status?, limit?, offset?
 * MUST come BEFORE /:testId to avoid matching 'user' as testId
 */
router.get('/user/all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 10, offset = 0 } = req.query;

    const tests = await photoABTestService.getUserTests(
      userId,
      status,
      parseInt(limit),
      parseInt(offset)
    );
    
    res.json({
      success: true,
      tests,
      count: tests.length
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/photo-ab-testing/:testId
 * Get test details with current metrics
 */
router.get('/:testId', authenticateToken, async (req, res) => {
  try {
    const { testId } = req.params;
    const userId = req.user.id;

    const test = await photoABTestService.getTestDetails(parseInt(testId), userId);
    
    res.json({
      success: true,
      test
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/photo-ab-testing/:testId/results
 * Get detailed test results
 */
router.get('/:testId/results', authenticateToken, async (req, res) => {
  try {
    const { testId } = req.params;
    const userId = req.user.id;

    const results = await photoABTestService.getTestResults(parseInt(testId), userId);
    
    res.json({
      success: true,
      ...results
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/photo-ab-testing/:testId/insights
 * Get insights and recommendations from test
 */
router.get('/:testId/insights', authenticateToken, async (req, res) => {
  try {
    const { testId } = req.params;
    const userId = req.user.id;

    const insights = await photoABTestService.getTestInsights(parseInt(testId), userId);
    
    res.json({
      success: true,
      insights
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/photo-ab-testing/:testId/like
 * Record a like for a test
 * Body: { photoId, photoVersion }
 */
router.post('/:testId/like', authenticateToken, async (req, res) => {
  try {
    const { testId } = req.params;
    const { photoId, photoVersion } = req.body;
    const likerUserId = req.user.id;

    if (!photoId || !photoVersion) {
      return res.status(400).json({ error: 'photoId and photoVersion are required' });
    }

    if (!['A', 'B'].includes(photoVersion)) {
      return res.status(400).json({ error: 'photoVersion must be A or B' });
    }

    const test = await photoABTestService.recordLike(parseInt(testId), likerUserId, photoId, photoVersion);
    
    res.json({
      success: true,
      message: 'Like recorded',
      test
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/photo-ab-testing/:testId/view
 * Record a view/profile visit for a test
 * Body: { photoVersion }
 */
router.post('/:testId/view', authenticateToken, async (req, res) => {
  try {
    const { testId } = req.params;
    const { photoVersion } = req.body;
    const viewerUserId = req.user.id;

    if (!photoVersion) {
      return res.status(400).json({ error: 'photoVersion is required' });
    }

    if (!['A', 'B'].includes(photoVersion)) {
      return res.status(400).json({ error: 'photoVersion must be A or B' });
    }

    const test = await photoABTestService.recordView(parseInt(testId), viewerUserId, photoVersion);
    
    res.json({
      success: true,
      message: 'View recorded',
      test
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/photo-ab-testing/:testId/pause
 * Pause a test
 */
router.put('/:testId/pause', authenticateToken, async (req, res) => {
  try {
    const { testId } = req.params;
    const userId = req.user.id;

    const test = await photoABTestService.pauseTest(parseInt(testId), userId);
    
    res.json({
      success: true,
      message: 'Test paused',
      test
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/photo-ab-testing/:testId/resume
 * Resume a paused test
 */
router.put('/:testId/resume', authenticateToken, async (req, res) => {
  try {
    const { testId } = req.params;
    const userId = req.user.id;

    const test = await photoABTestService.resumeTest(parseInt(testId), userId);
    
    res.json({
      success: true,
      message: 'Test resumed',
      test
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/photo-ab-testing/:testId/end
 * End a test early and determine winner
 */
router.put('/:testId/end', authenticateToken, async (req, res) => {
  try {
    const { testId } = req.params;
    const userId = req.user.id;

    const test = await photoABTestService.endTestEarly(parseInt(testId), userId);
    
    res.json({
      success: true,
      message: 'Test ended',
      test
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
