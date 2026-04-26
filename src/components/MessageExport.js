import React, { useState } from 'react';
import messagingEnhancedService from '../../services/messagingEnhancedService';
import '../../styles/MessageExport.css';

/**
 * MessageExport Component
 * Export and backup conversations
 */
const MessageExport = ({ matchId, onClose }) => {
  const [format, setFormat] = useState('json');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleExport = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      setLoading(true);

      const selectedFormat = format;
      const range = {
        startDate: dateRange.startDate || null,
        endDate: dateRange.endDate || null
      };

      const fileName = await messagingEnhancedService.downloadExport(
        matchId,
        selectedFormat,
        range
      );

      setSuccess(`Chat exported successfully as ${fileName}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err || 'Failed to export chat');
    } finally {
      setLoading(false);
    }
  };

  const formatDescriptions = {
    json: 'Complete structured format with all metadata',
    csv: 'Spreadsheet format for data analysis',
    pdf: 'Formatted document for printing/sharing',
    html: 'Web-ready format for viewing in browser'
  };

  return (
    <div className="message-export">
      <div className="export-header">
        <h3>Export Chat</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={handleExport} className="export-form">
        <div className="form-section">
          <h4>Export Format</h4>
          <div className="format-options">
            {['json', 'csv', 'pdf', 'html'].map((fmt) => (
              <label key={fmt} className="format-option">
                <input
                  type="radio"
                  name="format"
                  value={fmt}
                  checked={format === fmt}
                  onChange={(e) => setFormat(e.target.value)}
                />
                <span className="format-name">{fmt.toUpperCase()}</span>
                <span className="format-desc">{formatDescriptions[fmt]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h4>Date Range (Optional)</h4>
          <div className="date-range">
            <div className="date-field">
              <label htmlFor="start-date">From:</label>
              <input
                id="start-date"
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, startDate: e.target.value })
                }
                className="date-input"
              />
            </div>
            <div className="date-field">
              <label htmlFor="end-date">To:</label>
              <input
                id="end-date"
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, endDate: e.target.value })
                }
                className="date-input"
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            disabled={loading}
            className="export-btn"
          >
            {loading ? 'Exporting...' : '📥 Export Chat'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="cancel-btn"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>

      <div className="export-info">
        <h4>About Exports</h4>
        <ul>
          <li>Exports include all messages, attachments metadata, and reactions</li>
          <li>Files are encrypted and secure</li>
          <li>Exports are saved to your device only</li>
          <li>Disappearing messages are excluded</li>
          <li>Attachments are referenced but not included (use backup for full content)</li>
        </ul>
      </div>
    </div>
  );
};

export default MessageExport;
