/**
 * Referral Frontend Service
 * API wrapper for referral endpoints
 */

const API_BASE = '/api/referrals';

export const referralService = {
  /**
   * Get or create referral code
   */
  async getMyReferralCode() {
    const response = await fetch(`${API_BASE}/my-code`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to fetch referral code');
    return response.json();
  },

  /**
   * Accept/redeem a referral code
   */
  async acceptReferralCode(code) {
    const response = await fetch(`${API_BASE}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ referralCode: code })
    });

    if (!response.ok) throw new Error('Failed to accept referral code');
    return response.json();
  },

  /**
   * Get referral statistics
   */
  async getReferralStats() {
    const response = await fetch(`${API_BASE}/stats`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to fetch referral stats');
    return response.json();
  },

  /**
   * Get pending rewards
   */
  async getPendingRewards() {
    const response = await fetch(`${API_BASE}/rewards/pending`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to fetch pending rewards');
    return response.json();
  },

  /**
   * Claim all rewards
   */
  async claimRewards() {
    const response = await fetch(`${API_BASE}/rewards/claim`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to claim rewards');
    return response.json();
  },

  /**
   * Get referral history (who referred you)
   */
  async getReferralHistory() {
    const response = await fetch(`${API_BASE}/history`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to fetch referral history');
    return response.json();
  },

  /**
   * Get top referrers leaderboard
   */
  async getLeaderboard(limit = 10) {
    const response = await fetch(`${API_BASE}/leaderboard?limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to fetch leaderboard');
    return response.json();
  }
};

export default referralService;
