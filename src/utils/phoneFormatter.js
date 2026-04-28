/**
 * Phone Number Formatter for Firebase SMS
 * Converts various phone number formats to Firebase-compatible format (+country_code + digits)
 */

/**
 * Format phone number for Firebase SMS (must include country code)
 * @param {string} phoneNumber - Phone number in any format
 * @param {string} countryCode - Country code (default: +91 for India)
 * @returns {string} Formatted phone number with country code
 */
export const formatPhoneForFirebase = (phoneNumber, countryCode = '+91') => {
  if (!phoneNumber) return '';

  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // Remove existing + signs and re-add
  cleaned = cleaned.replace(/\+/g, '');

  // If no country code provided, add default
  if (!cleaned.startsWith(countryCode.replace('+', ''))) {
    // Remove leading 0 if present (Indian format)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = countryCode.replace('+', '') + cleaned;
  }

  return `+${cleaned}`;
};

/**
 * Validate phone number format
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} True if valid format
 */
export const isValidPhoneFormat = (phoneNumber) => {
  if (!phoneNumber) return false;

  // Must start with + and have 10-15 digits after +
  const phoneRegex = /^\+\d{10,15}$/;
  return phoneRegex.test(phoneNumber);
};

/**
 * Validate Indian phone number specifically
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} True if valid Indian phone
 */
export const isValidIndianPhone = (phoneNumber) => {
  if (!phoneNumber) return false;

  // Indian format: +91 followed by 10 digits
  const indianPhoneRegex = /^\+91\d{10}$/;
  return indianPhoneRegex.test(phoneNumber);
};

/**
 * Get phone error message
 * @param {string} phoneNumber - Phone number to check
 * @returns {string|null} Error message or null if valid
 */
export const getPhoneErrorMessage = (phoneNumber) => {
  if (!phoneNumber) {
    return 'Phone number is required for SMS OTP';
  }

  if (!isValidPhoneFormat(phoneNumber)) {
    return 'Phone number must include country code (e.g., +91 for India) with 10-15 digits';
  }

  return null;
};

/**
 * Mask phone number for display
 * @param {string} phoneNumber - Full phone number
 * @returns {string} Masked phone number
 */
export const maskPhoneNumber = (phoneNumber) => {
  if (!phoneNumber || phoneNumber.length < 6) return phoneNumber;

  const lastFourDigits = phoneNumber.slice(-4);
  return `****${lastFourDigits}`;
};

export default {
  formatPhoneForFirebase,
  isValidPhoneFormat,
  isValidIndianPhone,
  getPhoneErrorMessage,
  maskPhoneNumber
};
