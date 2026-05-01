import axios from 'axios';
import { API_BASE_URL } from '../utils/api';
import { getStoredAuthToken } from '../utils/auth';

const API_URL = `${API_BASE_URL}/lobby`;

const lobbyService = {
  // Get all lobby messages
  getMessages: async (limit = 50, offset = 0) => {
    try {
      const response = await axios.get(`${API_URL}/messages`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get messages:', error);
      throw error.response?.data?.error || 'Failed to load messages';
    }
  },

  // Send message to lobby
  sendMessage: async (message) => {
    try {
      if (!message || typeof message !== 'string' || !message.trim()) {
        throw new Error('Message must be a non-empty string');
      }

      const authToken = getStoredAuthToken();
      if (!authToken) {
        throw new Error('Authentication required. Please log in.');
      }

      const response = await axios.post(`${API_URL}/messages`, {
        message: message.trim()
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.data || !response.data.id) {
        throw new Error('Invalid response from server');
      }

      return response.data;
    } catch (error) {
      console.error('Failed to send message:', error);
      
      let errorMsg = 'Failed to send message';
      if (error.response?.status === 401) {
        errorMsg = 'Authentication failed. Please log in again.';
      } else if (error.response?.status === 400) {
        errorMsg = error.response.data?.error || 'Invalid message';
      } else if (error.response?.status === 500) {
        errorMsg = error.response.data?.error || 'Server error. Please try again.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      throw errorMsg;
    }
  },

  // Get online users count
  getOnlineUsers: async () => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.get(`${API_URL}/online-users`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get online status:', error);
      throw error.response?.data?.error || 'Failed to get online status';
    }
  }
};

export default lobbyService;
