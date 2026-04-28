/**
 * usePreferences Hook
 * Manages preferences priority subscription state and actions
 */

import { useState, useCallback, useEffect } from 'react';
import apiClient from '../services/apiClient';

export const usePreferences = () => {
  const [priorityStatus, setPriorityStatus] = useState(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Get subscription info
   */
  const getSubscriptionInfo = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/api/preferences-priority/info');
      setSubscriptionInfo(data.subscription);
      setError(null);
      return data.subscription;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to get subscription info';
      setError(errorMsg);
      console.error('Error fetching subscription info:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Check priority status
   */
  const checkPriorityStatus = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/api/preferences-priority/status');

      if (data.success) {
        setPriorityStatus(data);
        setError(null);
      }
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to check status';
      setError(errorMsg);
      console.error('Error checking priority status:', err);
      return { success: false, hasSubscription: false };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Check eligibility
   */
  const checkEligibility = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/api/preferences-priority/eligibility');

      if (data.success) {
        setEligibility(data);
        setError(null);
      }
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to check eligibility';
      setError(errorMsg);
      console.error('Error checking eligibility:', err);
      return { success: false, canAccess: false };
    }
  }, []);

  /**
   * Subscribe to priority
   */
  const subscribeToPriority = useCallback(async (autoRenew = true) => {
    try {
      setLoading(true);
      const { data } = await apiClient.post('/api/preferences-priority/subscribe', {
        autoRenew
      });

      if (data.success) {
        setPriorityStatus({ ...priorityStatus, subscription: data.subscription });
        setError(null);
      }
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to subscribe';
      setError(errorMsg);
      console.error('Error subscribing:', err);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [priorityStatus]);

  /**
   * Renew subscription
   */
  const renewSubscription = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.post('/api/preferences-priority/renew');

      if (data.success) {
        await checkPriorityStatus();
        setError(null);
      }
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to renew';
      setError(errorMsg);
      console.error('Error renewing:', err);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [checkPriorityStatus]);

  /**
   * Cancel subscription
   */
  const cancelSubscription = useCallback(async (reason = '') => {
    try {
      setLoading(true);
      const { data } = await apiClient.post('/api/preferences-priority/cancel', { reason });

      if (data.success) {
        setPriorityStatus({ hasSubscription: false });
        setError(null);
      }
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to cancel';
      setError(errorMsg);
      console.error('Error cancelling:', err);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get analytics
   */
  const getAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/api/preferences-priority/analytics');

      if (data.success) {
        setAnalytics(data.analytics);
        setError(null);
      }
      return data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to get analytics';
      setError(errorMsg);
      console.error('Error getting analytics:', err);
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
        getSubscriptionInfo(),
        checkPriorityStatus(),
        checkEligibility()
      ]);
    };

    fetchInitialData();
  }, []);

  return {
    // State
    priorityStatus,
    subscriptionInfo,
    analytics,
    eligibility,
    loading,
    error,

    // Actions
    getSubscriptionInfo,
    checkPriorityStatus,
    checkEligibility,
    subscribeToPriority,
    renewSubscription,
    cancelSubscription,
    getAnalytics
  };
};

export default usePreferences;
