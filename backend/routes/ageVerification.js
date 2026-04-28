/**
 * Age Verification Routes
 * POST /auth/verify-age - Verify user age during signup
 * GET /auth/age-status - Get user's age verification status
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const {
  validateAgeVerification,
  storeAgeVerification,
  getAgeVerificationStatus,
  calculateAgeFromDOB
} = require('../utils/ageVerification');
const IPBlockingService = require('../services/ipBlockingService');
const AdminSettingsService = require('../services/adminSettingsService');
const { getClientIP } = require('../middleware/ipBlocking');

/**
 * POST /auth/verify-age
 * Verify user's age before account creation
 * Body: { ageVerification: { method, dateOfBirth }, email }
 */
router.post('/verify-age', async (req, res) => {
  try {
    const { ageVerification, email } = req.body;
    const clientIP = getClientIP(req);

    if (!ageVerification) {
      return res.status(400).json({
        error: 'Age verification required'
      });
    }

    // Validate age verification
    const validation = validateAgeVerification(ageVerification);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Age verification failed',
        details: validation.errors,
        code: 'AGE_VERIFICATION_FAILED'
      });
    }

    // Check if user is old enough
    if (!validation.isOver18) {
      const age = calculateAgeFromDOB(new Date(ageVerification.dateOfBirth));
      
      // Block IP for underage attempt (if enabled in admin settings)
      const blockingEnabled = await AdminSettingsService.getSetting('underage_block_enabled', true);
      
      if (blockingEnabled && clientIP) {
        try {
          await IPBlockingService.blockIPForUnderageAttempt(clientIP, email, age);
          console.log(`[SECURITY] Blocked IP ${clientIP} for underage attempt (age: ${age})`);
        } catch (blockError) {
          console.error('Error blocking IP:', blockError);
          // Don't fail the request if blocking fails
        }
      }

      return res.status(403).json({
        error: 'You must be at least 18 years old to use LinkUp',
        code: 'UNDERAGE_USER',
        age: age,
        message: blockingEnabled 
          ? `You entered an age of ${age}. Your IP address has been blocked for 2 hours due to underage signup attempt.` 
          : `You entered an age of ${age}. You must be 18 or older to use LinkUp.`
      });
    }

    // Return verification success
    res.json({
      success: true,
      message: 'Age verification successful. You may proceed with signup.',
      verified: true,
      ageVerification: {
        method: ageVerification.method,
        dateOfBirth: ageVerification.dateOfBirth,
        age: calculateAgeFromDOB(new Date(ageVerification.dateOfBirth))
      }
    });
  } catch (error) {
    console.error('Age verification error:', error);
    res.status(500).json({
      error: 'Age verification failed',
      code: 'AGE_VERIFICATION_ERROR'
    });
  }
});

/**
 * POST /auth/complete-signup-with-age
 * Complete signup with age verification
 * Body: { email, password, confirmPassword, ageVerification: { method, dateOfBirth } }
 */
router.post('/complete-signup-with-age', async (req, res) => {
  try {
    const { email, password, confirmPassword, ageVerification } = req.body;

    // Validation
    if (!email || !password || !confirmPassword || !ageVerification) {
      return res.status(400).json({
        error: 'Email, password, and age verification required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: 'Passwords do not match'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters'
      });
    }

    // Validate age
    const validation = validateAgeVerification(ageVerification);
    if (!validation.valid || !validation.isOver18) {
      return res.status(403).json({
        error: validation.isOver18 ? 'Age verification failed' : 'You must be at least 18 years old to use LinkUp',
        code: validation.isOver18 ? 'AGE_VERIFICATION_FAILED' : 'UNDERAGE_USER',
        details: validation.errors
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Email already registered'
      });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user (in a transaction)
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (email, password, created_at, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, email, is_admin`,
        [normalizedEmail, hashedPassword]
      );

      const userId = userResult.rows[0].id;
      const user = userResult.rows[0];

      // Store age verification
      await storeAgeVerification(
        {
          query: (text, params) => client.query(text, params)
        },
        userId,
        ageVerification
      );

      // Create dating profile
      const firstName = email.split('@')[0];
      const age = calculateAgeFromDOB(new Date(ageVerification.dateOfBirth));
      await client.query(
        `INSERT INTO dating_profiles (user_id, first_name, age, profile_completion_percent, last_active)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [userId, firstName, age, 15]
      );

      // Create user preferences
      await client.query(
        'INSERT INTO user_preferences (user_id, created_at, updated_at) VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [userId]
      );

      await client.query('COMMIT');

      // Generate JWT token
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { userId: userId, id: userId, email: user.email, isAdmin: Boolean(user.is_admin) },
        process.env.JWT_SECRET || 'your_secret_key',
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      res.status(201).json({
        message: 'Signup successful. Your age has been verified.',
        success: true,
        token,
        user: {
          id: userId,
          email: user.email,
          isAdmin: Boolean(user.is_admin),
          ageVerified: true,
          age: age
        }
      });
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Signup with age error:', error);
    res.status(500).json({
      error: 'Signup failed',
      details: error.message
    });
  }
});

/**
 * GET /auth/age-status
 * Get current user's age verification status
 */
router.get('/age-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const ageVerification = await getAgeVerificationStatus(db, userId);

    if (!ageVerification) {
      return res.json({
        verified: false,
        message: 'No age verification found'
      });
    }

    const age = calculateAgeFromDOB(new Date(ageVerification.date_of_birth));

    res.json({
      verified: ageVerification.is_verified,
      method: ageVerification.verification_method,
      age: age,
      verifiedAt: ageVerification.verified_at,
      message: ageVerification.is_verified ? 'Age verification complete' : 'Age verification pending'
    });
  } catch (error) {
    console.error('Age status error:', error);
    res.status(500).json({
      error: 'Failed to get age status'
    });
  }
});

module.exports = router;
