/**
 * Call Preferences Routes - Manage what types of calls users accept
 */

const express = require('express');
const db = require('../config/database');

const router = express.Router();

/**
 * Get current call preferences for the authenticated user
 */
router.get('/my-preferences', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await db.query(`
      SELECT 
        is_available_for_calls,
        available_call_types,
        call_rating,
        total_calls_taken,
        call_earnings
      FROM dating_profiles
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = result.rows[0];

    res.json({
      success: true,
      preferences: {
        isAvailableForCalls: profile.is_available_for_calls,
        availableCallTypes: profile.available_call_types || ['voice', 'video'],
        callStats: {
          rating: Number(profile.call_rating) || 0,
          totalCalls: profile.total_calls_taken || 0,
          totalEarnings: Number(profile.call_earnings) || 0
        }
      }
    });
  } catch (error) {
    console.error('Get call preferences error:', error);
    res.status(500).json({ error: 'Failed to get call preferences' });
  }
});

/**
 * Update call preferences for the authenticated user
 * Body: { isAvailableForCalls: boolean, availableCallTypes: ['voice'] | ['video'] | ['voice', 'video'] }
 */
router.put('/my-preferences', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { isAvailableForCalls, availableCallTypes } = req.body;

    // Validate input
    if (typeof isAvailableForCalls !== 'boolean') {
      return res.status(400).json({ error: 'isAvailableForCalls must be a boolean' });
    }

    let callTypes = availableCallTypes || ['voice', 'video'];

    // Ensure it's an array
    if (!Array.isArray(callTypes)) {
      callTypes = [callTypes];
    }

    // Filter to only valid types
    const validTypes = ['voice', 'video'];
    callTypes = callTypes.filter(type => validTypes.includes(String(type).toLowerCase()));

    // If user is disabling calls, clear the available types
    if (!isAvailableForCalls) {
      callTypes = [];
    }

    if (isAvailableForCalls && callTypes.length === 0) {
      return res.status(400).json({ error: 'Must select at least one call type when availability is enabled' });
    }

    // Update the profile
    const result = await db.query(`
      UPDATE dating_profiles
      SET 
        is_available_for_calls = $2,
        available_call_types = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING is_available_for_calls, available_call_types
    `, [userId, isAvailableForCalls, callTypes]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const updated = result.rows[0];

    // Emit WebSocket event to broadcast preference change to all connected users
    const ioInstance = req.app?.io;
    if (ioInstance) {
      // Broadcast to all users that this user's preference has changed
      ioInstance.emit('user_call_preference_updated', {
        userId,
        isAvailableForCalls: updated.is_available_for_calls,
        availableCallTypes: updated.available_call_types || [],
        updatedAt: new Date().toISOString()
      });

      // Also emit to a user-specific room for their own apps
      ioInstance.to(`user_${userId}`).emit('your_call_preference_updated', {
        isAvailableForCalls: updated.is_available_for_calls,
        availableCallTypes: updated.available_call_types || [],
        updatedAt: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      preferences: {
        isAvailableForCalls: updated.is_available_for_calls,
        availableCallTypes: updated.available_call_types || [],
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Update call preferences error:', error);
    res.status(500).json({ error: 'Failed to update call preferences' });
  }
});

module.exports = router;
