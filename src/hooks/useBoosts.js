/**
 * useBoosts Hook
 * Manages profile boost data and operations
 */

import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

const API_URL = `${API_BASE_URL}/boosts`;

export const useBoosts = () => {
  const [packages, setPackages] = useState([]);
  const [bulkPricing, setBulkPricing] = useState([]);
  const [activeBoosts, setActiveBoosts] = useState([]);
  const [boostHistory, setBoostHistory] = useState([]);
  const [currentAnalytics, setCurrentAnalytics] = useState(null);
  const [canUseBoosts, setCanUseBoosts] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch boost packages
   */
  const fetchPackages = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/packages`);

      if (response.data.success) {
        setPackages(response.data.packages || []);
        setBulkPricing(response.data.bulkPricing || []);
        return response.data;
      }
    } catch (err) {
      console.error('Error fetching boost packages:', err);
    }
  }, []);

  /**
   * Calculate pricing
   */
  const calculatePrice = useCallback(async (type, quantity = 1) => {
    try {
      const response = await axios.get(`${API_URL}/pricing`, {
        params: { type, quantity }
      });

      if (response.data.success) {
        return response.data.pricing;
      }
    } catch (err) {
      console.error('Error calculating price:', err);
      return null;
    }
  }, []);

  /**
   * Purchase a boost
   */
  const purchaseBoost = useCallback(async (boostType, smartSchedule = true, scheduledTime = null) => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        `${API_URL}/purchase`,
        {
          type: boostType,
          smartSchedule,
          scheduledTime
        },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data.success) {
        await fetchActiveBoosts();
        await fetchHistory();
        return { success: true, boost: response.data.boost };
      } else {
        setError(response.data.message);
        return { success: false, message: response.data.message };
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to purchase boost';
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch active boosts
   */
  const fetchActiveBoosts = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/active`, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data.success) {
        setActiveBoosts(response.data.boosts || []);
        return response.data.boosts;
      }
    } catch (err) {
      console.error('Error fetching active boosts:', err);
    }
  }, []);

  /**
   * Fetch boost history
   */
  const fetchHistory = useCallback(async (limit = 20) => {
    try {
      const response = await axios.get(`${API_URL}/history`, {
        params: { limit },
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data.success) {
        setBoostHistory(response.data.boosts || []);
        return response.data.boosts;
      }
    } catch (err) {
      console.error('Error fetching boost history:', err);
    }
  }, []);

  /**
   * Get boost analytics
   */
  const getAnalytics = useCallback(async (boostId) => {
    try {
      const response = await axios.get(`${API_URL}/${boostId}/analytics`, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data.success) {
        setCurrentAnalytics(response.data.analytics);
        return response.data.analytics;
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      return null;
    }
  }, []);

  /**
   * Cancel boost
   */
  const cancelBoost = useCallback(async (boostId) => {
    try {
      const response = await axios.post(`${API_URL}/${boostId}/cancel`, {});

      if (response.data.success) {
        await fetchActiveBoosts();
        await fetchHistory();
        return { success: true, message: response.data.message, refund: response.data.refund };
      } else {
        return { success: false, message: response.data.message };
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to cancel boost';
      return { success: false, message: errorMsg };
    }
  }, [fetchActiveBoosts, fetchHistory]);

  /**
   * Check eligibility
   */
  const checkEligibility = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/eligibility`);

      if (response.data.success) {
        setCanUseBoosts(response.data.canUseBoosts);
        return response.data.canUseBoosts;
      }
    } catch (err) {
      console.error('Error checking eligibility:', err);
      return false;
    }
  }, []);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    const init = async () => {
      await fetchPackages();
      await checkEligibility();
      if (canUseBoosts) {
        await fetchActiveBoosts();
        await fetchHistory();
      }
    };

    init();
  }, []);

  /**
   * Refetch all data
   */
  const refetch = useCallback(async () => {
    await checkEligibility();
    if (canUseBoosts) {
      await fetchActiveBoosts();
      await fetchHistory();
    }
  }, [canUseBoosts, checkEligibility, fetchActiveBoosts, fetchHistory]);

  return {
    // Data
    packages,
    bulkPricing,
    activeBoosts,
    boostHistory,
    currentAnalytics,
    canUseBoosts,
    loading,
    error,

    // Methods
    fetchPackages,
    calculatePrice,
    purchaseBoost,
    fetchActiveBoosts,
    fetchHistory,
    getAnalytics,
    cancelBoost,
    checkEligibility,
    refetch
  };
};

export default useBoosts;
