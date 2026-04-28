/**
 * useIntroductions Hook
 * Manages introductions (Concierge Light) data and operations
 */

import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

const API_URL = `${API_BASE_URL}/introductions`;

export const useIntroductions = () => {
  const [introductions, setIntroductions] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    liked: 0,
    passed: 0,
    matched: 0,
    averageQuality: 0
  });
  const [eligible, setEligible] = useState(false);
  const [readyForNew, setReadyForNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch pending introductions
   */
  const fetchIntroductions = useCallback(async (status = 'pending', limit = 10) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(API_URL, {
        params: { status, limit },
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data.success) {
        setIntroductions(response.data.introductions || []);
        return response.data.introductions;
      } else {
        setError(response.data.message || 'Failed to fetch introductions');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch introductions';
      setError(errorMsg);
      console.error('Error fetching introductions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch intro statistics
   */
  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/stats`, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data.success) {
        setStats(response.data.stats || {});
        return response.data.stats;
      }
    } catch (err) {
      console.error('Error fetching intro stats:', err);
    }
  }, []);

  /**
   * Check eligibility for introductions
   */
  const checkEligibility = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/eligibility`, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data.success) {
        setEligible(response.data.eligible);
        setReadyForNew(response.data.readyForNewIntros);
        return {
          eligible: response.data.eligible,
          readyForNew: response.data.readyForNewIntros,
          message: response.data.message
        };
      }
    } catch (err) {
      console.error('Error checking eligibility:', err);
    }
  }, []);

  /**
   * Generate new introductions
   */
  const generateIntroductions = useCallback(async (count = 3) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        `${API_URL}/generate`,
        { count },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data.success) {
        await fetchIntroductions('pending');
        await fetchStats();
        setReadyForNew(false);
        return {
          success: true,
          introductions: response.data.introductions,
          message: response.data.message
        };
      } else {
        setError(response.data.message);
        return { success: false, message: response.data.message };
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to generate introductions';
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [fetchIntroductions, fetchStats]);

  /**
   * Respond to introduction (like/pass)
   */
  const respondToIntro = useCallback(async (introId, response, feedback = null) => {
    try {
      const result = await axios.post(
        `${API_URL}/${introId}/respond`,
        { response, feedback },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (result.data.success) {
        await fetchIntroductions('pending');
        await fetchStats();
        return { success: true, message: result.data.message };
      } else {
        return { success: false, message: result.data.message };
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to respond';
      console.error('Error responding to intro:', err);
      return { success: false, message: errorMsg };
    }
  }, [fetchIntroductions, fetchStats]);

  /**
   * Rate introduction
   */
  const rateIntroduction = useCallback(async (introId, rating, feedback = null) => {
    try {
      const result = await axios.post(
        `${API_URL}/${introId}/rate`,
        { rating, feedback },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (result.data.success) {
        await fetchStats();
        return { success: true, message: result.data.message };
      } else {
        return { success: false, message: result.data.message };
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to rate';
      console.error('Error rating intro:', err);
      return { success: false, message: errorMsg };
    }
  }, [fetchStats]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    const init = async () => {
      await checkEligibility();
      if (eligible) {
        await fetchIntroductions();
        await fetchStats();
      }
    };

    init();
  }, [eligible, checkEligibility, fetchIntroductions, fetchStats]);

  /**
   * Refetch all data
   */
  const refetch = useCallback(async () => {
    await checkEligibility();
    if (eligible) {
      await fetchIntroductions();
      await fetchStats();
    }
  }, [eligible, checkEligibility, fetchIntroductions, fetchStats]);

  return {
    // Data
    introductions,
    stats,
    eligible,
    readyForNew,
    loading,
    error,

    // Methods
    fetchIntroductions,
    fetchStats,
    checkEligibility,
    generateIntroductions,
    respondToIntro,
    rateIntroduction,
    refetch
  };
};

export default useIntroductions;
