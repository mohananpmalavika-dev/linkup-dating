import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const catfishDetectionService = {
  /**
   * Scan a message for red flags
   */
  async scanMessage(message) {
    try {
      const response = await axios.post(
        `${API_BASE}/api/catfish-detection/scan`,
        { message },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data.scan;
    } catch (error) {
      console.error('Error scanning message:', error);
      throw error;
    }
  },

  /**
   * Get all flags for current user
   */
  async getFlags(limit = 50, offset = 0, includeDismissed = false) {
    try {
      const response = await axios.get(
        `${API_BASE}/api/catfish-detection/flags`,
        {
          params: { limit, offset, includeDismissed },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data.flags;
    } catch (error) {
      console.error('Error getting flags:', error);
      throw error;
    }
  },

  /**
   * Get suspicious activity stats
   */
  async getStats() {
    try {
      const response = await axios.get(
        `${API_BASE}/api/catfish-detection/stats`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data.stats;
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  },

  /**
   * Dismiss a warning
   */
  async dismissFlag(flagId) {
    try {
      const response = await axios.post(
        `${API_BASE}/api/catfish-detection/flags/${flagId}/dismiss`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error dismissing flag:', error);
      throw error;
    }
  },

  /**
   * Report a message as suspicious
   */
  async reportFlag(flagId, reason) {
    try {
      const response = await axios.post(
        `${API_BASE}/api/catfish-detection/flags/${flagId}/report`,
        { reason },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error reporting flag:', error);
      throw error;
    }
  },

  /**
   * Check if a user has suspicious patterns
   */
  async checkUser(userId) {
    try {
      const response = await axios.post(
        `${API_BASE}/api/catfish-detection/check-user`,
        { userId },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data.assessment;
    } catch (error) {
      console.error('Error checking user:', error);
      throw error;
    }
  },

  /**
   * Get suspicious users (admin)
   */
  async getSuspiciousUsers(limit = 10, daysBack = 30) {
    try {
      const response = await axios.get(
        `${API_BASE}/api/catfish-detection/suspicious-users`,
        {
          params: { limit, daysBack },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      return response.data.suspiciousUsers;
    } catch (error) {
      console.error('Error getting suspicious users:', error);
      throw error;
    }
  }
};

export default catfishDetectionService;
