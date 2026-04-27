import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

const API_URL = `${API_BASE_URL}/messaging`;

/**
 * Messaging Enhancement Service
 * Handles message templates, search, encryption, export, and more
 */
export const messagingEnhancedService = {
  // ===========================
  // MESSAGE TEMPLATES
  // ===========================

  /**
   * Get user's message templates
   */
  getTemplates: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.pinned) params.append('pinned', filters.pinned);

      const response = await axios.get(`${API_URL}/templates?${params.toString()}`);
      return response.data.templates || [];
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch templates';
    }
  },

  /**
   * Create a new message template
   */
  createTemplate: async (templateData) => {
    try {
      const response = await axios.post(`${API_URL}/templates`, {
        title: templateData.title,
        content: templateData.content,
        category: templateData.category || 'general',
        emoji: templateData.emoji
      });
      return response.data.template;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to create template';
    }
  },

  /**
   * Update a message template
   */
  updateTemplate: async (templateId, templateData) => {
    try {
      const response = await axios.put(`${API_URL}/templates/${templateId}`, {
        title: templateData.title,
        content: templateData.content,
        category: templateData.category,
        emoji: templateData.emoji,
        isPinned: templateData.isPinned
      });
      return response.data.template;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to update template';
    }
  },

  /**
   * Delete a message template
   */
  deleteTemplate: async (templateId) => {
    try {
      const response = await axios.delete(`${API_URL}/templates/${templateId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to delete template';
    }
  },

  /**
   * Log template usage
   */
  useTemplate: async (templateId) => {
    try {
      const response = await axios.post(`${API_URL}/templates/${templateId}/use`);
      return response.data.template;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to log template usage';
    }
  },

  // ===========================
  // MESSAGE SEARCH & FILTERING
  // ===========================

  /**
   * Search messages
   */
  searchMessages: async (query, filters = {}) => {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: filters.limit || 50,
        offset: filters.offset || 0
      });

      if (filters.matchId) params.append('matchId', filters.matchId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.type) params.append('type', filters.type);

      const response = await axios.get(`${API_URL}/search?${params.toString()}`);
      return {
        results: response.data.results || [],
        total: response.data.total || 0,
        limit: response.data.limit || 50,
        offset: response.data.offset || 0
      };
    } catch (error) {
      throw error.response?.data?.error || 'Failed to search messages';
    }
  },

  // ===========================
  // MESSAGE ENCRYPTION
  // ===========================

  /**
   * Initialize encryption for a match
   */
  initializeEncryption: async (matchId) => {
    try {
      const response = await axios.post(`${API_URL}/encryption/init`, { matchId });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to initialize encryption';
    }
  },

  /**
   * Decrypt an encrypted message
   */
  decryptMessage: async (messageId, encryptionKey) => {
    try {
      const response = await axios.post(`${API_URL}/encryption/decrypt`, {
        messageId,
        encryptionKey
      });
      return response.data.message;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to decrypt message';
    }
  },

  // ===========================
  // MESSAGE EXPORT & BACKUP
  // ===========================

  /**
   * Export messages in specified format
   */
  exportMessages: async (matchId, format = 'json', dateRange = {}) => {
    try {
      const params = new URLSearchParams({
        matchId,
        format
      });

      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);

      const response = await axios.get(`${API_URL}/export?${params.toString()}`, {
        responseType: 'blob'
      });

      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to export messages';
    }
  },

  /**
   * Download exported chat
   */
  downloadExport: async (matchId, format = 'json', dateRange = {}) => {
    try {
      const data = await messagingEnhancedService.exportMessages(matchId, format, dateRange);

      // Create blob and download
      let mimeType = 'application/json';
      let fileName = `chat-export-${Date.now()}.json`;

      switch (format) {
        case 'csv':
          mimeType = 'text/csv';
          fileName = `chat-export-${Date.now()}.csv`;
          break;
        case 'html':
          mimeType = 'text/html';
          fileName = `chat-export-${Date.now()}.html`;
          break;
        default:
          break;
      }

      const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return fileName;
    } catch (error) {
      throw error;
    }
  },

  /**
   * List chat backups
   */
  listBackups: async (matchId = null) => {
    try {
      const params = new URLSearchParams();
      if (matchId) params.append('matchId', matchId);

      const response = await axios.get(`${API_URL}/backups?${params.toString()}`);
      return response.data.backups || [];
    } catch (error) {
      throw error.response?.data?.error || 'Failed to list backups';
    }
  },

  /**
   * Create manual backup
   */
  createBackup: async (matchId) => {
    try {
      const response = await axios.post(`${API_URL}/backups/create`, { matchId });
      return response.data.backup;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to create backup';
    }
  },

  // ===========================
  // DISAPPEARING MESSAGES
  // ===========================

  /**
   * Send a disappearing message
   */
  sendDisappearingMessage: async (matchId, message, disappearAfterSeconds = 3600) => {
    try {
      const response = await axios.post(`${API_URL}/disappearing`, {
        matchId,
        message,
        disappearAfterSeconds
      });
      return response.data.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to send disappearing message';
    }
  }
};

export default messagingEnhancedService;
