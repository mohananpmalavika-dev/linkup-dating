const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const dpdpaService = require('../services/dpdpaComplianceService');
const archiveService = require('../services/dataArchiveService');
const { logAuditTrail } = require('../middleware/auditLog');

/**
 * DPDPA COMPLIANCE ROUTES - India Data Protection Act
 * Handles data deletion, portability, and consent management
 */

// Get user's current consent preferences
router.get('/consent-preferences', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = await dpdpaService.getConsentPreferences(userId);
    
    res.json({
      success: true,
      data: preferences,
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update consent preferences
router.put('/consent-preferences', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      marketingEmails,
      personalizedAds,
      dataAnalytics,
      thirdPartySharing,
      locationTracking,
      pushNotifications,
    } = req.body;

    const updated = await dpdpaService.updateConsentPreferences(userId, {
      marketingEmails,
      personalizedAds,
      dataAnalytics,
      thirdPartySharing,
      locationTracking,
      pushNotifications,
    });

    await logAuditTrail(userId, 'CONSENT_UPDATED', { preferences: updated });

    res.json({
      success: true,
      message: 'Consent preferences updated successfully',
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Request data deletion (soft delete - 30 day grace period)
router.post('/request-deletion', authenticate, logAuditTrail('DATA_DELETION_REQUESTED'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason, feedback } = req.body;

    // Check if deletion already requested
    const existing = await db.query(
      'SELECT * FROM data_deletion_requests WHERE user_id = ? AND status IN (?, ?)',
      [userId, 'PENDING', 'IN_PROGRESS']
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You already have a pending deletion request',
      });
    }

    const deletionRequest = await dpdpaService.requestDataDeletion(userId, reason, feedback);

    res.json({
      success: true,
      message: 'Data deletion request received. Your account will be deleted in 30 days.',
      data: {
        requestId: deletionRequest.id,
        requestedAt: deletionRequest.created_at,
        deletionDate: deletionRequest.scheduled_deletion_date,
        gracePeriod: '30 days - you can cancel anytime',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Cancel pending deletion request
router.post('/cancel-deletion/:requestId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    // Verify request belongs to user
    const [request] = await db.query(
      'SELECT * FROM data_deletion_requests WHERE id = ? AND user_id = ?',
      [requestId, userId]
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Deletion request not found',
      });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a deletion request that is already in progress',
      });
    }

    await db.query(
      'UPDATE data_deletion_requests SET status = ?, cancelled_at = NOW() WHERE id = ?',
      ['CANCELLED', requestId]
    );

    await logAuditTrail(userId, 'DATA_DELETION_CANCELLED', { requestId });

    res.json({
      success: true,
      message: 'Deletion request cancelled successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get deletion request status
router.get('/deletion-status/:requestId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    const [request] = await db.query(
      'SELECT * FROM data_deletion_requests WHERE id = ? AND user_id = ?',
      [requestId, userId]
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
      });
    }

    res.json({
      success: true,
      data: {
        requestId: request.id,
        status: request.status,
        requestedAt: request.created_at,
        scheduledDeletion: request.scheduled_deletion_date,
        daysRemaining: Math.ceil(
          (new Date(request.scheduled_deletion_date) - new Date()) / (1000 * 60 * 60 * 24)
        ),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Request data portability (export user data)
router.post('/request-data-export', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { format = 'json' } = req.body; // 'json' or 'csv'

    // Check existing requests (max 1 per 30 days)
    const recent = await db.query(
      'SELECT * FROM data_export_requests WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)',
      [userId]
    );

    if (recent.length > 0) {
      return res.status(429).json({
        success: false,
        error: 'You can request data export once every 30 days',
        nextAvailable: new Date(new Date(recent[0].created_at).getTime() + 30 * 24 * 60 * 60 * 1000),
      });
    }

    const exportRequest = await dpdpaService.requestDataExport(userId, format);

    // Queue async job to prepare export
    archiveService.prepareDataExport(userId, format, exportRequest.id);

    res.json({
      success: true,
      message: 'Data export request submitted. You will receive an email within 24 hours.',
      data: {
        requestId: exportRequest.id,
        format,
        status: 'PROCESSING',
        estimatedTime: '24 hours',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Check data export status
router.get('/export-status/:exportId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { exportId } = req.params;

    const [exportRequest] = await db.query(
      'SELECT * FROM data_export_requests WHERE id = ? AND user_id = ?',
      [exportId, userId]
    );

    if (!exportRequest) {
      return res.status(404).json({
        success: false,
        error: 'Export request not found',
      });
    }

    // If ready, generate download link
    let downloadUrl = null;
    if (exportRequest.status === 'READY') {
      downloadUrl = await dpdpaService.generateExportDownloadUrl(exportId, userId);
    }

    res.json({
      success: true,
      data: {
        requestId: exportRequest.id,
        status: exportRequest.status,
        format: exportRequest.format,
        createdAt: exportRequest.created_at,
        downloadUrl,
        expiresIn: downloadUrl ? '7 days' : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get privacy settings summary
router.get('/privacy-summary', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const summary = await dpdpaService.getPrivacySummary(userId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Accept terms and conditions (track consent)
router.post('/accept-terms', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { termsVersion, privacyVersion, communityGuidelinesVersion } = req.body;

    await dpdpaService.recordTermsAcceptance(userId, {
      termsVersion,
      privacyVersion,
      communityGuidelinesVersion,
    });

    res.json({
      success: true,
      message: 'Terms accepted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get data processing agreement (for transparency)
router.get('/data-processing', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const processing = await dpdpaService.getDataProcessingInfo(userId);

    res.json({
      success: true,
      data: processing,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Admin: Get deletion requests status
router.get('/admin/deletion-requests', authenticate, async (req, res) => {
  try {
    // Verify admin
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const requests = await db.query(
      'SELECT id, user_id, status, created_at, scheduled_deletion_date FROM data_deletion_requests WHERE status IN (?, ?) ORDER BY created_at DESC LIMIT 50',
      ['PENDING', 'IN_PROGRESS']
    );

    res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
