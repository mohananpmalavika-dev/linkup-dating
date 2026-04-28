const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getClientIP } = require('../middleware/ipBlocking');
const AccountCreationLimitService = require('../services/accountCreationLimitService');
const spamFraudService = require('../services/spamFraudService');
const {
  calculateAgeFromDOB,
  storeAgeVerification,
  validateAgeVerification
} = require('../utils/ageVerification');
const {
  getConfiguredAdminEmails,
  isConfiguredAdminEmail,
  syncConfiguredAdminForEmail
} = require('../utils/adminAccess');
const { getActiveBanForUser } = require('../utils/moderation');
const { storeOTP, getOTP, incrementOTPAttempts, deleteOTP, findOTPByRecipient, MAX_OTP_ATTEMPTS } = require('../utils/redis');
const { isTwilioConfigured, sendPhoneOTP } = require('../utils/twilio');
const { verifyFirebaseIdToken } = require('../config/firebase');

// Email transporter configuration - recreated on each request to ensure env vars are loaded

const getEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true' || false, // Use TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD
    }
  });
};

const passwordResetStorage = new Map();

const normalizeRecipient = (value = '') => String(value || '').trim().toLowerCase();
const normalizePhoneNumber = (value = '') => {
  const digits = String(value || '').trim().replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }

  return digits;
};

const getPhoneLookupCandidates = (value = '') => {
  const rawDigits = String(value || '').trim().replace(/\D/g, '');
  const normalizedPhone = normalizePhoneNumber(value);
  const candidates = new Set();

  if (normalizedPhone) {
    candidates.add(normalizedPhone);
  }

  if (rawDigits) {
    candidates.add(rawDigits);

    if (rawDigits.length > 10) {
      candidates.add(rawDigits.slice(-10));
    }

    if (rawDigits.length === 10) {
      candidates.add(`91${rawDigits}`);
    }

    if (rawDigits.length === 11 && rawDigits.startsWith('0')) {
      candidates.add(rawDigits.slice(1));
      candidates.add(`91${rawDigits.slice(1)}`);
    }
  }

  return Array.from(candidates).filter(Boolean);
};

const getAuthRole = (userRecord) =>
  Boolean(userRecord?.is_admin || userRecord?.isAdmin) ? 'admin' : 'user';

const getRegistrationType = (userRecord) =>
  getAuthRole(userRecord) === 'admin' ? 'admin' : 'user';

const syncAdminPrivilegesForEmail = async (email) => {
  const normalizedEmail = normalizeRecipient(email);

  if (!normalizedEmail) {
    return;
  }

  await syncConfiguredAdminForEmail(db, normalizedEmail);
};

const getRequestMetadata = (req) => ({
  ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null,
  userAgent: req.headers['user-agent'] || null
});

const isStrongPassword = (value = '') => String(value || '').length >= 8;
const isEmailAddress = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeRecipient(value));
const looksLikePhoneNumber = (value = '') => /^\+?[0-9\s()-]{7,}$/.test(String(value || '').trim());
const resolveAuthContact = ({ identifier, email, phone } = {}) => {
  const rawIdentifier = String(identifier || '').trim();
  const rawEmail = String(email || '').trim();
  const rawPhone = String(phone || '').trim();
  const primaryValue = rawIdentifier || rawEmail || rawPhone;
  const phoneCandidateSource =
    looksLikePhoneNumber(rawIdentifier)
      ? rawIdentifier
      : looksLikePhoneNumber(rawPhone)
        ? rawPhone
        : looksLikePhoneNumber(rawEmail)
          ? rawEmail
          : '';
  let identifierType = null;
  let normalizedEmail = '';
  let normalizedPhone = '';

  if (primaryValue) {
    if (isEmailAddress(primaryValue)) {
      identifierType = 'email';
      normalizedEmail = normalizeRecipient(primaryValue);
    } else if (looksLikePhoneNumber(primaryValue)) {
      identifierType = 'phone';
      normalizedPhone = normalizePhoneNumber(primaryValue);
    }
  }

  if (!normalizedEmail && rawEmail && isEmailAddress(rawEmail)) {
    normalizedEmail = normalizeRecipient(rawEmail);
  }

  if (!normalizedPhone && rawPhone && looksLikePhoneNumber(rawPhone)) {
    normalizedPhone = normalizePhoneNumber(rawPhone);
  }

  if (!identifierType) {
    if (normalizedEmail) {
      identifierType = 'email';
    } else if (normalizedPhone) {
      identifierType = 'phone';
    }
  }

  return {
    identifierType,
    normalizedIdentifier: identifierType === 'phone' ? normalizedPhone : normalizedEmail,
    normalizedEmail,
    normalizedPhone,
    phoneCandidates: getPhoneLookupCandidates(phoneCandidateSource)
  };
};
const shouldExposeDevelopmentOtp =
  process.env.NODE_ENV !== 'production' && process.env.AUTH_EXPOSE_DEV_OTP === 'true';

const buildDevelopmentOtpPayload = (otp) => (
  shouldExposeDevelopmentOtp ? { devOtp: otp } : {}
);

const maskRecipient = (value = '') => {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return 'unknown';
  }

  if (rawValue.includes('@')) {
    const [localPart, domain = ''] = rawValue.split('@');
    const visibleLocal = localPart.slice(0, 2);
    return `${visibleLocal || '*'}***@${domain}`;
  }

  const digits = rawValue.replace(/\D/g, '');

  if (!digits) {
    return 'unknown';
  }

  if (digits.length <= 4) {
    return `***${digits}`;
  }

  return `${digits.slice(0, 2)}***${digits.slice(-2)}`;
};

const buildDisplayNameFromEmail = (email = '') => {
  const localPart = normalizeRecipient(email).split('@')[0] || 'linkup-user';
  const words = localPart
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return 'LinkUp User';
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const USER_WITH_PROFILE_SELECT = `
  SELECT u.id, u.email, u.phone, u.created_at, u.is_admin,
         u.mpin_hash, u.phone_verified, u.email_verified,
         dp.username, dp.first_name
  FROM users u
  LEFT JOIN dating_profiles dp ON dp.user_id = u.id
`;

const getUserWithProfileByEmail = async (email) => {
  const normalizedEmail = normalizeRecipient(email);

  return db.query(
    `${USER_WITH_PROFILE_SELECT}
     WHERE LOWER(u.email) = LOWER($1)
     LIMIT 1`,
    [normalizedEmail]
  );
};

const getUserWithProfileByPhone = async (phone) => {
  const phoneCandidates = getPhoneLookupCandidates(phone);

  if (phoneCandidates.length === 0) {
    return { rows: [] };
  }

  return db.query(
    `${USER_WITH_PROFILE_SELECT}
     WHERE u.phone = ANY($1::varchar[])
     ORDER BY CASE WHEN u.phone = $2 THEN 0 ELSE 1 END
     LIMIT 1`,
    [phoneCandidates, normalizePhoneNumber(phone)]
  );
};

const getUserWithProfileByIdentifier = async ({ identifierType, normalizedEmail, normalizedPhone }) => {
  if (identifierType === 'phone') {
    return getUserWithProfileByPhone(normalizedPhone);
  }

  if (identifierType === 'email') {
    return getUserWithProfileByEmail(normalizedEmail);
  }

  return { rows: [] };
};

const assertPhoneAvailableForUser = async (phone, userId = null) => {
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!normalizedPhone) {
    return null;
  }

  const params = userId ? [normalizedPhone, userId] : [normalizedPhone];
  const query = userId
    ? 'SELECT id FROM users WHERE phone = $1 AND id <> $2 LIMIT 1'
    : 'SELECT id FROM users WHERE phone = $1 LIMIT 1';
  const existingUserResult = await db.query(query, params);

  if (existingUserResult.rows.length > 0) {
    throw createHttpError(409, 'That phone number is already linked to another account.');
  }

  return normalizedPhone;
};

