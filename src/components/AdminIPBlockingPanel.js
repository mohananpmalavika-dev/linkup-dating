import React, { useState, useEffect } from 'react';
import './AdminIPBlockingPanel.css';

/**
 * Admin Panel Component for IP Blocking & Age Verification Settings
 * Allows admins to:
 * - View and manage IP blocking settings
 * - Configure block duration (2, 24, 37 hours, etc.)
 * - Enable/disable IP blocking for underage attempts
 * - View list of currently blocked IPs
 * - Manually block/unblock IPs
 * - View blocking statistics
 */

const AdminIPBlockingPanel = () => {
  const [settings, setSettings] = useState({
    blockDurationHours: 2,
    blockingEnabled: true,
    maxAttempts: 3
  });

  const [accountCreationSettings, setAccountCreationSettings] = useState({
    threshold: 3,
    blockDurationHours: 24
  });

  const [blockedIPs, setBlockedIPs] = useState([]);
  const [limitedIPs, setLimitedIPs] = useState([]);
  const [stats, setStats] = useState(null);
  const [acStats, setACStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [newDuration, setNewDuration] = useState('2');
  const [newThreshold, setNewThreshold] = useState('3');
  const [newACDuration, setNewACDuration] = useState('24');
  const [manualBlockIP, setManualBlockIP] = useState('');
  const [manualBlockReason, setManualBlockReason] = useState('');
  const [activeTab, setActiveTab] = useState('age_settings'); // age_settings, age_blocks, age_stats, ac_settings, ac_ips, ac_stats

  const token = localStorage.getItem('token');

  // Fetch current settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ip-blocking/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      if (data.success && data.settings) {
        const parsed = {};
        data.settings.forEach(s => {
          if (s.settingKey === 'underage_ip_block_duration_hours') {
            parsed.blockDurationHours = parseInt(s.settingValue, 10);
          } else if (s.settingKey === 'underage_block_enabled') {
            parsed.blockingEnabled = s.settingValue === 'true' || s.settingValue === true;
          } else if (s.settingKey === 'max_underage_attempts_per_ip') {
            parsed.maxAttempts = parseInt(s.settingValue, 10);
          }
        });
        setSettings(parsed);
        setNewDuration(String(parsed.blockDurationHours));
      }
    } catch (err) {
      setError(`Error fetching settings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch blocked IPs
  const fetchBlockedIPs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ip-blocking/blocked-ips?page=1&limit=100&activeOnly=true', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch blocked IPs');
      const data = await response.json();
      if (data.success) {
        setBlockedIPs(data.data.blocks || []);
      }
    } catch (err) {
      setError(`Error fetching blocked IPs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ip-blocking/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.statistics);
      }
    } catch (err) {
      setError(`Error fetching statistics: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update block duration setting
  const handleUpdateDuration = async () => {
    try {
      setError(null);
      setSuccess(null);
      setLoading(true);

      const duration = parseInt(newDuration, 10);
      if (duration < 1 || duration > 168) {
        setError('Duration must be between 1 and 168 hours');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/admin/ip-blocking/settings/update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'underage_ip_block_duration_hours',
          value: String(duration),
          type: 'integer',
          description: 'Hours to block IP for underage signup attempt'
        })
      });

      if (!response.ok) throw new Error('Failed to update duration');
      const data = await response.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, blockDurationHours: duration }));
        setSuccess(`✓ Block duration updated to ${duration} hours`);
      }
    } catch (err) {
      setError(`Error updating duration: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Toggle IP blocking enabled/disabled
  const handleToggleBlocking = async () => {
    try {
      setError(null);
      setSuccess(null);
      setLoading(true);

      const response = await fetch('/api/admin/ip-blocking/settings/update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'underage_block_enabled',
          value: !settings.blockingEnabled,
          type: 'boolean',
          description: 'Enable/disable IP blocking for underage attempts'
        })
      });

      if (!response.ok) throw new Error('Failed to toggle blocking');
      const data = await response.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, blockingEnabled: !prev.blockingEnabled }));
        setSuccess(`✓ IP blocking ${!settings.blockingEnabled ? 'enabled' : 'disabled'}`);
      }
    } catch (err) {
      setError(`Error toggling blocking: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Manually block an IP
  const handleBlockIP = async () => {
    if (!manualBlockIP.trim()) {
      setError('Please enter an IP address');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setLoading(true);

      const response = await fetch('/api/admin/ip-blocking/block-ip', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ipAddress: manualBlockIP,
          reason: manualBlockReason || 'manual_admin_block',
          durationHours: settings.blockDurationHours
        })
      });

      if (!response.ok) throw new Error('Failed to block IP');
      const data = await response.json();
      if (data.success) {
        setSuccess(`✓ IP ${manualBlockIP} blocked for ${settings.blockDurationHours} hours`);
        setManualBlockIP('');
        setManualBlockReason('');
        fetchBlockedIPs();
      }
    } catch (err) {
      setError(`Error blocking IP: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Unblock an IP
  const handleUnblockIP = async (ip) => {
    if (!window.confirm(`Unblock ${ip}?`)) return;

    try {
      setError(null);
      setSuccess(null);
      setLoading(true);

      const response = await fetch(`/api/admin/ip-blocking/unblock-ip/${ip}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to unblock IP');
      const data = await response.json();
      if (data.success) {
        setSuccess(`✓ IP ${ip} unblocked`);
        fetchBlockedIPs();
      }
    } catch (err) {
      setError(`Error unblocking IP: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch account creation limit settings
  const fetchAccountCreationSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ip-blocking/account-creation/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      if (data.success && data.settings) {
        setAccountCreationSettings(data.settings);
        setNewThreshold(String(data.settings.threshold));
        setNewACDuration(String(data.settings.blockDurationHours));
      }
    } catch (err) {
      setError(`Error fetching account creation settings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch limited IPs
  const fetchLimitedIPs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ip-blocking/account-creation/ips?page=1&limit=100&blockedOnly=false', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch limited IPs');
      const data = await response.json();
      if (data.success) {
        setLimitedIPs(data.data.records || []);
      }
    } catch (err) {
      setError(`Error fetching limited IPs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch account creation statistics
  const fetchAccountCreationStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ip-blocking/account-creation/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch account creation stats');
      const data = await response.json();
      if (data.success) {
        setACStats(data.statistics);
      }
    } catch (err) {
      setError(`Error fetching account creation stats: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update account creation threshold
  const handleUpdateThreshold = async () => {
    try {
      setError(null);
      setSuccess(null);
      setLoading(true);

      const threshold = parseInt(newThreshold, 10);
      if (threshold < 1 || threshold > 100) {
        setError('Threshold must be between 1 and 100');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/admin/ip-blocking/account-creation/settings/update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'account_creation_limit_threshold',
          value: String(threshold),
          type: 'integer',
          description: 'Maximum accounts allowed per IP'
        })
      });

      if (!response.ok) throw new Error('Failed to update threshold');
      const data = await response.json();
      if (data.success) {
        setAccountCreationSettings(prev => ({ ...prev, threshold }));
        setSuccess(`✓ Account creation threshold updated to ${threshold}`);
      }
    } catch (err) {
      setError(`Error updating threshold: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update account creation block duration
  const handleUpdateACDuration = async () => {
    try {
      setError(null);
      setSuccess(null);
      setLoading(true);

      const duration = parseInt(newACDuration, 10);
      if (duration < 1 || duration > 720) {
        setError('Duration must be between 1 and 720 hours');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/admin/ip-blocking/account-creation/settings/update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'account_creation_block_duration_hours',
          value: String(duration),
          type: 'integer',
          description: 'Hours to block IP for account creation spam'
        })
      });

      if (!response.ok) throw new Error('Failed to update duration');
      const data = await response.json();
      if (data.success) {
        setAccountCreationSettings(prev => ({ ...prev, blockDurationHours: duration }));
        setSuccess(`✓ Block duration updated to ${duration} hours`);
      }
    } catch (err) {
      setError(`Error updating duration: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Unblock an IP from account creation limiting
  const handleUnblockAccountCreationIP = async (ip) => {
    if (!window.confirm(`Unblock ${ip} from account creation limiting?`)) return;

    try {
      setError(null);
      setSuccess(null);
      setLoading(true);

      const response = await fetch(`/api/admin/ip-blocking/account-creation/unblock/${ip}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to unblock IP');
      const data = await response.json();
      if (data.success) {
        setSuccess(`✓ IP ${ip} unblocked from account creation limiting`);
        fetchLimitedIPs();
      }
    } catch (err) {
      setError(`Error unblocking IP: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Reset account creation count for an IP
  const handleResetIP = async (ip) => {
    if (!window.confirm(`Reset account creation count for ${ip}?`)) return;

    try {
      setError(null);
      setSuccess(null);
      setLoading(true);

      const response = await fetch(`/api/admin/ip-blocking/account-creation/reset/${ip}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to reset IP');
      const data = await response.json();
      if (data.success) {
        setSuccess(`✓ IP ${ip} account creation count reset`);
        fetchLimitedIPs();
      }
    } catch (err) {
      setError(`Error resetting IP: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load data when component mounts or tab changes
  useEffect(() => {
    if (activeTab === 'age_settings') {
      fetchSettings();
    } else if (activeTab === 'age_blocks') {
      fetchBlockedIPs();
    } else if (activeTab === 'age_stats') {
      fetchStats();
    } else if (activeTab === 'ac_settings') {
      fetchAccountCreationSettings();
    } else if (activeTab === 'ac_ips') {
      fetchLimitedIPs();
    } else if (activeTab === 'ac_stats') {
      fetchAccountCreationStats();
    }
  }, [activeTab]);

  const formatDuration = (hours) => {
    if (hours === 1) return '1 hour';
    if (hours < 24) return `${hours} hours`;
    if (hours === 24) return '1 day';
    return `${(hours / 24).toFixed(1)} days`;
  };

  const formatExpiresAt = (expiresAt) => {
    try {
      const date = new Date(expiresAt);
      const now = new Date();
      const diffMs = date - now;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 0) return 'Expired';
      if (diffMins < 60) return `${diffMins} min`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hrs`;
      return `${Math.floor(diffMins / 1440)} days`;
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="admin-ip-blocking-panel">
      <div className="panel-header">
        <h2>🔒 Security & Rate Limiting</h2>
        <p>Manage age verification, IP blocking, and account creation rate limiting</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="tabs">
        <div className="tab-group">
          <span className="tab-group-title">Age Verification</span>
          <button
            className={`tab ${activeTab === 'age_settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('age_settings')}
          >
            ⚙️ Settings
          </button>
          <button
            className={`tab ${activeTab === 'age_blocks' ? 'active' : ''}`}
            onClick={() => setActiveTab('age_blocks')}
          >
            🚫 Blocked IPs
          </button>
          <button
            className={`tab ${activeTab === 'age_stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('age_stats')}
          >
            📊 Stats
          </button>
        </div>

        <div className="tab-group">
          <span className="tab-group-title">Account Creation Limits</span>
          <button
            className={`tab ${activeTab === 'ac_settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('ac_settings')}
          >
            ⚙️ Settings
          </button>
          <button
            className={`tab ${activeTab === 'ac_ips' ? 'active' : ''}`}
            onClick={() => setActiveTab('ac_ips')}
          >
            📋 Limited IPs
          </button>
          <button
            className={`tab ${activeTab === 'ac_stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('ac_stats')}
          >
            📊 Stats
          </button>
        </div>
      </div>

      {/* Age Verification Settings Tab */}
      {activeTab === 'age_settings' && (
        <div className="tab-content settings-tab">
          <div className="settings-card">
            <h3>Block Duration Configuration</h3>
            <p className="help-text">How long to block an IP when user attempts signup with age &lt; 18</p>
            
            <div className="setting-row">
              <label>Current Duration:</label>
              <span className="current-value">{formatDuration(settings.blockDurationHours)}</span>
            </div>

            <div className="setting-row">
              <label htmlFor="duration-input">New Duration (hours):</label>
              <input
                id="duration-input"
                type="number"
                min="1"
                max="168"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                placeholder="Enter hours (1-168)"
              />
              <small>(1 = 1 hour, 24 = 1 day, 37 = 1.5 days, 168 = 1 week)</small>
            </div>

            <button 
              className="btn btn-primary"
              onClick={handleUpdateDuration}
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Duration'}
            </button>
          </div>

          <div className="settings-card">
            <h3>IP Blocking Status</h3>
            <p className="help-text">Enable or disable automatic IP blocking for underage signup attempts</p>
            
            <div className="setting-row toggle-row">
              <label>Blocking Status:</label>
              <div className={`status-badge ${settings.blockingEnabled ? 'enabled' : 'disabled'}`}>
                {settings.blockingEnabled ? '✓ ENABLED' : '✗ DISABLED'}
              </div>
            </div>

            <button 
              className={`btn ${settings.blockingEnabled ? 'btn-danger' : 'btn-success'}`}
              onClick={handleToggleBlocking}
              disabled={loading}
            >
              {loading ? 'Updating...' : settings.blockingEnabled ? 'Disable Blocking' : 'Enable Blocking'}
            </button>
          </div>

          <div className="settings-card info-card">
            <h4>ℹ️ How It Works</h4>
            <ul>
              <li>When a user attempts to sign up with age &lt; 18, their IP is automatically blocked</li>
              <li>Block duration is configurable: 2 hours (default), 24 hours, 37 hours, etc.</li>
              <li>After the block expires, the IP can sign up again</li>
              <li>You can manually unblock IPs from the "Blocked IPs" tab if needed</li>
            </ul>
          </div>
        </div>
      )}

      {/* Blocked IPs Tab */}
      {activeTab === 'blocks' && (
        <div className="tab-content blocks-tab">
          <div className="block-form-card">
            <h3>🚫 Manually Block an IP</h3>
            <div className="form-group">
              <label htmlFor="ip-input">IP Address:</label>
              <input
                id="ip-input"
                type="text"
                value={manualBlockIP}
                onChange={(e) => setManualBlockIP(e.target.value)}
                placeholder="e.g., 192.168.1.100"
              />
            </div>
            <div className="form-group">
              <label htmlFor="reason-input">Reason (optional):</label>
              <input
                id="reason-input"
                type="text"
                value={manualBlockReason}
                onChange={(e) => setManualBlockReason(e.target.value)}
                placeholder="e.g., spam, abuse, etc."
              />
            </div>
            <button 
              className="btn btn-danger"
              onClick={handleBlockIP}
              disabled={loading}
            >
              {loading ? 'Blocking...' : 'Block IP'}
            </button>
          </div>

          {blockedIPs.length > 0 ? (
            <div className="blocks-list-card">
              <h3>📋 Currently Blocked IPs ({blockedIPs.length})</h3>
              <div className="blocks-table">
                <div className="table-header">
                  <div className="col-ip">IP Address</div>
                  <div className="col-reason">Reason</div>
                  <div className="col-remaining">Time Remaining</div>
                  <div className="col-action">Action</div>
                </div>
                {blockedIPs.map((block) => (
                  <div key={block.id} className="table-row">
                    <div className="col-ip">{block.ipAddress}</div>
                    <div className="col-reason">{block.reason || 'underage_attempt'}</div>
                    <div className="col-remaining">{formatExpiresAt(block.expiresAt)}</div>
                    <div className="col-action">
                      <button
                        className="btn btn-small btn-unblock"
                        onClick={() => handleUnblockIP(block.ipAddress)}
                        disabled={loading}
                      >
                        Unblock
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>✓ No blocked IPs at the moment</p>
            </div>
          )}
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === 'age_stats' && (
        <div className="tab-content stats-tab">
          {stats ? (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.totalBlocks || 0}</div>
                <div className="stat-label">Total Blocks</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.activeBlocks || 0}</div>
                <div className="stat-label">Currently Active</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.expiredBlocks || 0}</div>
                <div className="stat-label">Expired</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.uniqueIPs || 0}</div>
                <div className="stat-label">Unique IPs</div>
              </div>
            </div>
          ) : loading ? (
            <p>Loading statistics...</p>
          ) : (
            <p>Failed to load statistics</p>
          )}
        </div>
      )}

      {/* Account Creation Settings Tab */}
      {activeTab === 'ac_settings' && (
        <div className="tab-content settings-tab">
          <div className="settings-card">
            <h3>Account Creation Rate Limiting</h3>
            <p className="help-text">Prevent spam by limiting accounts created from same IP address</p>
            
            <div className="setting-row">
              <label>Current Threshold:</label>
              <span className="current-value">{accountCreationSettings.threshold || 2} accounts per IP</span>
            </div>

            <div className="setting-row">
              <label htmlFor="threshold-input">Max Accounts Per IP:</label>
              <input
                id="threshold-input"
                type="number"
                min="1"
                max="100"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
                placeholder="e.g., 2, 24, 37"
              />
              <small>(After this limit is reached, the IP is blocked from creating more accounts. Examples: 2, 24, 37)</small>
            </div>

            <button 
              className="btn btn-primary"
              onClick={handleUpdateThreshold}
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Threshold'}
            </button>
          </div>

          <div className="settings-card">
            <h3>Block Duration for Account Creation Spam</h3>
            <p className="help-text">How long to block an IP after exceeding account creation limit</p>
            
            <div className="setting-row">
              <label>Current Duration:</label>
              <span className="current-value">{formatDuration(accountCreationSettings.blockDurationHours || 24)}</span>
            </div>

            <div className="setting-row">
              <label htmlFor="ac-duration-input">Block Duration (hours):</label>
              <input
                id="ac-duration-input"
                type="number"
                min="1"
                max="168"
                value={newACDuration}
                onChange={(e) => setNewACDuration(e.target.value)}
                placeholder="e.g., 24, 37"
              />
              <small>(1 = 1 hour, 24 = 1 day, 37 = 1.5 days, 168 = 1 week)</small>
            </div>

            <button 
              className="btn btn-primary"
              onClick={handleUpdateACDuration}
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Block Duration'}
            </button>
          </div>
        </div>
      )}

      {/* Account Creation Limited IPs Tab */}
      {activeTab === 'ac_ips' && (
        <div className="tab-content ips-tab">
          {limitedIPs.length > 0 ? (
            <div className="ips-list-card">
              <h3>📋 IPs Exceeding Account Creation Limit ({limitedIPs.length})</h3>
              <div className="ips-table">
                <div className="table-header">
                  <div className="col-ip">IP Address</div>
                  <div className="col-count">Accounts</div>
                  <div className="col-status">Status</div>
                  <div className="col-action">Action</div>
                </div>
                {limitedIPs.map((item) => (
                  <div key={item.ipAddress} className="table-row">
                    <div className="col-ip">{item.ipAddress}</div>
                    <div className="col-count">{item.accountCount}/{accountCreationSettings.threshold || 2}</div>
                    <div className="col-status">{item.isBlocked ? '🚫 Blocked' : '⚠️ Limited'}</div>
                    <div className="col-action">
                      {item.isBlocked ? (
                        <button
                          className="btn btn-small btn-unblock"
                          onClick={() => handleUnblockAccountCreationIP(item.ipAddress)}
                          disabled={loading}
                        >
                          Unblock
                        </button>
                      ) : (
                        <button
                          className="btn btn-small btn-block"
                          onClick={() => {
                            setManualBlockIP(item.ipAddress);
                            setManualBlockReason('account_spam');
                          }}
                          disabled={loading}
                        >
                          Block
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>✓ No IPs exceeding account creation limit</p>
            </div>
          )}
        </div>
      )}

      {/* Account Creation Statistics Tab */}
      {activeTab === 'ac_stats' && (
        <div className="tab-content stats-tab">
          {acStats ? (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{acStats.totalIPsTracked || 0}</div>
                <div className="stat-label">IPs Tracked</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{acStats.ipsExceedingLimit || 0}</div>
                <div className="stat-label">Exceeding Limit</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{acStats.currentlyBlocked || 0}</div>
                <div className="stat-label">Currently Blocked</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{acStats.totalAccountsCreated || 0}</div>
                <div className="stat-label">Total Accounts</div>
              </div>
            </div>
          ) : loading ? (
            <p>Loading account creation statistics...</p>
          ) : (
            <p>Failed to load account creation statistics</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminIPBlockingPanel;
