/**
 * DPDPA Compliance Service
 * Handles Data Protection Digital Processing Act requirements for India
 */

const db = require('../config/database');
const crypto = require('crypto');
const nodeMailer = require('nodemailer');

class DPDPAComplianceService {
  // Get user's current consent preferences
  async getConsentPreferences(userId) {
    const [preferences] = await db.query(
      `SELECT 
        id, 
        user_id, 
        marketing_emails,
        personalized_ads,
        data_analytics,
        third_party_sharing,
        location_tracking,
        push_notifications,
        updated_at
      FROM consent_preferences 
      WHERE user_id = ?`,
      [userId]
    );

    if (!preferences) {
      // Create default preferences
      return await this.initializeConsentPreferences(userId);
    }

    return {
      marketingEmails: preferences.marketing_emails,
      personalizedAds: preferences.personalized_ads,
      dataAnalytics: preferences.data_analytics,
      thirdPartySharing: preferences.third_party_sharing,
      locationTracking: preferences.location_tracking,
      pushNotifications: preferences.push_notifications,
      updatedAt: preferences.updated_at,
    };
  }

  // Initialize default consent preferences
  async initializeConsentPreferences(userId) {
    await db.query(
      `INSERT INTO consent_preferences 
      (user_id, marketing_emails, personalized_ads, data_analytics, third_party_sharing, location_tracking, push_notifications)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, true, true, true, false, false, true]
    );

    return {
      marketingEmails: true,
      personalizedAds: true,
      dataAnalytics: true,
      thirdPartySharing: false,
      locationTracking: false,
      pushNotifications: true,
    };
  }

  // Update consent preferences
  async updateConsentPreferences(userId, preferences) {
    await db.query(
      `UPDATE consent_preferences SET 
        marketing_emails = ?,
        personalized_ads = ?,
        data_analytics = ?,
        third_party_sharing = ?,
        location_tracking = ?,
        push_notifications = ?,
        updated_at = NOW()
      WHERE user_id = ?`,
      [
        preferences.marketingEmails,
        preferences.personalizedAds,
        preferences.dataAnalytics,
        preferences.thirdPartySharing,
        preferences.locationTracking,
        preferences.pushNotifications,
        userId,
      ]
    );

    return preferences;
  }

  // Request data deletion (30-day grace period)
  async requestDataDeletion(userId, reason, feedback) {
    const scheduledDeletionDate = new Date();
    scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

    const [result] = await db.query(
      `INSERT INTO data_deletion_requests 
      (user_id, reason, feedback, status, scheduled_deletion_date)
      VALUES (?, ?, ?, ?, ?)`,
      [userId, reason, feedback, 'PENDING', scheduledDeletionDate]
    );

    // Send confirmation email
    await this.sendDeletionConfirmationEmail(userId, scheduledDeletionDate, result.insertId);

    return {
      id: result.insertId,
      userId,
      created_at: new Date(),
      scheduled_deletion_date: scheduledDeletionDate,
      status: 'PENDING',
    };
  }

  // Request data export (DPDPA Article 6 - Right to Data Portability)
  async requestDataExport(userId, format = 'json') {
    const [result] = await db.query(
      `INSERT INTO data_export_requests 
      (user_id, format, status, created_at)
      VALUES (?, ?, ?, NOW())`,
      [userId, format, 'PROCESSING']
    );

    return {
      id: result.insertId,
      userId,
      format,
      status: 'PROCESSING',
      created_at: new Date(),
    };
  }

  // Generate secure download URL for exported data
  async generateExportDownloadUrl(exportId, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    await db.query(
      `INSERT INTO export_download_tokens 
      (export_id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)`,
      [exportId, userId, token, expiresAt]
    );

    return `${process.env.API_URL}/api/dpdpa/download-export/${exportId}/${token}`;
  }

  // Get privacy summary for user
  async getPrivacySummary(userId) {
    const [user] = await db.query(
      `SELECT id, email, created_at, last_login FROM users WHERE id = ?`,
      [userId]
    );

    const [preferences] = await db.query(
      `SELECT * FROM consent_preferences WHERE user_id = ?`,
      [userId]
    );

    const [messages] = await db.query(
      `SELECT COUNT(*) as count FROM messages WHERE sender_id = ? OR receiver_id = ?`,
      [userId, userId]
    );

    const [deletionRequest] = await db.query(
      `SELECT * FROM data_deletion_requests WHERE user_id = ? AND status IN (?, ?) ORDER BY created_at DESC LIMIT 1`,
      [userId, 'PENDING', 'IN_PROGRESS']
    );

    return {
      accountCreated: user.created_at,
      lastActive: user.last_login,
      dataCollected: {
        profileData: true,
        messageCount: messages[0].count,
        matchHistory: true,
        paymentHistory: true,
        locationHistory: true,
      },
      consentStatus: {
        marketing: preferences?.marketing_emails || false,
        analytics: preferences?.data_analytics || false,
        personalization: preferences?.personalized_ads || false,
        thirdPartySharing: preferences?.third_party_sharing || false,
      },
      deletionStatus: deletionRequest ? {
        requested: true,
        requestDate: deletionRequest.created_at,
        scheduledDate: deletionRequest.scheduled_deletion_date,
        daysRemaining: Math.ceil(
          (new Date(deletionRequest.scheduled_deletion_date) - new Date()) / (1000 * 60 * 60 * 24)
        ),
      } : null,
    };
  }

  // Record terms acceptance (for audit trail)
  async recordTermsAcceptance(userId, versions) {
    await db.query(
      `INSERT INTO terms_acceptance_log 
      (user_id, terms_version, privacy_version, guidelines_version, accepted_at, ip_address)
      VALUES (?, ?, ?, ?, NOW(), ?)`,
      [
        userId,
        versions.termsVersion,
        versions.privacyVersion,
        versions.communityGuidelinesVersion,
        // IP would be passed from middleware
        '0.0.0.0', // Placeholder
      ]
    );
  }

  // Get data processing information
  async getDataProcessingInfo(userId) {
    return {
      dataProcessingPurposes: [
        'Account creation and authentication',
        'Profile visibility and matchmaking',
        'Safety and fraud prevention',
        'Payment processing',
        'Service improvements and analytics',
        'Legal compliance',
      ],
      dataSharedWith: [
        'Payment processors (Razorpay)',
        'Email services for notifications',
        'Analytics providers (if opted in)',
        'Safety/verification services',
      ],
      dataRetention: {
        activeAccountData: 'Duration of account + 30 days after deletion',
        deletedAccountData: '90 days for legal/audit purposes',
        transactionData: '7 years (tax/legal requirement)',
        logs: '12 months',
      },
      userRights: [
        'Right to access your data',
        'Right to rectification of incorrect data',
        'Right to erasure (right to be forgotten)',
        'Right to restrict processing',
        'Right to data portability',
        'Right to object to processing',
        'Right to lodge a complaint with authorities',
      ],
    };
  }

  // Send deletion confirmation email
  async sendDeletionConfirmationEmail(userId, deletionDate, requestId) {
    try {
      const [user] = await db.query('SELECT email, first_name FROM users WHERE id = ?', [userId]);

      const transporter = nodeMailer.createTransport({
        service: 'Gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      const cancelUrl = `${process.env.APP_URL}/account/cancel-deletion/${requestId}`;

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'LinkUp - Account Deletion Request Confirmed',
        html: `
          <h2>Account Deletion Confirmed</h2>
          <p>Hi ${user.first_name},</p>
          <p>Your account deletion request has been received.</p>
          <p><strong>Your account will be deleted on: ${deletionDate.toDateString()}</strong></p>
          
          <h3>What happens next:</h3>
          <ul>
            <li>You have 30 days to cancel this request</li>
            <li>All your personal data will be permanently deleted</li>
            <li>Your account will no longer be accessible</li>
            <li>Messages with other users will be anonymized</li>
          </ul>
          
          <p><a href="${cancelUrl}">Click here to cancel deletion</a></p>
          
          <p>Questions? Contact us at support@linkup.app</p>
        `,
      });
    } catch (error) {
      console.error('Failed to send deletion confirmation email:', error);
    }
  }
}

module.exports = new DPDPAComplianceService();
