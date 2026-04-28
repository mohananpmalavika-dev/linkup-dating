/**
 * Double Dates Frontend Service
 * API wrapper for double dates endpoints
 */

const API_BASE = '/api/double-dates';

export const doubleDateService = {
  /**
   * Create a new double date request
   */
  async createRequest(matchId, friendId, friendMatchId, details) {
    const response = await fetch(`${API_BASE}/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        matchId,
        friendId,
        friendMatchId,
        proposedDate: details.proposedDate,
        proposedLocation: details.proposedLocation,
        proposedActivity: details.proposedActivity,
        message: details.message
      })
    });

    if (!response.ok) throw new Error('Failed to create request');
    return response.json();
  },

  /**
   * Get pending requests for current user
   */
  async getPendingRequests() {
    const response = await fetch(`${API_BASE}/requests/pending`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to fetch requests');
    return response.json();
  },

  /**
   * Approve a double date request
   */
  async approveRequest(requestId) {
    const response = await fetch(`${API_BASE}/request/${requestId}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to approve request');
    return response.json();
  },

  /**
   * Reject a double date request
   */
  async rejectRequest(requestId) {
    const response = await fetch(`${API_BASE}/request/${requestId}/reject`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to reject request');
    return response.json();
  },

  /**
   * Get active double date groups
   */
  async getActiveGroups() {
    const response = await fetch(`${API_BASE}/groups`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to fetch groups');
    return response.json();
  },

  /**
   * Mark double date as completed
   */
  async markCompleted(groupId) {
    const response = await fetch(`${API_BASE}/group/${groupId}/complete`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to mark completed');
    return response.json();
  },

  /**
   * Rate a double date
   */
  async rateDoubleDate(groupId, ratings) {
    const response = await fetch(`${API_BASE}/group/${groupId}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(ratings)
    });

    if (!response.ok) throw new Error('Failed to rate double date');
    return response.json();
  },

  /**
   * Enable friend verification (share match with friend)
   */
  async enableFriendVerification(matchId, friendId) {
    const response = await fetch(`${API_BASE}/friend-verification/enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ matchId, friendId })
    });

    if (!response.ok) throw new Error('Failed to enable verification');
    return response.json();
  },

  /**
   * Get matches shared with you for verification
   */
  async getFriendVerifications() {
    const response = await fetch(`${API_BASE}/friend-verification/shared-with-me`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (!response.ok) throw new Error('Failed to fetch verifications');
    return response.json();
  },

  /**
   * Respond to friend verification
   */
  async respondToVerification(verificationId, approved, feedback) {
    const response = await fetch(`${API_BASE}/friend-verification/${verificationId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ approved, feedback })
    });

    if (!response.ok) throw new Error('Failed to respond to verification');
    return response.json();
  }
};

export default doubleDateService;
