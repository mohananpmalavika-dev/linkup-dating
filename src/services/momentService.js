import apiClient from './apiClient';

const momentService = {
  async uploadMoment(file, caption) {
    try {
      const formData = new FormData();
      formData.append('photo', file);
      if (caption) {
        formData.append('caption', caption);
      }

      const response = await apiClient.post('/moments/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  },

  async getMatchesMoments() {
    try {
      const response = await apiClient.get('/moments/feed');
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  },

  async recordMomentView(momentId) {
    try {
      const response = await apiClient.post(`/moments/${momentId}/view`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  },

  async getMomentViewers(momentId) {
    try {
      const response = await apiClient.get(`/moments/${momentId}/viewers`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  },

  async getUserMoments() {
    try {
      const response = await apiClient.get('/moments/my-moments');
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  },

  async getMomentsStats() {
    try {
      const response = await apiClient.get('/moments/stats');
      return response.data;
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }
};

export default momentService;
