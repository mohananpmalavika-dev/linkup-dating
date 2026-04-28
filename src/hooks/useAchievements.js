/**
 * useAchievements Hook
 * Manage achievement unlocks, leaderboard updates, and notifications
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const useAchievements = (userId) => {
  const [unlockedAchievements, setUnlockedAchievements] = useState([]);
  const [leaderboardRanks, setLeaderboardRanks] = useState({});
  const [achievementNotification, setAchievementNotification] = useState(null);
  const [rankNotification, setRankNotification] = useState(null);
  const notificationTimeoutRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    // Fetch user's achievements
    fetchUserAchievements();

    // Set up event listeners
    const handleAchievementUnlocked = (event) => {
      const { detail } = event;
      setAchievementNotification(detail);
      setUnlockedAchievements((prev) => [...prev, detail]);

      // Clear notification after 5 seconds
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      notificationTimeoutRef.current = setTimeout(() => {
        setAchievementNotification(null);
      }, 5000);
    };

    const handleRankUpdated = (event) => {
      const { detail } = event;
      setLeaderboardRanks((prev) => ({
        ...prev,
        [detail.type]: detail
      }));
      setRankNotification(detail);

      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      notificationTimeoutRef.current = setTimeout(() => {
        setRankNotification(null);
      }, 4000);
    };

    const handleLeaderboardRefreshed = (event) => {
      fetchUserAchievements();
    };

    window.addEventListener('achievement-unlocked', handleAchievementUnlocked);
    window.addEventListener('leaderboard-rank-updated', handleRankUpdated);
    window.addEventListener('leaderboard-refreshed', handleLeaderboardRefreshed);

    return () => {
      window.removeEventListener('achievement-unlocked', handleAchievementUnlocked);
      window.removeEventListener('leaderboard-rank-updated', handleRankUpdated);
      window.removeEventListener('leaderboard-refreshed', handleLeaderboardRefreshed);
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [userId]);

  const fetchUserAchievements = useCallback(async () => {
    try {
      const response = await fetch(`/api/achievements/user/${userId}`);
      const data = await response.json();
      if (data.success) {
        setUnlockedAchievements(data.achievements || []);
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
  }, [userId]);

  const checkAndUnlockAchievements = useCallback(async () => {
    try {
      const response = await fetch('/api/achievements/check', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success && data.newAchievements) {
        setUnlockedAchievements((prev) => [
          ...prev,
          ...data.newAchievements
        ]);
      }
      return data;
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  }, []);

  const featureAchievement = useCallback(async (achievementId) => {
    try {
      const response = await fetch(`/api/achievements/feature/${achievementId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        fetchUserAchievements();
      }
      return data;
    } catch (error) {
      console.error('Error featuring achievement:', error);
    }
  }, [fetchUserAchievements]);

  const getUserRank = useCallback(async (type, city = null, interest = null) => {
    try {
      const params = new URLSearchParams();
      if (city) params.append('city', city);
      if (interest) params.append('interest', interest);

      const response = await fetch(
        `/api/leaderboards/user/${userId}/positions?${params}`,
        { method: 'GET' }
      );
      const data = await response.json();
      return data.positions || [];
    } catch (error) {
      console.error('Error fetching user ranks:', error);
      return [];
    }
  }, [userId]);

  const voteForConversationStarter = useCallback(async (votedForUserId, reason = '') => {
    try {
      const response = await fetch('/api/leaderboards/vote-conversation-starter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votedForUserId, reason })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error voting for conversation starter:', error);
    }
  }, []);

  const getAchievementProgress = useCallback(async (achievementCode) => {
    try {
      const response = await fetch(
        `/api/achievements/progress/${achievementCode}`,
        { method: 'GET' }
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching achievement progress:', error);
    }
  }, []);

  return {
    unlockedAchievements,
    leaderboardRanks,
    achievementNotification,
    rankNotification,
    fetchUserAchievements,
    checkAndUnlockAchievements,
    featureAchievement,
    getUserRank,
    voteForConversationStarter,
    getAchievementProgress
  };
};

export default useAchievements;
