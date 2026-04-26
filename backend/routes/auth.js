const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

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
    console.error('Check username error:', err);
    res.status(500).json({ error: 'Failed to check username' });
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

module.exports = router;
