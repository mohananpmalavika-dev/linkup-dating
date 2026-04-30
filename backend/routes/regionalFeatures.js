const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const RegionalFeaturesService = require('../services/regionalFeaturesService');

/**
 * REGIONAL FEATURES ROUTES
 * Malayalam language, Kerala districts, and regional safety features
 */

// Get available languages
router.get('/languages', (req, res) => {
  res.json({
    success: true,
    languages: RegionalFeaturesService.prototype.getAvailableLanguages(),
  });
});

// Set user language preference
router.post('/language', authenticate, async (req, res) => {
  try {
    const { languageCode } = req.body;
    const service = new RegionalFeaturesService();
    const result = await service.setUserLanguage(req.user.id, languageCode);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get user's language preference
router.get('/language', authenticate, async (req, res) => {
  try {
    const service = new RegionalFeaturesService();
    const language = await service.getUserLanguage(req.user.id);

    res.json({
      success: true,
      language,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get all Kerala districts
router.get('/districts', (req, res) => {
  const service = new RegionalFeaturesService();
  res.json({
    success: true,
    districts: service.getKeralaDistricts(),
  });
});

// Set user's district preference
router.post('/district', authenticate, async (req, res) => {
  try {
    const { districtCode } = req.body;
    const service = new RegionalFeaturesService();
    const result = await service.setDistrictPreference(req.user.id, districtCode);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get district-specific safety information
router.get('/safety/:districtCode', (req, res) => {
  try {
    const { districtCode } = req.params;
    const service = new RegionalFeaturesService();
    const safetyInfo = service.getDistrictSafetyInfo(districtCode);

    if (!safetyInfo) {
      return res.status(404).json({
        success: false,
        error: 'District not found',
      });
    }

    res.json({
      success: true,
      data: safetyInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get regional helplines
router.get('/helplines', (req, res) => {
  const service = new RegionalFeaturesService();
  res.json({
    success: true,
    helplines: service.constructor.REGIONAL_HELPLINES,
  });
});

// Get localized messages
router.get('/messages/:languageCode', (req, res) => {
  try {
    const { languageCode } = req.params;
    const service = new RegionalFeaturesService();
    const messages = service.getLocalizedMessages(languageCode);

    res.json({
      success: true,
      messages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Content moderation - Report content for takedown
router.post('/report-content', authenticate, async (req, res) => {
  try {
    const { contentId, contentType, reason, description } = req.body;

    if (!['profile', 'message', 'photo', 'moment', 'video'].includes(contentType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid content type',
      });
    }

    const service = new RegionalFeaturesService();
    const takedownId = await service.recordContentTakedown(
      contentId,
      req.user.id,
      reason,
      contentType
    );

    res.json({
      success: true,
      message: 'Content reported successfully',
      takedownId,
      expectedRemovalTime: '24 hours',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Admin: Get pending content removals
router.get('/admin/pending-removals', authenticate, async (req, res) => {
  try {
    // Verify admin
    const db = require('../config/database');
    const [user] = await db.query('SELECT role FROM users WHERE id = ?', [req.user.id]);

    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const service = new RegionalFeaturesService();
    const [removals] = await service.getPendingContentRemovals();

    res.json({
      success: true,
      data: removals,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Aadhaar e-KYC verification (Optional)
router.get('/aadhaar-status', authenticate, async (req, res) => {
  try {
    const service = new RegionalFeaturesService();
    const status = await service.getAadhaarStatus(req.user.id);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Initiate Aadhaar verification
router.post('/aadhaar-verify', authenticate, async (req, res) => {
  try {
    const { aadhaarNumber } = req.body;

    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Aadhaar number',
      });
    }

    const service = new RegionalFeaturesService();
    const result = await service.initiateAadhaarVerification(req.user.id, aadhaarNumber);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
