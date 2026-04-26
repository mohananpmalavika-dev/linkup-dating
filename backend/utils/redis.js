const Redis = require('ioredis');
require('dotenv').config();

const redisConfig = process.env.REDIS_URL
  ? {
      url: process.env.REDIS_URL,
      tls: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    }
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    };

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log('✓ Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis error:', err.message);
});

// Helper functions for OTP
const OTP_PREFIX = 'otp:';
const OTP_EXPIRY = 600; // 10 minutes in seconds
const MAX_OTP_ATTEMPTS = 5;

const storeOTP = async (otpId, data) => {
  const key = `${OTP_PREFIX}${otpId}`;
  const value = JSON.stringify({
    ...data,
    attempts: 0,
    createdAt: Date.now()
  });
  await redis.setex(key, OTP_EXPIRY, value);
  return true;
};

const getOTP = async (otpId) => {
  const key = `${OTP_PREFIX}${otpId}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

const incrementOTPAttempts = async (otpId) => {
  const key = `${OTP_PREFIX}${otpId}`;
  const data = await getOTP(otpId);
  if (!data) return null;
  
  data.attempts += 1;
  const ttl = await redis.ttl(key);
  await redis.setex(key, ttl > 0 ? ttl : OTP_EXPIRY, JSON.stringify(data));
  return data;
};

const deleteOTP = async (otpId) => {
  const key = `${OTP_PREFIX}${otpId}`;
  await redis.del(key);
  return true;
};

const findOTPByRecipient = async (recipient) => {
  const normalizedRecipient = String(recipient).trim().toLowerCase();
  const keys = await redis.keys(`${OTP_PREFIX}*`);
  
  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.recipient === normalizedRecipient) {
        const otpId = key.replace(OTP_PREFIX, '');
        return { otpId, storedData: parsed };
      }
    }
  }
  return null;
};

// Cache helpers
const cacheGet = async (key) => {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
};

const cacheSet = async (key, value, expiry = 3600) => {
  await redis.setex(key, expiry, JSON.stringify(value));
  return true;
};

const cacheDelete = async (key) => {
  await redis.del(key);
  return true;
};

const cacheDeletePattern = async (pattern) => {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  return true;
};

module.exports = {
  redis,
  storeOTP,
  getOTP,
  incrementOTPAttempts,
  deleteOTP,
  findOTPByRecipient,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern,
  OTP_EXPIRY,
  MAX_OTP_ATTEMPTS
};
