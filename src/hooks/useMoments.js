import { useState, useEffect, useCallback } from 'react';
import momentService from '../services/momentService';

/**
 * useMoments Hook
 * Manages moments (ephemeral photos) state and operations
 * 
 * Features:
 * - Fetch matches' moments (24-hour expiring)
 * - Upload new moments
 * - Track views and viewers
 * - Real-time statistics
 */
function useMoments() {
  const [moments, setMoments] = useState([]);
  const [userMoments, setUserMoments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch moments from matched users (moments feed)
   */
  const fetchMoments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await momentService.getMatchesMoments();
      
      if (result.success) {
        setMoments(result.moments || []);
        return result.moments || [];
      } else {
        setError(result.error || 'Failed to load moments');
        return [];
      }
    } catch (err) {
      setError(err.message || 'Error loading moments');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch user's own active moments
   */
  const fetchUserMoments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await momentService.getUserMoments();
      
      if (result.success) {
        setUserMoments(result.moments || []);
        return result.moments || [];
      } else {
        setError(result.error || 'Failed to load your moments');
        return [];
      }
    } catch (err) {
      setError(err.message || 'Error loading your moments');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Upload a new moment
   */
  const uploadMoment = useCallback(async (file, caption = '') => {
    try {
      setLoading(true);
      setError(null);
      const result = await momentService.uploadMoment(file, caption);
      
      if (result.success) {
        // Refresh both feeds after upload
        await Promise.all([fetchMoments(), fetchUserMoments()]);
        return result;
      } else {
        setError(result.error || 'Failed to upload moment');
        throw new Error(result.error);
      }
    } catch (err) {
      setError(err.message || 'Error uploading moment');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchMoments, fetchUserMoments]);

  /**
   * Record a moment view
   */
  const recordView = useCallback(async (momentId) => {
    try {
      const result = await momentService.recordMomentView(momentId);
      
      if (result.success) {
        // Update moment in state to mark as viewed
        setMoments(prev => 
          prev.map(m => 
            m.id === momentId ? { ...m, hasViewed: true } : m
          )
        );
        return result;
      } else {
        console.error('Failed to record view:', result.error);
        return null;
      }
    } catch (err) {
      console.error('Error recording view:', err);
      return null;
    }
  }, []);

  /**
   * Get viewers of a moment
   */
  const getViewers = useCallback(async (momentId) => {
    try {
      const result = await momentService.getMomentViewers(momentId);
      
      if (result.success) {
        return result.viewers || [];
      } else {
        console.error('Failed to get viewers:', result.error);
        return [];
      }
    } catch (err) {
      console.error('Error getting viewers:', err);
      return [];
    }
  }, []);

  /**
   * Fetch moments statistics
   */
  const fetchStats = useCallback(async () => {
    try {
      const result = await momentService.getMomentsStats();
      
      if (result.success) {
        setStats(result.stats);
        return result.stats;
      } else {
        console.error('Failed to fetch stats:', result.error);
        return null;
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      return null;
    }
  }, []);

  /**
   * Initialize moments on mount
   */
  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchMoments(),
        fetchUserMoments(),
        fetchStats()
      ]);
    };
    
    init();
  }, []);

  return {
    // Data
    moments,
    userMoments,
    stats,
    loading,
    error,

    // Methods
    fetchMoments,
    fetchUserMoments,
    uploadMoment,
    recordView,
    getViewers,
    fetchStats,

    // Derived
    momentCount: moments.length,
    userMomentCount: userMoments.length,
    hasActiveMoments: userMoments.length > 0,
  };
}

export default useMoments;
