const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { isConfiguredAdminEmail, syncConfiguredAdminForEmail } = require('../utils/adminAccess');

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

module.exports = { authenticateToken };
