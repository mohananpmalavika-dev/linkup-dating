import axios from 'axios';
import { API_BASE_URL } from '../utils/api';
import { getStoredAuthToken } from '../utils/auth';

const API_URL = `${API_BASE_URL}/social`;

/**
 * Social Features Service
 * Handles referrals, friend relationships, social integrations, and group chats
 */

export const socialService = {
  // ========== HUB METHODS ==========

  /**
   * Get the consolidated social hub payload
   */
  getHub: async () => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.get(`${API_URL}/hub`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to load social hub';
    }
  },

  // ========== REFERRAL METHODS ==========

  /**
   * Get current user's referral code and link
   */
  getReferralInfo: async () => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.get(`${API_URL}/referral/me`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to get referral info';
    }
  },

  /**
   * Get referral statistics
   */
  getReferralStats: async () => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.get(`${API_URL}/referral/stats`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to get referral stats';
    }
  },

  /**
   * Validate referral code during signup
   */
  validateReferralCode: async (code) => {
    try {
      const response = await axios.post(`${API_URL}/referral/validate`, { code });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Invalid referral code';
    }
  },

  /**
   * Complete referral reward application for the signed-in user
   */
  completeReferral: async (code) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.post(`${API_URL}/referral/complete`, { code }, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to apply referral';
    }
  },

  // ========== FRIEND METHODS ==========

  /**
   * Send friend request
   */
  sendFriendRequest: async (targetUserId) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.post(`${API_URL}/friends/add`, { targetUserId }, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to send friend request';
    }
  },

  /**
   * Accept friend request
   */
  acceptFriendRequest: async (friendshipId) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.post(`${API_URL}/friends/${friendshipId}/accept`, {}, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to accept friend request';
    }
  },

  /**
   * Decline friend request
   */
  declineFriendRequest: async (friendshipId) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.post(`${API_URL}/friends/${friendshipId}/decline`, {}, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to decline friend request';
    }
  },

  /**
   * Get user's friends list
   */
  getFriends: async (status = 'accepted', limit = 50, offset = 0, direction = 'all') => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.get(`${API_URL}/friends/list`, {
        params: { status, limit, offset, direction },
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to get friends';
    }
  },

  /**
   * Get friendship status with another user
   */
  getFriendStatus: async (targetUserId) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.get(`${API_URL}/friends/status/${targetUserId}`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to get friendship status';
    }
  },

  /**
   * Remove friend
   */
  removeFriend: async (friendshipId) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.delete(`${API_URL}/friends/${friendshipId}`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to remove friend';
    }
  },

  // ========== SOCIAL INTEGRATION METHODS ==========

  /**
   * Add social media integration (Instagram, TikTok, etc.)
   */
  addSocialIntegration: async (platform, username, isPublic = false) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.post(`${API_URL}/integrations`, {
        platform,
        username,
        isPublic
      }, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to add social integration';
    }
  },

  /**
   * Get user's social integrations
   */
  getSocialIntegrations: async () => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.get(`${API_URL}/integrations`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch social integrations';
    }
  },

  /**
   * Update an existing social integration
   */
  updateSocialIntegration: async (integrationId, updates) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.patch(`${API_URL}/integrations/${integrationId}`, updates, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to update integration';
    }
  },

  /**
   * Remove social integration
   */
  removeSocialIntegration: async (integrationId) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.delete(`${API_URL}/integrations/${integrationId}`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to remove integration';
    }
  },

  /**
   * Get user's public social profiles
   */
  getPublicSocialProfiles: async (userId) => {
    try {
      const response = await axios.get(`${API_URL}/integrations/${userId}/public`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch social profiles';
    }
  },

  // ========== COMMUNITY ROOM METHODS ==========

  /**
   * Join or create a curated community room
   */
  joinCommunityRoom: async (roomSlug) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.post(`${API_URL}/community-rooms/${roomSlug}/join`, {}, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to join community room';
    }
  },

  // ========== DATING REFERRAL METHODS ==========

  /**
   * Accept a dating introduction/referral
   */
  acceptDatingReferral: async (referralId) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.post(`${API_BASE_URL}/dating/referrals/${referralId}/accept`, {}, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to accept referral';
    }
  },

  // ========== GROUP CHAT METHODS ==========

  /**
   * Create group chat
   */
  createGroupChat: async (name, description = '', memberIds = [], groupType = 'custom', matchId = null) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.post(`${API_URL}/group-chats`, {
        name,
        description,
        memberIds,
        groupType,
        matchId
      }, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to create group chat';
    }
  },

  /**
   * Get user's group chats
   */
  getGroupChats: async () => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.get(`${API_URL}/group-chats`, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch group chats';
    }
  },

  /**
   * Send message to group chat
   */
  sendGroupMessage: async (groupId, message, mediaType = null, mediaUrl = null) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.post(`${API_URL}/group-chats/${groupId}/messages`, {
        message,
        mediaType,
        mediaUrl
      }, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to send message';
    }
  },

  /**
   * Get group chat messages
   */
  getGroupMessages: async (groupId, limit = 50, offset = 0) => {
    try {
      const authToken = getStoredAuthToken();
      const response = await axios.get(`${API_URL}/group-chats/${groupId}/messages`, {
        params: { limit, offset },
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch messages';
    }
  },

  /**
   * Leave group chat
   */
  leaveGroupChat: async (groupId) => {
    try {
      const response = await axios.post(`${API_URL}/group-chats/${groupId}/leave`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to leave group';
    }
  }
};

export default socialService;
