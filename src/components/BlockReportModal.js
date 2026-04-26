import React, { useState } from 'react';
import '../styles/BlockReportModal.css';

const BlockReportModal = ({ profile, onClose, onBlock, onReport }) => {
  const [action, setAction] = useState(null); // 'block', 'report', null
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleBlockUser = async () => {
    setLoading(true);
    setError('');
    try {
      await onBlock(profile.userId || profile.id);
      setSuccess('User blocked successfully');
      setTimeout(onClose, 1500);
    } catch (err) {
      setError('Failed to block user');
    } finally {
      setLoading(false);
    }
  };

  const handleReportUser = async () => {
    if (!reportReason) {
      setError('Please select a reason for reporting');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onReport(profile.userId || profile.id, reportReason, reportDescription);
      setSuccess('Report submitted successfully');
      setTimeout(onClose, 1500);
    } catch (err) {
      setError('Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const reportReasons = [
    { value: 'inappropriate_photos', label: 'Inappropriate photos' },
    { value: 'fake_profile', label: 'Fake profile' },
    { value: 'suspicious_behavior', label: 'Suspicious behavior' },
    { value: 'harassment', label: 'Harassment or threats' },
    { value: 'spam', label: 'Spam or scam' },
    { value: 'offensive_content', label: 'Offensive content' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <div className="block-report-modal-overlay" onClick={onClose}>
      <div className="block-report-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {action === 'block' ? 'Block User' : action === 'report' ? 'Report User' : 'Choose Action'}
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {success && <div className="modal-success">{success}</div>}
        {error && <div className="modal-error">{error}</div>}

        {!action ? (
          <div className="modal-content">
            <p className="user-name">{profile.firstName}, {profile.age}</p>
            <p className="modal-description">What would you like to do?</p>
            
            <div className="action-buttons">
              <button
                className="btn-action btn-block"
                onClick={() => setAction('block')}
                disabled={loading}
              >
                🚫 Block User
              </button>
              <button
                className="btn-action btn-report"
                onClick={() => setAction('report')}
                disabled={loading}
              >
                ⚠️ Report User
              </button>
            </div>

            <div className="action-info">
              <div className="info-item">
                <strong>Block:</strong>
                <p>Prevents this user from contacting you or seeing your profile</p>
              </div>
              <div className="info-item">
                <strong>Report:</strong>
                <p>Notifies our team of problematic behavior. We'll investigate all reports</p>
              </div>
            </div>

            <button className="btn-cancel" onClick={onClose}>Cancel</button>
          </div>
        ) : action === 'block' ? (
          <div className="modal-content">
            <div className="confirmation-section">
              <p>Are you sure you want to block {profile.firstName}?</p>
              <p className="confirmation-text">
                After blocking, {profile.firstName} won't be able to:
              </p>
              <ul className="block-effects">
                <li>See your profile</li>
                <li>Send you messages</li>
                <li>Match with you</li>
              </ul>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handleBlockUser}
                disabled={loading}
              >
                {loading ? 'Blocking...' : 'Confirm Block'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setAction(null)}
                disabled={loading}
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="modal-content">
            <div className="report-form">
              <p>Help us understand what's wrong with this profile</p>
              
              <div className="form-group">
                <label htmlFor="report-reason" className="form-label">
                  Reason for report *
                </label>
                <select
                  id="report-reason"
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  className="form-select"
                  disabled={loading}
                >
                  <option value="">-- Select a reason --</option>
                  {reportReasons.map(reason => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="report-description" className="form-label">
                  Additional details (optional)
                </label>
                <textarea
                  id="report-description"
                  value={reportDescription}
                  onChange={e => setReportDescription(e.target.value)}
                  placeholder="Describe what's wrong (max 500 characters)"
                  maxLength="500"
                  className="form-textarea"
                  disabled={loading}
                  rows="4"
                />
                <p className="char-count">{reportDescription.length}/500</p>
              </div>

              <div className="modal-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleReportUser}
                  disabled={loading || !reportReason}
                >
                  {loading ? 'Submitting...' : 'Submit Report'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setAction(null)}
                  disabled={loading}
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlockReportModal;
