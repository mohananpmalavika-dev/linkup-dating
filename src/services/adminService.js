import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

const API_URL = `${API_BASE_URL}/admin`;

const adminService = {
  getDashboard: async () => {
    const response = await axios.get(`${API_URL}/dashboard`);
    return response.data;
  },

  getModerationQueue: async (params = {}) => {
    const response = await axios.get(`${API_URL}/moderation/queue`, { params });
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

  getModerationFlags: async (params = {}) => {
    const response = await axios.get(`${API_URL}/moderation-flags`, { params });
    return response.data;
  },

  reviewModerationFlag: async (flagId, payload) => {
    const response = await axios.put(`${API_URL}/moderation-flags/${flagId}/review`, payload);
    return response.data;
  },

  getReviewCandidates: async (params = {}) => {
    const response = await axios.get(`${API_URL}/users/review`, { params });
    return response.data;
  },

  getUserReview: async (userId) => {
    const response = await axios.get(`${API_URL}/users/${userId}/review`);
    return response.data;
  },

  createUserFlag: async (userId, payload) => {
    const response = await axios.post(`${API_URL}/users/${userId}/flag`, payload);
    return response.data;
  },

  suspendUser: async (userId, payload) => {
    const response = await axios.post(`${API_URL}/users/${userId}/suspend`, payload);
    return response.data;
  },

  banUser: async (userId, payload) => {
    const response = await axios.post(`${API_URL}/users/${userId}/ban`, payload);
    return response.data;
  },

  deleteUser: async (userId, payload) => {
    const response = await axios.post(`${API_URL}/users/${userId}/delete`, payload);
    return response.data;
  },

  getPhotoModeration: async (params = {}) => {
    const response = await axios.get(`${API_URL}/photo-moderation`, { params });
    return response.data;
  },

  reviewPhotoModeration: async (queueId, payload) => {
    const response = await axios.put(`${API_URL}/photo-moderation/${queueId}/review`, payload);
    return response.data;
  },

  getBans: async (params = {}) => {
    const response = await axios.get(`${API_URL}/bans`, { params });
    return response.data;
  },

  revokeBan: async (banId, payload) => {
    const response = await axios.post(`${API_URL}/bans/${banId}/revoke`, payload);
    return response.data;
  },

  getAppeals: async (params = {}) => {
    const response = await axios.get(`${API_URL}/appeals`, { params });
    return response.data;
  },

  reviewAppeal: async (appealId, payload) => {
    const response = await axios.post(`${API_URL}/appeals/${appealId}/review`, payload);
    return response.data;
  },

  getUserAnalytics: async (userId, params = {}) => {
    const response = await axios.get(`${API_URL}/analytics/users/${userId}`, { params });
    return response.data;
  },

  getPlatformAnalytics: async (params = {}) => {
    const response = await axios.get(`${API_URL}/analytics/platform`, { params });
    return response.data;
  },

  getModerationAnalytics: async (params = {}) => {
    const response = await axios.get(`${API_URL}/analytics/moderation`, { params });
    return response.data;
  },

  getActionsLog: async (params = {}) => {
    const response = await axios.get(`${API_URL}/actions-log`, { params });
    return response.data;
  }
};

export default adminService;
