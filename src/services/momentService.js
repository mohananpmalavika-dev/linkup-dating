import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const momentService = {
  /**
   * Upload a new moment
   */
  async uploadMoment(photoUrl, photoKey, caption) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/moments/upload`, {
        photoUrl,
        photoKey,
        caption,
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
   * Get moments feed from matches
   */
  async getMatchesMoments() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/moments/feed`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  /**
   * Record that user viewed a moment
   */
  async recordMomentView(momentId) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/moments/${momentId}/view`
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
   * Get viewers of a moment
   */
  async getMomentViewers(momentId) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/moments/${momentId}/viewers`
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
   * Get user's own moments
   */
  async getUserMoments() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/moments/my-moments`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },

  /**
   * Get moments statistics
   */
  async getMomentsStats() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/moments/stats`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message,
      };
    }
  },
};

export default momentService;
