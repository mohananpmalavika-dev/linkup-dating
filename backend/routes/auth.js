const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const db = require('../config/database');

// Email transporter configuration - recreated on each request to ensure env vars are loaded
const getEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true' || false, // Use TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS // Note: EMAIL_PASS not EMAIL_PASSWORD
    }
  });
};

// OTP storage (in production, use database)
const otpStorage = new Map();

const normalizeRecipient = (value = '') => String(value || '').trim().toLowerCase();

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
    `SELECT u.id, u.email, u.created_at, dp.username, dp.first_name
     FROM users u
     LEFT JOIN dating_profiles dp ON dp.user_id = u.id
     WHERE LOWER(u.email) = LOWER($1)
     LIMIT 1`,
    [normalizedEmail]
  );
};

const ensureUserForOtpLogin = async (email) => {
  const normalizedEmail = normalizeRecipient(email);
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
    'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at',
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

  const hydratedUserResult = await getUserWithProfileByEmail(normalizedEmail);
  return hydratedUserResult.rows[0];
};

const findStoredOtpEntry = ({ otpId, email, phone }) => {
  const requestedRecipient = normalizeRecipient(email || phone);

  if (otpId) {
    const storedData = otpStorage.get(otpId);

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

  let latestMatch = null;

  for (const [storedOtpId, storedData] of otpStorage.entries()) {
    if (storedData.recipient !== requestedRecipient) {
      continue;
    }

    if (!latestMatch || storedData.createdAt > latestMatch.storedData.createdAt) {
      latestMatch = { otpId: storedOtpId, storedData };
    }
  }

  return latestMatch;
};

const buildAuthUserPayload = (userRecord) => {
  if (!userRecord) {
    return null;
  }

  const displayName = userRecord.first_name || buildDisplayNameFromEmail(userRecord.email);

  return {
    id: userRecord.id,
    email: userRecord.email,
    username: userRecord.username || null,
    name: displayName,
    avatar: displayName.charAt(0).toUpperCase()
  };
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
const generateToken = (userId) => {
  return jwt.sign(
    { userId, id: userId },
    process.env.JWT_SECRET || 'your_secret_key',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// SIGNUP
router.post('/signup', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    if (!email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Check if user exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const result = await db.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
      [email, hashedPassword]
    );

    const userId = result.rows[0].id;

    // Create empty dating profile
    await db.query(
      'INSERT INTO dating_profiles (user_id) VALUES ($1)',
      [userId]
    );

    // Create user preferences
    await db.query(
      'INSERT INTO user_preferences (user_id) VALUES ($1)',
      [userId]
    );

    const token = generateToken(userId);

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: userId, email }
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

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const result = await db.query('SELECT id, password FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// CHECK USERNAME AVAILABILITY
router.get('/check-username', async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    // Check if username exists in dating_profiles
    const result = await db.query(
      'SELECT id FROM dating_profiles WHERE first_name ILIKE $1 OR username ILIKE $1 LIMIT 1',
      [username]
    );

    const available = result.rows.length === 0;
    res.json({ available, username });
  } catch (err) {
    console.error('Check username error:', err.message);
    
    // If column doesn't exist, return available as true for now
    if (err.message.includes('column "username" does not exist')) {
      return res.json({ available: true, username: req.query.username });
    }
    
    res.status(500).json({ error: 'Failed to check username', details: err.message });
  }
});

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
router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ valid: false });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', (err, user) => {
    if (err) return res.status(401).json({ valid: false });
    res.json({ valid: true, user });
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
      'SELECT id, email, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Get dating profile if exists
    const profileResult = await db.query(
      'SELECT * FROM dating_profiles WHERE user_id = $1',
      [userId]
    );

    res.json({
      user: {
        ...user,
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

    // Store OTP with 10-minute expiration
    otpStorage.set(otpId, {
      otp,
      recipient,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: 0
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
    const { otpId, otp, email, phone } = req.body;

    if (!otp) {
      return res.status(400).json({ error: 'OTP required' });
    }

    const otpEntry = findStoredOtpEntry({ otpId, email, phone });
    if (!otpEntry) {
      return res.status(400).json({ error: 'Invalid or expired OTP request' });
    }

    const { otpId: matchedOtpId, storedData } = otpEntry;

    // Check if OTP has expired
    if (Date.now() > storedData.expiresAt) {
      otpStorage.delete(matchedOtpId);
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Check if OTP matches
    if (storedData.otp !== otp) {
      storedData.attempts += 1;
      
      // Lock after 5 failed attempts
      if (storedData.attempts >= 5) {
        otpStorage.delete(matchedOtpId);
        return res.status(429).json({ error: 'Too many attempts. Please request a new OTP.' });
      }

      return res.status(400).json({ 
        error: 'Invalid OTP',
        attemptsRemaining: 5 - storedData.attempts
      });
    }

    // OTP verified successfully
    otpStorage.delete(matchedOtpId); // Clear the OTP after successful verification

    const recipientEmail = storedData.recipient.includes('@')
      ? storedData.recipient
      : normalizeRecipient(email);

    let authenticatedUser = null;
    let token = null;
    let needsUsernameSetup = false;

    if (recipientEmail) {
      const userRecord = await ensureUserForOtpLogin(recipientEmail);
      authenticatedUser = buildAuthUserPayload(userRecord);
      token = generateToken(userRecord.id);
      needsUsernameSetup = !userRecord.username;
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
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

router.all('/verify-otp', methodNotAllowed('POST'));

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
      'SELECT id, email FROM users WHERE id = $1 LIMIT 1',
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
        name: profileResult.rows[0].first_name || fallbackName
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

module.exports = router;
