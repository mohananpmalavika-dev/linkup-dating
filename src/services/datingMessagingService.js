import axios from 'axios';
import { API_BASE_URL } from '../utils/api';
import { getStoredAuthToken } from '../utils/auth';

const API_URL = `${API_BASE_URL}/messaging`;

const fileToDataUrl = (fileOrBlob) => new Promise((resolve, reject) => {
  const reader = new FileReader();

  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Failed to read attachment'));
  reader.readAsDataURL(fileOrBlob);
});

const getAuthHeaders = () => {
  const authToken = getStoredAuthToken();
  if (!authToken) {
    throw new Error('Authentication required. Please log in.');
  }
  return {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
};

const datingMessagingService = {
  getMessages: async (matchId, options = {}) => {
    try {
      const response = await axios.get(`${API_URL}/matches/${matchId}/messages`, {
        params: {
          limit: options.limit || 50,
          offset: options.offset || 0
        },
        headers: getAuthHeaders()
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
      }, {
        headers: getAuthHeaders()
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
      }, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to update reaction';
    }
  },

  getUnreadCount: async () => {
    try {
      const response = await axios.get(`${API_URL}/unread-count`, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to load unread count';
    }
  },

  sendMediaMessage: async (matchId, file, mediaType = 'image', options = {}) => {
    try {
      const mediaBase64 = await fileToDataUrl(file);
      const response = await axios.post(`${API_URL}/matches/${matchId}/media`, {
        mediaBase64,
        mediaType,
        duration: options.duration || null
      }, {
        headers: getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to send media';
    }
  },

  sendVoiceNote: async (matchId, audioBlob, duration = 0) => {
    try {
      return await datingMessagingService.sendMediaMessage(matchId, audioBlob, 'voice', {
        duration
      });
    } catch (error) {
      throw error.response?.data?.error || 'Failed to send voice note';
    }
  }
};

export default datingMessagingService;
