/**
 * Shared utility functions for e-commerce modules
 */

/**
 * Format date for display in Indian locale
 * @param {string|Date} value - Date value to format
 * @returns {string} Formatted date string or "Date unavailable"
 */
export const formatDisplayDate = (value) => {
  if (!value) {
    return "Date unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Format date to ISO string (YYYY-MM-DD)
 * @param {string|Date} value - Date value to format
 * @returns {string} ISO date string or empty string
 */
export const formatISODate = (value) => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
};

/**
 * Format date for friendly display (e.g., "15 Apr 2024")
 * @param {string|Date} value - Date value to format
 * @returns {string|null} Formatted date or null if invalid
 */
export const formatFriendlyDate = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Normalize and validate order/seller status
 * @param {string} status - Status string to normalize
 * @param {string[]} validStatuses - Array of valid status values
 * @returns {string} Normalized status or default
 */
export const normalizeOrderStatus = (status, validStatuses = ["Confirmed", "Packed", "Shipped", "Delivered"]) => {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const matchedStatus = validStatuses.find(
    (orderStatus) => orderStatus.toLowerCase() === normalizedStatus
  );

  return matchedStatus || validStatuses[0];
};

/**
 * Get next status in the order workflow
 * @param {string} currentStatus - Current status
 * @param {string[]} statusSteps - Array of status steps
 * @returns {string} Next status or current if last
 */
export const getNextStatus = (currentStatus, statusSteps = ["Confirmed", "Packed", "Shipped", "Delivered"]) => {
  const normalized = normalizeOrderStatus(currentStatus, statusSteps);
  const currentIndex = statusSteps.indexOf(normalized);
  return statusSteps[currentIndex + 1] || normalized;
};

/**
 * Validate and format currency value
 * @param {number} value - Currency value
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value) => {
  const normalizedValue =
    typeof value === "number"
      ? value
      : Number(String(value || "").replace(/[^0-9.-]/g, "").trim());

  if (!Number.isFinite(normalizedValue)) {
    return "";
  }

  // Round to 2 decimal places
  const rounded = Math.round(normalizedValue * 100) / 100;
  
  // Remove trailing zeros and decimal point if not needed
  return String(rounded)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
};

/**
 * Validate Indian phone number
 * @param {string} phone - Phone number string
 * @returns {boolean} True if valid Indian phone
 */
export const isValidIndianPhone = (phone) => {
  const cleaned = String(phone || "").replace(/\D/g, "");
  return cleaned.length === 10 && /^[6-9]/.test(cleaned);
};

/**
 * Validate Indian pincode (6 digits)
 * @param {string} pincode - Pincode string
 * @returns {boolean} True if valid pincode
 */
export const isValidPincode = (pincode) => {
  const cleaned = String(pincode || "").trim();
  return /^\d{6}$/.test(cleaned);
};

/**
 * Validate Indian GSTIN
 * @param {string} gstin - GSTIN string
 * @returns {boolean} True if valid GSTIN
 */
export const isValidGSTIN = (gstin) => {
  const cleaned = String(gstin || "").trim().toUpperCase();
  if (!cleaned) {
    return false;
  }

  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(cleaned);
};

/**
 * Parse numeric input safely
 * @param {string|number} value - Input value
 * @returns {number|null} Parsed number or null
 */
export const parseNumericInput = (value) => {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Calculate return eligibility window text
 * @param {object} item - Item object with returnAllowed, returnWindowDays, returnEligibleUntil
 * @returns {string} Return window text
 */
export const getReturnWindowText = (item) => {
  if (!item?.returnAllowed) {
    return "Returns not allowed";
  }

  const eligibleUntil = item.returnEligibleUntil ? new Date(item.returnEligibleUntil) : null;
  
  if (eligibleUntil && !Number.isNaN(eligibleUntil.getTime())) {
    const remainingMs = eligibleUntil.getTime() - Date.now();
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    if (remainingMs < 0) {
      return "Return window expired";
    }

    return `Return by ${formatDisplayDate(item.returnEligibleUntil)} (${remainingDays} day${remainingDays === 1 ? "" : "s"} left)`;
  }

  return `Return window ${item.returnWindowDays || 0} day(s)`;
};

/**
 * Check if item is eligible for return
 * @param {object} item - Item object
 * @returns {boolean} True if eligible
 */
export const isItemReturnEligible = (item) => {
  if (!item?.returnAllowed || item?.returnRequest) {
    return false;
  }

  const eligibleUntil = item.returnEligibleUntil ? new Date(item.returnEligibleUntil) : null;
  if (!eligibleUntil || Number.isNaN(eligibleUntil.getTime())) {
    return false;
  }

  return Date.now() <= eligibleUntil.getTime();
};

/**
 * Title case string
 * @param {string} value - String to title case
 * @returns {string} Title cased string
 */
export const titleCase = (value) => {
  if (!value) {
    return "";
  }

  return String(value)
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
};

/**
 * Format a countdown duration in milliseconds
 * @param {number} value - Milliseconds remaining
 * @returns {string} Human-friendly countdown string
 */
export const formatCountdown = (value) => {
  const totalMs = Math.max(0, Number(value || 0));
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};
