import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getStoredAuthToken } from '../../utils/auth';
import '../../styles/ContactMeansSettings.css';

const ContactMeansSettings = ({ user, onUpdate }) => {
  const [contactMeans, setContactMeans] = useState({
    availableForChat: true,
    availableForVoiceCall: true,
    availableForVideoCall: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch current contact means settings
  useEffect(() => {
    const fetchContactMeans = async () => {
      try {
        const token = getStoredAuthToken();
        if (!token) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        const response = await axios.get(
          `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/auth/contact-means`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.data.success) {
          setContactMeans(response.data.contactMeans);
        }
      } catch (err) {
        console.error('Error fetching contact means:', err);
        setError('Failed to load contact means settings');
      } finally {
        setLoading(false);
      }
    };

    fetchContactMeans();
  }, []);

  // Clear notifications after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleToggle = (means) => {
    const enabledCount = [
      contactMeans.availableForChat && means !== 'availableForChat',
      contactMeans.availableForVoiceCall && means !== 'availableForVoiceCall',
      contactMeans.availableForVideoCall && means !== 'availableForVideoCall',
    ].filter((v) => v === true).length;

    if (contactMeans[means] && enabledCount === 0) {
      setError('At least one contact means must be enabled');
      return;
    }

    setContactMeans((prev) => ({
      ...prev,
      [means]: !prev[means],
    }));
  };

  const handleSave = async () => {
    // Validate at least one method is enabled
    const enabledCount = Object.values(contactMeans).filter((v) => v === true).length;
    if (enabledCount === 0) {
      setError('At least one contact means must be enabled');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const token = getStoredAuthToken();
      if (!token) {
        setError('Not authenticated');
        setSaving(false);
        return;
      }

      const response = await axios.post(
        `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/auth/contact-means`,
        contactMeans,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setSuccess('Contact means updated successfully!');
        setContactMeans(response.data.contactMeans);
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      console.error('Error saving contact means:', err);
      setError(
        err.response?.data?.message || 'Failed to save contact means settings'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="contact-means-container loading">Loading contact means settings...</div>;
  }

  const enabledCount = Object.values(contactMeans).filter((v) => v === true).length;

  const getMeansIcon = (means) => {
    switch (means) {
      case 'availableForChat':
        return '💬';
      case 'availableForVoiceCall':
        return '📞';
      case 'availableForVideoCall':
        return '📹';
      default:
        return '📱';
    }
  };

  const getMeansLabel = (means) => {
    switch (means) {
      case 'availableForChat':
        return 'Chat Messages';
      case 'availableForVoiceCall':
        return 'Voice Calls';
      case 'availableForVideoCall':
        return 'Video Calls';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="contact-means-container">
      <h3>How Others Can Contact You</h3>
      <p className="subtitle">Choose which communication methods you're available for</p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="means-options">
        {['availableForChat', 'availableForVoiceCall', 'availableForVideoCall'].map((means) => (
          <div key={means} className="means-option">
            <label className="means-label">
              <input
                type="checkbox"
                checked={contactMeans[means]}
                onChange={() => handleToggle(means)}
                disabled={saving}
              />
              <span className="means-icon">{getMeansIcon(means)}</span>
              <span className="means-text">{getMeansLabel(means)}</span>
            </label>
            <span className={`means-status ${contactMeans[means] ? 'enabled' : 'disabled'}`}>
              {contactMeans[means] ? '✓ Available' : '✗ Not Available'}
            </span>
          </div>
        ))}
      </div>

      <div className="means-info">
        <p>
          <strong>Active:</strong> {enabledCount} method{enabledCount !== 1 ? 's' : ''} enabled
        </p>
        <ul className="info-list">
          <li>💬 Chat: Text-based conversations</li>
          <li>📞 Voice Call: Audio calls for real-time conversation</li>
          <li>📹 Video Call: Video calls with screen sharing</li>
        </ul>
      </div>

      <button
        className="btn-save-means"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save Contact Preferences'}
      </button>
    </div>
  );
};

export default ContactMeansSettings;
