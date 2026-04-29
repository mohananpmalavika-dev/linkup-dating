import { useState, useEffect, useCallback } from 'react';
import icebreakerVideoService from '../services/icebreakerVideoService';

/**
 * useIcebreakerVideos Hook
 * Manages icebreaker video state and operations
 * 
 * Features:
 * - Fetch user's own videos (gallery)
 * - Fetch active video (intro for profile)
 * - Fetch matched user's video for viewing
 * - Rate videos
 * - Delete videos
 * - Real-time view/rating updates
 */
function useIcebreakerVideos(userId = null) {
  const [myVideos, setMyVideos] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [matchVideo, setMatchVideo] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch user's own icebreaker videos (gallery)
   */
  const fetchMyVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await icebreakerVideoService.getMyVideos();
      setMyVideos(response.videos || []);
      return response.videos || [];
    } catch (err) {
      setError('Failed to load your videos');
      console.error('Error fetching videos:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch user's active (intro) video
   */
  const fetchActiveVideo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await icebreakerVideoService.getMyActiveVideo();
      if (response.video) {
        setActiveVideo(response.video);
        return response.video;
      }
      return null;
    } catch (err) {
      console.error('Error fetching active video:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch a matched user's icebreaker video for viewing
   */
  const fetchMatchVideo = useCallback(async (matchUserId) => {
    try {
      setLoading(true);
      setError(null);
      const response = await icebreakerVideoService.getMatchVideo(matchUserId);
      if (response.video) {
        setMatchVideo(response.video);
        return response.video;
      }
      return null;
    } catch (err) {
      console.error('Error fetching match video:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Upload a new icebreaker video
   */
  const uploadVideo = useCallback(async (videoData) => {
    try {
      setLoading(true);
      setError(null);
      const response = await icebreakerVideoService.uploadVideo(videoData);
      // Refresh both active and gallery after upload
      await Promise.all([fetchActiveVideo(), fetchMyVideos()]);
      return response;
    } catch (err) {
      setError('Failed to upload video');
      console.error('Error uploading video:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchActiveVideo, fetchMyVideos]);

  /**
   * Rate an icebreaker video
   */
  const rateVideo = useCallback(async (videoId, ratingData) => {
    try {
      setLoading(true);
      setError(null);
      const response = await icebreakerVideoService.rateVideo(videoId, ratingData);
      return response;
    } catch (err) {
      setError('Failed to submit rating');
      console.error('Error rating video:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete an icebreaker video
   */
  const deleteVideo = useCallback(async (videoId, videoKey = null) => {
    try {
      setLoading(true);
      setError(null);
      await icebreakerVideoService.deleteVideo(videoId, videoKey);
      // Refresh gallery after delete
      await fetchMyVideos();
      return true;
    } catch (err) {
      setError('Failed to delete video');
      console.error('Error deleting video:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchMyVideos]);

  /**
   * Fetch video statistics (owner only)
   */
  const fetchVideoStats = useCallback(async (videoId) => {
    try {
      setLoading(true);
      setError(null);
      const response = await icebreakerVideoService.getVideoStats(videoId);
      setStats(response.stats || {});
      return response.stats || {};
    } catch (err) {
      console.error('Error fetching stats:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get aggregated stats for all user videos
   */
  const fetchAggregateStats = useCallback(async () => {
    try {
      const response = await icebreakerVideoService.getAggregateStats();
      setStats(response.stats || {});
      return response.stats || {};
    } catch (err) {
      console.error('Error fetching aggregate stats:', err);
      return null;
    }
  }, []);

  /**
   * On component mount, fetch active video if user is logged in
   */
  useEffect(() => {
    if (userId) {
      fetchActiveVideo();
    }
  }, [userId, fetchActiveVideo]);

  return {
    // Data
    myVideos,
    activeVideo,
    matchVideo,
    stats,
    loading,
    error,

    // Methods
    fetchMyVideos,
    fetchActiveVideo,
    fetchMatchVideo,
    uploadVideo,
    rateVideo,
    deleteVideo,
    fetchVideoStats,
    fetchAggregateStats,

    // Derived
    hasActiveVideo: !!activeVideo,
    videoCount: myVideos.length,
  };
}

export default useIcebreakerVideos;
