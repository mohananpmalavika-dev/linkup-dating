import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import datingProfileService from '../services/datingProfileService';
import { getStoredUserData } from '../utils/auth';
import '../styles/AccountSettings.css';

const GENDER_OPTIONS = ['male', 'female', 'non-binary', 'other'];
const RELATIONSHIP_GOALS_OPTIONS = ['serious', 'casual', 'friendship', 'marriage'];
const BODY_TYPE_OPTIONS = ['slim', 'athletic', 'average', 'curvy', 'muscular', 'heavyset'];
const INTEREST_SUGGESTIONS = [
  'music', 'travel', 'fitness', 'reading', 'cooking', 'gaming',
  'photography', 'art', 'hiking', 'movies', 'sports', 'dancing',
  'yoga', 'technology', 'fashion', 'pets', 'politics', 'science'
];

const AccountSettings = ({ onBack, onLogout }) => {
  const currentUser = getStoredUserData();
  const [activeTab, setActiveTab] = useState('security');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetId, setResetId] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devResetCode, setDevResetCode] = useState('');

  const [preferences, setPreferences] = useState({
    ageRangeMin: 18,
    ageRangeMax: 50,
    locationRadius: 50,
    genderPreferences: [],
    relationshipGoals: [],
    interests: [],
    heightRangeMin: '',
    heightRangeMax: '',
    bodyTypes: [],
    showMyProfile: true,
    allowMessages: true,
    notificationsEnabled: true
  });
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setPreferencesLoading(true);
    try {
      const data = await datingProfileService.getPreferences();
      setPreferences({
        ageRangeMin: data.ageRangeMin ?? 18,
        ageRangeMax: data.ageRangeMax ?? 50,
        locationRadius: data.locationRadius ?? 50,
        genderPreferences: data.genderPreferences || [],
        relationshipGoals: data.relationshipGoals || [],
        interests: data.interests || [],
        heightRangeMin: data.heightRangeMin || '',
        heightRangeMax: data.heightRangeMax || '',
        bodyTypes: data.bodyTypes || [],
        showMyProfile: data.showMyProfile ?? true,
        allowMessages: data.allowMessages ?? true,
        notificationsEnabled: data.notificationsEnabled ?? true
      });
    } catch (err) {
      console.error('Failed to load preferences:', err);
    } finally {
      setPreferencesLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setPreferencesSaving(true);
    setError('');
    setSuccess('');
    try {
      await datingProfileService.updatePreferences({
        ...preferences,
        heightRangeMin: preferences.heightRangeMin ? Number(preferences.heightRangeMin) : null,
        heightRangeMax: preferences.heightRangeMax ? Number(preferences.heightRangeMax) : null
      });
      setSuccess('Preferences saved successfully');
    } catch (err) {
      setError(err || 'Failed to save preferences');
    } finally {
      setPreferencesSaving(false);
    }
  };

  const toggleArrayValue = (field, value) => {
    setPreferences((prev) => {
      const current = prev[field] || [];
      const exists = current.includes(value);
      return { ...prev, [field]: exists ? current.filter((v) => v !== value) : [...current, value] };
    });
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText.trim().toUpperCase() !== 'DELETE') {
      setError('Type DELETE to confirm account deletion');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.deleteAccount({ confirmationText: deleteConfirmationText.trim() });
      setSuccess('Account deleted successfully. You will be logged out.');
      setTimeout(() => { if (typeof onLogout === 'function') { onLogout(); } }, 2000);
    } catch (err) {
      setError(err?.error || err.response?.data?.error || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!currentUser?.email) { setError('Unable to determine your account email'); return; }
    setResetLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await authService.requestPasswordReset(currentUser.email);
      setResetId(response.resetId || '');
      setDevResetCode(response.devResetCode || '');
      setSuccess(response.message || 'Password reset code sent');
    } catch (err) {
      setError(err?.error || err || 'Failed to request password reset');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCompletePasswordReset = async () => {
    if (!resetId || !resetCode || !newPassword || !confirmPassword) {
      setError('Complete all password reset fields first');
      return;
    }
    setResetLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await authService.resetPassword({
        email: currentUser?.email, resetId, resetCode, newPassword, confirmPassword
      });
      setSuccess(response.message || 'Password reset successfully');
      setResetCode(''); setNewPassword(''); setConfirmPassword(''); setDevResetCode('');
    } catch (err) {
      setError(err?.error || err || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  const renderPreferencesTab = () => (
    <div className="preferences-section">
      {preferencesLoading ? (
        <div className="preferences-loading">
          <div className="spinner"></div>
          <p>Loading your preferences...</p>
        </div>
      ) : (
        <div className="preferences-form">
          <div className="preferences-group">
            <h3>Age Range</h3>
            <div className="range-inputs">
              <label className="range-field">
                <span>From</span>
                <input
                  type="number"
                  min="18"
                  max="120"
                  value={preferences.ageRangeMin}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, ageRangeMin: Number(e.target.value) }))
                  }
                />
              </label>
              <span className="range-separator">-</span>
              <label className="range-field">
                <span>To</span>
                <input
                  type="number"
                  min="18"
                  max="120"
                  value={preferences.ageRangeMax}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, ageRangeMax: Number(e.target.value) }))
                  }
                />
              </label>
            </div>
          </div>

          <div className="preferences-group">
            <h3>Location Radius</h3>
            <div className="range-slider-container">
              <input
                type="range"
                min="1"
                max="500"
                value={preferences.locationRadius}
                onChange={(e) =>
                  setPreferences((p) => ({ ...p, locationRadius: Number(e.target.value) }))
                }
                className="range-slider"
              />
              <span className="range-value">{preferences.locationRadius} km</span>
            </div>
          </div>

          <div className="preferences-group">
            <h3>Gender Preferences</h3>
            <div className="checkbox-grid">
              {GENDER_OPTIONS.map((gender) => (
                <label key={gender} className="checkbox-chip">
                  <input
                    type="checkbox"
                    checked={preferences.genderPreferences.includes(gender)}
                    onChange={() => toggleArrayValue('genderPreferences', gender)}
                  />
                  <span>{gender.charAt(0).toUpperCase() + gender.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="preferences-group">
            <h3>Relationship Goals</h3>
            <div className="checkbox-grid">
              {RELATIONSHIP_GOALS_OPTIONS.map((goal) => (
                <label key={goal} className="checkbox-chip">
                  <input
                    type="checkbox"
                    checked={preferences.relationshipGoals.includes(goal)}
                    onChange={() => toggleArrayValue('relationshipGoals', goal)}
                  />
                  <span>{goal.charAt(0).toUpperCase() + goal.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="preferences-group">
            <h3>Interests</h3>
            <div className="checkbox-grid">
              {INTEREST_SUGGESTIONS.map((interest) => (
                <label key={interest} className="checkbox-chip">
                  <input
                    type="checkbox"
                    checked={preferences.interests.includes(interest)}
                    onChange={() => toggleArrayValue('interests', interest)}
                  />
                  <span>{interest.charAt(0).toUpperCase() + interest.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="preferences-group">
            <h3>Height Range (cm)</h3>
            <div className="range-inputs">
              <label className="range-field">
                <span>Min</span>
                <input
                  type="number"
                  min="100"
                  max="250"
                  value={preferences.heightRangeMin}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, heightRangeMin: e.target.value }))
                  }
                  placeholder="Any"
                />
              </label>
              <span className="range-separator">-</span>
              <label className="range-field">
                <span>Max</span>
                <input
                  type="number"
                  min="100"
                  max="250"
                  value={preferences.heightRangeMax}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, heightRangeMax: e.target.value }))
                  }
                  placeholder="Any"
                />
              </label>
            </div>
          </div>

          <div className="preferences-group">
            <h3>Body Types</h3>
            <div className="checkbox-grid">
              {BODY_TYPE_OPTIONS.map((type) => (
                <label key={type} className="checkbox-chip">
                  <input
                    type="checkbox"
                    checked={preferences.bodyTypes.includes(type)}
                    onChange={() => toggleArrayValue('bodyTypes', type)}
                  />
                  <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="preferences-group">
            <h3>Privacy Settings</h3>
            <div className="toggle-list">
              <label className="toggle-item">
                <div className="toggle-info">
                  <strong>Show My Profile</strong>
                  <span>Appear in discovery for others</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.showMyProfile}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, showMyProfile: e.target.checked }))
                  }
                  className="toggle-switch"
                />
              </label>
              <label className="toggle-item">
                <div className="toggle-info">
                  <strong>Allow Messages</strong>
                  <span>Receive messages from matches</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.allowMessages}
                  onChange={(e) =>
                    setPreferences((p) => ({ ...p, allowMessages: e.target.checked }))
                  }
                  className="toggle-switch"
                />
              </label>
              <label className="toggle-item">
                <div className="toggle-info">
                  <strong>Notifications</strong>
                  <span>Push and email notifications</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notificationsEnabled}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      notificationsEnabled: e.target.checked
                    }))
                  }
                  className="toggle-switch"
                />
              </label>
            </div>
          </div>

          <button
            className="btn-save-preferences"
            onClick={handleSavePreferences}
            disabled={preferencesSaving}
          >
            {preferencesSaving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      )}
    </div>
  );

  const renderSecurityTab = () => (
    <div className="security-section">
      <div className="settings-item">
        <div className="setting-info">
          <h3>Password Reset</h3>
          <p>Send a reset code to {currentUser?.email || 'your email'} and choose a new password.</p>
        </div>
        <button className="btn-delete-account" onClick={handleRequestPasswordReset} disabled={resetLoading}>
          {resetLoading ? 'Sending...' : 'Send Reset Code'}
        </button>
      </div>

      {resetId && (
        <>
          <div className="form-group">
            <label htmlFor="reset-code">Reset code</label>
            <input id="reset-code" type="text" value={resetCode}
              onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter the 6-digit code" className="form-input" disabled={resetLoading} />
          </div>
          <div className="form-group">
            <label htmlFor="new-password">New password</label>
            <input id="new-password" type="password" value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="At least 8 characters" className="form-input" disabled={resetLoading} />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm new password</label>
            <input id="confirm-password" type="password" value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat your new password" className="form-input" disabled={resetLoading} />
          </div>
          {devResetCode && <div className="settings-success">Development reset code: <strong>{devResetCode}</strong></div>}
          <button className="btn-delete-account" onClick={handleCompletePasswordReset}
            disabled={resetLoading || !resetCode || !newPassword || !confirmPassword}>
            {resetLoading ? 'Resetting...' : 'Update Password'}
          </button>
        </>
      )}
    </div>
  );

  const renderAccountTab = () => (
    <div className="account-section">
      <div className="settings-item">
        <div className="setting-info">
          <h3>Delete Account</h3>
          <p>Permanently delete your account and all associated data</p>
        </div>
        <button className="btn-delete-account" onClick={() => setShowDeleteConfirmation(true)} disabled={loading}>
          Delete Account
        </button>
      </div>
    </div>
  );

  return (
    <div className="account-settings-container">
      <div className="settings-header">
        <button className="btn-back" onClick={onBack}>Back</button>
        <h1>Account Settings</h1>
        <div style={{ width: '44px' }} />
      </div>

      <div className="settings-tabs">
        <button className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => { setActiveTab('security'); setError(''); setSuccess(''); }}>Security</button>
        <button className={`tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => { setActiveTab('preferences'); setError(''); setSuccess(''); }}>Preferences</button>
        <button className={`tab-btn ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => { setActiveTab('account'); setError(''); setSuccess(''); }}>Account</button>
      </div>

      <div className="settings-content">
        {error && <div className="settings-error">{error}</div>}
        {success && <div className="settings-success">{success}</div>}
        {activeTab === 'security' && renderSecurityTab()}
        {activeTab === 'preferences' && renderPreferencesTab()}
        {activeTab === 'account' && renderAccountTab()}
      </div>

      {showDeleteConfirmation && (
        <div className="delete-confirmation-overlay" onClick={() => !loading && setShowDeleteConfirmation(false)}>
          <div className="delete-confirmation-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-modal-header">
              <h2>Delete Account</h2>
              <button className="close-btn" onClick={() => !loading && setShowDeleteConfirmation(false)} disabled={loading}>×</button>
            </div>
            <div className="delete-modal-content">
              <div className="warning-section">
                <span className="warning-icon">⚠️</span>
                <p className="warning-title">This action cannot be undone</p>
                <p className="warning-text">Deleting your account will permanently remove:</p>
              </div>
              <ul className="deletion-effects">
                <li>Your profile and all profile information</li>
                <li>All your photos</li>
                <li>Your matches and conversations</li>
                <li>Your account settings and preferences</li>
                <li>Any reports or blocks you've made</li>
              </ul>
              <div className="form-group">
                <label htmlFor="delete-confirmation">Type DELETE to confirm permanent deletion</label>
                <input id="delete-confirmation" type="text" value={deleteConfirmationText}
                  onChange={e => setDeleteConfirmationText(e.target.value)} placeholder="DELETE"
                  disabled={loading} className="form-input" />
              </div>
              <div className="modal-actions">
                <button className="btn btn-cancel-delete" onClick={() => {
                  setShowDeleteConfirmation(false); setDeleteConfirmationText(''); setError('');
                }} disabled={loading}>Cancel</button>
                <button className="btn btn-confirm-delete" onClick={handleDeleteAccount}
                  disabled={loading || deleteConfirmationText.trim().toUpperCase() !== 'DELETE'}>
                  {loading ? 'Deleting...' : 'Delete My Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSettings;
