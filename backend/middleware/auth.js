const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { isConfiguredAdminEmail, syncConfiguredAdminForEmail } = require('../utils/adminAccess');
const { getActiveBanForUser } = require('../utils/moderation');

const PREMIUM_PLANS = new Set(['premium', 'gold']);
const OPTIONAL_SCHEMA_ERROR_CODES = new Set(['42P01', '42703']);

const hasUnexpiredDate = (value) => !value || new Date(value) > new Date();
const isOptionalSchemaError = (error) =>
  OPTIONAL_SCHEMA_ERROR_CODES.has(error?.code || error?.parent?.code || error?.original?.code);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', async (err, decodedUser) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });

    try {
      const userId = decodedUser.userId || decodedUser.id;

      if (!userId) {
        return res.status(401).json({ error: 'Invalid authentication payload' });
      }

      const userResult = await db.query(
        `SELECT id, email, is_admin
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      const userRecord = userResult.rows[0];

      if (!userRecord.is_admin && isConfiguredAdminEmail(userRecord.email)) {
        await syncConfiguredAdminForEmail(db, userRecord.email);
        userRecord.is_admin = true;
      }

      const activeBan = await getActiveBanForUser(userRecord.id);
      if (activeBan) {
        return res.status(403).json({
          error: 'Your account is currently restricted by moderation.',
          code: 'ACCOUNT_RESTRICTED',
          ban: activeBan
        });
      }

      req.user = {
        ...decodedUser,
        id: userRecord.id,
        userId: userRecord.id,
        email: userRecord.email,
        isAdmin: Boolean(userRecord.is_admin),
        is_admin: Boolean(userRecord.is_admin)
      };

      next();
    } catch (lookupError) {
      console.error('Authentication lookup error:', lookupError);
      res.status(500).json({ error: 'Failed to authenticate user' });
    }
  });
};

const requirePremium = async (req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const subscriptionResult = await db.query(
      `SELECT plan, status, expires_at
       FROM subscriptions
       WHERE user_id = $1
       LIMIT 1`,
      [req.user.id]
    );

    const subscription = subscriptionResult.rows[0];
    const hasActiveSubscription = Boolean(
      subscription &&
        subscription.status === 'active' &&
        PREMIUM_PLANS.has(subscription.plan) &&
        hasUnexpiredDate(subscription.expires_at)
    );

    if (hasActiveSubscription) {
      req.user.subscriptionPlan = subscription.plan;
      req.user.isPremium = true;
      req.user.isGold = subscription.plan === 'gold';
      return next();
    }

    let legacyPremium = null;

    try {
      const legacyPremiumResult = await db.query(
        `SELECT is_premium, premium_until
         FROM dating_profiles
         WHERE user_id = $1
         LIMIT 1`,
        [req.user.id]
      );

      legacyPremium = legacyPremiumResult.rows[0];
    } catch (error) {
      if (!isOptionalSchemaError(error)) {
        throw error;
      }
    }

    const hasLegacyPremium = Boolean(
      legacyPremium?.is_premium && hasUnexpiredDate(legacyPremium.premium_until)
    );

    if (hasLegacyPremium) {
      req.user.subscriptionPlan = req.user.subscriptionPlan || 'premium';
      req.user.isPremium = true;
      req.user.isGold = false;
      return next();
    }

    return res.status(403).json({
      error: 'Premium subscription required',
      code: 'PREMIUM_REQUIRED'
    });
  } catch (error) {
    console.error('Premium access check error:', error);
    return res.status(500).json({ error: 'Failed to verify premium access' });
  }
};

module.exports = {
  authenticateUser: authenticateToken,
  authenticateToken,
  protect: authenticateToken,
  requirePremium
};
