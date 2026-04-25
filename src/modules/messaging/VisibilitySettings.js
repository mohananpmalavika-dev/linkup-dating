import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/api';
import { getStoredAuthToken } from '../../utils/auth';
import './VisibilitySettings.css';

const VisibilitySettings = ({ user, onUpdate }) => {
  const [visibility, setVisibility] = useState({
    visibleViaPhone: true,
    visibleViaEmail: true,
    visibleViaUsername: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadVisibilitySettings();
  }, [user]);

  const loadVisibilitySettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/auth/visibility`, {
        headers: {
          Authorization: `Bearer ${getStoredAuthToken()}`,
        },
      });

      if (response.data.success) {
        setVisibility(response.data.visibility);
      }
    } catch (err) {
      setError('Error loading visibility settings');
      console.error('Error loading visibility settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setVisibility((prev) => {
      const newVisibility = {
        ...prev,
        [key]: !prev[key],
      };

      // Ensure at least one method is enabled
      const enabledMethods = Object.values(newVisibility).filter((v) => v === true).length;
      if (enabledMethods === 0) {
        setError('At least one visibility method must be enabled');
        return prev; // Don't update
      }

      setError('');
      return newVisibility;
    });
  };

  const handleSave = async () => {
    const enabledMethods = Object.values(visibility).filter((v) => v === true).length;
    if (enabledMethods === 0) {
      setError('At least one visibility method must be enabled');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/visibility`,
        visibility,
        {
          headers: {
            Authorization: `Bearer ${getStoredAuthToken()}`,
          },
        }
      );

      if (response.data.success) {
        setSuccess('Visibility settings updated successfully');
        if (onUpdate) {
          onUpdate({ visibility: response.data.visibility });
        }
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.data.message || 'Failed to update visibility settings');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating visibility settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="visibility-settings loading">Loading visibility settings...</div>;
  }

  const enabledCount = Object.values(visibility).filter((v) => v === true).length;

  return (
    <div className="visibility-settings">
      <div className="settings-header">
        <h3>👁️ Control Who Can Find You</h3>
        <p className="settings-description">
          Choose which methods others can use to send you invitations.
          You're currently visible via {enabledCount} method{enabledCount !== 1 ? 's' : ''}.
        </p>
      </div>

      <div className="visibility-options">
        {/* Email Visibility */}
        <div className="visibility-option">
          <div className="option-header">
            <label className="option-label">
              <input
                type="checkbox"
                checked={visibility.visibleViaEmail}
                onChange={() => handleToggle('visibleViaEmail')}
                disabled={saving}
              />
              <span className="option-title">📧 Visible via Email</span>
            </label>
          </div>
          <p className="option-description">
            Others can send you invitations using your email address
          </p>
          <div className={`option-status ${visibility.visibleViaEmail ? 'enabled' : 'disabled'}`}>
            {visibility.visibleViaEmail ? '✓ Enabled' : '✗ Disabled'}
          </div>
        </div>

        {/* Phone Visibility */}
        <div className="visibility-option">
          <div className="option-header">
            <label className="option-label">
              <input
                type="checkbox"
                checked={visibility.visibleViaPhone}
                onChange={() => handleToggle('visibleViaPhone')}
                disabled={saving}
              />
              <span className="option-title">📱 Visible via Phone</span>
            </label>
          </div>
          <p className="option-description">
            Others can send you invitations using your phone number
          </p>
          <div className={`option-status ${visibility.visibleViaPhone ? 'enabled' : 'disabled'}`}>
            {visibility.visibleViaPhone ? '✓ Enabled' : '✗ Disabled'}
          </div>
        </div>

        {/* Username Visibility */}
        <div className="visibility-option">
          <div className="option-header">
            <label className="option-label">
              <input
                type="checkbox"
                checked={visibility.visibleViaUsername}
                onChange={() => handleToggle('visibleViaUsername')}
                disabled={saving}
              />
              <span className="option-title">👤 Visible via Username</span>
            </label>
          </div>
          <p className="option-description">
            Others can send you invitations using your @username
          </p>
          <div className={`option-status ${visibility.visibleViaUsername ? 'enabled' : 'disabled'}`}>
            {visibility.visibleViaUsername ? '✓ Enabled' : '✗ Disabled'}
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="settings-actions">
        <button
          className="btn-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="privacy-info">
        <p className="info-title">ℹ️ About Visibility</p>
        <ul className="info-list">
          <li>You must enable at least one method for others to contact you</li>
          <li>Disabling a method doesn't hide that information - it only prevents new invitations via that method</li>
          <li>Existing contacts can always reach you via any enabled method</li>
          <li>Changes take effect immediately</li>
        </ul>
      </div>
    </div>
  );
};

export default VisibilitySettings;