const linkPhoneToUser = async (userId, phone) => {
  const normalizedPhone = await assertPhoneAvailableForUser(phone, userId);

  if (!normalizedPhone) {
    return null;
  }

  const updateResult = await db.query(
    `UPDATE users
     SET phone = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
       AND (phone IS NULL OR phone = $1)
     RETURNING phone`,
    [normalizedPhone, userId]
  );

  if (updateResult.rows.length > 0) {
    return updateResult.rows[0].phone;
  }

  const currentUserResult = await db.query(
    'SELECT phone FROM users WHERE id = $1 LIMIT 1',
    [userId]
  );

  return currentUserResult.rows[0]?.phone || null;
};

const ensureUserForOtpLogin = async (email, { allowCreate = true, ageVerification = null, phone = null } = {}) => {
  const normalizedEmail = normalizeRecipient(email);
  const normalizedPhone = normalizePhoneNumber(phone);
  await syncAdminPrivilegesForEmail(normalizedEmail);
  const existingUserResult = await getUserWithProfileByEmail(normalizedEmail);

  if (existingUserResult.rows.length > 0) {
    const linkedPhone = normalizedPhone
      ? await linkPhoneToUser(existingUserResult.rows[0].id, normalizedPhone)
      : existingUserResult.rows[0].phone || null;

    await db.query(
      `INSERT INTO user_preferences (user_id, created_at, updated_at)
       VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO NOTHING`,
      [existingUserResult.rows[0].id]
    );

    return {
      ...existingUserResult.rows[0],
      phone: linkedPhone
    };
  }

  if (!allowCreate) {
    throw createHttpError(404, 'No account found for that email address. Sign up first.');
  }

  const ageValidation = validateAgeVerification(ageVerification);
  if (!ageValidation.valid) {
    throw createHttpError(400, ageValidation.errors[0] || 'Age verification is required');
  }

  if (!ageValidation.isOver18) {
    throw createHttpError(403, 'You must be at least 18 years old to use LinkUp');
  }

  const fallbackName = buildDisplayNameFromEmail(normalizedEmail);
  const generatedPasswordHash = await hashPassword(uuidv4());
  const verifiedAge = calculateAgeFromDOB(new Date(ageVerification.dateOfBirth));
  await assertPhoneAvailableForUser(normalizedPhone);
  const createdUserResult = await db.query(
    'INSERT INTO users (email, password, phone) VALUES ($1, $2, $3) RETURNING id, email, phone, created_at, is_admin',
    [normalizedEmail, generatedPasswordHash, normalizedPhone || null]
  );

  const createdUser = createdUserResult.rows[0];

  await storeAgeVerification(db, createdUser.id, ageVerification);

  await db.query(
    `INSERT INTO dating_profiles (user_id, first_name, age, profile_completion_percent, last_active)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO NOTHING`,
    [createdUser.id, fallbackName, verifiedAge, 10]
  );

  await db.query(
    `INSERT INTO user_preferences (user_id, created_at, updated_at)
       VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO NOTHING`,
    [createdUser.id]
  );

  await syncAdminPrivilegesForEmail(normalizedEmail);
  const hydratedUserResult = await getUserWithProfileByEmail(normalizedEmail);
  return hydratedUserResult.rows[0];
};

const findStoredOtpEntry = async ({ otpId, identifier, email, phone }) => {
  const contact = resolveAuthContact({ identifier, email, phone });
  const requestedValues = new Set(
    [
      contact.normalizedIdentifier,
      contact.normalizedEmail,
      contact.normalizedPhone,
      ...contact.phoneCandidates
    ].filter(Boolean)
  );

  if (otpId) {
    const storedData = await getOTP(otpId);

    if (!storedData) {
      return null;
    }

    const storedValues = new Set(
      [
        storedData.recipient,
        storedData.loginIdentifier,
        storedData.profilePhone,
        ...(Array.isArray(storedData.phoneCandidates) ? storedData.phoneCandidates : [])
      ].filter(Boolean)
    );

    if (
      requestedValues.size > 0 &&
      !Array.from(requestedValues).some((value) => storedValues.has(value))
    ) {
      return null;
    }

    return { otpId, storedData };
  }

  if (!contact.normalizedEmail) {
    return null;
  }

  return await findOTPByRecipient(contact.normalizedEmail);
};

const findStoredPasswordResetEntry = ({ resetId, email }) => {
  const requestedRecipient = normalizeRecipient(email);

  if (resetId) {
    const storedData = passwordResetStorage.get(resetId);

    if (!storedData) {
      return null;
    }

    if (requestedRecipient && storedData.recipient !== requestedRecipient) {
      return null;
    }

    return { resetId, storedData };
  }

  if (!requestedRecipient) {
    return null;
  }

  let latestMatch = null;

  for (const [storedResetId, storedData] of passwordResetStorage.entries()) {
    if (storedData.recipient !== requestedRecipient) {
      continue;
    }

    if (!latestMatch || storedData.createdAt > latestMatch.storedData.createdAt) {
      latestMatch = { resetId: storedResetId, storedData };
    }
  }

  return latestMatch;
};

const buildAuthUserPayload = (userRecord) => {
  if (!userRecord) {
    return null;
  }

  const displayName = userRecord.first_name || buildDisplayNameFromEmail(userRecord.email);
  const isAdmin = Boolean(userRecord.is_admin || userRecord.isAdmin);

  return {
    id: userRecord.id,
    email: userRecord.email,
    phone: userRecord.phone || null,
    username: userRecord.username || null,
    name: displayName,
    avatar: displayName.charAt(0).toUpperCase(),
    isAdmin,
    role: getAuthRole(userRecord),
    registrationType: getRegistrationType(userRecord),
    emailVerified: Boolean(userRecord.email_verified || userRecord.emailVerified),
    phoneVerified: Boolean(userRecord.phone_verified || userRecord.phoneVerified),
    hasMpin: Boolean(userRecord.mpin_hash || userRecord.mpinHash)
  };
};

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const applyOtpRegistrationProfile = async (userId, email, registrationData = {}) => {
  const normalizedUsername = String(registrationData.username || '').trim().toLowerCase();
  const fullName = String(registrationData.fullName || '').trim() || buildDisplayNameFromEmail(email);
  const locationCity = String(registrationData.location || registrationData.city || '').trim() || null;
  const locationState = String(registrationData.state || '').trim() || null;
  const locationCountry = String(registrationData.country || '').trim() || null;
  const bio = String(registrationData.bio || '').trim() || null;

  if (normalizedUsername && !/^[a-zA-Z0-9_-]{3,20}$/.test(normalizedUsername)) {
    throw createHttpError(
      400,
      'Username can only contain letters, numbers, underscores, and dashes (3-20 characters)'
    );
  }

  if (normalizedUsername) {
    const existingUsernameResult = await db.query(
      'SELECT user_id FROM dating_profiles WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [normalizedUsername]
    );

    if (
      existingUsernameResult.rows.length > 0 &&
      existingUsernameResult.rows[0].user_id !== userId
    ) {
      throw createHttpError(409, 'Username is already taken');
    }
  }

  const result = await db.query(
    `UPDATE dating_profiles
     SET username = COALESCE($1, username),
         first_name = COALESCE($2, first_name),
         location_city = COALESCE($3, location_city),
         location_state = COALESCE($4, location_state),
         location_country = COALESCE($5, location_country),
         bio = COALESCE($6, bio),
         profile_completion_percent = GREATEST(COALESCE(profile_completion_percent, 0), $7),
         last_active = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $8
     RETURNING *`,
    [
      normalizedUsername || null,
      fullName || null,
      locationCity,
      locationState,
      locationCountry,
      bio,
      normalizedUsername || locationCity || bio ? 35 : 20,
      userId
    ]
  );

  return result.rows[0] || null;
};

