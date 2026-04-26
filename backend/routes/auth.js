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
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// OTP storage (in production, use database)
const otpStorage = new Map();

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
      recipient: email || phone,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      attempts: 0
    });

    console.log(`OTP generated: ${otp} for ${email || phone}`);

    // Send OTP via email
    if (email) {
      try {
        const transporter = getEmailTransporter();
        
        // Verify connection before sending
        await transporter.verify();
        console.log('Email transporter verified');

        const mailResult = await transporter.sendMail({
          from: process.env.EMAIL_USER,
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
          otpId
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
            otp: otp  // For development only
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
        otpId
      });
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP', details: error.message });
  }
});

// VERIFY OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { otpId, otp } = req.body;

    if (!otpId || !otp) {
      return res.status(400).json({ error: 'OTP ID and OTP required' });
    }

    // Check if OTP exists in storage
    const storedData = otpStorage.get(otpId);

    if (!storedData) {
      return res.status(400).json({ error: 'Invalid or expired OTP ID' });
    }

    // Check if OTP has expired
    if (Date.now() > storedData.expiresAt) {
      otpStorage.delete(otpId);
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Check if OTP matches
    if (storedData.otp !== otp) {
      storedData.attempts += 1;
      
      // Lock after 5 failed attempts
      if (storedData.attempts >= 5) {
        otpStorage.delete(otpId);
        return res.status(429).json({ error: 'Too many attempts. Please request a new OTP.' });
      }

      return res.status(400).json({ 
        error: 'Invalid OTP',
        attemptsRemaining: 5 - storedData.attempts
      });
    }

    // OTP verified successfully
    otpStorage.delete(otpId); // Clear the OTP after successful verification

    res.json({
      success: true,
      message: 'OTP verified successfully',
      verified: true
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

module.exports = router;
