import React, { useEffect, useState } from 'react';
import socialService from '../services/socialService';
import '../styles/SocialIntegration.css';

const PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: 'IG', color: '#E4405F' },
  { id: 'tiktok', name: 'TikTok', icon: 'TT', color: '#000000' },
  { id: 'twitter', name: 'Twitter', icon: 'X', color: '#111827' },
  { id: 'facebook', name: 'Facebook', icon: 'FB', color: '#1877F2' }
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
      setIntegrations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load integrations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIntegration = async (event) => {
    event.preventDefault();
    if (!selectedPlatform || !username.trim()) {
      setError('Please select a platform and enter a username');
      return;
    }

    setSubmitting(true);
    try {
      const result = await socialService.addSocialIntegration(selectedPlatform, username.trim(), isPublic);
      setIntegrations((currentIntegrations) => {
        const remaining = currentIntegrations.filter((integration) => integration.platform !== result.platform);
        return [...remaining, result];
      });
      setSelectedPlatform(null);
      setUsername('');
      setIsPublic(false);
      setError('');
    } catch (err) {
      setError(err || 'Failed to add integration');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVisibility = async (integration) => {
    try {
      const updated = await socialService.updateSocialIntegration(integration.id, {
        isPublic: !(integration.isPublic ?? integration.is_public)
      });
      setIntegrations((currentIntegrations) =>
        currentIntegrations.map((currentIntegration) =>
          currentIntegration.id === integration.id ? updated : currentIntegration
        )
      );
    } catch (err) {
      setError(err || 'Failed to update visibility');
    }
  };

  const handleRemoveIntegration = async (integrationId) => {
    if (!window.confirm('Remove this social link?')) {
      return;
    }

    try {
      await socialService.removeSocialIntegration(integrationId);
      setIntegrations((currentIntegrations) =>
        currentIntegrations.filter((integration) => integration.id !== integrationId)
      );
    } catch (err) {
      setError('Failed to remove integration');
    }
  };

  const getPlatformInfo = (platformId) => PLATFORMS.find((platform) => platform.id === platformId);

  return (
    <div className="social-integration-modal-overlay" onClick={onClose}>
      <div className="social-integration-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Social Media Links</h2>
          <button className="close-btn" onClick={onClose}>x</button>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        {!selectedPlatform ? (
          <div className="platform-selector">
            <h3>Connect Your Social Media</h3>
            <p>Choose which handles you want to connect and whether they should appear on your dating profile.</p>
            <div className="platform-grid">
              {PLATFORMS.map((platform) => {
                const isAlreadyAdded = integrations.some((integration) => integration.platform === platform.id);

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
                    {isAlreadyAdded ? <span className="added-badge">Added</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <form onSubmit={handleAddIntegration} className="add-integration-form">
            <h3>Add {getPlatformInfo(selectedPlatform)?.name}</h3>

            <div className="form-group">
              <label>Username or handle</label>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="@username"
                className="form-input"
                disabled={submitting}
              />
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                  disabled={submitting}
                />
                <span>Show this link publicly on my profile</span>
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
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Add Account'}
              </button>
            </div>
          </form>
        )}

        {loading ? <div className="loading">Loading linked accounts...</div> : null}

        {integrations.length > 0 ? (
          <div className="current-integrations">
            <h3>Your Connected Accounts</h3>
            <div className="integration-list">
              {integrations.map((integration) => {
                const platformInfo = getPlatformInfo(integration.platform);
                const isVisible = integration.isPublic ?? integration.is_public;
                const verifiedAt = integration.verifiedAt ?? integration.verified_at;

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
                      {verifiedAt ? <span className="verified-badge">Verified</span> : null}
                      {isVisible ? (
                        <span className="public-badge">Public</span>
                      ) : (
                        <span className="private-badge">Private</span>
                      )}
                      <button
                        className="visibility-toggle-btn"
                        onClick={() => handleToggleVisibility(integration)}
                        title={isVisible ? 'Make private' : 'Make public'}
                      >
                        {isVisible ? 'Hide' : 'Show'}
                      </button>
                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveIntegration(integration.id)}
                        title="Remove account"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SocialIntegration;