const methodNotAllowed = (expectedMethod) => (req, res) => {
  const endpoint = `${req.baseUrl}${req.path}`;

  res.status(405).json({
    message: `Method ${req.method} not allowed for ${endpoint}. Use ${expectedMethod} ${endpoint}.`,
    allowedMethods: [expectedMethod]
  });
};

// Helper function to hash password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Helper function to generate JWT
const generateToken = (userRecordOrId) => {
  const userId =
    typeof userRecordOrId === 'object' && userRecordOrId !== null
      ? userRecordOrId.id || userRecordOrId.userId
      : userRecordOrId;
  const email =
    typeof userRecordOrId === 'object' && userRecordOrId !== null
      ? userRecordOrId.email || null
      : null;
  const isAdmin =
    typeof userRecordOrId === 'object' && userRecordOrId !== null
      ? Boolean(userRecordOrId.is_admin || userRecordOrId.isAdmin)
      : false;

  return jwt.sign(
    { userId, id: userId, email, isAdmin },
    process.env.JWT_SECRET || 'your_secret_key',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

const respondWithActiveBan = async (res, userId) => {
  const activeBan = await getActiveBanForUser(userId);

  if (!activeBan) {
    return false;
  }

  res.status(403).json({
    error: 'Your account is currently restricted by moderation.',
    code: 'ACCOUNT_RESTRICTED',
    ban: activeBan
  });

  return true;
};

// SIGNUP
router.post('/signup', async (req, res) => {
  try {
    const { email, password, confirmPassword, ageVerification, phone } = req.body;
    const normalizedEmail = normalizeRecipient(email);
    const normalizedPhone = normalizePhoneNumber(phone);
    const clientIP = getClientIP(req);

    if (!normalizedEmail || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Check account creation limit BEFORE age verification
    // This prevents IP address enumeration attacks
    if (clientIP) {
      try {
        const canCreate = await AccountCreationLimitService.canCreateAccount(clientIP);
        if (!canCreate.canCreate) {
          console.log(`[SECURITY] Account creation blocked for IP ${clientIP}: ${canCreate.reason}`);
          
          if (canCreate.reason === 'account_creation_blocked') {
            return res.status(429).json({
              success: false,
              error: 'Account creation limit exceeded',
              code: 'ACCOUNT_CREATION_BLOCKED',
              message: `Your IP address is temporarily blocked from creating accounts. ${canCreate.remainingMinutes} minutes remaining.`,
              blockedUntil: canCreate.blockedUntil,
              remainingMinutes: canCreate.remainingMinutes,
              blockReason: canCreate.blockReason
            });
          } else if (canCreate.reason === 'account_limit_exceeded') {
            return res.status(429).json({
              success: false,
              error: 'Too many accounts from this IP',
              code: 'ACCOUNT_LIMIT_EXCEEDED',
              message: `Maximum ${canCreate.threshold} accounts allowed per IP address. Contact support if you need assistance.`,
              threshold: canCreate.threshold,
              accountCount: canCreate.accountCount
            });
          }
        }
      } catch (limitError) {
        console.error('Error checking account creation limit:', limitError);
        // Fail open - allow signup if service is unavailable
      }
    }

    const ageValidation = validateAgeVerification(ageVerification);
    if (!ageValidation.valid) {
      return res.status(400).json({
        error: ageValidation.errors[0] || 'Age verification failed',
        details: ageValidation.errors,
        code: 'AGE_VERIFICATION_FAILED'
      });
    }

    if (!ageValidation.isOver18) {
      return res.status(403).json({
        error: 'You must be at least 18 years old to use LinkUp',
        code: 'UNDERAGE_USER'
      });
    }

    // Check if user exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    await assertPhoneAvailableForUser(normalizedPhone);

    // Create user
    const createdUserResult = await db.query(
      'INSERT INTO users (email, password, phone) VALUES ($1, $2, $3) RETURNING id, email, phone, is_admin',
      [normalizedEmail, hashedPassword, normalizedPhone || null]
    );

    const userId = createdUserResult.rows[0].id;
    const verifiedAge = calculateAgeFromDOB(new Date(ageVerification.dateOfBirth));

    await storeAgeVerification(db, userId, ageVerification);

    // Create empty dating profile
    await db.query(
      `INSERT INTO dating_profiles (user_id, first_name, age, profile_completion_percent, last_active)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, buildDisplayNameFromEmail(normalizedEmail), verifiedAge, 10]
    );

    // Create user preferences
    await db.query(
      'INSERT INTO user_preferences (user_id, created_at, updated_at) VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [userId]
    );

    // Record account creation for rate limiting
    if (clientIP) {
      try {
        await AccountCreationLimitService.recordAccountCreation(clientIP, userId);
      } catch (recordError) {
        console.error('Error recording account creation for rate limiting:', recordError);
        // Don't fail signup if recording fails
      }
    }

    const persistedUserResult = await db.query(
      `SELECT id, email, phone, is_admin
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );
    const persistedUser = persistedUserResult.rows[0];
    const token = generateToken(persistedUser);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: persistedUser.id,
        email: persistedUser.email,
        phone: persistedUser.phone || null,
        isAdmin: Boolean(persistedUser.is_admin),
        role: getAuthRole(persistedUser),
        registrationType: getRegistrationType(persistedUser)
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Signup failed' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password, identifier, phone } = req.body;
    const contact = resolveAuthContact({ identifier, email, phone });
    const requestMetadata = getRequestMetadata(req);

    if (!contact.normalizedIdentifier || !password) {
      return res.status(400).json({ error: 'Email or phone number and password required' });
    }

    if (contact.identifierType === 'email') {
      await syncAdminPrivilegesForEmail(contact.normalizedEmail);
    }

    // Find user
    const result =
      contact.identifierType === 'phone'
        ? await db.query(
            `SELECT id, email, phone, password, is_admin
             FROM users
             WHERE phone = ANY($1::varchar[])
             ORDER BY CASE WHEN phone = $2 THEN 0 ELSE 1 END
             LIMIT 1`,
            [contact.phoneCandidates, contact.normalizedPhone]
          )
        : await db.query(
            `SELECT id, email, phone, password, is_admin
             FROM users
             WHERE LOWER(email) = LOWER($1)
             LIMIT 1`,
            [contact.normalizedEmail]
          );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_admin && isConfiguredAdminEmail(user.email)) {
      await syncAdminPrivilegesForEmail(user.email);
      user.is_admin = true;
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (await respondWithActiveBan(res, user.id)) {
      return;
    }

    const token = generateToken(user);

    spamFraudService.trackUserActivity({
      userId: user.id,
      action: 'password_login',
      analyticsUpdates: { session_count: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runFraudCheck: true
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone || null,
        isAdmin: Boolean(user.is_admin),
        role: getAuthRole(user),
        registrationType: getRegistrationType(user)
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// CHECK USERNAME AVAILABILITY
// Check username availability (both GET and POST)
const checkUsernameAvailability = async (req, res) => {
  try {
    // Support both GET query params and POST body
    const username = req.query.username || req.body?.username;

    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    // Check if username exists in dating_profiles
    const result = await db.query(
      'SELECT id FROM dating_profiles WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [username]
    );

    const available = result.rows.length === 0;
    res.json({ available, username });
  } catch (err) {
    console.error('Check username error:', err.message);
    
    // If column doesn't exist, return available as true for now
    if (err.message.includes('column "username" does not exist')) {
      return res.json({ available: true, username: req.query.username || req.body?.username });
    }
    
    res.status(500).json({ error: 'Failed to check username', details: err.message });
  }
};

router.get('/check-username', checkUsernameAvailability);
router.post('/check-username', checkUsernameAvailability);

// CHECK EMAIL AVAILABILITY
router.get('/check-email', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Check if email exists in users
    const result = await db.query(
      'SELECT id FROM users WHERE email ILIKE $1 LIMIT 1',
      [email]
    );

    const available = result.rows.length === 0;
    res.json({ available, email });
  } catch (err) {
    console.error('Check email error:', err);
    res.status(500).json({ error: 'Failed to check email' });
  }
});

// VERIFY TOKEN
router.get('/verify', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ valid: false });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', async (err, decodedUser) => {
    if (err) return res.status(401).json({ valid: false });

    try {
      const userId = decodedUser.userId || decodedUser.id;
      const result = await db.query(
        `SELECT id, email, phone, is_admin,
                mpin_hash, phone_verified, email_verified
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ valid: false });
      }

      const userRecord = result.rows[0];

      if (!userRecord.is_admin && isConfiguredAdminEmail(userRecord.email)) {
        await syncAdminPrivilegesForEmail(userRecord.email);
        userRecord.is_admin = true;
      }

      if (await respondWithActiveBan(res, userRecord.id)) {
        return;
      }

      res.json({
        valid: true,
        user: {
          id: userRecord.id,
          email: userRecord.email,
          phone: userRecord.phone || null,
          isAdmin: Boolean(userRecord.is_admin),
          role: getAuthRole(userRecord),
          registrationType: getRegistrationType(userRecord),
          emailVerified: Boolean(userRecord.email_verified),
          phoneVerified: Boolean(userRecord.phone_verified),
          hasMpin: Boolean(userRecord.mpin_hash)
        }
      });
    } catch (lookupError) {
      console.error('Verify token error:', lookupError);
      res.status(500).json({ valid: false, error: 'Failed to verify token' });
    }
  });
});

// SUBMIT A MODERATION APPEAL
router.post('/appeals', async (req, res) => {
  try {
    const normalizedEmail = normalizeRecipient(req.body?.email);
    const message = String(req.body?.message || '').trim();
    const subject = String(req.body?.subject || 'Account moderation appeal').trim();
    const contactEmail = normalizeRecipient(req.body?.contactEmail) || normalizedEmail;

    if (!normalizedEmail || !message) {
      return res.status(400).json({ error: 'Email and appeal message are required' });
    }

    const userResult = await db.query(
      `SELECT u.id, u.email,
              latest_ban.id as ban_id,
              latest_ban.status as ban_status
       FROM users u
       LEFT JOIN LATERAL (
         SELECT id, status
         FROM user_bans
         WHERE user_id = u.id
         ORDER BY issued_at DESC, id DESC
         LIMIT 1
       ) latest_ban ON TRUE
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No account found for that email address' });
    }

    const userRecord = userResult.rows[0];

    if (!userRecord.ban_id) {
      return res.status(400).json({ error: 'There is no moderation action available to appeal for this account' });
    }

    const existingAppeal = await db.query(
      `SELECT id
       FROM moderation_appeals
       WHERE user_id = $1
         AND COALESCE(ban_id, 0) = COALESCE($2, 0)
         AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userRecord.id, userRecord.ban_id]
    );

    if (existingAppeal.rows.length > 0) {
      return res.status(409).json({ error: 'There is already a pending appeal for this moderation action' });
    }

    const appealResult = await db.query(
      `INSERT INTO moderation_appeals (
         user_id,
         ban_id,
         subject,
         message,
         contact_email
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [userRecord.id, userRecord.ban_id, subject, message, contactEmail]
    );

    await spamFraudService.refreshSystemMetrics();

    res.status(201).json({
      success: true,
      message: 'Appeal submitted successfully',
      appealId: appealResult.rows[0].id,
      createdAt: appealResult.rows[0].created_at
    });
  } catch (err) {
    console.error('Submit appeal error:', err);
    res.status(500).json({ error: 'Failed to submit appeal' });
  }
});

// GET CURRENT USER
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify and decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    const userId = decoded.userId || decoded.id;

    // Get user data
    const result = await db.query(
      `SELECT id, email, phone, created_at, is_admin,
              mpin_hash, phone_verified, email_verified
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.is_admin && isConfiguredAdminEmail(user.email)) {
      await syncAdminPrivilegesForEmail(user.email);
      user.is_admin = true;
    }

    // Get dating profile if exists
    const profileResult = await db.query(
      'SELECT * FROM dating_profiles WHERE user_id = $1',
      [userId]
    );

    res.json({
      user: {
        ...user,
        isAdmin: Boolean(user.is_admin),
        role: getAuthRole(user),
        registrationType: getRegistrationType(user),
        emailVerified: Boolean(user.email_verified),
        phoneVerified: Boolean(user.phone_verified),
        hasMpin: Boolean(user.mpin_hash),
        profile: profileResult.rows[0] || null
      }
    });
  } catch (err) {
    console.error('Get user error:', err);
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// UPDATE CURRENT USER
router.patch('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify and decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    const userId = decoded.userId || decoded.id;

    // Extract storefront data
    const { cart, favorites, savedAddresses } = req.body;

    // Build storefront_data object
    const storefrontData = {};
    if (cart !== undefined) storefrontData.cart = cart;
    if (favorites !== undefined) storefrontData.favorites = favorites;
    if (savedAddresses !== undefined) storefrontData.savedAddresses = savedAddresses;

    // Update user with storefront data
    const result = await db.query(
      `UPDATE users
       SET storefront_data = COALESCE(storefront_data, '{}')::jsonb || $1::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, phone, created_at, storefront_data, is_admin`,
      [JSON.stringify(storefrontData), userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.is_admin && isConfiguredAdminEmail(user.email)) {
      await syncAdminPrivilegesForEmail(user.email);
      user.is_admin = true;
    }

    // Get dating profile if exists
    const profileResult = await db.query(
      'SELECT * FROM dating_profiles WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      message: 'User data updated successfully',
      user: {
        ...user,
        isAdmin: Boolean(user.is_admin),
        role: getAuthRole(user),
        registrationType: getRegistrationType(user),
        profile: profileResult.rows[0] || null
      }
    });
  } catch (err) {
    console.error('Update user error:', err);
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET VISIBILITY SETTINGS
router.get('/visibility', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    
    res.json({
      success: true,
      data: {
        visibleViaPhone: true,
        visibleViaEmail: true,
        visibleViaUsername: true
      }
    });
  });
});

// SET VISIBILITY SETTINGS
router.post('/visibility', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    
    const { visibleViaPhone, visibleViaEmail, visibleViaUsername } = req.body;
    
    res.json({
      success: true,
      message: 'Visibility settings updated',
      data: {
        visibleViaPhone: visibleViaPhone !== undefined ? visibleViaPhone : true,
        visibleViaEmail: visibleViaEmail !== undefined ? visibleViaEmail : true,
        visibleViaUsername: visibleViaUsername !== undefined ? visibleViaUsername : true
      }
    });
  });
});

// GET CONTACT MEANS (Chat, Voice, Video availability)
router.get('/contact-means', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    
    res.json({
      success: true,
      data: {
        availableForChat: true,
        availableForVoiceCall: false,
        availableForVideoCall: false
      }
    });
  });
});

// SET CONTACT MEANS
router.post('/contact-means', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    
    const { availableForChat, availableForVoiceCall, availableForVideoCall } = req.body;
    
    res.json({
      success: true,
      message: 'Contact means updated',
      data: {
        availableForChat: availableForChat !== undefined ? availableForChat : true,
        availableForVoiceCall: availableForVoiceCall !== undefined ? availableForVoiceCall : false,
        availableForVideoCall: availableForVideoCall !== undefined ? availableForVideoCall : false
      }
    });
  });
});

// SEND OTP
router.post('/send-otp', async (req, res) => {
  try {
    const contact = resolveAuthContact(req.body);
    const normalizedPurpose = String(req.body?.purpose || 'login').trim().toLowerCase();
    const otpPurpose = normalizedPurpose === 'signup' ? 'signup' : 'login';
    const requestedAgeVerification = req.body?.ageVerification || null;
    const signupPhone = contact.normalizedPhone;
    const requestedChannel = String(req.body?.channel || 'email').trim().toLowerCase();
    const otpChannel = requestedChannel === 'phone' ? 'phone' : 'email';
    let otpRecipientEmail = contact.normalizedEmail;
    let otpRecipientPhone = contact.normalizedPhone;
    let accountRecord = null;

    if (!contact.normalizedIdentifier) {
      return res.status(400).json({ error: 'Email or phone number required' });
    }

    if (otpPurpose === 'signup' && contact.identifierType !== 'email') {
      return res.status(400).json({
        error: 'A valid email address is required to sign up.'
      });
    }

    if (otpPurpose === 'signup') {
      await syncAdminPrivilegesForEmail(contact.normalizedEmail);
      const existingUserResult = await getUserWithProfileByEmail(contact.normalizedEmail);
      const accountExists = existingUserResult.rows.length > 0;

      if (accountExists) {
        return res.status(409).json({ error: 'User already exists' });
      }

      await assertPhoneAvailableForUser(signupPhone);

      const ageValidation = validateAgeVerification(requestedAgeVerification);
      if (!ageValidation.valid) {
        return res.status(400).json({
          error: ageValidation.errors[0] || 'Age verification failed',
          details: ageValidation.errors,
          code: 'AGE_VERIFICATION_FAILED'
        });
      }

      if (!ageValidation.isOver18) {
        return res.status(403).json({
          error: 'You must be at least 18 years old to use LinkUp',
          code: 'UNDERAGE_USER'
        });
      }
    } else {
      const existingUserResult = await getUserWithProfileByIdentifier(contact);

      if (existingUserResult.rows.length === 0) {
        return res.status(404).json({
          error:
            contact.identifierType === 'phone'
              ? 'No account found for that phone number. Sign up first.'
              : 'No account found for that email address. Sign up first.',
          code: 'ACCOUNT_NOT_FOUND'
        });
      }

      accountRecord = existingUserResult.rows[0];
      otpRecipientEmail = accountRecord.email;
      otpRecipientPhone = accountRecord.phone || contact.normalizedPhone;
      await syncAdminPrivilegesForEmail(otpRecipientEmail);
    }

    // Determine actual delivery target based on channel
    const deliveryTarget = otpChannel === 'phone' ? otpRecipientPhone : otpRecipientEmail;

    if (otpChannel === 'phone' && !deliveryTarget) {
      return res.status(400).json({
        error: 'No phone number available for this account. Please verify via email first and link a phone number.',
        code: 'PHONE_NOT_LINKED'
      });
    }

    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpId = uuidv4();
    const developmentOtpPayload = buildDevelopmentOtpPayload(otp);
    const maskedRecipient = maskRecipient(deliveryTarget);

    // Store OTP with 10-minute expiration in Redis
    await storeOTP(otpId, {
      otp,
      recipient: deliveryTarget,
      channel: otpChannel,
      purpose: otpPurpose,
      loginIdentifier: contact.normalizedIdentifier,
      profilePhone: otpPurpose === 'signup' ? signupPhone || null : null,
      phoneCandidates: contact.phoneCandidates,
      userId: accountRecord?.id || null,
      ageVerification:
        otpPurpose === 'signup'
          ? {
              method: requestedAgeVerification.method,
              dateOfBirth: requestedAgeVerification.dateOfBirth
            }
          : null,
      createdAt: Date.now()
    });

    console.info('OTP generated for recipient', {
      otpId,
      recipient: maskedRecipient,
      channel: otpChannel
    });

    // Phone OTP via Twilio
    if (otpChannel === 'phone') {
      if (isTwilioConfigured()) {
        const smsResult = await sendPhoneOTP(deliveryTarget, otp);

        if (smsResult.success) {
          return res.json({
            success: true,
            message: 'OTP sent successfully to your phone number',
            otpId,
            channel: 'phone'
          });
        }

        // If Twilio fails and dev mode, fall through to dev OTP
        if (!shouldExposeDevelopmentOtp) {
          await deleteOTP(otpId);
          return res.status(500).json({
            error: 'Failed to send OTP via SMS. Please try email verification or contact support.'
          });
        }
      }

      // Twilio not configured or failed - dev fallback
      if (shouldExposeDevelopmentOtp) {
        console.warn('Phone OTP fallback enabled because Twilio is not configured or failed', {
          otpId,
          recipient: maskedRecipient
        });

        return res.json({
          success: true,
          message: 'SMS delivery is unavailable. Development OTP fallback is enabled.',
          otpId,
          channel: 'phone',
          ...developmentOtpPayload
        });
      }

      await deleteOTP(otpId);
      return res.status(500).json({ error: 'SMS service not configured. Please contact support.' });
    }

    // Email OTP
    if (!process.env.EMAIL_USER) {
      if (shouldExposeDevelopmentOtp) {
        console.warn('Email OTP fallback enabled because SMTP is not configured', {
          otpId,
          recipient: maskedRecipient
        });

        return res.json({
          success: true,
          message: 'Email delivery is unavailable. Development OTP fallback is enabled.',
          otpId,
          channel: 'email',
          ...developmentOtpPayload
        });
      }

      await deleteOTP(otpId);
      console.error('EMAIL_USER environment variable not set');
      return res.status(500).json({ error: 'Email service not configured. Please contact support.' });
    }

    try {
      const transporter = getEmailTransporter();

      // Verify connection before sending
      await transporter.verify();
      console.log('Email transporter verified');

      const mailResult = await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: deliveryTarget,
        subject: 'Your LinkUp OTP Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>LinkUp - Email Verification</h2>
            <p>Your One-Time Password (OTP) is:</p>
            <h1 style="color: #6366f1; letter-spacing: 2px; text-align: center;">${otp}</h1>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
            <hr />
            <p style="color: #666; font-size: 12px;">LinkUp Dating - Your Perfect Match Awaits</p>
          </div>
        `
      });

      console.log(`OTP email sent successfully to ${maskedRecipient} (MessageID: ${mailResult.messageId})`);

      return res.json({
        success: true,
        message: 'OTP sent successfully to your email',
        otpId,
        channel: 'email'
      });
    } catch (emailError) {
      console.error('Email send error:', {
        message: emailError.message,
        code: emailError.code,
        response: emailError.response,
        command: emailError.command
      });

      if (shouldExposeDevelopmentOtp) {
        console.warn('Email OTP fallback enabled because SMTP delivery failed', {
          otpId,
          recipient: maskedRecipient
        });

        return res.json({
          success: true,
          message: 'Email delivery failed. Development OTP fallback is enabled.',
          otpId,
          channel: 'email',
          ...developmentOtpPayload
        });
      }

      await deleteOTP(otpId);

      // Return error details in development mode for debugging
      if (process.env.NODE_ENV === 'development') {
        return res.status(500).json({
          error: 'Failed to send OTP',
          details: emailError.message
        });
      }

      return res.status(500).json({
        error: 'Failed to send OTP. Please check your credentials and try again.'
      });
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to send OTP' });
  }
});

router.all('/send-otp', methodNotAllowed('POST'));

// VERIFY OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const {
      otpId,
      otp,
      identifier,
      email,
      phone,
      fullName,
      username,
      location,
      city,
      state,
      country,
      bio
    } = req.body;
    const requestMetadata = getRequestMetadata(req);
    const contact = resolveAuthContact({ identifier, email, phone });

    if (!otp) {
      return res.status(400).json({ error: 'OTP required' });
    }

    const otpEntry = await findStoredOtpEntry({ otpId, identifier, email, phone });
    if (!otpEntry) {
      return res.status(400).json({ error: 'Invalid or expired OTP request' });
    }

    const { otpId: matchedOtpId, storedData } = otpEntry;

    // Check if OTP matches
    if (storedData.otp !== otp) {
      const updatedData = await incrementOTPAttempts(matchedOtpId);
      
      // Lock after max failed attempts
      if (!updatedData || updatedData.attempts >= MAX_OTP_ATTEMPTS) {
        await deleteOTP(matchedOtpId);
        return res.status(429).json({ error: 'Too many attempts. Please request a new OTP.' });
      }

      return res.status(400).json({ 
        error: 'Invalid OTP',
        attemptsRemaining: MAX_OTP_ATTEMPTS - updatedData.attempts
      });
    }

    // OTP verified successfully
    await deleteOTP(matchedOtpId); // Clear the OTP after successful verification

    const recipientEmail = storedData.recipient.includes('@')
      ? storedData.recipient
      : contact.normalizedEmail;

    if (!isEmailAddress(recipientEmail)) {
      return res.status(400).json({
        error: 'A valid email address is required to complete OTP verification.'
      });
    }

    let authenticatedUser = null;
    let token = null;
    let needsUsernameSetup = false;

    if (recipientEmail) {
      const otpPurpose = storedData.purpose === 'signup' ? 'signup' : 'login';
      const userRecord = await ensureUserForOtpLogin(recipientEmail, {
        allowCreate: otpPurpose === 'signup',
        ageVerification: storedData.ageVerification || null,
        phone: otpPurpose === 'signup' ? storedData.profilePhone || null : null
      });
      const profileRecord = await applyOtpRegistrationProfile(userRecord.id, recipientEmail, {
        fullName,
        username,
        location,
        city,
        state,
        country,
        bio
      });

      // Update verification flags based on OTP channel
      const verificationUpdates = [];
      const verificationValues = [];

      if (storedData.channel === 'email') {
        verificationUpdates.push('email_verified = TRUE');
      }

      if (storedData.channel === 'phone') {
        verificationUpdates.push('phone_verified = TRUE');
      }

      if (verificationUpdates.length > 0) {
        await db.query(
          `UPDATE users SET ${verificationUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [userRecord.id]
        );
      }

      // Refresh user record with verification flags
      const refreshedUserResult = await db.query(
        `SELECT id, email, phone, created_at, is_admin,
                mpin_hash, phone_verified, email_verified
         FROM users WHERE id = $1 LIMIT 1`,
        [userRecord.id]
      );
      const refreshedUser = refreshedUserResult.rows[0] || userRecord;

      authenticatedUser = buildAuthUserPayload({
        ...refreshedUser,
        phone: refreshedUser.phone || storedData.profilePhone || null,
        username: profileRecord?.username || userRecord.username,
        first_name: profileRecord?.first_name || userRecord.first_name
      });

      if (await respondWithActiveBan(res, userRecord.id)) {
        return;
      }

      token = generateToken(refreshedUser);
      needsUsernameSetup = !(profileRecord?.username || userRecord.username);

      spamFraudService.trackUserActivity({
        userId: userRecord.id,
        action: `${storedData.channel}_otp_login`,
        analyticsUpdates: { session_count: 1 },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        runFraudCheck: true
      });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully',
      verified: true,
      token,
      user: authenticatedUser,
      needsUsernameSetup,
      verifiedChannel: storedData.channel
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to verify OTP' });
  }
});

router.all('/verify-otp', methodNotAllowed('POST'));

// REQUEST PASSWORD RESET
router.post('/request-password-reset', async (req, res) => {
  try {
    const normalizedEmail = normalizeRecipient(req.body.email);

    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const userResult = await db.query(
      `SELECT id, email
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'If that email exists, a reset code has been sent.'
      });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetId = uuidv4();

    passwordResetStorage.set(resetId, {
      code: resetCode,
      recipient: normalizedEmail,
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000,
      attempts: 0
    });

    const developmentPayload = process.env.NODE_ENV === 'production'
      ? {}
      : { devResetCode: resetCode };

    if (process.env.EMAIL_USER) {
      try {
        const transporter = getEmailTransporter();
        await transporter.verify();
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: normalizedEmail,
          subject: 'Your LinkUp password reset code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>LinkUp password reset</h2>
              <p>Use this code to reset your password:</p>
              <h1 style="letter-spacing: 2px; text-align: center;">${resetCode}</h1>
              <p>This code expires in 15 minutes.</p>
            </div>
          `
        });
      } catch (mailError) {
        console.error('Password reset email error:', mailError);

        if (process.env.NODE_ENV === 'production') {
          return res.status(500).json({ error: 'Failed to send password reset email' });
        }
      }
    }

    res.json({
      success: true,
      message: 'If that email exists, a reset code has been sent.',
      resetId,
      ...developmentPayload
    });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ error: 'Failed to request password reset' });
  }
});

router.all('/request-password-reset', methodNotAllowed('POST'));

// RESET PASSWORD
router.post('/reset-password', async (req, res) => {
  try {
    const {
      email,
      resetId,
      resetCode,
      newPassword,
      confirmPassword
    } = req.body;
    const normalizedEmail = normalizeRecipient(email);

    if (!normalizedEmail || !resetCode || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Email, reset code, and new password are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const resetEntry = findStoredPasswordResetEntry({ resetId, email: normalizedEmail });
    if (!resetEntry) {
      return res.status(400).json({ error: 'Invalid or expired password reset request' });
    }

    const { resetId: matchedResetId, storedData } = resetEntry;

    if (Date.now() > storedData.expiresAt) {
      passwordResetStorage.delete(matchedResetId);
      return res.status(400).json({ error: 'Password reset code has expired' });
    }

    if (storedData.code !== String(resetCode).trim()) {
      storedData.attempts += 1;

      if (storedData.attempts >= 5) {
        passwordResetStorage.delete(matchedResetId);
        return res.status(429).json({ error: 'Too many attempts. Request a new reset code.' });
      }

      return res.status(400).json({
        error: 'Invalid reset code',
        attemptsRemaining: 5 - storedData.attempts
      });
    }

    const hashedPassword = await hashPassword(newPassword);
    const result = await db.query(
      `UPDATE users
       SET password = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE LOWER(email) = LOWER($2)
       RETURNING id, email, is_admin`,
      [hashedPassword, normalizedEmail]
    );

    passwordResetStorage.delete(matchedResetId);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Password reset successfully',
      user: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        isAdmin: Boolean(result.rows[0].is_admin),
        role: getAuthRole(result.rows[0]),
        registrationType: getRegistrationType(result.rows[0])
      }
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.all('/reset-password', methodNotAllowed('POST'));

router.post('/set-username', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const username = String(req.body.username || '').trim().toLowerCase();

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      return res.status(400).json({
        error: 'Username can only contain letters, numbers, underscores, and dashes (3-20 characters)'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    const userId = decoded.userId || decoded.id;

    const existingUsernameResult = await db.query(
      'SELECT user_id FROM dating_profiles WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [username]
    );

    if (
      existingUsernameResult.rows.length > 0 &&
      existingUsernameResult.rows[0].user_id !== userId
    ) {
      return res.status(409).json({ error: 'Username is already taken' });
    }

    const userResult = await db.query(
      'SELECT id, email, is_admin FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const fallbackName = buildDisplayNameFromEmail(userResult.rows[0].email);
    const profileResult = await db.query(
      `INSERT INTO dating_profiles (user_id, username, first_name, age, last_active)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET
         username = EXCLUDED.username,
         updated_at = CURRENT_TIMESTAMP,
         last_active = CURRENT_TIMESTAMP
       RETURNING user_id, username, first_name`,
      [userId, username, fallbackName, 18]
    );

    await db.query(
      `INSERT INTO user_preferences (user_id, created_at, updated_at)
       VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    res.json({
      success: true,
      message: 'Username saved successfully',
      user: {
        id: userId,
        username: profileResult.rows[0].username,
        name: profileResult.rows[0].first_name || fallbackName,
        isAdmin: Boolean(userResult.rows[0].is_admin),
        role: getAuthRole(userResult.rows[0]),
        registrationType: getRegistrationType(userResult.rows[0])
      }
    });
  } catch (error) {
    console.error('Set username error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }

    res.status(500).json({ error: 'Failed to set username' });
  }
});

router.all('/set-username', methodNotAllowed('POST'));

// DELETE ACCOUNT
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const confirmationText = String(req.body?.confirmationText || req.query?.confirmationText || '').trim();
    const currentPassword = String(req.body?.currentPassword || '').trim();

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user exists
    const userExists = await db.query('SELECT id, password, email FROM users WHERE id = $1', [userId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userRecord = userExists.rows[0];
    let isConfirmed = confirmationText.toUpperCase() === 'DELETE';

    if (!isConfirmed && currentPassword) {
      isConfirmed = await bcrypt.compare(currentPassword, userRecord.password);
    }

    if (!isConfirmed) {
      return res.status(400).json({
        error: 'Confirm account deletion with the word DELETE or your current password'
      });
    }

    // Delete user and all associated data (cascading deletes will handle related records)
    // This will delete:
    // - dating_profiles
    // - profile_photos
    // - user_preferences
    // - interactions (as from_user_id or to_user_id)
    // - matches (as user_id_1 or user_id_2)
    // - messages (as from_user_id or to_user_id)
    // - video_dates
    // - verification_tokens
    // - user_blocks (as blocking_user_id or blocked_user_id)
    // - user_reports (as reporting_user_id or reported_user_id)
    // - chatroom_members
    // - chatroom_messages
    // - lobby_messages
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

router.all('/account', methodNotAllowed('DELETE'));

// SET MPIN (authenticated)
router.post('/set-mpin', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { mpin, oldMpin } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!mpin) {
      return res.status(400).json({ error: 'MPIN is required' });
    }

    if (!/^\d{4,6}$/.test(mpin)) {
      return res.status(400).json({ error: 'MPIN must be 4-6 digits' });
    }

    // If there's an existing MPIN, verify old MPIN first
    const existingUserResult = await db.query(
      'SELECT mpin_hash FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );

    if (existingUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingMpinHash = existingUserResult.rows[0].mpin_hash;

    if (existingMpinHash) {
      if (!oldMpin) {
        return res.status(400).json({ error: 'Old MPIN is required to change MPIN' });
      }

      const oldMpinValid = await bcrypt.compare(oldMpin, existingMpinHash);
      if (!oldMpinValid) {
        return res.status(401).json({ error: 'Old MPIN is incorrect' });
      }
    }

    const hashedMpin = await hashPassword(mpin);

    await db.query(
      `UPDATE users
       SET mpin_hash = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hashedMpin, userId]
    );

    res.json({
      success: true,
      message: existingMpinHash ? 'MPIN updated successfully' : 'MPIN set successfully'
    });
  } catch (error) {
    console.error('Set MPIN error:', error);
    res.status(500).json({ error: 'Failed to set MPIN' });
  }
});

router.all('/set-mpin', methodNotAllowed('POST'));

// LOGIN WITH MPIN
router.post('/login-mpin', async (req, res) => {
  try {
    const { identifier, phone, email, mpin } = req.body;
    const contact = resolveAuthContact({ identifier, email, phone });
    const requestMetadata = getRequestMetadata(req);

    if (!contact.normalizedIdentifier || !mpin) {
      return res.status(400).json({ error: 'Email/phone and MPIN are required' });
    }

    if (!/^\d{4,6}$/.test(mpin)) {
      return res.status(400).json({ error: 'MPIN must be 4-6 digits' });
    }

    if (contact.identifierType === 'email') {
      await syncAdminPrivilegesForEmail(contact.normalizedEmail);
    }

    // Find user with verification flags
    const result =
      contact.identifierType === 'phone'
        ? await db.query(
            `SELECT id, email, phone, password, is_admin,
                    mpin_hash, phone_verified, email_verified
             FROM users
             WHERE phone = ANY($1::varchar[])
             ORDER BY CASE WHEN phone = $2 THEN 0 ELSE 1 END
             LIMIT 1`,
            [contact.phoneCandidates, contact.normalizedPhone]
          )
        : await db.query(
            `SELECT id, email, phone, password, is_admin,
                    mpin_hash, phone_verified, email_verified
             FROM users
             WHERE LOWER(email) = LOWER($1)
             LIMIT 1`,
            [contact.normalizedEmail]
          );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No account found. Sign up first.',
        code: 'ACCOUNT_NOT_FOUND'
      });
    }

    const user = result.rows[0];

    // Check if user has an MPIN set
    if (!user.mpin_hash) {
      return res.status(400).json({
        error: 'MPIN is not set for this account. Please log in with password or OTP and set MPIN first.',
        code: 'MPIN_NOT_SET'
      });
    }

    // Verification check rules:
    // If both email and phone are verified, user can login with either
    // If only one is verified, user must use that channel
    const hasEmail = Boolean(user.email);
    const hasPhone = Boolean(user.phone);
    const emailVerified = Boolean(user.email_verified);
    const phoneVerified = Boolean(user.phone_verified);
    const usingPhone = contact.identifierType === 'phone';
    const usingEmail = contact.identifierType === 'email';

    if (hasEmail && hasPhone) {
      // User has both email and phone
      if (emailVerified && phoneVerified) {
        // Both verified - allow any channel
        // User can login with either
      } else if (emailVerified && !phoneVerified && usingPhone) {
        return res.status(403).json({
          error: 'Phone number is not verified. Please verify your phone number first via OTP.',
          code: 'PHONE_NOT_VERIFIED',
          redirectTo: 'email_login'
        });
      } else if (!emailVerified && phoneVerified && usingEmail) {
        return res.status(403).json({
          error: 'Email is not verified. Please verify your email first via OTP.',
          code: 'EMAIL_NOT_VERIFIED',
          redirectTo: 'phone_login'
        });
      } else if (!emailVerified && !phoneVerified) {
        return res.status(403).json({
          error: 'Neither email nor phone is verified. Please verify at least one channel first.',
          code: 'NOT_VERIFIED'
        });
      }
    } else if (hasEmail && !hasPhone && usingPhone) {
      return res.status(400).json({
        error: 'No phone number on file. Use email to login.',
        code: 'PHONE_NOT_LINKED'
      });
    } else if (!hasEmail && hasPhone && usingEmail) {
      return res.status(400).json({
        error: 'No email on file. Use phone number to login.',
        code: 'EMAIL_NOT_LINKED'
      });
    }

    // Check MPIN
    const isMpinValid = await bcrypt.compare(mpin, user.mpin_hash);
    if (!isMpinValid) {
      return res.status(401).json({ error: 'Invalid MPIN' });
    }

    if (!user.is_admin && isConfiguredAdminEmail(user.email)) {
      await syncAdminPrivilegesForEmail(user.email);
      user.is_admin = true;
    }

    if (await respondWithActiveBan(res, user.id)) {
      return;
    }

    const token = generateToken(user);

    spamFraudService.trackUserActivity({
      userId: user.id,
      action: 'mpin_login',
      analyticsUpdates: { session_count: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runFraudCheck: true
    });

    res.json({
      message: 'Login successful',
      token,
      user: buildAuthUserPayload(user)
    });
  } catch (err) {
    console.error('MPIN login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.all('/login-mpin', methodNotAllowed('POST'));

// GET AUTH METHODS — returns available login methods for a user
router.get('/auth-methods', async (req, res) => {
  try {
    const { identifier, phone, email } = req.query;
    const contact = resolveAuthContact({ identifier, email, phone });

    if (!contact.normalizedIdentifier) {
      return res.status(400).json({ error: 'Email or phone number required' });
    }

    const result =
      contact.identifierType === 'phone'
        ? await db.query(
            `SELECT id, email, phone, is_admin,
                    mpin_hash, phone_verified, email_verified
             FROM users
             WHERE phone = ANY($1::varchar[])
             ORDER BY CASE WHEN phone = $2 THEN 0 ELSE 1 END
             LIMIT 1`,
            [contact.phoneCandidates, contact.normalizedPhone]
          )
        : await db.query(
            `SELECT id, email, phone, is_admin,
                    mpin_hash, phone_verified, email_verified
             FROM users
             WHERE LOWER(email) = LOWER($1)
             LIMIT 1`,
            [contact.normalizedEmail]
          );

    const user = result.rows[0] || null;

    if (!user) {
      return res.json({
        exists: false,
        methods: { password: false, otp: { email: false, phone: false }, mpin: false }
      });
    }

    const hasEmail = Boolean(user.email);
    const hasPhone = Boolean(user.phone);
    const emailVerified = Boolean(user.email_verified);
    const phoneVerified = Boolean(user.phone_verified);

    res.json({
      exists: true,
      emailVerified,
      phoneVerified,
      hasMpin: Boolean(user.mpin_hash),
      methods: {
        password: true,
        otp: {
          email: hasEmail,
          phone: hasPhone && phoneVerified
        },
        mpin: Boolean(user.mpin_hash)
      }
    });
  } catch (err) {
    console.error('Auth methods error:', err);
    res.status(500).json({ error: 'Failed to get auth methods' });
  }
});

// FIREBASE PHONE AUTH VERIFICATION
router.post('/firebase-verify-phone', async (req, res) => {
  try {
    const { idToken, email, ageVerification, fullName, username, location, city, state, country, bio } = req.body;
    const requestMetadata = getRequestMetadata(req);

    if (!idToken) {
      return res.status(400).json({ error: 'Firebase ID token is required' });
    }

    // Verify the Firebase ID token
    const verificationResult = await verifyFirebaseIdToken(idToken);

    if (!verificationResult.success) {
      return res.status(401).json({
        error: 'Invalid Firebase token',
        details: verificationResult.error,
        code: verificationResult.code
      });
    }

    const { phoneNumber } = verificationResult;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'No phone number found in Firebase token' });
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Find user by phone number
    let userResult = await getUserWithProfileByPhone(normalizedPhone);
    let userRecord = userResult.rows[0] || null;
    let isNewUser = false;

    // If no user found by phone, try to create one if email is provided
    if (!userRecord) {
      const normalizedEmail = email ? normalizeRecipient(email) : null;

      if (!normalizedEmail) {
        return res.status(404).json({
          error: 'No account found for this phone number. Please sign up with email first or provide an email.',
          code: 'ACCOUNT_NOT_FOUND'
        });
      }

      // Validate age verification for new user creation
      const ageValidation = validateAgeVerification(ageVerification);
      if (!ageValidation.valid) {
        return res.status(400).json({
          error: ageValidation.errors[0] || 'Age verification failed',
          details: ageValidation.errors,
          code: 'AGE_VERIFICATION_FAILED'
        });
      }

      if (!ageValidation.isOver18) {
        return res.status(403).json({
          error: 'You must be at least 18 years old to use LinkUp',
          code: 'UNDERAGE_USER'
        });
      }

      await syncAdminPrivilegesForEmail(normalizedEmail);
      const existingUserByEmail = await getUserWithProfileByEmail(normalizedEmail);

      if (existingUserByEmail.rows.length > 0) {
        // User exists by email - link the phone number
        userRecord = existingUserByEmail.rows[0];
        await linkPhoneToUser(userRecord.id, normalizedPhone);
      } else {
        // Create new user
        isNewUser = true;
        const fallbackName = buildDisplayNameFromEmail(normalizedEmail);
        const generatedPasswordHash = await hashPassword(uuidv4());
        const verifiedAge = calculateAgeFromDOB(new Date(ageVerification.dateOfBirth));

        const createdUserResult = await db.query(
          'INSERT INTO users (email, password, phone) VALUES ($1, $2, $3) RETURNING id, email, phone, created_at, is_admin',
          [normalizedEmail, generatedPasswordHash, normalizedPhone]
        );

        const createdUser = createdUserResult.rows[0];
        await storeAgeVerification(db, createdUser.id, ageVerification);

        await db.query(
          `INSERT INTO dating_profiles (user_id, first_name, age, profile_completion_percent, last_active)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id) DO NOTHING`,
          [createdUser.id, fallbackName, verifiedAge, 10]
        );

        await db.query(
          `INSERT INTO user_preferences (user_id, created_at, updated_at)
           VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id) DO NOTHING`,
          [createdUser.id]
        );

        await syncAdminPrivilegesForEmail(normalizedEmail);
        const hydratedUserResult = await getUserWithProfileByEmail(normalizedEmail);
        userRecord = hydratedUserResult.rows[0];
      }
    }

    if (!userRecord) {
      return res.status(500).json({ error: 'Failed to resolve user account' });
    }

    // Mark phone as verified
    await db.query(
      `UPDATE users SET phone_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [userRecord.id]
    );

    // Refresh user record
    const refreshedUserResult = await db.query(
      `SELECT id, email, phone, created_at, is_admin,
              mpin_hash, phone_verified, email_verified
       FROM users WHERE id = $1 LIMIT 1`,
      [userRecord.id]
    );
    const refreshedUser = refreshedUserResult.rows[0] || userRecord;

    // Apply registration profile data if provided
    const profileRecord = await applyOtpRegistrationProfile(refreshedUser.id, refreshedUser.email, {
      fullName,
      username,
      location,
      city,
      state,
      country,
      bio
    });

    if (await respondWithActiveBan(res, refreshedUser.id)) {
      return;
    }

    const token = generateToken(refreshedUser);
    const needsUsernameSetup = !(profileRecord?.username || refreshedUser.username);

    spamFraudService.trackUserActivity({
      userId: refreshedUser.id,
      action: 'firebase_phone_login',
      analyticsUpdates: { session_count: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runFraudCheck: true
    });

    const authenticatedUser = buildAuthUserPayload({
      ...refreshedUser,
      username: profileRecord?.username || refreshedUser.username,
      first_name: profileRecord?.first_name || refreshedUser.first_name
    });

    res.json({
      success: true,
      message: 'Phone verified and logged in successfully',
      verified: true,
      token,
      user: authenticatedUser,
      needsUsernameSetup,
      verifiedChannel: 'phone',
      isNewUser
    });
  } catch (error) {
    console.error('Firebase phone verification error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to verify phone' });
  }
});

router.all('/firebase-verify-phone', methodNotAllowed('POST'));

// SET USER AS ADMIN (for initialization)
router.post('/set-admin', async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeRecipient(email);

    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!isConfiguredAdminEmail(normalizedEmail)) {
      return res.status(403).json({
        error: `Only configured admin emails can be promoted with this endpoint. Allowed: ${Array.from(getConfiguredAdminEmails()).join(', ')}`
      });
    }

    const result = await db.query(
      `UPDATE users
       SET is_admin = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE LOWER(email) = LOWER($1)
       RETURNING id, email, is_admin`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: `${normalizedEmail} is now an admin`,
      user: {
        ...result.rows[0],
        isAdmin: Boolean(result.rows[0].is_admin),
        role: 'admin',
        registrationType: 'admin'
      }
    });
  } catch (err) {
    console.error('Set admin error:', err);
    res.status(500).json({ error: 'Failed to set admin' });
  }
});

module.exports = router;
