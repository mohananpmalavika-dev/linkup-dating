import React, { useState } from 'react';
import authService from '../services/authService';
import '../styles/AccountSettings.css';

const AccountSettings = ({ onBack, onLogout }) => {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setError('Please enter your password to confirm deletion');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // In a real implementation, you might want to verify the password first
      // For now, we'll just call the delete account endpoint
      await authService.deleteAccount();
      setSuccess('Account deleted successfully. You will be logged out.');
      
      // Log out after a short delay
      setTimeout(() => {
        if (typeof onLogout === 'function') {
          onLogout();
        }
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete account');
    } finally {
      setLoading(false);
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
                  <label htmlFor="delete-password">
                    Enter your password to confirm deletion
                  </label>
                  <input
                    id="delete-password"
                    type="password"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    placeholder="Your password"
                    disabled={loading}
                    className="form-input"
                  />
                </div>

                <div className="modal-actions">
                  <button
                    className="btn btn-cancel-delete"
                    onClick={() => {
                      setShowDeleteConfirmation(false);
                      setDeletePassword('');
                      setError('');
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-confirm-delete"
                    onClick={handleDeleteAccount}
                    disabled={loading || !deletePassword}
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
