const Redis = require('ioredis');
require('dotenv').config();

const OTP_PREFIX = 'otp:';
const OTP_EXPIRY = 600;
const MAX_OTP_ATTEMPTS = 5;

const isProduction = process.env.NODE_ENV === 'production';
const redisUrl = process.env.REDIS_URL?.trim();
const redisHost = process.env.REDIS_HOST?.trim();
const shouldUseRedis = Boolean(redisUrl || redisHost);

const fallbackStore = new Map();
let redisReady = false;
let hasLoggedFallback = false;

const buildFallbackPattern = (pattern = '') =>
  new RegExp(`^${String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

const logFallbackOnce = (reason) => {
  if (hasLoggedFallback) {
    return;
  }

  const suffix = reason ? ` (${reason})` : '';
  console.warn(`Redis unavailable${suffix}; using in-memory fallback for OTP and cache data.`);
  hasLoggedFallback = true;
};

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

  const sharedConfig = {
    connectTimeout: 10000,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 100, 2000),
    tls: isProduction ? { rejectUnauthorized: false } : undefined
  };

  try {
    const client = redisUrl
      ? new Redis(redisUrl, sharedConfig)
      : new Redis({
          host: redisHost,
          port: Number(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
          db: Number(process.env.REDIS_DB) || 0,
          ...sharedConfig
        });

    client.on('ready', () => {
      redisReady = true;
      hasLoggedFallback = false;
      console.log('Redis connected');
    });

    client.on('close', () => {
      redisReady = false;
    });

    client.on('end', () => {
      redisReady = false;
    });

    client.on('error', (err) => {
      redisReady = false;
      console.error('Redis error:', err?.message || String(err));
    });

    return client;
  } catch (err) {
    console.error('Redis configuration error:', err?.message || String(err));
    logFallbackOnce('configuration error');
    return null;
  }
};

const redis = createRedisClient();

const canUseRedis = () => Boolean(redis && redisReady);

const withRedisFallback = async (redisOperation, fallbackOperation, reason) => {
  if (!canUseRedis()) {
    if (shouldUseRedis) {
      logFallbackOnce(reason);
    }

    return fallbackOperation();
  }

  try {
    return await redisOperation();
  } catch (err) {
    redisReady = false;
    console.error(`Redis ${reason} failed:`, err?.message || String(err));
    logFallbackOnce(reason);
    return fallbackOperation();
  }
};

const setWithExpiry = async (key, expirySeconds, value) => {
  await withRedisFallback(
    () => redis.setex(key, expirySeconds, value),
    async () => {
      setFallbackEntry(key, value, expirySeconds);
    },
    'write'
  );
};

const getValue = async (key) => {
  return withRedisFallback(
    () => redis.get(key),
    async () => getFallbackEntry(key)?.value || null,
    'read'
  );
};

const deleteValue = async (key) => {
  await withRedisFallback(
    () => redis.del(key),
    async () => {
      fallbackStore.delete(key);
    },
    'delete'
  );
};

const getKeys = async (pattern) => {
  return withRedisFallback(
    () => redis.keys(pattern),
    async () => getFallbackKeys(pattern),
    'key lookup'
  );
};

const getTtl = async (key) => {
  return withRedisFallback(
    () => redis.ttl(key),
    async () => {
      const entry = getFallbackEntry(key);
      if (!entry) {
        return -2;
      }

      return Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
    },
    'ttl lookup'
  );
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

  await withRedisFallback(
    () => redis.del(...keys),
    async () => {
      keys.forEach((key) => fallbackStore.delete(key));
    },
    'pattern delete'
  );

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

const invalidateDiscoveryCache = async (userId) => {
  const pattern = `discovery:${userId}:*`;
  await cacheDeletePattern(pattern);
};

module.exports = {
  redis,
  isRedisReady: canUseRedis,
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
  invalidateDiscoveryCache,
  OTP_EXPIRY,
  MAX_OTP_ATTEMPTS
};
