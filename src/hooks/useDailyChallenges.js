/**
 * Daily Challenges Hook
 * Manages state and API interactions for daily challenges
 */

import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

const useDailyChallenges = () => {
  const [todayChallenges, setTodayChallenges] = useState([]);
  const [weeklyChallenges, setWeeklyChallenges] = useState({});
  const [pointsBalance, setPointsBalance] = useState({
    totalPoints: 0,
    availablePoints: 0,
    weeklyPoints: 0,
    monthlyStreak: 0
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [redemptionHistory, setRedemptionHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch today's challenges
   */
  const fetchTodayChallenges = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/api/challenges/today');
      if (response.data.success) {
        setTodayChallenges(response.data.challenges || []);
      }
    } catch (err) {
      console.error('Error fetching today challenges:', err);
      setError(err.response?.data?.message || 'Failed to fetch challenges');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch weekly challenges
   */
  const fetchWeeklyChallenges = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/challenges/weekly');
      if (response.data.success) {
        setWeeklyChallenges(response.data.challenges || {});
      }
    } catch (err) {
      console.error('Error fetching weekly challenges:', err);
      setError(err.response?.data?.message || 'Failed to fetch weekly challenges');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch points balance
   */
  const fetchPointsBalance = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/challenges/points/balance');
      if (response.data.success) {
        setPointsBalance({
          totalPoints: response.data.totalPoints,
          availablePoints: response.data.availablePoints,
          weeklyPoints: response.data.weeklyPoints,
          monthlyStreak: response.data.monthlyStreak
        });
      }
    } catch (err) {
      console.error('Error fetching points balance:', err);
    }
  }, []);

  /**
   * Update challenge progress
   */
  const updateProgress = useCallback(async (challengeId, increment = 1) => {
    try {
      setLoading(true);
      const response = await apiClient.post(
        `/api/challenges/${challengeId}/progress`,
        { increment }
      );

      if (response.data.success) {
        // Refresh challenges to show updated progress
        await fetchTodayChallenges();

        // If completed, refresh points
        if (response.data.completed) {
          await fetchPointsBalance();
        }

        return {
          completed: response.data.completed,
          pointsEarned: response.data.pointsEarned,
          progress: response.data.progress
        };
      }
    } catch (err) {
      console.error('Error updating progress:', err);
      setError(err.response?.data?.message || 'Failed to update progress');
    } finally {
      setLoading(false);
    }
  }, [fetchTodayChallenges, fetchPointsBalance]);

  /**
   * Redeem points
   */
  const redeemPoints = useCallback(async (pointsToRedeem, rewardType, rewardValue) => {
    try {
      setLoading(true);
      const response = await apiClient.post('/api/challenges/points/redeem', {
        pointsToRedeem,
        rewardType,
        rewardValue
      });

      if (response.data.success) {
        // Refresh points and history
        await fetchPointsBalance();
        await fetchRedemptionHistory();

        return response.data.redemption;
      }
    } catch (err) {
      console.error('Error redeeming points:', err);
      setError(err.response?.data?.message || 'Failed to redeem points');
    } finally {
      setLoading(false);
    }
  }, [fetchPointsBalance]);

  /**
   * Apply redemption
   */
  const applyRedemption = useCallback(async (redemptionId) => {
    try {
      setLoading(true);
      const response = await apiClient.post(
        `/api/challenges/redemptions/${redemptionId}/apply`,
        {}
      );

      if (response.data.success) {
        await fetchRedemptionHistory();
        return response.data.redemption;
      }
    } catch (err) {
      console.error('Error applying redemption:', err);
      setError(err.response?.data?.message || 'Failed to apply reward');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch redemption history
   */
  const fetchRedemptionHistory = useCallback(async (limit = 20) => {
    try {
      const response = await apiClient.get('/api/challenges/redemptions/history', {
        params: { limit }
      });

      if (response.data.success) {
        setRedemptionHistory(response.data.history || []);
      }
    } catch (err) {
      console.error('Error fetching redemption history:', err);
    }
  }, []);

  /**
   * Fetch leaderboard
   */
  const fetchLeaderboard = useCallback(async (limit = 20) => {
    try {
      const response = await apiClient.get('/api/challenges/leaderboard/weekly', {
        params: { limit }
      });

      if (response.data.success) {
        setLeaderboard(response.data.leaderboard || []);
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    }
  }, []);

  /**
   * Initialize challenges on mount
   */
  useEffect(() => {
    fetchTodayChallenges();
    fetchWeeklyChallenges();
    fetchPointsBalance();
    fetchLeaderboard();
  }, [fetchTodayChallenges, fetchWeeklyChallenges, fetchPointsBalance, fetchLeaderboard]);

  return {
    todayChallenges,
    weeklyChallenges,
    pointsBalance,
    leaderboard,
    redemptionHistory,
    loading,
    error,
    updateProgress,
    redeemPoints,
    applyRedemption,
    fetchPointsBalance,
    fetchRedemptionHistory,
    fetchLeaderboard,
    refetch: () => {
      fetchTodayChallenges();
      fetchWeeklyChallenges();
      fetchPointsBalance();
    }
  };
};

export default useDailyChallenges;
