const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { redis } = require('../utils/redis');

// General API rate limiter
const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:api:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:auth:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many authentication attempts, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// OTP rate limiter
const otpLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:otp:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 OTP requests per hour
  message: {
    error: 'Too many OTP requests, please try again after an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Message rate limiter
const messageLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:msg:'
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 messages per minute
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    error: 'Too many messages sent, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Profile view rate limiter (prevent scraping)
const profileViewLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:profile:'
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each user to 60 profile views per minute
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    error: 'Too many profile views, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Like/pass rate limiter
const interactionLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:interaction:'
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 50, // limit each user to 50 interactions per minute
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    error: 'Too many interactions, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Report rate limiter
const reportLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:report:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each user to 5 reports per hour
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    error: 'Too many reports submitted, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  otpLimiter,
  messageLimiter,
  profileViewLimiter,
  interactionLimiter,
  reportLimiter
};
