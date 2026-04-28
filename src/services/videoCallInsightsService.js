import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const videoCallInsightsService = {
  /**
   * Submit a post-call rating
   */
  async submitCallRating(
    videoDeteId,
    rating,
    comment,
    wouldDateAgain,
    communicationQuality,
    chemistryLevel,
    appearanceMatch,
    personalityMatch,
    ratedUserId
  ) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/video-insights/rate-call`, {
        videoDeteId,
        ratedUserId,
        rating,
        comment,
        wouldDateAgain,
        communicationQuality,
        chemistryLevel,
        appearanceMatch,
        personalityMatch,
      });

      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  /**
   * Get user's video call analytics
   */
  async getUserAnalytics() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/video-insights/analytics`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  /**
   * Get compatibility score for a video call
   */
  async getCompatibilityScore(videoDeteId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/video-insights/compatibility/${videoDeteId}`
      );
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  /**
   * Generate compatibility score (trigger analysis)
   */
  async generateCompatibilityScore(videoDeteId) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/video-insights/generate-compatibility/${videoDeteId}`
      );
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  /**
   * Get upcoming video calls
   */
  async getUpcomingCalls() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/video-insights/upcoming-calls`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  /**
   * Get video call history
   */
  async getCallHistory(limit = 10) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/video-insights/call-history`, {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },
};

export default videoCallInsightsService;
