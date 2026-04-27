import React, { useEffect, useState } from 'react';
import socialService from '../services/socialService';
import '../styles/SocialIntegration.css';

const PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: '📷', color: '#E4405F' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#000' },
  { id: 'twitter', name: 'Twitter', icon: '𝕏', color: '#000' },
  { id: 'facebook', name: 'Facebook', icon: '📘', color: '#1877F2' }
];

const SocialIntegration = ({ onClose }) => {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [username, setUsername] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const data = await socialService.getSocialIntegrations();
      setIntegrations(data || []);
    } catch (err) {
      setError('Failed to load integrations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIntegration = async (e) => {
    e.preventDefault();
    if (!selectedPlatform || !username.trim()) {
      setError('Please select a platform and enter username');
      return;
    }

    setSubmitting(true);
    try {
      const result = await socialService.addSocialIntegration(
        selectedPlatform,
        username,
        isPublic
      );
      setIntegrations([...integrations, result]);
      setSelectedPlatform(null);
      setUsername('');
      setIsPublic(false);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to add integration');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveIntegration = async (integrationId) => {
    if (!window.confirm('Remove this social link?')) return;

    try {
      await socialService.removeSocialIntegration(integrationId);
      setIntegrations(integrations.filter(i => i.id !== integrationId));
    } catch (err) {
      setError('Failed to remove integration');
    }
  };

  const getPlatformInfo = (platformId) => PLATFORMS.find(p => p.id === platformId);

  return (
    <div className="social-integration-modal-overlay" onClick={onClose}>
      <div className="social-integration-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Social Media Links</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {/* Add New Integration */}
        {!selectedPlatform ? (
          <div className="platform-selector">
            <h3>Connect Your Social Media</h3>
            <p>Make your profile more discoverable</p>
            <div className="platform-grid">
              {PLATFORMS.map((platform) => {
                const isAlreadyAdded = integrations.some(i => i.platform === platform.id);
                return (
                  <button
                    key={platform.id}
                    className={`platform-btn ${isAlreadyAdded ? 'added' : ''}`}
                    onClick={() => !isAlreadyAdded && setSelectedPlatform(platform.id)}
                    disabled={isAlreadyAdded}
                    style={{ borderColor: platform.color }}
                  >
                    <span className="platform-icon">{platform.icon}</span>
                    <span className="platform-name">{platform.name}</span>
                    {isAlreadyAdded && <span className="added-badge">✓ Added</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <form onSubmit={handleAddIntegration} className="add-integration-form">
            <h3>Add {getPlatformInfo(selectedPlatform)?.name}</h3>
            
            <div className="form-group">
              <label>Username/Handle</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={`@username`}
                className="form-input"
                disabled={submitting}
              />
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  disabled={submitting}
                />
                <span>Make profile link visible to other users</span>
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedPlatform(null)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Adding...' : 'Add Account'}
              </button>
            </div>
          </form>
        )}

        {/* Current Integrations */}
        {integrations.length > 0 && (
          <div className="current-integrations">
            <h3>Your Connected Accounts</h3>
            <div className="integration-list">
              {integrations.map((integration) => {
                const platformInfo = getPlatformInfo(integration.platform);
                return (
                  <div key={integration.id} className="integration-item">
                    <div className="integration-info">
                      <span className="integration-icon">{platformInfo?.icon}</span>
                      <div className="integration-details">
                        <p className="integration-platform">{platformInfo?.name}</p>
                        <p className="integration-username">@{integration.username}</p>
                      </div>
                    </div>
                    <div className="integration-actions">
                      {integration.verified_at && (
                        <span className="verified-badge">✓ Verified</span>
                      )}
                      {integration.is_public ? (
                        <span className="public-badge">🔓 Public</span>
                      ) : (
                        <span className="private-badge">🔒 Private</span>
                      )}
                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveIntegration(integration.id)}
                        title="Remove account"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialIntegration;
