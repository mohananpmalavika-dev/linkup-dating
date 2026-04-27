/**
 * Icebreaker Suggestion Service (Frontend)
 * Handles communication with backend icebreaker suggestion endpoints
 */

const API_BASE = '/api/dating';

const icereakerSuggestionService = {
  /**
   * Get AI-generated opening message suggestions for a profile
   */
  async getSuggestions(profileId) {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE}/opening-templates/${profileId}/suggestions`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch suggestions');
    }

    return await response.json();
  },

  /**
   * Use a template suggestion to send a message
   */
  async useSuggestion(toUserId, message, templateId = null, interestTrigger = null) {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE}/opening-templates/use`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        toUserId,
        message,
        templateId,
        interestTrigger
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    return await response.json();
  },

  /**
   * Get top-performing templates
   */
  async getTopPerformers(limit = 10) {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE}/opening-templates/top-performers?limit=${limit}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch top performers');
    }

    return await response.json();
  },

  /**
   * Get recommended templates
   */
  async getRecommendations(limit = 5) {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE}/opening-templates/recommended?limit=${limit}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch recommendations');
    }

    return await response.json();
  },

  /**
   * Get user's custom templates
   */
  async getMyTemplates(category = null, limit = 20, offset = 0) {
    const token = localStorage.getItem('authToken');
    let url = `${API_BASE}/opening-templates/my-templates?limit=${limit}&offset=${offset}`;
    if (category) {
      url += `&category=${encodeURIComponent(category)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch templates');
    }

    return await response.json();
  },

  /**
   * Create a new custom template
   */
  async createTemplate(content, title, category = 'general', emoji = null, interestTrigger = null) {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE}/opening-templates/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        title,
        category,
        emoji,
        interestTrigger
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create template');
    }

    return await response.json();
  },

  /**
   * Update an existing template
   */
  async updateTemplate(templateId, { content, title, isPinned, category, emoji }) {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE}/opening-templates/${templateId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        title,
        isPinned,
        category,
        emoji
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update template');
    }

    return await response.json();
  },

  /**
   * Delete a template
   */
  async deleteTemplate(templateId) {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE}/opening-templates/${templateId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete template');
    }

    return await response.json();
  },

  /**
   * Track a response to a template message
   */
  async trackResponse(templateId, hasResponse = true) {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE}/opening-templates/track-response`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        templateId,
        hasResponse
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to track response');
    }

    return await response.json();
  }
};

export default icereakerSuggestionService;
