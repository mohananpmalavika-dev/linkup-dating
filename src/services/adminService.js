import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

const API_URL = `${API_BASE_URL}/admin`;

const adminService = {
  getDashboard: async () => {
    const response = await axios.get(`${API_URL}/dashboard`);
    return response.data;
  },

  getReports: async (params = {}) => {
    const response = await axios.get(`${API_URL}/reports`, { params });
    return response.data;
  },

  resolveReport: async (reportId, payload) => {
    const response = await axios.put(`${API_URL}/reports/${reportId}/resolve`, payload);
    return response.data;
  },

  getSpamFlags: async (params = {}) => {
    const response = await axios.get(`${API_URL}/spam-flags`, { params });
    return response.data;
  },

  resolveSpamFlag: async (flagId, payload) => {
    const response = await axios.put(`${API_URL}/spam-flags/${flagId}/resolve`, payload);
    return response.data;
  },

  getFraudFlags: async (params = {}) => {
    const response = await axios.get(`${API_URL}/fraud-flags`, { params });
    return response.data;
  },

  resolveFraudFlag: async (flagId, payload) => {
    const response = await axios.put(`${API_URL}/fraud-flags/${flagId}/resolve`, payload);
    return response.data;
  },

  suspendUser: async (userId, payload) => {
    const response = await axios.post(`${API_URL}/users/${userId}/suspend`, payload);
    return response.data;
  },

  deleteUser: async (userId, payload) => {
    const response = await axios.post(`${API_URL}/users/${userId}/delete`, payload);
    return response.data;
  },

  getPlatformAnalytics: async (params = {}) => {
    const response = await axios.get(`${API_URL}/analytics/platform`, { params });
    return response.data;
  },

  getActionsLog: async (params = {}) => {
    const response = await axios.get(`${API_URL}/actions-log`, { params });
    return response.data;
  }
};

export default adminService;
