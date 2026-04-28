/**
 * Notification Routes
 * API endpoints for managing notifications and preferences
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const NotificationService = require('../services/notificationService');

/**
 * GET /api/notifications/preferences
 * Get current user's notification preferences
 */
router.get('/preferences', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = await NotificationService.getPreferences(userId);

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/preferences
 * Update notification preferences
 */
router.post('/preferences', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    const updated = await NotificationService.updatePreferences(userId, updates);

    res.json({
      success: true,
      preferences: updated
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/send
 * Send a smart notification
 */
router.post('/send', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationData = req.body;

    const result = await NotificationService.sendSmartNotification(userId, notificationData);

    res.json({
      success: result.sent,
      ...result
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/:notificationId/open
 * Record notification open event
 */
router.post('/:notificationId/open', protect, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { action } = req.body;

    const recorded = await NotificationService.recordNotificationOpened(
      notificationId,
      action
    );

    res.json({
      success: recorded,
      message: recorded ? 'Notification opened recorded' : 'Failed to record'
    });
  } catch (error) {
    console.error('Error recording notification open:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/notifications/stats
 * Get notification statistics for current user
 */
router.get('/stats', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;

    const stats = await NotificationService.getNotificationStats(userId, parseInt(days));

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting notification stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/optimal-time
 * Calculate optimal send time for user
 */
router.post('/optimal-time', protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const optimalTime = await NotificationService.calculateOptimalSendTime(userId);

    res.json({
      success: true,
      optimalTime
    });
  } catch (error) {
    console.error('Error calculating optimal time:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
