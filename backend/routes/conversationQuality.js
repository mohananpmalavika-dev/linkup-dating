const express = require('express');
const router = express.Router();
const conversationQualityService = require('../services/conversationQualityService');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/conversation-quality/:matchId
 * Get conversation quality metrics for a specific match
 */
router.get('/:matchId', authenticateToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const quality = await conversationQualityService.analyzeConversationQuality(
      matchId,
      userId
    );

    res.json(quality);
  } catch (error) {
    console.error('Error getting conversation quality:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/conversation-quality/:matchId/suggestions
 * Get AI-powered suggestions for the conversation
 */
router.get('/:matchId/suggestions', authenticateToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const suggestions = await conversationQualityService.generateSuggestions(
      matchId,
      userId
    );

    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/conversation-quality/:matchId/previous-suggestions
 * Get previously generated suggestions for a match
 */
router.get('/:matchId/previous-suggestions', authenticateToken, async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;
    const { limit = 5 } = req.query;

    const suggestions = await conversationQualityService.getPreviousSuggestions(
      matchId,
      userId,
      parseInt(limit)
    );

    res.json({ suggestions });
  } catch (error) {
    console.error('Error fetching previous suggestions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/conversation-quality/:matchId/suggestions/:suggestionId/use
 * Mark a suggestion as used
 */
router.post('/:matchId/suggestions/:suggestionId/use', authenticateToken, async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const { rating } = req.body;

    const suggestion = await conversationQualityService.markSuggestionUsed(
      suggestionId,
      rating
    );

    res.json({ success: true, suggestion });
  } catch (error) {
    console.error('Error marking suggestion used:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/conversation-quality/:matchId/insights
 * Get quality insights and interpretation
 */
router.get('/:matchId/insights', authenticateToken, async (req, res) => {
  try {
    const { matchId } = req.params;

    const insights = await conversationQualityService.getQualityInsights(matchId);

    res.json(insights);
  } catch (error) {
    console.error('Error getting insights:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
