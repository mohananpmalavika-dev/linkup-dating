import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const conversationQualityService = {
  /**
   * Get conversation quality metrics for a match
   */
  async getQualityMetrics(matchId) {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(
        `${API_URL}/api/conversation-quality/${matchId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching quality metrics:', error);
      throw error;
    }
  },

  /**
   * Get AI-powered suggestions for a conversation
   */
  async getSuggestions(matchId) {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(
        `${API_URL}/api/conversation-quality/${matchId}/suggestions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data.suggestions;
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      throw error;
    }
  },

  /**
   * Get previous suggestions for a match
   */
  async getPreviousSuggestions(matchId, limit = 5) {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(
        `${API_URL}/api/conversation-quality/${matchId}/previous-suggestions?limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data.suggestions;
    } catch (error) {
      console.error('Error fetching previous suggestions:', error);
      throw error;
    }
  },

  /**
   * Mark a suggestion as used
   */
  async markSuggestionUsed(matchId, suggestionId, rating = null) {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.post(
        `${API_URL}/api/conversation-quality/${matchId}/suggestions/${suggestionId}/use`,
        { rating },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error marking suggestion used:', error);
      throw error;
    }
  },

  /**
   * Get insights about conversation quality
   */
  async getInsights(matchId) {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(
        `${API_URL}/api/conversation-quality/${matchId}/insights`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching insights:', error);
      throw error;
    }
  }
};

export default conversationQualityService;
