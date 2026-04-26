import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

const API_URL = `${API_BASE_URL}/dating/video-calls`;

const unwrapError = (error, fallbackMessage) =>
  error.response?.data?.error || fallbackMessage;

const videoCallService = {
  getMatchSessions: async (matchId) => {
    try {
      const response = await axios.get(`${API_URL}/match/${matchId}`);
      return response.data;
    } catch (error) {
      throw unwrapError(error, 'Failed to load video call history');
    }
  },

  getHistory: async (params = {}) => {
    try {
      const response = await axios.get(`${API_URL}/history`, { params });
      return response.data;
    } catch (error) {
      throw unwrapError(error, 'Failed to load video call history');
    }
  },

  createLiveSession: async (matchId, payload = {}) => {
    try {
      const response = await axios.post(`${API_URL}/match/${matchId}/live`, payload);
      return response.data;
    } catch (error) {
      throw unwrapError(error, 'Failed to prepare the video call');
    }
  },

  scheduleCall: async (matchId, payload = {}) => {
    try {
      const response = await axios.post(`${API_URL}/match/${matchId}/schedule`, payload);
      return response.data;
    } catch (error) {
      throw unwrapError(error, 'Failed to schedule the video call');
    }
  },

  deliverDueReminders: async () => {
    try {
      const response = await axios.post(`${API_URL}/due-reminders`);
      return response.data;
    } catch (error) {
      throw unwrapError(error, 'Failed to deliver video call reminders');
    }
  },

  sendReminder: async (videoDateId) => {
    try {
      const response = await axios.post(`${API_URL}/${videoDateId}/reminder`);
      return response.data;
    } catch (error) {
      throw unwrapError(error, 'Failed to send reminder');
    }
  },

  joinSession: async (videoDateId, payload = {}) => {
    try {
      const response = await axios.post(`${API_URL}/${videoDateId}/join`, payload);
      return response.data;
    } catch (error) {
      throw unwrapError(error, 'Failed to join the video call');
    }
  },

  updateSettings: async (videoDateId, payload = {}) => {
    try {
      const response = await axios.post(`${API_URL}/${videoDateId}/settings`, payload);
      return response.data;
    } catch (error) {
      throw unwrapError(error, 'Failed to update call settings');
    }
  },

  updateRecordingConsent: async (videoDateId, payload = {}) => {
    try {
      const response = await axios.post(`${API_URL}/${videoDateId}/recording-consent`, payload);
      return response.data;
    } catch (error) {
      throw unwrapError(error, 'Failed to update recording consent');
    }
  },

  completeSession: async (videoDateId, payload = {}) => {
    try {
      const response = await axios.post(`${API_URL}/${videoDateId}/complete`, payload);
      return response.data;
    } catch (error) {
      throw unwrapError(error, 'Failed to finalize the video call');
    }
  }
};

export default videoCallService;
