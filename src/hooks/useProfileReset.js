/**
 * useProfileReset Hook
 * Manages profile reset state and actions
 */

import { useState, useCallback, useEffect } from 'react';
import apiClient from '../services/apiClient';

export const useProfileReset = () => {
  const [resetStatus, setResetStatus] = useState(null);
  const [featureInfo, setFeatureInfo] = useState(null);
  const [history, setHistory] = useState(null);
  const [impact, setImpact] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Get feature info
   */
  const getFeatureInfo = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/api/profile-reset/info');
      setFeatureInfo(data.feature);
      setError(null);
      return data.feature;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to get feature info';
      setError(errorMsg);
      console.error('Error fetching feature info:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Check reset status
   */
  const checkResetStatus = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/api/profile-reset/status');

      if (data.success) {
        setResetStatus(data.status);
        setError(null);
      }
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to check status';
      setError(errorMsg);
      console.error('Error checking reset status:', err);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initiate profile reset
   */
  const initiateReset = useCallback(async (reason = '') => {
    try {
      setLoading(true);
      const { data } = await apiClient.post('/api/profile-reset/reset', { reason });

      if (data.success) {
        setError(null);
        await checkResetStatus();
      }
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to reset profile';
      setError(errorMsg);
      console.error('Error initiating reset:', err);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [checkResetStatus]);

  /**
   * Get reset history
   */
  const getHistory = useCallback(async (limit = 10) => {
    try {
      setLoading(true);
      const { data } = await apiClient.get(`/api/profile-reset/history?limit=${limit}`);

      if (data.success) {
        setHistory(data.history);
        setError(null);
      }
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to fetch history';
      setError(errorMsg);
      console.error('Error getting history:', err);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get reset impact
   */
  const getImpact = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/api/profile-reset/impact');

      if (data.success) {
        setImpact(data.impact);
        setError(null);
      }
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to get impact';
      setError(errorMsg);
      console.error('Error getting impact:', err);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get reset statistics
   */
  const getStats = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/api/profile-reset/stats');

      if (data.success) {
        setStats(data.stats);
        setError(null);
      }
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to get stats';
      setError(errorMsg);
      console.error('Error getting stats:', err);
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch all data on mount
   */
  useEffect(() => {
    const fetchInitialData = async () => {
      await Promise.all([
        getFeatureInfo(),
        checkResetStatus(),
        getStats()
      ]);
    };

    fetchInitialData();
  }, []);

  return {
    // State
    resetStatus,
    featureInfo,
    history,
    impact,
    stats,
    loading,
    error,

    // Actions
    getFeatureInfo,
    checkResetStatus,
    initiateReset,
    getHistory,
    getImpact,
    getStats
  };
};

export default useProfileReset;
