import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

const API_URL = `${API_BASE_URL}/dating`;

/**
 * Dating Profile Service
 * Handles all dating profile operations including creation, retrieval, and profile management
 */

export const datingProfileService = {
  /**
   * Create or update user dating profile
   */
  createProfile: async (profileData) => {
    try {
      const response = await axios.post(`${API_URL}/profiles`, profileData);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to create profile';
    }
  },

  /**
   * Get current user's profile
   */
  getMyProfile: async () => {
    try {
      const response = await axios.get(`${API_URL}/profiles/me`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch profile';
    }
  },

  /**
   * Get profile by ID
   */
  getProfileById: async (userId) => {
    try {
      const response = await axios.get(`${API_URL}/profiles/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch profile';
    }
  },

  /**
   * Update profile information
   */
  updateProfile: async (profileData) => {
    try {
      const response = await axios.put(`${API_URL}/profiles/me`, profileData);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to update profile';
    }
  },

  /**
   * Upload profile photos
   */
  uploadProfilePhotos: async (files) => {
    try {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`photos`, file);
      });
      const response = await axios.post(`${API_URL}/profiles/me/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to upload photos';
    }
  },

  /**
   * Get profiles for discovery (with optional filters)
   */
  getDiscoveryProfiles: async (filters = {}) => {
    try {
      const response = await axios.get(`${API_URL}/discovery`, { params: filters });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch profiles';
    }
  },

  /**
   * Search profiles with advanced filters
   */
  searchProfiles: async (filters) => {
    try {
      const response = await axios.post(`${API_URL}/search`, filters);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to search profiles';
    }
  },

  /**
   * Like/swipe right on a profile
   */
  likeProfile: async (userId) => {
    try {
      const response = await axios.post(`${API_URL}/interactions/like`, { toUserId: userId });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to like profile';
    }
  },

  /**
   * Pass/swipe left on a profile
   */
  passProfile: async (userId) => {
    try {
      const response = await axios.post(`${API_URL}/interactions/pass`, { toUserId: userId });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to pass profile';
    }
  },

  /**
   * Get user's matches
   */
  getMatches: async (limit = 20, page = 1) => {
    try {
      const response = await axios.get(`${API_URL}/matches`, { params: { limit, page } });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch matches';
    }
  },

  /**
   * Get a single match by match ID
   */
  getMatchById: async (matchId) => {
    try {
      const response = await axios.get(`${API_URL}/matches/by-id/${matchId}`);
      return response.data.match;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch match';
    }
  },

  /**
   * Check if there's a mutual match with a user
   */
  checkMatch: async (userId) => {
    try {
      const response = await axios.get(`${API_URL}/matches/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'No match found';
    }
  },

  /**
   * Unmatch with a user
   */
  unmatch: async (matchId) => {
    try {
      const response = await axios.post(`${API_URL}/matches/${matchId}/unmatch`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to unmatch';
    }
  },

  /**
   * Get likes received (profiles that liked you)
   */
  getLikesReceived: async (limit = 20, page = 1) => {
    try {
      const response = await axios.get(`${API_URL}/likes-received`, { params: { limit, page } });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch likes';
    }
  },

  /**
   * Get profile interaction history
   */
  getInteractionHistory: async (limit = 50) => {
    try {
      const response = await axios.get(`${API_URL}/interaction-history`, { params: { limit } });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch history';
    }
  },

  /**
   * Get profile completion summary
   */
  getProfileCompletion: async () => {
    try {
      const response = await axios.get(`${API_URL}/profiles/me/completion`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch completion';
    }
  },

  /**
   * Verify identity
   */
  verifyIdentity: async (verificationData) => {
    try {
      const formData = new FormData();
      Object.keys(verificationData).forEach((key) => {
        if (verificationData[key] instanceof File) {
          formData.append(key, verificationData[key]);
        } else {
          formData.append(key, verificationData[key]);
        }
      });
      const response = await axios.post(`${API_URL}/profiles/me/verify`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to verify identity';
    }
  },
};

export default datingProfileService;
