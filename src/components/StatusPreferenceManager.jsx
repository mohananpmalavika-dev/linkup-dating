/**
 * Status Preference Manager Component
 * Allows users to manage activity status sharing preferences per match
 * Features:
 * - Privacy level presets (full, basic, minimal, hidden)
 * - Individual setting toggles
 * - Real-time preview
 * - Bulk operations
 */

import React, { useState, useEffect } from 'react';
import { getStoredAuthToken } from '../utils/auth';
import { buildApiUrl } from '../utils/api';
import './StatusPreferenceManager.css';

const buildAuthenticatedFetchOptions = (options = {}) => {
  const token = getStoredAuthToken();

  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };
};

const StatusPreferenceManager = ({ matchId, userId, onSave = null, isOpen = false, onClose = null }) => {
  const [preference, setPreference] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [privacyLevel, setPrivacyLevel] = useState('full');
  const [customSettings, setCustomSettings] = useState({
    showOnlineStatus: true,
    showLastActive: true,
    showTypingIndicator: true,
    showActivityStatus: true,
    showReadReceipts: true,
    shareDetailedStatus: true
  });

  useEffect(() => {
    if (!isOpen || !matchId) return;
    fetchPreference();
  }, [isOpen, matchId]);

  const fetchPreference = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        buildApiUrl(`/dating/status-preferences/${matchId}`),
        buildAuthenticatedFetchOptions()
      );
      const data = await response.json();
      if (data.success) {
        const pref = data.preference;
        setPreference(pref);
        setPrivacyLevel(pref.privacy_level || 'full');
        setCustomSettings({
          showOnlineStatus: pref.show_online_status,
          showLastActive: pref.show_last_active,
          showTypingIndicator: pref.show_typing_indicator,
          showActivityStatus: pref.show_activity_status,
          showReadReceipts: pref.show_read_receipts,
          shareDetailedStatus: pref.share_detailed_status
        });
      }
    } catch (error) {
      console.error('Error fetching preference:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrivacyLevelChange = (level) => {
    setPrivacyLevel(level);

    const presets = {
      full: {
        showOnlineStatus: true,
        showLastActive: true,
        showTypingIndicator: true,
        showActivityStatus: true,
        showReadReceipts: true,
        shareDetailedStatus: true
      },
      basic: {
        showOnlineStatus: true,
        showLastActive: false,
        showTypingIndicator: false,
        showActivityStatus: false,
        showReadReceipts: false,
        shareDetailedStatus: false
      },
      minimal: {
        showOnlineStatus: false,
        showLastActive: true,
        showTypingIndicator: false,
        showActivityStatus: false,
        showReadReceipts: false,
        shareDetailedStatus: false
      },
      hidden: {
        showOnlineStatus: false,
        showLastActive: false,
        showTypingIndicator: false,
        showActivityStatus: false,
        showReadReceipts: false,
        shareDetailedStatus: false
      }
    };

    setCustomSettings(presets[level] || presets.full);
  };

  const handleSettingChange = (setting, value) => {
    setCustomSettings(prev => ({
      ...prev,
      [setting]: value
    }));
    // Auto-switch to custom mode if user modifies individual settings
    setPrivacyLevel('custom');
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(buildApiUrl('/dating/status-preferences'), {
        method: 'POST',
        ...buildAuthenticatedFetchOptions({
          headers: { 'Content-Type': 'application/json' }
        }),
        body: JSON.stringify({
          matchId,
          privacyLevel,
          ...customSettings
        })
      });

      const data = await response.json();
      if (data.success) {
        setPreference(data.preference);
        if (onSave) onSave(data.preference);
        alert('Privacy settings updated successfully');
        if (onClose) onClose();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving preference:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickSet = async (level) => {
    try {
      setSaving(true);
      const response = await fetch(buildApiUrl(`/dating/status-preferences/${matchId}/quick-set`), {
        method: 'POST',
        ...buildAuthenticatedFetchOptions({
          headers: { 'Content-Type': 'application/json' }
        }),
        body: JSON.stringify({ privacyLevel: level })
      });

      const data = await response.json();
      if (data.success) {
        setPreference(data.preference);
        setPrivacyLevel(level);
        handlePrivacyLevelChange(level);
        if (onSave) onSave(data.preference);
        alert(`Privacy level set to ${level}`);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error setting privacy level:', error);
      alert('Failed to set privacy level');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="status-preference-manager-overlay" onClick={onClose}>
      <div className="status-preference-manager" onClick={e => e.stopPropagation()}>
        <div className="manager-header">
          <h2>Activity Status Privacy</h2>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="manager-loading">
            <p>Loading preferences...</p>
          </div>
        ) : (
          <>
            <div className="manager-content">
              {/* Privacy Level Presets */}
              <div className="settings-section">
                <h3>Quick Privacy Presets</h3>
                <p className="section-description">
                  Select a privacy level to control what activity information you share
                </p>

                <div className="privacy-presets">
                  <button
                    className={`preset-btn ${privacyLevel === 'full' ? 'active' : ''}`}
                    onClick={() => handleQuickSet('full')}
                    disabled={saving}
                  >
                    <span className="preset-icon">🔓</span>
                    <span className="preset-name">Full</span>
                    <span className="preset-desc">Share everything</span>
                  </button>

                  <button
                    className={`preset-btn ${privacyLevel === 'basic' ? 'active' : ''}`}
                    onClick={() => handleQuickSet('basic')}
                    disabled={saving}
                  >
                    <span className="preset-icon">🔒</span>
                    <span className="preset-name">Basic</span>
                    <span className="preset-desc">Online/offline only</span>
                  </button>

                  <button
                    className={`preset-btn ${privacyLevel === 'minimal' ? 'active' : ''}`}
                    onClick={() => handleQuickSet('minimal')}
                    disabled={saving}
                  >
                    <span className="preset-icon">🔐</span>
                    <span className="preset-name">Minimal</span>
                    <span className="preset-desc">Last active only</span>
                  </button>

                  <button
                    className={`preset-btn ${privacyLevel === 'hidden' ? 'active' : ''}`}
                    onClick={() => handleQuickSet('hidden')}
                    disabled={saving}
                  >
                    <span className="preset-icon">🚫</span>
                    <span className="preset-name">Hidden</span>
                    <span className="preset-desc">No status visible</span>
                  </button>
                </div>
              </div>

              {/* Custom Settings */}
              <div className="settings-section">
                <h3>Custom Settings</h3>
                <p className="section-description">
                  Fine-tune individual status sharing options
                </p>

                <div className="custom-settings">
                  <label className="setting-item">
                    <input
                      type="checkbox"
                      checked={customSettings.showOnlineStatus}
                      onChange={e => handleSettingChange('showOnlineStatus', e.target.checked)}
                      disabled={saving}
                    />
                    <span className="setting-label">
                      <strong>Online Status</strong>
                      <small>Show if you're currently online</small>
                    </span>
                  </label>

                  <label className="setting-item">
                    <input
                      type="checkbox"
                      checked={customSettings.showLastActive}
                      onChange={e => handleSettingChange('showLastActive', e.target.checked)}
                      disabled={saving}
                    />
                    <span className="setting-label">
                      <strong>Last Active Time</strong>
                      <small>Show "Last active 2 minutes ago"</small>
                    </span>
                  </label>

                  <label className="setting-item">
                    <input
                      type="checkbox"
                      checked={customSettings.showActivityStatus}
                      onChange={e => handleSettingChange('showActivityStatus', e.target.checked)}
                      disabled={saving}
                    />
                    <span className="setting-label">
                      <strong>Activity Status</strong>
                      <small>Show current activity (video call, viewing profile, etc.)</small>
                    </span>
                  </label>

                  <label className="setting-item">
                    <input
                      type="checkbox"
                      checked={customSettings.showTypingIndicator}
                      onChange={e => handleSettingChange('showTypingIndicator', e.target.checked)}
                      disabled={saving}
                    />
                    <span className="setting-label">
                      <strong>Typing Indicator</strong>
                      <small>Show when you're typing</small>
                    </span>
                  </label>

                  <label className="setting-item">
                    <input
                      type="checkbox"
                      checked={customSettings.showReadReceipts}
                      onChange={e => handleSettingChange('showReadReceipts', e.target.checked)}
                      disabled={saving}
                    />
                    <span className="setting-label">
                      <strong>Read Receipts</strong>
                      <small>Show when you've read messages</small>
                    </span>
                  </label>
                </div>
              </div>

              {/* Info */}
              <div className="settings-section info-section">
                <h3>ℹ️ About Privacy Controls</h3>
                <ul className="info-list">
                  <li>Changes apply immediately to this match</li>
                  <li>You can set different privacy levels for each match</li>
                  <li>The other person won't know about your privacy settings</li>
                  <li>You can change settings anytime</li>
                </ul>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="manager-footer">
              <button
                className="btn btn-secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StatusPreferenceManager;
