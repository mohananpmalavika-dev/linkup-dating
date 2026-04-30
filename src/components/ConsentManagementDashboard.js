import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ConsentManagementDashboard.css';

/**
 * Consent Management Dashboard Component
 * DPDPA Compliance - Manage data collection and processing
 */

export default function ConsentManagementDashboard() {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [privacySummary, setPrivacySummary] = useState(null);

  useEffect(() => {
    fetchConsentPreferences();
    fetchPrivacySummary();
  }, []);

  const fetchConsentPreferences = async () => {
    try {
      const response = await axios.get('/api/dpdpa/consent-preferences');
      setPreferences(response.data.data);
    } catch (err) {
      setError('Failed to load consent preferences');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrivacySummary = async () => {
    try {
      const response = await axios.get('/api/dpdpa/privacy-summary');
      setPrivacySummary(response.data.data);
    } catch (err) {
      console.error('Failed to load privacy summary');
    }
  };

  const handleToggle = (key) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await axios.put('/api/dpdpa/consent-preferences', {
        marketingEmails: preferences.marketingEmails,
        personalizedAds: preferences.personalizedAds,
        dataAnalytics: preferences.dataAnalytics,
        thirdPartySharing: preferences.thirdPartySharing,
        locationTracking: preferences.locationTracking,
        pushNotifications: preferences.pushNotifications,
      });

      setSuccess('Consent preferences saved successfully!');
    } catch (err) {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="consent-loading">Loading...</div>;
  }

  return (
    <div className="consent-dashboard">
      <h1>Privacy & Consent Management</h1>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="consent-container">
        {/* Privacy Summary */}
        {privacySummary && (
          <section className="privacy-summary-section">
            <h2>Your Privacy at a Glance</h2>

            <div className="summary-grid">
              <div className="summary-card">
                <h4>Account Created</h4>
                <p>
                  {new Date(privacySummary.accountCreated).toLocaleDateString()}
                </p>
              </div>

              <div className="summary-card">
                <h4>Messages Sent/Received</h4>
                <p>{privacySummary.dataCollected.messageCount}</p>
              </div>

              <div className="summary-card">
                <h4>Last Active</h4>
                <p>{new Date(privacySummary.lastActive).toLocaleDateString()}</p>
              </div>

              <div className="summary-card">
                <h4>Data Types</h4>
                <p>{Object.keys(privacySummary.dataCollected).length} categories</p>
              </div>
            </div>

            {privacySummary.deletionStatus && (
              <div className="deletion-status-box">
                <h4>⏰ Pending Deletion</h4>
                <p>
                  Your account is scheduled for deletion on{' '}
                  {new Date(
                    privacySummary.deletionStatus.scheduledDate
                  ).toDateString()}
                </p>
                <p className="days-left">
                  {privacySummary.deletionStatus.daysRemaining} days remaining to
                  cancel
                </p>
              </div>
            )}
          </section>
        )}

        {/* Consent Preferences */}
        <section className="consent-section">
          <h2>Data Collection Preferences</h2>
          <p className="section-description">
            Control how your data is collected and used
          </p>

          <div className="preferences-list">
            {/* Marketing Emails */}
            <div className="preference-item">
              <div className="preference-info">
                <h3>📧 Marketing Emails</h3>
                <p>
                  Receive emails about new features, promotions, and special
                  offers
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.marketingEmails}
                  onChange={() => handleToggle('marketingEmails')}
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Personalized Ads */}
            <div className="preference-item">
              <div className="preference-info">
                <h3>🎯 Personalized Ads</h3>
                <p>
                  Allow us to show ads tailored to your interests and
                  preferences
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.personalizedAds}
                  onChange={() => handleToggle('personalizedAds')}
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Data Analytics */}
            <div className="preference-item">
              <div className="preference-info">
                <h3>📊 Analytics & Improvements</h3>
                <p>
                  Help us improve the app by analyzing how you use LinkUp
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.dataAnalytics}
                  onChange={() => handleToggle('dataAnalytics')}
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Third Party Sharing */}
            <div className="preference-item">
              <div className="preference-info">
                <h3>🔗 Third-Party Sharing</h3>
                <p>
                  Share your data with trusted partners for better services
                  (rarely used)
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.thirdPartySharing}
                  onChange={() => handleToggle('thirdPartySharing')}
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Location Tracking */}
            <div className="preference-item">
              <div className="preference-info">
                <h3>📍 Location Tracking</h3>
                <p>
                  Allow background location tracking for distance-based features
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.locationTracking}
                  onChange={() => handleToggle('locationTracking')}
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Push Notifications */}
            <div className="preference-item">
              <div className="preference-info">
                <h3>🔔 Push Notifications</h3>
                <p>
                  Receive notifications about matches, messages, and app
                  updates
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.pushNotifications}
                  onChange={() => handleToggle('pushNotifications')}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          <button
            className="btn btn-primary btn-large"
            onClick={handleSavePreferences}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </section>

        {/* Data Rights */}
        <section className="data-rights-section">
          <h2>Your Data Rights (DPDPA)</h2>
          <p className="section-description">
            As per India's Data Protection Digital Processing Act, you have the
            following rights:
          </p>

          <div className="rights-grid">
            <div className="right-card">
              <h4>📖 Right to Access</h4>
              <p>View all personal data we hold about you</p>
            </div>

            <div className="right-card">
              <h4>✏️ Right to Rectification</h4>
              <p>Correct or update your personal information</p>
            </div>

            <div className="right-card">
              <h4>🗑️ Right to Erasure</h4>
              <p>Request permanent deletion of your data</p>
            </div>

            <div className="right-card">
              <h4>📤 Right to Portability</h4>
              <p>Export your data in a standard format</p>
            </div>

            <div className="right-card">
              <h4>🚫 Right to Restrict</h4>
              <p>Stop processing of your data</p>
            </div>

            <div className="right-card">
              <h4>📋 Right to Complain</h4>
              <p>Lodge complaints with data protection authorities</p>
            </div>
          </div>
        </section>

        {/* Data Processing Info */}
        <section className="data-processing-section">
          <h2>How We Use Your Data</h2>

          <div className="processing-box">
            <h4>Data Processing Purposes:</h4>
            <ul>
              <li>✓ Account creation and authentication</li>
              <li>✓ Profile matching and recommendations</li>
              <li>✓ Safety and fraud prevention</li>
              <li>✓ Payment processing</li>
              <li>✓ Service improvements</li>
              <li>✓ Legal and regulatory compliance</li>
            </ul>
          </div>

          <div className="processing-box">
            <h4>Data Retention:</h4>
            <ul>
              <li>📌 Active account data: Duration of account use</li>
              <li>📌 After deletion: 30 days grace period</li>
              <li>📌 Transactions: 7 years (tax law requirement)</li>
              <li>📌 Logs and audit trails: 12 months</li>
            </ul>
          </div>
        </section>

        {/* Action Buttons */}
        <section className="actions-section">
          <h2>Additional Actions</h2>

          <div className="action-buttons">
            <a href="/account/export-data" className="btn btn-secondary">
              📥 Export My Data
            </a>
            <a href="/account/delete-account" className="btn btn-danger">
              🗑️ Delete My Account
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
