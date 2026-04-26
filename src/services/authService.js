import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

const API_URL = `${API_BASE_URL}/auth`;

/**
 * Authentication Service
 * Handles all authentication operations
 */
export const authService = {
  /**
   * User signup
   */
  signup: async (email, password, confirmPassword) => {
    try {
      const response = await axios.post(`${API_URL}/signup`, {
        email,
        password,
        confirmPassword
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Signup failed';
    }
  },

  /**
   * User login
   */
  login: async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/login`, {
        email,
        password
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Login failed';
    }
  },

  /**
   * Verify authentication token
   */
  verifyToken: async (token) => {
    try {
      const response = await axios.get(`${API_URL}/verify`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Token verification failed';
    }
  },

  /**
   * Check if username is available
   */
  checkUsername: async (username) => {
    try {
      const response = await axios.get(`${API_URL}/check-username`, {
        params: { username }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to check username';
    }
  },

  /**
   * Check if email is available
   */
  checkEmail: async (email) => {
    try {
      const response = await axios.get(`${API_URL}/check-email`, {
        params: { email }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to check email';
    }
  }
};
