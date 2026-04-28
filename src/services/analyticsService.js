/**
 * Analytics Service
 * Frontend service for dating analytics API calls
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const analyticsService = {
  /**
   * Get personal stats (match rate, likes, etc.)
   */
  getPersonalStats: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/personal-stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching personal stats:', error);
      throw error;
    }
  },

  /**
   * Get profile performance vs industry average
   */
  getProfilePerformance: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/profile-performance`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching profile performance:', error);
      throw error;
    }
  },

  /**
   * Get monthly report with trends
   */
  getMonthlyReport: async (year, month) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/analytics/monthly-report?year=${year}&month=${month}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching monthly report:', error);
      throw error;
    }
  },

  /**
   * Get personalized recommendations
   */
  getRecommendations: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/recommendations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      throw error;
    }
  },

  /**
   * Get profile comparison with benchmarks
   */
  getProfileComparison: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/profile-comparison`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching profile comparison:', error);
      throw error;
    }
  },

  /**
   * Get complete analytics dashboard
   */
  getAnalyticsDashboard: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/dashboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching analytics dashboard:', error);
      throw error;
    }
  }
};

export default analyticsService;
