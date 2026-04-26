import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

const API_URL = `${API_BASE_URL}/messaging`;

const datingMessagingService = {
  getMessages: async (matchId, options = {}) => {
    try {
      const response = await axios.get(`${API_URL}/matches/${matchId}/messages`, {
        params: {
          limit: options.limit || 50,
          offset: options.offset || 0
        }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to load messages';
    }
  },

  sendMessage: async (matchId, message) => {
    try {
      const response = await axios.post(`${API_URL}/matches/${matchId}/messages`, {
        message
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to send message';
    }
  },

  toggleReaction: async (messageId, emoji) => {
    try {
      const response = await axios.post(`${API_URL}/messages/${messageId}/reactions`, {
        emoji
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to update reaction';
    }
  },

  getUnreadCount: async () => {
    try {
      const response = await axios.get(`${API_URL}/unread-count`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to load unread count';
    }
  },

  sendMediaMessage: async (matchId, file, mediaType = 'image') => {
    try {
      const formData = new FormData();
      formData.append('media', file);
      formData.append('mediaType', mediaType);
      const response = await axios.post(`${API_URL}/matches/${matchId}/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to send media';
    }
  },

  sendVoiceNote: async (matchId, audioBlob, duration = 0) => {
    try {
      const formData = new FormData();
      formData.append('media', audioBlob, 'voice-note.webm');
      formData.append('mediaType', 'voice');
      formData.append('duration', String(duration));
      const response = await axios.post(`${API_URL}/matches/${matchId}/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to send voice note';
    }
  }
};

export default datingMessagingService;
