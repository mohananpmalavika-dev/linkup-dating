import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

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
      throw error.response?.data?.error || 'Failed to load messages';
    }
  },

  // Send message to lobby
  sendMessage: async (message) => {
    try {
      const response = await axios.post(`${API_URL}/messages`, {
        message
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to send message';
    }
  },

  // Get online users count
  getOnlineUsers: async () => {
    try {
      const response = await axios.get(`${API_URL}/online-users`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to get online status';
    }
  }
};

export default lobbyService;
