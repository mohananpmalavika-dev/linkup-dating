/**
 * Admin Authentication Middleware
 * Ensures user is authenticated and has admin privileges
 */

const db = require('../config/database');

/**
 * Middleware to check if user is authenticated admin
 */
const requireAdmin = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin
    const userResult = await db.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // User is admin, continue
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Middleware to check if user is authenticated super admin
 * Super admins can manage other admins, change settings, etc.
 */
const requireSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userResult = await db.query(
      'SELECT is_admin, is_super_admin FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_super_admin) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    next();
  } catch (error) {
    console.error('Super admin middleware error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  requireAdmin,
  requireSuperAdmin
};
