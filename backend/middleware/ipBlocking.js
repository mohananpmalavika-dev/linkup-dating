/**
 * IP Blocking Middleware
 * Checks if incoming IP is blocked before processing request
 */

const IPBlockingService = require('../services/ipBlockingService');

const getClientIP = (req) => {
  // Check various headers that may contain the real IP
  return (
    req.headers['x-forwarded-for']?.split(',')[0] || // X-Forwarded-For (from proxy)
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.ip ||
    req.connection?.remoteAddress ||
    null
  );
};

/**
 * Middleware to check if IP is blocked
 * Can be used on specific routes or globally
 */
const checkIPBlock = async (req, res, next) => {
  try {
    const clientIP = getClientIP(req);

    if (!clientIP) {
      return next(); // No IP to check, proceed
    }

    // Check if IP is blocked
    const isBlocked = await IPBlockingService.isIPBlocked(clientIP);

    if (isBlocked) {
      const blockDetails = await IPBlockingService.getIPBlockDetails(clientIP);

      return res.status(403).json({
        success: false,
        error: 'Access Denied',
        message: 'Your IP address is temporarily blocked due to suspicious activity. Please try again later.',
        code: 'IP_BLOCKED',
        blockDetails: {
          reason: blockDetails?.reason,
          blockedAt: blockDetails?.blockedAt,
          expiresAt: blockDetails?.expiresAt,
          remainingMinutes: blockDetails?.remainingMinutes
        }
      });
    }

    // Store IP in request for later use
    req.clientIP = clientIP;
    next();
  } catch (error) {
    console.error('Error in IP blocking middleware:', error);
    // On error, allow request to proceed (fail open for availability)
    next();
  }
};

module.exports = {
  checkIPBlock,
  getClientIP
};
