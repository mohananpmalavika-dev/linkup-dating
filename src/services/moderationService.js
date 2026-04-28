/**
 * Content Moderation Service (Frontend)
 * Scans user content before sending to backend
 * Handles text, images, and profile data
 */

import apiClient from './apiClient';

class ModerationService {
  /**
   * Scan text for inappropriate content
   * @param {string} text - Text to scan
   * @returns {Promise<{clean: boolean, severity: string, issues: Array}>}
   */
  async scanText(text) {
    if (!text || text.trim().length === 0) {
      return { clean: true, severity: 'none', issues: [] };
    }

    try {
      const response = await apiClient.post('/moderation/scan-text', { text });
      return response.data;
    } catch (error) {
      console.error('Text scan failed:', error);
      // On error, assume clean to avoid blocking users
      return { clean: true, severity: 'none', issues: [] };
    }
  }

  /**
   * Scan image for NSFW and inappropriate content
   * @param {string} imageUrl - URL of image to scan
   * @returns {Promise<{clean: boolean, nsfw: boolean, issues: Array}>}
   */
  async scanImage(imageUrl) {
    if (!imageUrl) {
      return { clean: true, nsfw: false, issues: [] };
    }

    try {
      const response = await apiClient.post('/moderation/scan-image', { imageUrl });
      return response.data;
    } catch (error) {
      console.error('Image scan failed:', error);
      // On error, assume clean
      return { clean: true, nsfw: false, issues: [] };
    }
  }

  /**
   * Scan user profile for issues
   * @param {Object} profileData - Profile data with username, bio, photos
   * @returns {Promise<{clean: boolean, severity: string, issues: Array}>}
   */
  async scanProfile(profileData) {
    if (!profileData) {
      return { clean: true, severity: 'none', issues: [] };
    }

    try {
      const response = await apiClient.post('/moderation/scan-profile', { profileData });
      return response.data;
    } catch (error) {
      console.error('Profile scan failed:', error);
      return { clean: true, severity: 'none', issues: [] };
    }
  }

  /**
   * Flag content for manual admin review
   * @param {string} contentType - Type of content (profile, message, photo, etc)
   * @param {string|number} contentId - ID of the content
   * @param {string} reason - Reason for flagging
   * @returns {Promise<{success: boolean, flagId: string}>}
   */
  async flagContent(contentType, contentId, reason) {
    try {
      const response = await apiClient.post('/moderation/flag', {
        contentType,
        contentId,
        reason
      });
      return response.data;
    } catch (error) {
      console.error('Flag content failed:', error);
      throw error;
    }
  }

  /**
   * Get severity level color for UI display
   * @param {string} severity - Severity level (none, low, medium, high)
   * @returns {string} - Color code or CSS class name
   */
  getSeverityColor(severity) {
    const severityMap = {
      'none': '#4CAF50',      // Green
      'low': '#FFC107',       // Amber
      'medium': '#FF9800',    // Orange
      'high': '#F44336'       // Red
    };
    return severityMap[severity] || '#757575'; // Gray default
  }

  /**
   * Get severity icon for UI display
   * @param {string} severity - Severity level
   * @returns {string} - Emoji or icon
   */
  getSeverityIcon(severity) {
    const iconMap = {
      'none': '✓',
      'low': '⚠️',
      'medium': '⚠️',
      'high': '❌'
    };
    return iconMap[severity] || '?';
  }

  /**
   * Get human-readable message for flagged content
   * @param {Array} issues - Array of issue objects
   * @returns {string} - Formatted message
   */
  formatIssueMessage(issues) {
    if (!Array.isArray(issues) || issues.length === 0) {
      return 'Content looks good!';
    }

    return issues.map(issue => {
      if (issue.type === 'profanity') {
        return `Profanity detected: ${issue.words?.join(', ') || 'inappropriate language'}`;
      } else if (issue.type === 'spam') {
        return 'Spam patterns detected (URLs, promotional content)';
      } else if (issue.type === 'harassment') {
        return 'Harassment or threatening language detected';
      } else if (issue.type === 'nsfw') {
        return 'NSFW content detected in image';
      } else if (issue.type === 'violence') {
        return 'Violent content detected in image';
      } else {
        return issue.message || 'Content flagged';
      }
    }).join(' | ');
  }

  /**
   * Check if severity should block sending (high severity)
   * @param {string} severity - Severity level
   * @returns {boolean} - True if should show warning dialog
   */
  shouldShowWarning(severity) {
    return severity === 'high' || severity === 'medium';
  }

  /**
   * Check if content is severely flagged (should require confirmation)
   * @param {string} severity - Severity level
   * @returns {boolean} - True if high severity
   */
  isHighSeverity(severity) {
    return severity === 'high';
  }
}

export default new ModerationService();
