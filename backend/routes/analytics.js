const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const DatingAnalyticsService = require('../services/datingAnalyticsService');

/**
 * GET /api/analytics/personal-stats
 * Get user's personal match rate and performance stats
 */
router.get('/personal-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await DatingAnalyticsService.getPersonalStats(userId);
    
    if (!result.success) {
      return res.status(404).json({ error: result.message });
    }
    
    res.json(result.stats);
  } catch (error) {
    console.error('Error fetching personal stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/profile-performance
 * Get profile performance vs industry average
 */
router.get('/profile-performance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await DatingAnalyticsService.getProfilePerformance(userId);
    
    if (!result.success) {
      return res.status(404).json({ error: result.message });
    }
    
    res.json(result.performance);
  } catch (error) {
    console.error('Error fetching profile performance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/monthly-report
 * Get monthly report with trends (query: year, month)
 */
router.get('/monthly-report', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const year = req.query.year || new Date().getFullYear();
    const month = req.query.month || new Date().getMonth() + 1;
    
    const result = await DatingAnalyticsService.getMonthlyReport(userId, year, month);
    
    if (!result.success) {
      return res.status(404).json({ error: result.message });
    }
    
    res.json(result.report);
  } catch (error) {
    console.error('Error fetching monthly report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/recommendations
 * Get personalized recommendations
 */
router.get('/recommendations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await DatingAnalyticsService.getRecommendations(userId);
    
    if (!result.success) {
      return res.status(404).json({ error: result.message });
    }
    
    res.json(result.recommendations);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/profile-comparison
 * Get profile comparison with benchmarks
 */
router.get('/profile-comparison', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await DatingAnalyticsService.getProfileComparison(userId);
    
    if (!result.success) {
      return res.status(404).json({ error: result.message });
    }
    
    res.json(result.comparison);
  } catch (error) {
    console.error('Error fetching profile comparison:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/dashboard
 * Get complete analytics dashboard (combines personal stats, performance, and recommendations)
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [
      statsResult,
      performanceResult,
      recommendationsResult,
      comparisonResult
    ] = await Promise.all([
      DatingAnalyticsService.getPersonalStats(userId),
      DatingAnalyticsService.getProfilePerformance(userId),
      DatingAnalyticsService.getRecommendations(userId),
      DatingAnalyticsService.getProfileComparison(userId)
    ]);
    
    if (!statsResult.success) {
      return res.status(404).json({ error: 'Unable to fetch dashboard data' });
    }
    
    res.json({
      personalStats: statsResult.stats,
      profilePerformance: performanceResult.performance || {},
      recommendations: recommendationsResult.recommendations || [],
      comparison: comparisonResult.comparison || {}
    });
  } catch (error) {
    console.error('Error fetching analytics dashboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
