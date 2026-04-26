import React, { useState } from 'react';
import { authService } from '../services/authService';
import { getStoredUserData } from '../utils/auth';
import '../styles/AccountSettings.css';

const AccountSettings = ({ onBack, onLogout }) => {
  const currentUser = getStoredUserData();
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText.trim().toUpperCase() !== 'DELETE') {
      setError('Type DELETE to confirm account deletion');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authService.deleteAccount({
        confirmationText: deleteConfirmationText.trim()
      });
      setSuccess('Account deleted successfully. You will be logged out.');
      
      // Log out after a short delay
      setTimeout(() => {
        if (typeof onLogout === 'function') {
          onLogout();
        }
      }, 2000);
    } catch (err) {
      setError(err?.error || err.response?.data?.error || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!currentUser?.email) {
      setError('Unable to determine your account email');
      return;
    }

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
        email: currentUser?.email,
        resetId,
        resetCode,
        newPassword,
        confirmPassword
      });

      setSuccess(response.message || 'Password reset successfully');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
      setDevResetCode('');
    } catch (err) {
      setError(err?.error || err || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="account-settings-container">
      <div className="settings-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h1>Account Settings</h1>
        <div style={{ width: '44px' }} />
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h2>Security</h2>

          <div className="settings-item">
            <div className="setting-info">
              <h3>Password Reset</h3>
              <p>Send a reset code to {currentUser?.email || 'your email'} and choose a new password.</p>
            </div>
            <button
              className="btn-delete-account"
              onClick={handleRequestPasswordReset}
              disabled={resetLoading}
            >
              {resetLoading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </div>

          {resetId ? (
            <div className="form-group">
              <label htmlFor="reset-code">Reset code</label>
              <input
                id="reset-code"
                type="text"
                value={resetCode}
                onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter the 6-digit code"
                className="form-input"
                disabled={resetLoading}
              />
            </div>
          ) : null}

          {resetId ? (
            <div className="form-group">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="form-input"
                disabled={resetLoading}
              />
            </div>
          ) : null}

          {resetId ? (
            <div className="form-group">
              <label htmlFor="confirm-password">Confirm new password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your new password"
                className="form-input"
                disabled={resetLoading}
              />
            </div>
          ) : null}

          {devResetCode ? (
            <div className="settings-success">
              Development reset code: <strong>{devResetCode}</strong>
            </div>
          ) : null}

          {resetId ? (
            <button
              className="btn-delete-account"
              onClick={handleCompletePasswordReset}
              disabled={resetLoading || !resetCode || !newPassword || !confirmPassword}
            >
              {resetLoading ? 'Resetting...' : 'Update Password'}
            </button>
          ) : null}
        </div>

        <div className="settings-section">
          <h2>Account Management</h2>
          
          <div className="settings-item">
            <div className="setting-info">
              <h3>Delete Account</h3>
              <p>Permanently delete your account and all associated data</p>
            </div>
            <button
              className="btn-delete-account"
              onClick={() => setShowDeleteConfirmation(true)}
              disabled={loading}
            >
              Delete Account
            </button>
          </div>

          {error && <div className="settings-error">{error}</div>}
          {success && <div className="settings-success">{success}</div>}
        </div>

        {showDeleteConfirmation && (
          <div className="delete-confirmation-overlay" onClick={() => !loading && setShowDeleteConfirmation(false)}>
            <div className="delete-confirmation-modal" onClick={e => e.stopPropagation()}>
              <div className="delete-modal-header">
                <h2>Delete Account</h2>
                <button
                  className="close-btn"
                  onClick={() => !loading && setShowDeleteConfirmation(false)}
                  disabled={loading}
                >
                  ×
                </button>
              </div>

              <div className="delete-modal-content">
                <div className="warning-section">
                  <span className="warning-icon">⚠️</span>
                  <p className="warning-title">This action cannot be undone</p>
                  <p className="warning-text">
                    Deleting your account will permanently remove:
                  </p>
                </div>

                <ul className="deletion-effects">
                  <li>Your profile and all profile information</li>
                  <li>All your photos</li>
                  <li>Your matches and conversations</li>
                  <li>Your account settings and preferences</li>
                  <li>Any reports or blocks you've made</li>
                </ul>

                <div className="form-group">
                  <label htmlFor="delete-confirmation">
                    Type DELETE to confirm permanent deletion
                  </label>
                  <input
                    id="delete-confirmation"
                    type="text"
                    value={deleteConfirmationText}
                    onChange={e => setDeleteConfirmationText(e.target.value)}
                    placeholder="DELETE"
                    disabled={loading}
                    className="form-input"
                  />
                </div>

                <div className="modal-actions">
                  <button
                    className="btn btn-cancel-delete"
                    onClick={() => {
                      setShowDeleteConfirmation(false);
                      setDeleteConfirmationText('');
                      setError('');
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-confirm-delete"
                    onClick={handleDeleteAccount}
                    disabled={loading || deleteConfirmationText.trim().toUpperCase() !== 'DELETE'}
                  >
                    {loading ? 'Deleting...' : 'Delete My Account'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSettings;
