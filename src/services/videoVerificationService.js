/**
 * Video Verification Service
 * Frontend API calls for video verification
 */
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const videoVerificationService = {
  /**
   * Process verification result and create badge
   */
  async processVerificationResult(videoAuthResultId) {
    try {
      const response = await axios.post(
        `${API_URL}/api/video-verification/process-result`,
        { videoAuthResultId },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error processing verification result:', error);
      throw error;
    }
  },

  /**
   * Get current user's verification badge
   */
  async getUserBadge() {
    try {
      const response = await axios.get(
        `${API_URL}/api/video-verification/badge`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting user badge:', error);
      throw error;
    }
  },

  /**
   * Get badge display info for a user
   */
  async getBadge(userId) {
    try {
      const response = await axios.get(
        `${API_URL}/api/video-verification/badge/${userId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting badge:', error);
      throw error;
    }
  },

  /**
   * Check if user is verified
   */
  async isUserVerified(userId) {
    try {
      const response = await axios.get(
        `${API_URL}/api/video-verification/is-verified/${userId}`
      );
      return response.data.verified;
    } catch (error) {
      console.error('Error checking verification status:', error);
      return false;
    }
  },

  /**
   * Get verification statistics
   */
  async getStats() {
    try {
      const response = await axios.get(
        `${API_URL}/api/video-verification/stats`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  },

  /**
   * Get list of verified users
   */
  async getVerifiedUsers(options = {}) {
    try {
      const { limit = 100, offset = 0, minFacialMatch = 0.90, excludeUserId = null } = options;
      
      const params = new URLSearchParams({
        limit,
        offset,
        minFacialMatch
      });

      if (excludeUserId) {
        params.append('excludeUserId', excludeUserId);
      }

      const response = await axios.get(
        `${API_URL}/api/video-verification/verified-users?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting verified users:', error);
      throw error;
    }
  },

  /**
   * Revoke verification badge (admin only)
   */
  async revokeBadge(userId, reason = '') {
    try {
      const response = await axios.post(
        `${API_URL}/api/video-verification/revoke`,
        { userId, reason },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error revoking badge:', error);
      throw error;
    }
  },

  /**
   * Flag badge for manual review (admin only)
   */
  async flagForManualReview(userId, notes = '') {
    try {
      const response = await axios.post(
        `${API_URL}/api/video-verification/flag-review`,
        { userId, notes },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error flagging for review:', error);
      throw error;
    }
  },

  /**
   * Get badges pending manual review (admin only)
   */
  async getPendingReview(limit = 50) {
    try {
      const response = await axios.get(
        `${API_URL}/api/video-verification/pending-review?limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting pending reviews:', error);
      throw error;
    }
  }
};

export default videoVerificationService;
