import { useState, useCallback, useEffect } from 'react';
import { datingProfileService } from '../services/datingProfileService';

/**
 * useVideoProfile Hook
 * Manages video profile state and operations
 * Provides video upload, retrieval, and authentication status
 */
const useVideoProfile = () => {
  const [videoProfile, setVideoProfile] = useState(null);
  const [videoAuthenticationResult, setVideoAuthenticationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch video profile details
  const fetchVideoProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const details = await datingProfileService.getVideoIntroDetails();
      setVideoProfile(details);
      
      if (details.latestAnalysis) {
        setVideoAuthenticationResult({
          overallScore: details.latestAnalysis.score,
          isAuthentic: details.latestAnalysis.score >= 0.75,
          needsReview: details.latestAnalysis.score >= 0.6 && details.latestAnalysis.score < 0.75,
          isFraud: details.latestAnalysis.score < 0.4,
          scores: details.latestAnalysis.scores,
          riskFlags: details.latestAnalysis.riskFlags,
          message: details.latestAnalysis.score >= 0.75 
            ? 'Your video has been verified!'
            : details.latestAnalysis.score >= 0.6
            ? 'Your video is under review'
            : 'Video verification failed',
          status: details.latestAnalysis.status
        });
      }
    } catch (err) {
      console.error('Error fetching video profile:', err);
      setError(err.message || 'Failed to fetch video profile');
    } finally {
      setLoading(false);
    }
  }, []);

  // Upload video profile
  const uploadVideo = useCallback(async (file, durationSeconds) => {
    try {
      setLoading(true);
      setError(null);
      setUploadProgress(0);

      const result = await datingProfileService.uploadVideoIntro(file, durationSeconds);
      setUploadProgress(100);

      // Update video profile state
      setVideoProfile({
        hasVideoIntro: true,
        videoUrl: result.videoIntroUrl,
        durationSeconds: result.durationSeconds,
        authenticationStatus: result.authentication?.status
      });

      // Set authentication result
      if (result.authentication) {
        setVideoAuthenticationResult(result.authentication);
      }

      return result;
    } catch (err) {
      console.error('Error uploading video:', err);
      setError(err.message || 'Failed to upload video');
      throw err;
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  }, []);

  // Delete video profile
  const deleteVideo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await datingProfileService.deleteVideoIntro();
      setVideoProfile(null);
      setVideoAuthenticationResult(null);
    } catch (err) {
      console.error('Error deleting video:', err);
      setError(err.message || 'Failed to delete video');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-check fraud detection
  const recheckFraud = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await datingProfileService.recheckVideoFraud();
      
      if (result.authentication) {
        setVideoAuthenticationResult(result.authentication);
      }

      return result;
    } catch (err) {
      console.error('Error re-checking fraud:', err);
      setError(err.message || 'Failed to re-check fraud detection');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    fetchVideoProfile();
  }, [fetchVideoProfile]);

  // Derived stats for quick access
  const hasVideoProfile = videoProfile?.hasVideoIntro || false;
  const videoUrl = videoProfile?.videoUrl;
  const videoDuration = videoProfile?.durationSeconds;
  const authenticationStatus = videoProfile?.authenticationStatus || videoAuthenticationResult?.status;
  const isAuthenticated = videoAuthenticationResult?.isAuthentic || false;
  const authenticationScore = videoAuthenticationResult?.overallScore || 0;

  return {
    // Data
    videoProfile,
    videoAuthenticationResult,
    loading,
    error,
    uploadProgress,

    // Methods
    fetchVideoProfile,
    uploadVideo,
    deleteVideo,
    recheckFraud,

    // Derived stats (quick access)
    hasVideoProfile,
    videoUrl,
    videoDuration,
    authenticationStatus,
    isAuthenticated,
    authenticationScore,

    // Helpers
    isLoading: loading,
    hasError: !!error,
    isVerified: isAuthenticated,
    needsReview: videoAuthenticationResult?.needsReview || false,
    isFlagged: videoAuthenticationResult?.isFraud || false
  };
};

export default useVideoProfile;
