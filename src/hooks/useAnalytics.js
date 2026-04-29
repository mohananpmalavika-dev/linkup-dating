import { useState, useCallback, useEffect } from 'react';
import analyticsService from '../services/analyticsService';

/**
 * useAnalytics Hook
 * Manages analytics dashboard data and operations
 * Provides personal stats, performance metrics, recommendations, and trends
 */
const useAnalytics = () => {
  const [personalStats, setPersonalStats] = useState(null);
  const [profilePerformance, setProfilePerformance] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all analytics data
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [stats, performance, recommendations, comparison] = await Promise.all([
        analyticsService.getPersonalStats(),
        analyticsService.getProfilePerformance(),
        analyticsService.getRecommendations(),
        analyticsService.getProfileComparison()
      ]);

      setPersonalStats(stats);
      setProfilePerformance(performance);
      setRecommendations(recommendations);
      setComparison(comparison);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err.message || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch personal stats only
  const fetchPersonalStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const stats = await analyticsService.getPersonalStats();
      setPersonalStats(stats);
    } catch (err) {
      console.error('Error fetching personal stats:', err);
      setError(err.message || 'Failed to fetch personal stats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch profile performance only
  const fetchProfilePerformance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const performance = await analyticsService.getProfilePerformance();
      setProfilePerformance(performance);
    } catch (err) {
      console.error('Error fetching performance:', err);
      setError(err.message || 'Failed to fetch performance data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch monthly report
  const fetchMonthlyReport = useCallback(async (year, month) => {
    try {
      setLoading(true);
      setError(null);
      const report = await analyticsService.getMonthlyReport(year, month);
      setMonthlyReport(report);
    } catch (err) {
      console.error('Error fetching monthly report:', err);
      setError(err.message || 'Failed to fetch monthly report');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch recommendations only
  const fetchRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const recs = await analyticsService.getRecommendations();
      setRecommendations(recs);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError(err.message || 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Derived stats for quick access
  const matchRatePercentage = personalStats?.stats?.matchRate || 0;
  const industryAverageMatchRate = personalStats?.stats?.industryAverageMatchRate || 0;
  const profileViews = personalStats?.stats?.profileViews || 0;
  const likesReceived = personalStats?.stats?.likesReceived || 0;
  const matchesMade = personalStats?.stats?.matchesMade || 0;
  const performancePercentage = profilePerformance?.performance?.percentageAboveAverage || 0;
  const recommendationCount = recommendations?.recommendations?.length || 0;

  return {
    // Data
    personalStats,
    profilePerformance,
    recommendations,
    comparison,
    monthlyReport,
    loading,
    error,

    // Methods
    fetchAnalytics,
    fetchPersonalStats,
    fetchProfilePerformance,
    fetchMonthlyReport,
    fetchRecommendations,

    // Derived stats (quick access)
    matchRatePercentage,
    industryAverageMatchRate,
    profileViews,
    likesReceived,
    matchesMade,
    performancePercentage,
    recommendationCount,

    // Helpers
    isLoading: loading,
    hasError: !!error
  };
};

export default useAnalytics;
