import axios from 'axios';
import { API_BASE_URL } from '../utils/api';
import { getStoredAuthToken } from '../utils/auth';

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
      const authToken = getStoredAuthToken();
      const response = await axios.get(`${API_URL}/${chatroomId}`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to load chatroom';
    }
  },

  // Create a new chatroom
  createChatroom: async (name, description = '', isPublic = true, maxMembers = 100) => {
    try {
      console.log('createChatroom called with:', { name, description, isPublic, maxMembers });
      const authToken = getStoredAuthToken();
      console.log('Token available:', !!authToken);
      
      if (!authToken) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      if (!name || !name.trim()) {
        throw new Error('Chatroom name is required');
      }
      
      const response = await axios.post(`${API_URL}`, {
        name: name.trim(),
        description: description.trim(),
        isPublic,
        maxMembers
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('createChatroom response:', response.data);
      return response.data;
    } catch (error) {
      console.error('createChatroom error response:', error.response);
      console.error('createChatroom error:', error);
      
      // Provide more detailed error message
      let errorMsg = 'Failed to create chatroom';
      if (error.response?.status === 401) {
        errorMsg = 'Authentication failed. Please log in again.';
      } else if (error.response?.status === 400) {
        errorMsg = error.response.data?.error || 'Invalid chatroom details';
      } else if (error.response?.status === 409) {
        errorMsg = 'A chatroom with this name already exists';
      } else if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      throw errorMsg;
    }
  },

  // Join a chatroom
  joinChatroom: async (chatroomId) => {
    try {
      const authToken = getStoredAuthToken();
      if (!authToken) {
        throw new Error('Authentication required. Please log in.');
      }

      const response = await axios.post(`${API_URL}/${chatroomId}/join`, {}, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to join chatroom';
    }
  },

  // Leave a chatroom
  leaveChatroom: async (chatroomId) => {
    try {
      const authToken = getStoredAuthToken();
      if (!authToken) {
        throw new Error('Authentication required. Please log in.');
      }

      const response = await axios.post(`${API_URL}/${chatroomId}/leave`, {}, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to leave chatroom';
    }
  },

  // Get chatroom members
  getMembers: async (chatroomId, limit = 50, offset = 0) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.get(`${API_URL}/${chatroomId}/members`, {
        params: { limit, offset },
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to load members';
    }
  },

  // Get messages for a chatroom
  getMessages: async (chatroomId, limit = 50, offset = 0) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.get(`${API_URL}/${chatroomId}/messages`, {
        params: { limit, offset },
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to load messages';
    }
  },

  // Send message to chatroom
  sendMessage: async (chatroomId, message) => {
    try {
      const authToken = getStoredAuthToken();
      if (!authToken) {
        throw new Error('Authentication required. Please log in.');
      }

      const response = await axios.post(`${API_URL}/${chatroomId}/messages`, {
        message
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to send message';
    }
  }
};

export default chatroomService;
