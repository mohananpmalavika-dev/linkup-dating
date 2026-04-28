import apiClient from './apiClient';

const videoCallInsightsService = {
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
      const response = await apiClient.post('/video-insights/rate-call', {
        videoDeteId,
        ratedUserId,
        rating,
        comment,
        wouldDateAgain,
        communicationQuality,
        chemistryLevel,
        appearanceMatch,
        personalityMatch
      });

      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  },

  async getUserAnalytics() {
    try {
      const response = await apiClient.get('/video-insights/analytics');
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  },

  async getCompatibilityScore(videoDeteId) {
    try {
      const response = await apiClient.get(`/video-insights/compatibility/${videoDeteId}`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  },

  async generateCompatibilityScore(videoDeteId) {
    try {
      const response = await apiClient.post(`/video-insights/generate-compatibility/${videoDeteId}`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  },

  async getUpcomingCalls() {
    try {
      const response = await apiClient.get('/video-insights/upcoming-calls');
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  },

  async getCallHistory(limit = 10) {
    try {
      const response = await apiClient.get('/video-insights/call-history', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }
};

export default videoCallInsightsService;
