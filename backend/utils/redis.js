const Redis = require('ioredis');
require('dotenv').config();

const OTP_PREFIX = 'otp:';
const OTP_EXPIRY = 600;
const MAX_OTP_ATTEMPTS = 5;

const isProduction = process.env.NODE_ENV === 'production';
const shouldUseRedis = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);

const fallbackStore = new Map();

const buildFallbackPattern = (pattern = '') =>
  new RegExp(`^${String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

const getFallbackEntry = (key) => {
  const entry = fallbackStore.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    fallbackStore.delete(key);
    return null;
  }

  return entry;
};

const setFallbackEntry = (key, value, expirySeconds) => {
  fallbackStore.set(key, {
    value,
    expiresAt: Date.now() + expirySeconds * 1000
  });
};

const getFallbackKeys = (pattern) => {
  const matcher = buildFallbackPattern(pattern);
  const keys = [];

  for (const key of fallbackStore.keys()) {
    if (getFallbackEntry(key) && matcher.test(key)) {
      keys.push(key);
    }
  }

  return keys;
};

const createRedisClient = () => {
  if (!shouldUseRedis) {
    console.log('Redis not configured; using in-memory fallback for OTP and cache data.');
    return null;
  }

  const redisConfig = process.env.REDIS_URL
    ? {
        url: process.env.REDIS_URL,
        tls: isProduction ? { rejectUnauthorized: false } : undefined
      }
    : {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3
      };

  const client = new Redis(redisConfig);

  client.on('connect', () => {
    console.log('Redis connected');
  });

  client.on('error', (err) => {
    console.error('Redis error:', err.message);
  });

  return client;
};

const redis = createRedisClient();

const setWithExpiry = async (key, expirySeconds, value) => {
  if (redis) {
    await redis.setex(key, expirySeconds, value);
    return;
  }

  setFallbackEntry(key, value, expirySeconds);
};

const getValue = async (key) => {
  if (redis) {
    return redis.get(key);
  }

  return getFallbackEntry(key)?.value || null;
};

const deleteValue = async (key) => {
  if (redis) {
    await redis.del(key);
    return;
  }

  fallbackStore.delete(key);
};

const getKeys = async (pattern) => {
  if (redis) {
    return redis.keys(pattern);
  }

  return getFallbackKeys(pattern);
};

const getTtl = async (key) => {
  if (redis) {
    return redis.ttl(key);
  }

  const entry = getFallbackEntry(key);
  if (!entry) {
    return -2;
  }

  return Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
};

const storeOTP = async (otpId, data) => {
  const key = `${OTP_PREFIX}${otpId}`;
  const value = JSON.stringify({
    ...data,
    attempts: 0,
    createdAt: Date.now()
  });

  await setWithExpiry(key, OTP_EXPIRY, value);
  return true;
};

const getOTP = async (otpId) => {
  const key = `${OTP_PREFIX}${otpId}`;
  const data = await getValue(key);
  return data ? JSON.parse(data) : null;
};

const incrementOTPAttempts = async (otpId) => {
  const key = `${OTP_PREFIX}${otpId}`;
  const data = await getOTP(otpId);

  if (!data) {
    return null;
  }

  data.attempts += 1;
  const ttl = await getTtl(key);
  await setWithExpiry(key, ttl > 0 ? ttl : OTP_EXPIRY, JSON.stringify(data));
  return data;
};

const deleteOTP = async (otpId) => {
  const key = `${OTP_PREFIX}${otpId}`;
  await deleteValue(key);
  return true;
};

const findOTPByRecipient = async (recipient) => {
  const normalizedRecipient = String(recipient || '').trim().toLowerCase();
  const keys = await getKeys(`${OTP_PREFIX}*`);

  for (const key of keys) {
    const data = await getValue(key);

    if (!data) {
      continue;
    }

    const parsed = JSON.parse(data);
    if (parsed.recipient === normalizedRecipient) {
      const otpId = key.replace(OTP_PREFIX, '');
      return { otpId, storedData: parsed };
    }
  }

  return null;
};

const cacheGet = async (key) => {
  const data = await getValue(key);
  return data ? JSON.parse(data) : null;
};

const cacheSet = async (key, value, expiry = 3600) => {
  await setWithExpiry(key, expiry, JSON.stringify(value));
  return true;
};

const cacheDelete = async (key) => {
  await deleteValue(key);
  return true;
};

const cacheDeletePattern = async (pattern) => {
  const keys = await getKeys(pattern);

  if (keys.length === 0) {
    return true;
  }

  if (redis) {
    await redis.del(...keys);
    return true;
  }

  keys.forEach((key) => fallbackStore.delete(key));
  return true;
};

const cacheGetPaginated = async (key) => {
  const data = await getValue(key);
  return data ? JSON.parse(data) : null;
};

const cacheSetPaginated = async (key, value, expiry = 300) => {
  await setWithExpiry(key, expiry, JSON.stringify(value));
  return true;
};

const buildCacheKey = (prefix, ...parts) => {
  const normalizedParts = parts.map((part) => {
    if (part === null || part === undefined) return 'null';
    if (typeof part === 'object') return JSON.stringify(part);
    return String(part);
  });
  return `${prefix}:${normalizedParts.join(':')}`;
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
  cacheGetPaginated,
  cacheSetPaginated,
  buildCacheKey,
  OTP_EXPIRY,
  MAX_OTP_ATTEMPTS
};
