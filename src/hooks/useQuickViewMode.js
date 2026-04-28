/**
 * useQuickViewMode Hook
 * Manage quick view mode state and interactions
 */

import { useState, useCallback, useEffect } from 'react';

const useQuickViewMode = (initialProfiles = []) => {
  const [isActive, setIsActive] = useState(false);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState({
    totalViewed: 0,
    totalLiked: 0,
    totalPassed: 0
  });

  // Fetch quick view profiles
  const fetchQuickViewProfiles = useCallback(async (filters = {}) => {
    try {
      const params = new URLSearchParams({
        limit: 50,
        mode: 'quick_view',
        ...filters
      });

      const response = await fetch(`/api/discovery/quick-view?${params}`, {
        method: 'GET'
      });

      const data = await response.json();
      if (data.success) {
        setProfiles(data.profiles || []);
        setCurrentIndex(0);
        return data.profiles;
      }
    } catch (error) {
      console.error('Error fetching quick view profiles:', error);
      return [];
    }
  }, []);

  // Start quick view mode
  const startQuickView = useCallback(async (filters = {}) => {
    const profiles = await fetchQuickViewProfiles(filters);
    if (profiles.length > 0) {
      setIsActive(true);
    }
  }, [fetchQuickViewProfiles]);

  // Exit quick view mode
  const exitQuickView = useCallback(() => {
    setIsActive(false);
    setCurrentIndex(0);
  }, []);

  // Handle like action
  const handleLike = useCallback(async (profile) => {
    try {
      const response = await fetch(`/api/discovery/quick-view/${profile.id}/like`, {
        method: 'POST'
      });

      const data = await response.json();
      if (data.success) {
        setStats((prev) => ({
          ...prev,
          totalLiked: prev.totalLiked + 1
        }));
        return true;
      }
    } catch (error) {
      console.error('Error liking profile:', error);
    }
    return false;
  }, []);

  // Handle pass action
  const handlePass = useCallback(async (profile) => {
    try {
      const response = await fetch(`/api/discovery/quick-view/${profile.id}/pass`, {
        method: 'POST'
      });

      const data = await response.json();
      if (data.success) {
        setStats((prev) => ({
          ...prev,
          totalPassed: prev.totalPassed + 1
        }));
        return true;
      }
    } catch (error) {
      console.error('Error passing profile:', error);
    }
    return false;
  }, []);

  // Update stats
  const updateStats = useCallback(() => {
    setStats((prev) => ({
      ...prev,
      totalViewed: prev.totalLiked + prev.totalPassed
    }));
  }, []);

  // Get next batch of profiles when running low
  const loadMoreProfiles = useCallback(async () => {
    if (profiles.length - currentIndex < 10) {
      const newProfiles = await fetchQuickViewProfiles();
      if (newProfiles.length > 0) {
        setProfiles((prev) => [...prev, ...newProfiles]);
      }
    }
  }, [currentIndex, profiles.length, fetchQuickViewProfiles]);

  // Auto-load more profiles when getting low
  useEffect(() => {
    if (isActive && profiles.length > 0) {
      loadMoreProfiles();
    }
  }, [currentIndex, isActive, loadMoreProfiles]);

  // Update stats when like/pass counts change
  useEffect(() => {
    updateStats();
  }, [stats.totalLiked, stats.totalPassed, updateStats]);

  return {
    isActive,
    profiles,
    currentIndex,
    stats,
    startQuickView,
    exitQuickView,
    handleLike,
    handlePass,
    fetchQuickViewProfiles,
    loadMoreProfiles
  };
};

export default useQuickViewMode;
