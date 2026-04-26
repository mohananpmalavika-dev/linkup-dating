const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const spamFraudService = require('../services/spamFraudService');
const {
  getConfiguredAdminEmails,
  isConfiguredAdminEmail,
  syncConfiguredAdminForEmail
} = require('../utils/adminAccess');
const { storeOTP, getOTP, incrementOTPAttempts, deleteOTP, findOTPByRecipient, MAX_OTP_ATTEMPTS } = require('../utils/redis');

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

const getUserWithProfileByEmail = async (email) => {
  const normalizedEmail = normalizeRecipient(email);

  return db.query(
    `SELECT u.id, u.email, u.created_at, u.is_admin, dp.username, dp.first_name
     FROM users u
     LEFT JOIN dating_profiles dp ON dp.user_id = u.id
     WHERE LOWER(u.email) = LOWER($1)
     LIMIT 1`,
    [normalizedEmail]
  );
};

const ensureUserForOtpLogin = async (email) => {
  const normalizedEmail = normalizeRecipient(email);
  await syncAdminPrivilegesForEmail(normalizedEmail);
  const existingUserResult = await getUserWithProfileByEmail(normalizedEmail);

  if (existingUserResult.rows.length > 0) {
    await db.query(
      `INSERT INTO user_preferences (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [existingUserResult.rows[0].id]
    );

    return existingUserResult.rows[0];
  }

  const fallbackName = buildDisplayNameFromEmail(normalizedEmail);
  const generatedPasswordHash = await hashPassword(uuidv4());
  const createdUserResult = await db.query(
    'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at, is_admin',
    [normalizedEmail, generatedPasswordHash]
  );

  const createdUser = createdUserResult.rows[0];

  await db.query(
    `INSERT INTO dating_profiles (user_id, first_name, age, profile_completion_percent, last_active)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO NOTHING`,
    [createdUser.id, fallbackName, 18, 10]
  );

  await db.query(
    `INSERT INTO user_preferences (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [createdUser.id]
  );

  await syncAdminPrivilegesForEmail(normalizedEmail);
  const hydratedUserResult = await getUserWithProfileByEmail(normalizedEmail);
  return hydratedUserResult.rows[0];
};

const findStoredOtpEntry = async ({ otpId, email, phone }) => {
  const requestedRecipient = normalizeRecipient(email || phone);

  if (otpId) {
    const storedData = await getOTP(otpId);

    if (!storedData) {
      return null;
    }

    if (requestedRecipient && storedData.recipient !== requestedRecipient) {
      return null;
    }

    return { otpId, storedData };
  }

  if (!requestedRecipient) {
    return null;
  }

  return await findOTPByRecipient(requestedRecipient);
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
    username: userRecord.username || null,
    name: displayName,
    avatar: displayName.charAt(0).toUpperCase(),
    isAdmin,
    role: getAuthRole(userRecord),
    registrationType: getRegistrationType(userRecord)
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

// SIGNUP
router.post('/signup', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;
    const normalizedEmail = normalizeRecipient(email);

    if (!normalizedEmail || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Check if user exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const createdUserResult = await db.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, is_admin',
      [normalizedEmail, hashedPassword]
    );

    const userId = createdUserResult.rows[0].id;

    // Create empty dating profile
    await db.query(
      `INSERT INTO dating_profiles (user_id, first_name, age, profile_completion_percent, last_active)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, buildDisplayNameFromEmail(normalizedEmail), 18, 10]
    );

    // Create user preferences
    await db.query(
      'INSERT INTO user_preferences (user_id) VALUES ($1)',
      [userId]
    );

    await syncAdminPrivilegesForEmail(normalizedEmail);

    const persistedUserResult = await db.query(
      `SELECT id, email, is_admin
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
        isAdmin: Boolean(persistedUser.is_admin),
        role: getAuthRole(persistedUser),
        registrationType: getRegistrationType(persistedUser)
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeRecipient(email);
    const requestMetadata = getRequestMetadata(req);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    await syncAdminPrivilegesForEmail(normalizedEmail);

    // Find user
    const result = await db.query(
      'SELECT id, email, password, is_admin FROM users WHERE email = $1',
      [normalizedEmail]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
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
        `SELECT id, email, is_admin
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

      res.json({
        valid: true,
        user: {
          id: userRecord.id,
          email: userRecord.email,
          isAdmin: Boolean(userRecord.is_admin),
          role: getAuthRole(userRecord),
          registrationType: getRegistrationType(userRecord)
        }
      });
    } catch (lookupError) {
      console.error('Verify token error:', lookupError);
      res.status(500).json({ valid: false, error: 'Failed to verify token' });
    }
  });
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
      'SELECT id, email, created_at, is_admin FROM users WHERE id = $1',
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
       RETURNING id, email, created_at, storefront_data, is_admin`,
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
    const { email, phone } = req.body;
    const recipient = normalizeRecipient(email || phone);

    if (!email && !phone) {
      return res.status(400).json({ error: 'Email or phone number required' });
    }

    // Validate that email credentials are configured
    if (email && !process.env.EMAIL_USER) {
      console.error('EMAIL_USER environment variable not set');
      return res.status(500).json({ error: 'Email service not configured. Please contact support.' });
    }

    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpId = uuidv4();

    // Store OTP with 10-minute expiration in Redis
    await storeOTP(otpId, {
      otp,
      recipient,
      createdAt: Date.now()
    });

    console.log(`OTP generated: ${otp} for ${email || phone}`);

    const developmentOtpPayload = process.env.NODE_ENV === 'production'
      ? {}
      : { devOtp: otp };

    // Send OTP via email
    if (email) {
      try {
        const transporter = getEmailTransporter();
        
        // Verify connection before sending
        await transporter.verify();
        console.log('Email transporter verified');

        const mailResult = await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: email,
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

        console.log(`✓ OTP email sent successfully to ${email} (MessageID: ${mailResult.messageId})`);

        res.json({
          success: true,
          message: 'OTP sent successfully to your email',
          otpId,
          ...developmentOtpPayload
        });
      } catch (emailError) {
        console.error('❌ Email send error:', {
          message: emailError.message,
          code: emailError.code,
          response: emailError.response,
          command: emailError.command
        });

        // Return error details in development mode for debugging
        if (process.env.NODE_ENV === 'development') {
          return res.status(500).json({ 
            error: 'Failed to send OTP',
            details: emailError.message,
            otpId,
            devOtp: otp
          });
        }

        res.status(500).json({ 
          error: 'Failed to send OTP. Please check your credentials and try again.' 
        });
      }
    } else if (phone) {
      // Phone OTP (SMS) - not implemented yet
      res.json({
        success: true,
        message: 'OTP will be sent via SMS (feature coming soon)',
        otpId,
        ...developmentOtpPayload
      });
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP', details: error.message });
  }
});

router.all('/send-otp', methodNotAllowed('POST'));

// VERIFY OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { otpId, otp, email, phone, fullName, username, location, city, state, country, bio } = req.body;
    const requestMetadata = getRequestMetadata(req);

    if (!otp) {
      return res.status(400).json({ error: 'OTP required' });
    }

    const otpEntry = await findStoredOtpEntry({ otpId, email, phone });
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
      : normalizeRecipient(email);

    let authenticatedUser = null;
    let token = null;
    let needsUsernameSetup = false;

    if (recipientEmail) {
      const userRecord = await ensureUserForOtpLogin(recipientEmail);
      const profileRecord = await applyOtpRegistrationProfile(userRecord.id, recipientEmail, {
        fullName,
        username,
        location,
        city,
        state,
        country,
        bio
      });

      authenticatedUser = buildAuthUserPayload({
        ...userRecord,
        username: profileRecord?.username || userRecord.username,
        first_name: profileRecord?.first_name || userRecord.first_name
      });
      token = generateToken(userRecord);
      needsUsernameSetup = !(profileRecord?.username || userRecord.username);

      spamFraudService.trackUserActivity({
        userId: userRecord.id,
        action: 'otp_login',
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
      needsUsernameSetup
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
      `INSERT INTO user_preferences (user_id)
       VALUES ($1)
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
