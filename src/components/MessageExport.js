import React, { useState } from 'react';
import messagingEnhancedService from '../services/messagingEnhancedService';
import '../styles/MessageExport.css';

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

  const handleExport = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      setLoading(true);

      const fileName = await messagingEnhancedService.downloadExport(matchId, format, {
        startDate: dateRange.startDate || null,
        endDate: dateRange.endDate || null
      });

      setSuccess(`Chat exported successfully as ${fileName}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (exportError) {
      setError(exportError || 'Failed to export chat');
    } finally {
      setLoading(false);
    }
  };

  const formatDescriptions = {
    json: 'Complete structured format with metadata',
    csv: 'Spreadsheet format for sorting and analysis',
    html: 'Browser-friendly format for viewing or printing'
  };

  return (
    <div className="message-export">
      <div className="export-header">
        <h3>Export Chat</h3>
        <button type="button" className="close-btn" onClick={onClose}>x</button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={handleExport} className="export-form">
        <div className="form-section">
          <h4>Export Format</h4>
          <div className="format-options">
            {['json', 'csv', 'html'].map((nextFormat) => (
              <label key={nextFormat} className="format-option">
                <input
                  type="radio"
                  name="format"
                  value={nextFormat}
                  checked={format === nextFormat}
                  onChange={(event) => setFormat(event.target.value)}
                />
                <span className="format-name">{nextFormat.toUpperCase()}</span>
                <span className="format-desc">{formatDescriptions[nextFormat]}</span>
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
                onChange={(event) => (
                  setDateRange((currentRange) => ({
                    ...currentRange,
                    startDate: event.target.value
                  }))
                )}
                className="date-input"
              />
            </div>
            <div className="date-field">
              <label htmlFor="end-date">To:</label>
              <input
                id="end-date"
                type="date"
                value={dateRange.endDate}
                onChange={(event) => (
                  setDateRange((currentRange) => ({
                    ...currentRange,
                    endDate: event.target.value
                  }))
                )}
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
            {loading ? 'Exporting...' : 'Export chat'}
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
          <li>Exports include message text, timestamps, reactions, and supported media references</li>
          <li>Date filters help you export only part of a conversation</li>
          <li>Files are downloaded to your device from this browser session</li>
          <li>Expired disappearing messages are not included</li>
          <li>Use chat backup from the More menu when you want a server-side archive entry</li>
        </ul>
      </div>
    </div>
  );
};

export default MessageExport;
