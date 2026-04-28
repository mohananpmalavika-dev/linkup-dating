/**
 * Use Streaks Hook
 * Manages streak data and operations
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

const API_URL = `${API_BASE_URL}/streaks`;

const useStreaks = (matchId = null) => {
  const [currentStreak, setCurrentStreak] = useState(null);
  const [userStreaks, setUserStreaks] = useState([]);
  const [streakStats, setStreakStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch current match streak
   */
  const fetchMatchStreak = useCallback(async (mId) => {
    if (!mId) return;

    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/match/${mId}`);
      if (response.data.success) {
        setCurrentStreak(response.data.streak);
      }
    } catch (err) {
      console.error('Error fetching match streak:', err);
      setError(err.response?.data?.message || 'Failed to fetch streak');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch all user streaks
   */
  const fetchUserStreaks = useCallback(async (limit = 50) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/user/active`, {
        params: { limit }
      });
      if (response.data.success) {
        setUserStreaks(response.data.streaks || []);
      }
    } catch (err) {
      console.error('Error fetching user streaks:', err);
      setError(err.response?.data?.message || 'Failed to fetch streaks');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch user streak statistics
   */
  const fetchStreakStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/user/stats`);
      if (response.data.success) {
        setStreakStats(response.data.stats);
      }
    } catch (err) {
      console.error('Error fetching streak stats:', err);
    }
  }, []);

  /**
   * Fetch leaderboard
   */
  const fetchLeaderboard = useCallback(async (limit = 20) => {
    try {
      const response = await axios.get(`${API_URL}/leaderboard`, {
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
   * Initialize data on mount
   */
  useEffect(() => {
    if (matchId) {
      fetchMatchStreak(matchId);
    }
    fetchUserStreaks();
    fetchStreakStats();
    fetchLeaderboard();
  }, [matchId, fetchMatchStreak, fetchUserStreaks, fetchStreakStats, fetchLeaderboard]);

  /**
   * Refresh all streak data
   */
  const refetch = useCallback(() => {
    if (matchId) {
      fetchMatchStreak(matchId);
    }
    fetchUserStreaks();
    fetchStreakStats();
    fetchLeaderboard();
  }, [matchId, fetchMatchStreak, fetchUserStreaks, fetchStreakStats, fetchLeaderboard]);

  return {
    currentStreak,
    userStreaks,
    streakStats,
    leaderboard,
    loading,
    error,
    fetchMatchStreak,
    fetchUserStreaks,
    fetchStreakStats,
    fetchLeaderboard,
    refetch
  };
};

export default useStreaks;
