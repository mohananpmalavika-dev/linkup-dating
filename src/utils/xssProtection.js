/**
 * XSS Protection utilities
 * Sanitizes user input to prevent XSS attacks
 */

/**
 * Simple HTML sanitizer - removes potentially dangerous HTML tags and attributes
 * For production use, install and use DOMPurify library
 * @param {string} html - HTML string to sanitize
 * @returns {string} - Sanitized HTML
 */
const sanitizeHtml = (html) => {
  if (typeof html !== 'string') {
    return '';
  }

  const div = document.createElement('div');
  div.textContent = html; // textContent automatically escapes HTML
  return div.innerHTML;
};

/**
 * Sanitize text content - removes all HTML tags
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
const sanitizeText = (text) => {
  if (typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

/**
 * Sanitize URL - removes javascript: protocol and other dangerous schemes
 * @param {string} url - URL to sanitize
 * @returns {string} - Sanitized URL or empty string if dangerous
 */
const sanitizeUrl = (url) => {
  if (typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim().toLowerCase();

  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  if (dangerousProtocols.some((proto) => trimmed.startsWith(proto))) {
    return '';
  }

  return url;
};

/**
 * Sanitize object - sanitizes all string properties in an object
 * @param {object} obj - Object to sanitize
 * @param {boolean} htmlMode - If true, preserve HTML; if false, plain text
 * @returns {object} - Sanitized object
 */
const sanitizeObject = (obj, htmlMode = false) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitizer = htmlMode ? sanitizeHtml : sanitizeText;
  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizer(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, htmlMode);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

export { sanitizeHtml, sanitizeText, sanitizeUrl, sanitizeObject };
