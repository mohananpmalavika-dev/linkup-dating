import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DataDeletionRequest.css';

/**
 * Data Deletion Request Component
 * DPDPA Compliance - Right to be forgotten (Article 5)
 */

export default function DataDeletionRequest() {
  const [deletionStatus, setDeletionStatus] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchDeletionStatus();
  }, []);

  const fetchDeletionStatus = async () => {
    try {
      const response = await axios.get('/api/dpdpa/deletion-status');
      if (response.data.data) {
        setDeletionStatus(response.data.data);
      }
    } catch (err) {
      // No pending deletion request
    }
  };

  const handleRequestDeletion = async () => {
    if (!reason) {
      setError('Please select a reason');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/dpdpa/request-deletion', {
        reason,
        feedback,
      });

      setSuccess('Deletion request submitted successfully!');
      setDeletionStatus(response.data.data);
      setShowConfirmation(false);
      setReason('');
      setFeedback('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request deletion');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDeletion = async () => {
    if (!deletionStatus?.requestId) return;

    setLoading(true);
    try {
      await axios.post(`/api/dpdpa/cancel-deletion/${deletionStatus.requestId}`);
      setSuccess('Deletion request cancelled successfully!');
      setDeletionStatus(null);
    } catch (err) {
      setError('Failed to cancel deletion request');
    } finally {
      setLoading(false);
    }
  };

  if (deletionStatus) {
    return (
      <div className="data-deletion-container">
        <div className="deletion-status-card">
          <div className="status-header warning">
            <h3>⚠️ Account Deletion Pending</h3>
          </div>

          <div className="status-info">
            <p className="status-text">
              Your account is scheduled for deletion on{' '}
              <strong>{new Date(deletionStatus.scheduledDeletion).toDateString()}</strong>
            </p>

            <div className="grace-period">
              <p className="days-remaining">
                <strong>{deletionStatus.daysRemaining}</strong> days remaining to cancel
              </p>
              <p className="grace-info">
                You have a 30-day grace period to cancel this request
              </p>
            </div>
          </div>

          <div className="what-happens">
            <h4>What will happen:</h4>
            <ul>
              <li>✅ All your personal data will be permanently deleted</li>
              <li>✅ Your profile will no longer be visible</li>
              <li>✅ Your messages will be anonymized</li>
              <li>✅ Your account will be inaccessible</li>
            </ul>
          </div>

          <div className="action-buttons">
            <button
              className="btn btn-secondary"
              onClick={handleCancelDeletion}
              disabled={loading}
            >
              {loading ? 'Cancelling...' : 'Cancel Deletion Request'}
            </button>
          </div>

          <p className="info-text">
            💡 Once deleted, account recovery is not possible. This action is permanent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="data-deletion-container">
      <div className="deletion-card">
        <h2>Delete Your Account</h2>

        {error && <div className="error-alert">{error}</div>}
        {success && <div className="success-alert">{success}</div>}

        {!showConfirmation ? (
          <div className="deletion-info">
            <div className="info-section">
              <h3>⚠️ Important Information</h3>
              <p>
                Account deletion is a serious action. Once you request deletion, your
                account will be completely removed after 30 days.
              </p>

              <h4>What will be deleted:</h4>
              <ul className="deletion-list">
                <li>✓ Your profile and photos</li>
                <li>✓ Your messages and chats</li>
                <li>✓ Your payment history</li>
                <li>✓ Your matches and favorites</li>
                <li>✓ All personal preferences and settings</li>
              </ul>

              <h4>What we keep (for legal/security):</h4>
              <ul className="retention-list">
                <li>• Transaction records (7 years - tax compliance)</li>
                <li>• Audit logs (12 months - security)</li>
                <li>• Anonymized usage data</li>
              </ul>

              <h4>Grace Period:</h4>
              <p>
                You have <strong>30 days</strong> after submitting the deletion request to
                cancel it. After 30 days, your account will be permanently deleted.
              </p>
            </div>

            <button
              className="btn btn-primary btn-large"
              onClick={() => setShowConfirmation(true)}
            >
              Continue with Deletion
            </button>
          </div>
        ) : (
          <div className="deletion-confirmation">
            <h3>Confirm Account Deletion</h3>

            <div className="form-group">
              <label htmlFor="reason">Why are you deleting your account?</label>
              <select
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="form-control"
              >
                <option value="">Select a reason...</option>
                <option value="not_using">Not using the app</option>
                <option value="privacy_concerns">Privacy concerns</option>
                <option value="found_match">Found my match</option>
                <option value="safety_concerns">Safety concerns</option>
                <option value="other">Other reason</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="feedback">
                Additional feedback (optional)
              </label>
              <textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Help us improve by sharing your feedback..."
                rows="4"
                className="form-control"
              />
            </div>

            <div className="confirmation-warning">
              <p>
                <strong>⚠️ Warning:</strong> This action cannot be undone immediately. Your
                account will be deleted in 30 days. You can cancel this request at any time
                during the grace period.
              </p>
            </div>

            <div className="action-buttons">
              <button
                className="btn btn-secondary"
                onClick={() => setShowConfirmation(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleRequestDeletion}
                disabled={loading || !reason}
              >
                {loading ? 'Processing...' : 'Request Deletion'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
