const rateLimit = require('express-rate-limit');
const { redis, isRedisReady } = require('../utils/redis');

let RedisStore = null;

try {
  const importedRedisStore = require('rate-limit-redis');
  RedisStore = importedRedisStore.default || importedRedisStore;
} catch (error) {
  RedisStore = null;
}

const userOrIpKeyGenerator = (req) => req.user?.id || req.ip;

const buildStore = (prefix) => {
  if (!RedisStore || !redis || !isRedisReady()) {
    return undefined;
  }

  try {
    return new RedisStore({
      client: redis,
      prefix
    });
  } catch (error) {
    console.warn(`Rate limiter store fallback enabled for ${prefix}: ${error.message}`);
    return undefined;
  }
};

const buildRateLimitConfig = (options, prefix) => {
  const config = { ...options };
  const store = buildStore(prefix);

  if (store) {
    config.store = store;
  }

  return config;
};

const createRateLimiter = (options, prefix) =>
  rateLimit(buildRateLimitConfig(options, prefix));

const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
}, 'rl:api:');

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many login attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
}, 'rl:auth:');

const otpLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 3,
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many OTP requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
}, 'rl:otp:');

const messageLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: userOrIpKeyGenerator,
  message: {
    error: 'Too many messages sent, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false
}, 'rl:msg:');

const profileViewLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: userOrIpKeyGenerator,
  message: {
    error: 'Too many profile views, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false
}, 'rl:profile:');

const interactionLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 50,
  keyGenerator: userOrIpKeyGenerator,
  message: {
    error: 'Too many interactions, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false
}, 'rl:interaction:');

const reportLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: userOrIpKeyGenerator,
  message: {
    error: 'Too many reports submitted, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
}, 'rl:report:');

module.exports = {
  apiLimiter,
  authLimiter,
  otpLimiter,
  messageLimiter,
  profileViewLimiter,
  interactionLimiter,
  reportLimiter
};
