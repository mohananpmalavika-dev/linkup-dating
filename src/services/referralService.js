import socialService from './socialService';
import apiClient from './apiClient';

const API_BASE = '/referrals';

const normalizeFriend = (friend = {}) => ({
  id: friend.friendId || friend.userId || friend.id,
  name:
    friend.displayName ||
    friend.name ||
    [friend.firstName || friend.first_name, friend.lastName || friend.last_name]
      .filter(Boolean)
      .join(' ') ||
    'DatingHub friend',
  email: friend.email || '',
  phone: friend.phone || friend.phoneNumber || '',
  avatar: friend.avatar || friend.photoUrl || friend.photo_url || 'Friend'
});

const buildInviteMessage = (referralCode, referralLink) =>
  `Join me on DatingHub. Use code ${referralCode} or sign up here: ${referralLink}`;

export const referralService = {
  async getMyReferralCode() {
    const response = await apiClient.get(`${API_BASE}/my-code`);
    return response.data;
  },

  async getReferralCode() {
    return this.getMyReferralCode();
  },

  async acceptReferralCode(code) {
    const response = await apiClient.post(`${API_BASE}/accept`, {
      referralCode: code
    });
    return response.data;
  },

  async getReferralStats() {
    const response = await apiClient.get(`${API_BASE}/stats`);
    return response.data;
  },

  async getPendingRewards() {
    const response = await apiClient.get(`${API_BASE}/rewards/pending`);
    return response.data;
  },

  async claimRewards() {
    const response = await apiClient.post(`${API_BASE}/rewards/claim`);
    return response.data;
  },

  async getReferralHistory() {
    const response = await apiClient.get(`${API_BASE}/history`);
    return response.data;
  },

  async getLeaderboard(limit = 10) {
    const response = await apiClient.get(`${API_BASE}/leaderboard`, {
      params: { limit }
    });
    return response.data;
  },

  async getFriends() {
    const result = await socialService.getFriends('accepted', 100, 0, 'all');
    return {
      success: true,
      data: Array.isArray(result?.friends) ? result.friends.map(normalizeFriend) : []
    };
  },

  async sendInvites(friends = [], inviteMethod = 'link', referralCode = '') {
    const referralInfo = await this.getMyReferralCode();
    const code = referralCode || referralInfo.code;
    const link = referralInfo.link;
    const message = buildInviteMessage(code, link);
    const normalizedFriends = (Array.isArray(friends) ? friends : []).map(normalizeFriend);

    if (!code || !link) {
      return {
        success: false,
        message: 'Referral information is unavailable right now.'
      };
    }

    if (inviteMethod === 'email') {
      const recipients = normalizedFriends.map((friend) => friend.email).filter(Boolean);
      if (recipients.length === 0) {
        return { success: false, message: 'Selected friends do not have email addresses.' };
      }

      window.location.href = `mailto:${recipients.join(',')}?subject=${encodeURIComponent(
        'Join me on DatingHub'
      )}&body=${encodeURIComponent(message)}`;

      return { success: true };
    }

    if (inviteMethod === 'sms') {
      const recipient = normalizedFriends.find((friend) => friend.phone)?.phone || '';
      window.location.href = `sms:${recipient}?body=${encodeURIComponent(message)}`;
      return { success: true };
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on DatingHub',
          text: message,
          url: link
        });
        return { success: true };
      } catch (error) {
        if (error?.name !== 'AbortError') {
          await navigator.clipboard.writeText(message);
          return {
            success: true,
            message: 'Invite copied to clipboard.'
          };
        }

        return { success: false, message: 'Invite sharing was canceled.' };
      }
    }

    await navigator.clipboard.writeText(message);
    return {
      success: true,
      message: 'Invite copied to clipboard.'
    };
  }
};

export default referralService;
