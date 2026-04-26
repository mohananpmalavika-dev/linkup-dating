const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if user is admin - will be verified from database
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

// 1. GET ADMIN DASHBOARD DATA
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    // Get today's metrics
    const todayMetrics = await db.query(
      `SELECT * FROM system_metrics WHERE metric_date = CURRENT_DATE`,
      []
    );

    // Get total reported users
    const reportedUsers = await db.query(
      `SELECT COUNT(*) as count FROM user_reports WHERE status = 'pending'`,
      []
    );

    // Get spam flagged users
    const spamFlags = await db.query(
      `SELECT COUNT(*) as count FROM spam_flags WHERE is_resolved = FALSE`,
      []
    );

    // Get fraud flagged users
    const fraudFlags = await db.query(
      `SELECT COUNT(*) as count FROM fraud_flags WHERE is_resolved = FALSE`,
      []
    );

    // Get active users count
    const activeUsers = await db.query(
      `SELECT COUNT(DISTINCT user_id) as count FROM user_session_logs 
       WHERE created_at > NOW() - INTERVAL '24 hours'`,
      []
    );

    // Get recent admin actions
    const recentActions = await db.query(
      `SELECT aa.*, u.email, tu.email as target_email
       FROM admin_actions aa
       LEFT JOIN users u ON aa.admin_user_id = u.id
       LEFT JOIN users tu ON aa.target_user_id = tu.id
       ORDER BY aa.created_at DESC LIMIT 10`,
      []
    );

    res.json({
      metrics: todayMetrics.rows[0] || {
        daily_active_users: 0,
        monthly_active_users: 0,
        total_messages: 0,
        total_matches: 0,
        new_users: 0
      },
      pendingReports: reportedUsers.rows[0].count,
      spamFlags: spamFlags.rows[0].count,
      fraudFlags: fraudFlags.rows[0].count,
      activeUsers: activeUsers.rows[0].count,
      recentActions: recentActions.rows
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// 2. GET ALL PENDING REPORTS
router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'pending' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const reports = await db.query(
      `SELECT ur.*, 
              ru.email as reporting_user_email, dp_ru.first_name as reporting_user_name,
              tu.email as reported_user_email, dp_tu.first_name as reported_user_name
       FROM user_reports ur
       LEFT JOIN users ru ON ur.reporting_user_id = ru.id
       LEFT JOIN dating_profiles dp_ru ON dp_ru.user_id = ru.id
       LEFT JOIN users tu ON ur.reported_user_id = tu.id
       LEFT JOIN dating_profiles dp_tu ON dp_tu.user_id = tu.id
       WHERE ur.status = $1
       ORDER BY ur.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, parseInt(limit), offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM user_reports WHERE status = $1`,
      [status]
    );

    res.json({
      reports: reports.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// 3. RESOLVE A REPORT
router.put('/reports/:reportId/resolve', requireAdmin, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, action } = req.body;

    if (!status || !action) {
      return res.status(400).json({ error: 'Status and action are required' });
    }

    // Update report status
    await db.query(
      `UPDATE user_reports SET status = $1, resolved_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [status, reportId]
    );

    // Log admin action
    const reportData = await db.query(
      `SELECT reported_user_id FROM user_reports WHERE id = $1`,
      [reportId]
    );

    if (reportData.rows.length > 0) {
      await db.query(
        `INSERT INTO admin_actions (admin_user_id, action_type, target_user_id, reason, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user.id,
          `report_${action}`,
          reportData.rows[0].reported_user_id,
          `Report #${reportId} - ${action}`,
          JSON.stringify({ reportId, status, action })
        ]
      );
    }

    res.json({ success: true, message: 'Report resolved successfully' });
  } catch (err) {
    console.error('Resolve report error:', err);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

// 4. GET SPAM FLAGS
router.get('/spam-flags', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, resolved = false } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const flags = await db.query(
      `SELECT sf.*, u.email, dp.first_name, dp.age
       FROM spam_flags sf
       LEFT JOIN users u ON sf.user_id = u.id
       LEFT JOIN dating_profiles dp ON dp.user_id = u.id
       WHERE sf.is_resolved = $1
       ORDER BY sf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [resolved === 'true', parseInt(limit), offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM spam_flags WHERE is_resolved = $1`,
      [resolved === 'true']
    );

    res.json({
      flags: flags.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Get spam flags error:', err);
    res.status(500).json({ error: 'Failed to fetch spam flags' });
  }
});

// 5. RESOLVE SPAM FLAG
router.put('/spam-flags/:flagId/resolve', requireAdmin, async (req, res) => {
  try {
    const { flagId } = req.params;
    const { action } = req.body;

    const flag = await db.query(
      `SELECT user_id FROM spam_flags WHERE id = $1`,
      [flagId]
    );

    if (flag.rows.length === 0) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    // Update flag
    await db.query(
      `UPDATE spam_flags SET is_resolved = TRUE, resolved_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [flagId]
    );

    // Log admin action
    await db.query(
      `INSERT INTO admin_actions (admin_user_id, action_type, target_user_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        `spam_${action}`,
        flag.rows[0].user_id,
        `Spam flag #${flagId} - ${action}`,
        JSON.stringify({ flagId, action })
      ]
    );

    res.json({ success: true, message: 'Spam flag resolved' });
  } catch (err) {
    console.error('Resolve spam flag error:', err);
    res.status(500).json({ error: 'Failed to resolve spam flag' });
  }
});

// 6. GET FRAUD FLAGS
router.get('/fraud-flags', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, resolved = false } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const flags = await db.query(
      `SELECT ff.*, u.email, dp.first_name, dp.age
       FROM fraud_flags ff
       LEFT JOIN users u ON ff.user_id = u.id
       LEFT JOIN dating_profiles dp ON dp.user_id = u.id
       WHERE ff.is_resolved = $1
       ORDER BY ff.confidence_score DESC, ff.created_at DESC
       LIMIT $2 OFFSET $3`,
      [resolved === 'true', parseInt(limit), offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM fraud_flags WHERE is_resolved = $1`,
      [resolved === 'true']
    );

    res.json({
      flags: flags.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Get fraud flags error:', err);
    res.status(500).json({ error: 'Failed to fetch fraud flags' });
  }
});

// 7. RESOLVE FRAUD FLAG
router.put('/fraud-flags/:flagId/resolve', requireAdmin, async (req, res) => {
  try {
    const { flagId } = req.params;
    const { action } = req.body;

    const flag = await db.query(
      `SELECT user_id FROM fraud_flags WHERE id = $1`,
      [flagId]
    );

    if (flag.rows.length === 0) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    // Update flag
    await db.query(
      `UPDATE fraud_flags SET is_resolved = TRUE, action_taken = $1 WHERE id = $2`,
      [action, flagId]
    );

    // Log admin action
    await db.query(
      `INSERT INTO admin_actions (admin_user_id, action_type, target_user_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        `fraud_${action}`,
        flag.rows[0].user_id,
        `Fraud flag #${flagId} - ${action}`,
        JSON.stringify({ flagId, action })
      ]
    );

    res.json({ success: true, message: 'Fraud flag resolved' });
  } catch (err) {
    console.error('Resolve fraud flag error:', err);
    res.status(500).json({ error: 'Failed to resolve fraud flag' });
  }
});

