import React, { useState } from 'react';
import axios from 'axios';
import './DataExportImport.css';

/**
 * Data Export Component
 * DPDPA Compliance - Right to data portability
 */

export default function DataExportImport() {
  const [exportStatus, setExportStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [format, setFormat] = useState('json');

  const handleRequestExport = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('/api/dpdpa/request-data-export', {
        format,
      });

      setExportStatus(response.data.data);
      setSuccess(response.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request data export');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExport = async (exportId) => {
    try {
      const response = await axios.get(`/api/dpdpa/export-status/${exportId}`);

      if (response.data.data.status === 'READY' && response.data.data.downloadUrl) {
        // Download the file
        window.open(response.data.data.downloadUrl, '_blank');
      } else {
        setError('Export is not ready yet. Please check back soon.');
      }
    } catch (err) {
      setError('Failed to download export');
    }
  };

  return (
    <div className="data-export-container">
      <div className="export-card">
        <h2>📥 Export Your Data</h2>

        {error && <div className="error-alert">{error}</div>}
        {success && <div className="success-alert">{success}</div>}

        {!exportStatus ? (
          <div className="export-request">
            <div className="export-info">
              <h3>Get a Copy of Your Data</h3>
              <p>
                Under India's Data Protection Digital Processing Act (DPDPA),
                you have the right to access and download a copy of all your
                personal data.
              </p>

              <div className="what-included">
                <h4>Your export will include:</h4>
                <ul>
                  <li>✓ Profile information (name, bio, photos, preferences)</li>
                  <li>✓ Messages and conversations</li>
                  <li>✓ Matches and favorites</li>
                  <li>✓ Payment and subscription history</li>
                  <li>✓ Activity and usage data</li>
                  <li>✓ Privacy and consent preferences</li>
                  <li>✓ Account settings and preferences</li>
                </ul>
              </div>

              <div className="format-selection">
                <label>Select export format:</label>
                <div className="format-options">
                  <label className="format-option">
                    <input
                      type="radio"
                      value="json"
                      checked={format === 'json'}
                      onChange={(e) => setFormat(e.target.value)}
                    />
                    <span>JSON (Recommended)</span>
                    <small>Preserves all data structure and relationships</small>
                  </label>

                  <label className="format-option">
                    <input
                      type="radio"
                      value="csv"
                      checked={format === 'csv'}
                      onChange={(e) => setFormat(e.target.value)}
                    />
                    <span>CSV</span>
                    <small>Spreadsheet compatible format</small>
                  </label>
                </div>
              </div>

              <div className="important-note">
                <h4>⏱️ Processing Time</h4>
                <p>
                  Your data export will be prepared within 24 hours. You'll
                  receive an email with a download link that expires in 7 days.
                </p>
              </div>

              <button
                className="btn btn-primary btn-large"
                onClick={handleRequestExport}
                disabled={loading}
              >
                {loading ? 'Processing...' : '📥 Request Data Export'}
              </button>
            </div>
          </div>
        ) : (
          <div className="export-status">
            <h3>Export Request Submitted</h3>

            <div className="status-info">
              <p className="status-text">
                <strong>Status:</strong> {exportStatus.status}
              </p>
              <p className="format-text">
                <strong>Format:</strong> {exportStatus.format.toUpperCase()}
              </p>
              <p className="time-text">
                <strong>Estimated time:</strong> {exportStatus.estimatedTime}
              </p>
            </div>

            {exportStatus.status === 'READY' && exportStatus.downloadUrl ? (
              <div className="download-section">
                <h4>✓ Your data is ready!</h4>
                <button
                  className="btn btn-success"
                  onClick={() => handleDownloadExport(exportStatus.requestId)}
                >
                  ⬇️ Download Now
                </button>
                <p className="download-note">
                  Download link expires in {exportStatus.expiresIn}
                </p>
              </div>
            ) : (
              <div className="processing-section">
                <div className="progress-bar">
                  <div className="progress-fill"></div>
                </div>
                <p>Your data is being prepared. Check back soon!</p>
              </div>
            )}

            <button
              className="btn btn-secondary btn-large"
              onClick={() => setExportStatus(null)}
            >
              Request Another Export
            </button>
          </div>
        )}

        <div className="privacy-guarantee">
          <h4>🔒 Your Privacy is Protected</h4>
          <p>
            • Your data is encrypted during transfer<br/>
            • Download links expire after 7 days<br/>
            • Only you can access your exported data<br/>
            • This action doesn't affect your account
          </p>
        </div>
      </div>
    </div>
  );
}
