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
   * Get profiles for discovery (with optional filters and cursor pagination)
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
   * Superlike/swipe up on a profile
   */
  superlikeProfile: async (userId) => {
    try {
      const response = await axios.post(`${API_URL}/interactions/superlike`, { toUserId: userId });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to superlike profile';
    }
  },

  /**
   * Get daily like/superlike limits
   */
  getDailyLimits: async () => {
    try {
      const response = await axios.get(`${API_URL}/daily-limits`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch daily limits';
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

  /**
   * Block a user
   */
  blockUser: async (userId) => {
    try {
      const response = await axios.post(`${API_URL}/blocks`, { blockedUserId: userId });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to block user';
    }
  },

  /**
   * Get list of blocked users
   */
  getBlockedUsers: async () => {
    try {
      const response = await axios.get(`${API_URL}/blocks`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch blocked users';
    }
  },

  /**
   * Unblock a user
   */
  unblockUser: async (userId) => {
    try {
      const response = await axios.delete(`${API_URL}/blocks/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to unblock user';
    }
  },

  /**
   * Report a user
   */
  reportUser: async (userId, reason, description) => {
    try {
      const response = await axios.post(`${API_URL}/reports`, {
        reportedUserId: userId,
        reason,
        description,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to report user';
    }
  },

  /**
   * Save a profile to favorites
   */
  favoriteProfile: async (userId) => {
    try {
      const response = await axios.post(`${API_URL}/favorites`, {
        favoriteUserId: userId
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to save favorite';
    }
  },

  /**
   * Get favorite profiles
   */
  getFavorites: async () => {
    try {
      const response = await axios.get(`${API_URL}/favorites`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch favorites';
    }
  },

  /**
   * Remove a profile from favorites
   */
  removeFavorite: async (userId) => {
    try {
      const response = await axios.delete(`${API_URL}/favorites/${userId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to remove favorite';
    }
  },

  /**
   * Get search history
   */
  getSearchHistory: async (limit = 20) => {
    try {
      const response = await axios.get(`${API_URL}/search-history`, { params: { limit } });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch search history';
    }
  },

  /**
   * Clear search history
   */
  clearSearchHistory: async () => {
    try {
      const response = await axios.delete(`${API_URL}/search-history`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to clear search history';
    }
  },

  /**
   * Get in-app notifications
   */
  getNotifications: async (limit = 25) => {
    try {
      const response = await axios.get(`${API_URL}/notifications`, { params: { limit } });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch notifications';
    }
  },

  /**
   * Get unread notification count
   */
  getUnreadNotificationCount: async () => {
    try {
      const response = await axios.get(`${API_URL}/notifications/unread-count`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch notification count';
    }
  },

  /**
   * Mark one notification as read
   */
  markNotificationRead: async (notificationId) => {
    try {
      const response = await axios.post(`${API_URL}/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to update notification';
    }
  },

  /**
   * Mark all notifications as read
   */
  markAllNotificationsRead: async () => {
    try {
      const response = await axios.post(`${API_URL}/notifications/read-all`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to update notifications';
    }
  },

  /**
   * Get user preferences
   */
  getPreferences: async () => {
    try {
      const response = await axios.get(`${API_URL}/preferences`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch preferences';
    }
  },

  /**
   * Update user preferences
   */
  updatePreferences: async (preferences) => {
    try {
      const response = await axios.put(`${API_URL}/preferences`, preferences);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to update preferences';
    }
  },

  /**
   * Get top picks (most compatible profiles)
   */
  getTopPicks: async (limit = 10) => {
    try {
      const response = await axios.get(`${API_URL}/top-picks`, { params: { limit } });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch top picks';
    }
  },

  /**
   * Get smart discovery queue (personalized multi-factor ranking)
   */
  getDiscoveryQueue: async (page = 1, limit = 10) => {
    try {
      const response = await axios.get(`${API_URL}/discovery-queue`, { params: { page, limit } });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch discovery queue';
    }
  },

  /**
   * Get trending profiles
   */
  getTrendingProfiles: async (limit = 10) => {
    try {
      const response = await axios.get(`${API_URL}/trending`, { params: { limit } });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch trending profiles';
    }
  },

  /**
   * Get new profiles
   */
  getNewProfiles: async (limit = 10) => {
    try {
      const response = await axios.get(`${API_URL}/new-profiles`, { params: { limit } });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch new profiles';
    }
  },

  /**
   * Rewind last pass (undo swipe left)
   */
  rewindPass: async () => {
    try {
      const response = await axios.post(`${API_URL}/interactions/rewind`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to rewind pass';
    }
  },

  /**
   * Get daily prompts
   */
  getDailyPrompts: async () => {
    try {
      const response = await axios.get(`${API_URL}/daily-prompts`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch daily prompts';
    }
  },

  /**
   * Answer a daily prompt
   */
  answerDailyPrompt: async (promptId, response) => {
    try {
      const result = await axios.post(`${API_URL}/daily-prompts/${promptId}/answer`, { response });
      return result.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to answer prompt';
    }
  },

  /**
   * Delete a daily prompt answer
   */
  deleteDailyPromptAnswer: async (promptId) => {
    try {
      const response = await axios.delete(`${API_URL}/daily-prompts/${promptId}/answer`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to delete prompt answer';
    }
  },

  /**
   * Get user's answered prompts
   */
  getProfilePrompts: async () => {
    try {
      const response = await axios.get(`${API_URL}/profiles/me/prompts`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch profile prompts';
    }
  },

  /**
   * Get notification preferences
   */
  getNotificationPreferences: async () => {
    try {
      const response = await axios.get(`${API_URL}/notification-preferences`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch notification preferences';
    }
  },

  /**
   * Update notification preferences
   */
  updateNotificationPreferences: async (preferences) => {
    try {
      const response = await axios.put(`${API_URL}/notification-preferences`, preferences);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to update notification preferences';
    }
  },

  // ========== PHASE 3: SAFETY & PREMIUM ==========

  /**
   * Get photo verification pose challenge
   */
  getVerificationChallenge: async () => {
    try {
      const response = await axios.get(`${API_URL}/verify-photo/challenge`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to get verification challenge';
    }
  },

  /**
   * Submit photo verification selfie
   */
  verifyPhoto: async (photoBase64) => {
    try {
      const response = await axios.post(`${API_URL}/profiles/me/verify-photo`, { photoBase64 });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to submit verification photo';
    }
  },

  /**
   * Get photo verification status
   */
  getVerificationStatus: async () => {
    try {
      const response = await axios.get(`${API_URL}/profiles/me/verification-status`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to get verification status';
    }
  },

  /**
   * Get subscription plans
   */
  getSubscriptionPlans: async () => {
    try {
      const response = await axios.get(`${API_URL}/subscription/plans`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to get subscription plans';
    }
  },

  /**
   * Get current user's subscription
   */
  getMySubscription: async () => {
    try {
      const response = await axios.get(`${API_URL}/subscription/me`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to get subscription';
    }
  },

  /**
   * Create subscription (simulate)
   */
  createSubscription: async (plan) => {
    try {
      const response = await axios.post(`${API_URL}/subscription/create`, { plan });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to create subscription';
    }
  },

  /**
   * Cancel subscription
   */
  cancelSubscription: async () => {
    try {
      const response = await axios.delete(`${API_URL}/subscription/cancel`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to cancel subscription';
    }
  },

  /**
   * Boost profile visibility
   */
  boostProfile: async () => {
    try {
      const response = await axios.post(`${API_URL}/profiles/me/boost`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to boost profile';
    }
  },

  /**
   * Get who liked me (requires premium)
   */
  getWhoLikedMe: async () => {
    try {
      const response = await axios.get(`${API_URL}/who-liked-me`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to get likes';
    }
  },

  /**
   * Send message request to non-match
   */
  sendMessageRequest: async (toUserId, message) => {
    try {
      const response = await axios.post(`${API_URL}/message-requests`, { toUserId, message });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to send message request';
    }
  },

  /**
   * Get incoming message requests
   */
  getMessageRequests: async () => {
    try {
      const response = await axios.get(`${API_URL}/message-requests`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to get message requests';
    }
  },

  /**
   * Accept message request
   */
  acceptMessageRequest: async (requestId) => {
    try {
      const response = await axios.post(`${API_URL}/message-requests/${requestId}/accept`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to accept request';
    }
  },

  /**
   * Decline message request
   */
  declineMessageRequest: async (requestId) => {
    try {
      const response = await axios.post(`${API_URL}/message-requests/${requestId}/decline`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to decline request';
    }
  },

  // ========== PHASE 4: ADVANCED PROFILE ANALYTICS & INSIGHTS ==========

  /**
   * Record a profile view
   */
  recordProfileView: async (userId) => {
    try {
      const response = await axios.post(`${API_URL}/profiles/${userId}/view`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to record profile view';
    }
  },

  /**
   * Get profile analytics (strength, views, interactions)
   */
  getProfileAnalytics: async () => {
    try {
      const response = await axios.get(`${API_URL}/profiles/me/analytics`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to get analytics';
    }
  },

  /**
   * Get who viewed my profile (requires premium)
   */
  getProfileViews: async (limit = 20, page = 1) => {
    try {
      const response = await axios.get(`${API_URL}/profiles/me/profile-views`, {
        params: { limit, page }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to get profile views';
    }
  },

  /**
   * Get compatibility score with a profile
   */
  getCompatibility: async (userId) => {
    try {
      const response = await axios.get(`${API_URL}/profiles/${userId}/compatibility`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to get compatibility';
    }
  },

  /**
   * Send heartbeat to update last active
   */
  sendHeartbeat: async () => {
    try {
      const response = await axios.post(`${API_URL}/profiles/me/heartbeat`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to update activity';
    }
  },
};

export default datingProfileService;
