/**
 * Custom error class for reminder operations
 * Extends Error with additional context for proper error handling and user feedback
 * 
 * @class ReminderError
 * @extends Error
 * 
 * @param {string} message - User-friendly error message
 * @param {string} [type='UNKNOWN'] - Error type (NETWORK, VALIDATION, SERVER, AUTH, NOT_FOUND)
 * @param {number} [statusCode=null] - HTTP status code
 * 
 * @example
 * try {
 *   const reminders = await fetchReminders();
 * } catch (error) {
 *   if (error instanceof ReminderError) {
 *     console.log(error.message); // User-friendly message
 *     console.log(error.type); // Error type
 *     if (error.isRetryable()) {
 *       // Retry the operation
 *     }
 *   }
 * }
 */
export class ReminderError extends Error {
  constructor(message, type = 'UNKNOWN', statusCode = null) {
    super(message);
    this.name = 'ReminderError';
    this.type = type; // NETWORK, VALIDATION, SERVER, AUTH
    this.statusCode = statusCode;
    this.timestamp = new Date();
  }

  /**
   * Convert Axios error to ReminderError with proper type and message
   * 
   * @static
   * @param {Error} error - Axios error object
   * @returns {ReminderError} Formatted error with type and status
   * 
   * @example
   * axios.get('/reminders')
   *   .catch(error => {
   *     throw ReminderError.fromAxiosError(error);
   *   });
   */
  static fromAxiosError(error) {
    if (!error.response) {
      return new ReminderError(
        'Unable to connect to server. Check your internet connection.',
        'NETWORK',
        null
      );
    }

    const status = error.response.status;
    const data = error.response.data;

    if (status === 401 || status === 403) {
      return new ReminderError(
        'Your session has expired. Please log in again.',
        'AUTH',
        status
      );
    }

    if (status === 400) {
      return new ReminderError(
        data.message || 'Invalid reminder details. Please check and try again.',
        'VALIDATION',
        status
      );
    }

    if (status === 404) {
      return new ReminderError(
        'Reminder not found. It may have been deleted.',
        'NOT_FOUND',
        status
      );
    }

    if (status >= 500) {
      return new ReminderError(
        'Server error. Our team has been notified. Please try again in a few moments.',
        'SERVER',
        status
      );
    }

    return new ReminderError(
      data.message || 'An unexpected error occurred.',
      'UNKNOWN',
      status
    );
  }

  /**
   * Check if error is retryable (network or server issues)
   * 
   * @returns {boolean} True if operation should be retried
   */
  isRetryable() {
    return this.type === 'NETWORK' || this.type === 'SERVER';
  }

  /**
   * Check if error is authentication-related
   * 
   * @returns {boolean} True if user needs to re-authenticate
   */
  isAuthError() {
    return this.type === 'AUTH';
  }
}

/**
 * Format error for user display in UI
 * Converts any error type into a consistent format for components
 * 
 * @param {Error|ReminderError} error - Error to format
 * @returns {Object} Formatted error object
 * @returns {string} returns.message - User-friendly error message
 * @returns {string} returns.type - Error type (NETWORK, AUTH, etc.)
 * @returns {boolean} returns.canRetry - Whether operation can be retried
 * @returns {boolean} returns.isAuthError - Whether auth is needed
 * 
 * @example
 * const errorForUI = formatErrorForUser(error);
 * 
 * return (
 *   <ErrorAlert
 *     message={errorForUI.message}
 *     canRetry={errorForUI.canRetry}
 *     onRetry={handleRetry}
 *   />
 * );
 */
export const formatErrorForUser = (error) => {
  if (error instanceof ReminderError) {
    return {
      message: error.message,
      type: error.type,
      canRetry: error.isRetryable(),
      isAuthError: error.isAuthError()
    };
  }

  return {
    message: 'An unexpected error occurred. Please try again.',
    type: 'UNKNOWN',
    canRetry: true,
    isAuthError: false
  };
};
