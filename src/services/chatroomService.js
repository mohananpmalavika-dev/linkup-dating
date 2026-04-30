import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

const API_URL = `${API_BASE_URL}/chatrooms`;

const chatroomService = {
  // Get all public chatrooms
  getChatrooms: async (page = 1, pageSize = 20) => {
    try {
      const response = await axios.get(`${API_URL}`, {
        params: { page, pageSize }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to load chatrooms';
    }
  },

  // Get specific chatroom details
  getChatroom: async (chatroomId) => {
    try {
      const response = await axios.get(`${API_URL}/${chatroomId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to load chatroom';
    }
  },

  // Create a new chatroom
  createChatroom: async (name, description = '', isPublic = true, maxMembers = 100) => {
    try {
      console.log('createChatroom called with:', { name, description, isPublic, maxMembers });
      const token = localStorage.getItem('token');
      console.log('Token available:', !!token);
      
      const response = await axios.post(`${API_URL}`, {
        name,
        description,
        isPublic,
        maxMembers
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('createChatroom response:', response.data);
      return response.data;
    } catch (error) {
      console.error('createChatroom error response:', error.response);
      console.error('createChatroom error:', error);
      throw error.response?.data?.error || error.message || 'Failed to create chatroom';
    }
  },

  // Join a chatroom
  joinChatroom: async (chatroomId) => {
    try {
      const response = await axios.post(`${API_URL}/${chatroomId}/join`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to join chatroom';
    }
  },

  // Leave a chatroom
  leaveChatroom: async (chatroomId) => {
    try {
      const response = await axios.post(`${API_URL}/${chatroomId}/leave`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to leave chatroom';
    }
  },

  // Get chatroom members
  getMembers: async (chatroomId, limit = 50, offset = 0) => {
    try {
      const response = await axios.get(`${API_URL}/${chatroomId}/members`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to load members';
    }
  },

  // Get messages for a chatroom
  getMessages: async (chatroomId, limit = 50, offset = 0) => {
    try {
      const response = await axios.get(`${API_URL}/${chatroomId}/messages`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to load messages';
    }
  },

  // Send message to chatroom
  sendMessage: async (chatroomId, message) => {
    try {
      const response = await axios.post(`${API_URL}/${chatroomId}/messages`, {
        message
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to send message';
    }
  }
};

export default chatroomService;
