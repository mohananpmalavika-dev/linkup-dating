/**
 * Call Preferences Routes - Manage what types of calls users accept
 */

const express = require('express');
const db = require('../config/database');

const router = express.Router();
const VALID_CALL_TYPES = ['voice', 'video'];

const normalizeCallTypes = ({ availableCallTypes, availableFor, isAvailable }) => {
  if (!isAvailable) {
    return [];
  }

  let rawTypes = availableCallTypes;

  if (!rawTypes && availableFor && typeof availableFor === 'object') {
    rawTypes = Object.entries(availableFor)
      .filter(([, enabled]) => enabled !== false)
      .map(([type]) => String(type).toLowerCase());
  }

  if (!Array.isArray(rawTypes)) {
    rawTypes = rawTypes ? [rawTypes] : [...VALID_CALL_TYPES];
  }

  return Array.from(
    new Set(
      rawTypes
        .map((type) => String(type || '').trim().toLowerCase())
        .filter((type) => VALID_CALL_TYPES.includes(type))
    )
  );
};

const toAvailableFor = (availableCallTypes = []) => ({
  voice: availableCallTypes.includes('voice'),
  video: availableCallTypes.includes('video')
});

const emitPreferenceUpdate = (req, userId, isAvailableForCalls, availableCallTypes = []) => {
  const ioInstance = req.app?.io;

  if (!ioInstance) {
    return;
  }

  const payload = {
    userId,
    isAvailableForCalls,
    availableCallTypes,
    availableFor: toAvailableFor(availableCallTypes),
    updatedAt: new Date().toISOString()
  };

  ioInstance.emit('user_call_preference_updated', payload);
  ioInstance.to(`user_${userId}`).emit('your_call_preference_updated', payload);
};

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
        COALESCE(
          available_call_types,
          CASE
            WHEN COALESCE(is_available_for_calls, FALSE)
              THEN '{"voice","video"}'::text[]
            ELSE '{}'::text[]
          END
        ) as available_call_types,
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
        availableFor: toAvailableFor(profile.available_call_types || ['voice', 'video']),
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

    const { isAvailableForCalls, availableCallTypes, availableFor } = req.body;

    // Validate input
    if (typeof isAvailableForCalls !== 'boolean') {
      return res.status(400).json({ error: 'isAvailableForCalls must be a boolean' });
    }

    let callTypes = normalizeCallTypes({
      availableCallTypes,
      availableFor,
      isAvailable: isAvailableForCalls
    });

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
    const savedCallTypes = updated.available_call_types || [];
    emitPreferenceUpdate(req, userId, updated.is_available_for_calls, savedCallTypes);

    res.json({
      success: true,
      preferences: {
        isAvailableForCalls: updated.is_available_for_calls,
        availableCallTypes: savedCallTypes,
        availableFor: toAvailableFor(savedCallTypes),
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Update call preferences error:', error);
    res.status(500).json({ error: 'Failed to update call preferences' });
  }
});

module.exports = router;
