import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const photoABTestService = {
  /**
   * Create a new A/B test
   */
  async createTest(photoAId, photoBId, testName, durationHours = 48) {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/photo-ab-testing`,
        {
          photoAId,
          photoBId,
          testName,
          durationHours
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to create test';
    }
  },

  /**
   * Get test details
   */
  async getTest(testId) {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/photo-ab-testing/${testId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch test';
    }
  },

  /**
   * Get all user tests
   */
  async getUserTests(status = null, limit = 10, offset = 0) {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('limit', limit);
      params.append('offset', offset);

      const response = await axios.get(
        `${API_URL}/api/photo-ab-testing/user/all?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch tests';
    }
  },

  /**
   * Get test results
   */
  async getTestResults(testId) {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/photo-ab-testing/${testId}/results`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch results';
    }
  },

  /**
   * Get test insights
   */
  async getTestInsights(testId) {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/photo-ab-testing/${testId}/insights`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch insights';
    }
  },

  /**
   * Record a like
   */
  async recordLike(testId, photoId, photoVersion) {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/photo-ab-testing/${testId}/like`,
        { photoId, photoVersion },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to record like';
    }
  },

  /**
   * Record a view
   */
  async recordView(testId, photoVersion) {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/photo-ab-testing/${testId}/view`,
        { photoVersion },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to record view';
    }
  },

  /**
   * Pause a test
   */
  async pauseTest(testId) {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_URL}/api/photo-ab-testing/${testId}/pause`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to pause test';
    }
  },

  /**
   * Resume a test
   */
  async resumeTest(testId) {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_URL}/api/photo-ab-testing/${testId}/resume`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to resume test';
    }
  },

  /**
   * End test early
   */
  async endTest(testId) {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_URL}/api/photo-ab-testing/${testId}/end`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to end test';
    }
  }
};

export default photoABTestService;