// 8. SUSPEND USER
router.post('/users/:userId/suspend', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration_days } = req.body;

    // Update dating profile to inactive
    await db.query(
      `UPDATE dating_profiles SET is_active = FALSE WHERE user_id = $1`,
      [userId]
    );

    // Log admin action
    await db.query(
      `INSERT INTO admin_actions (admin_user_id, action_type, target_user_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        'user_suspend',
        userId,
        reason,
        JSON.stringify({ duration_days })
      ]
    );

    res.json({ success: true, message: 'User suspended successfully' });
  } catch (err) {
    console.error('Suspend user error:', err);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

// 9. DELETE USER
router.post('/users/:userId/delete', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    // Delete user (cascading deletes will handle all related data)
    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);

    // Log admin action
    await db.query(
      `INSERT INTO admin_actions (admin_user_id, action_type, target_user_id, reason)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, 'user_delete', userId, reason]
    );

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// 10. GET USER ANALYTICS
router.get('/analytics/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const analytics = await db.query(
      `SELECT * FROM user_analytics 
       WHERE user_id = $1 AND activity_date >= CURRENT_DATE - INTERVAL '1 day' * $2
       ORDER BY activity_date DESC`,
      [userId, parseInt(days)]
    );

    const userInfo = await db.query(
      `SELECT u.id, u.email, dp.first_name, dp.age, dp.created_at, u.created_at as account_created_at
       FROM users u
       LEFT JOIN dating_profiles dp ON dp.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    res.json({
      user: userInfo.rows[0],
      analytics: analytics.rows
    });
  } catch (err) {
    console.error('Get user analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
});

// 11. GET PLATFORM ANALYTICS
router.get('/analytics/platform', requireAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const metrics = await db.query(
      `SELECT * FROM system_metrics 
       WHERE metric_date >= CURRENT_DATE - INTERVAL '1 day' * $1
       ORDER BY metric_date DESC`,
      [parseInt(days)]
    );

    // Calculate trends
    const dau = metrics.rows.map(m => ({ date: m.metric_date, value: m.daily_active_users }));
    const totalMessages = metrics.rows.reduce((sum, m) => sum + m.total_messages, 0);
    const totalMatches = metrics.rows.reduce((sum, m) => sum + m.total_matches, 0);
    const newUsers = metrics.rows.reduce((sum, m) => sum + m.new_users, 0);

    res.json({
      metrics: metrics.rows,
      summary: {
        dau: dau[0]?.value || 0,
        totalMessages,
        totalMatches,
        newUsers,
        periodDays: parseInt(days)
      }
    });
  } catch (err) {
    console.error('Get platform analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch platform analytics' });
  }
});

// 12. GET ADMIN ACTIONS LOG
router.get('/actions-log', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, action_type } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `SELECT aa.*, u.email as admin_email
                 FROM admin_actions aa
                 LEFT JOIN users u ON aa.admin_user_id = u.id`;
    let params = [];

    if (action_type) {
      query += ` WHERE aa.action_type = $1`;
      params.push(action_type);
      query += ` ORDER BY aa.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), offset);
    } else {
      query += ` ORDER BY aa.created_at DESC LIMIT $1 OFFSET $2`;
      params = [parseInt(limit), offset];
    }

    const actions = await db.query(query, params);

    const countResult = await db.query(
      action_type
        ? `SELECT COUNT(*) as count FROM admin_actions WHERE action_type = $1`
        : `SELECT COUNT(*) as count FROM admin_actions`,
      action_type ? [action_type] : []
    );

    res.json({
      actions: actions.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Get actions log error:', err);
    res.status(500).json({ error: 'Failed to fetch actions log' });
  }
});

module.exports = router;
