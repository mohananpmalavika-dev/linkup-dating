/**
 * Admin Moderation Dashboard Component
 * Review and manage flagged content, user warnings, and bans
 * 
 * Routes:
 * /admin/moderation - Main dashboard
 * /admin/moderation/queue - Pending flags review queue
 * /admin/moderation/users - User management (warnings/bans)
 * /admin/moderation/stats - Moderation statistics
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminModeration.css';

const AdminModeration = () => {
  const [activeTab, setActiveTab] = useState('queue');
  const [flags, setFlags] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    if (activeTab === 'queue') {
      fetchFlags();
    } else if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab, filterStatus, sortBy]);

  // Fetch pending flags
  const fetchFlags = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await axios.get('/api/moderation/pending-flags', {
        params: { limit: 50, status: filterStatus }
      });
      
      let flagsList = response.data.flags || [];
      
      // Sort flags
      if (sortBy === 'recent') {
        flagsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else if (sortBy === 'oldest') {
        flagsList.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      }
      
      setFlags(flagsList);
    } catch (err) {
      setError('Failed to load flags');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch moderation stats
  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/moderation/stats');
      setStats(response.data);
    } catch (err) {
      setError('Failed to load statistics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Resolve flag (approve/reject)
  const handleResolveFlag = async (flagId, action, reason = '') => {
    try {
      setLoading(true);
      
      const response = await axios.post('/api/moderation/resolve-flag', {
        flagId,
        action,
        reason
      });
      
      // Remove flag from list
      setFlags(flags.filter(f => f.id !== flagId));
      setSelectedFlag(null);
      
      alert(`Content ${action} successfully`);
    } catch (err) {
      setError('Failed to resolve flag');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-moderation-container">
      <header className="moderation-header">
        <h1>Content Moderation Dashboard</h1>
        <p>Review and manage user reports and flagged content</p>
      </header>

      {error && (
        <div className="error-banner">
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="moderation-tabs">
        <button
          className={`tab ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          📋 Review Queue
        </button>
        <button
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Statistics
        </button>
        <button
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 User Management
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'queue' && (
        <FlagsQueueTab
          flags={flags}
          loading={loading}
          selectedFlag={selectedFlag}
          setSelectedFlag={setSelectedFlag}
          onResolve={handleResolveFlag}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />
      )}

      {activeTab === 'stats' && (
        <StatsTab stats={stats} loading={loading} />
      )}

      {activeTab === 'users' && (
        <UserManagementTab />
      )}
    </div>
  );
};

/**
 * Flags Review Queue Tab
 */
const FlagsQueueTab = ({
  flags,
  loading,
  selectedFlag,
  setSelectedFlag,
  onResolve,
  filterStatus,
  setFilterStatus,
  sortBy,
  setSortBy
}) => {
  const [resolution, setResolution] = useState({ action: '', reason: '' });

  const handleResolve = async () => {
    if (!resolution.action) {
      alert('Please select an action');
      return;
    }
    await onResolve(selectedFlag.id, resolution.action, resolution.reason);
    setResolution({ action: '', reason: '' });
  };

  return (
    <div className="queue-container">
      {/* Filters & Sort */}
      <div className="queue-controls">
        <div className="filter-group">
          <label>Status:</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="all">All</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Sort:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>

        <div className="flag-count">
          {flags.length} flag{flags.length !== 1 ? 's' : ''} to review
        </div>
      </div>

      <div className="queue-content">
        {/* Flags List */}
        <div className="flags-list">
          {loading ? (
            <div className="loading-state">
              <p>Loading flags...</p>
            </div>
          ) : flags.length === 0 ? (
            <div className="empty-state">
              <p>✅ No pending flags</p>
              <p>Great job keeping the platform safe!</p>
            </div>
          ) : (
            flags.map((flag) => (
              <div
                key={flag.id}
                className={`flag-item ${selectedFlag?.id === flag.id ? 'selected' : ''}`}
                onClick={() => setSelectedFlag(flag)}
              >
                <div className="flag-header">
                  <span className="flag-type">{flag.contentType}</span>
                  <span className="flag-time">
                    {new Date(flag.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="flag-reason">{flag.reason}</p>
                <span className="flag-id">ID: {flag.contentId}</span>
              </div>
            ))
          )}
        </div>

        {/* Details Panel */}
        <div className="details-panel">
          {selectedFlag ? (
            <>
              <h3>Flag Details</h3>
              
              <div className="detail-section">
                <label>Content Type</label>
                <p>{selectedFlag.contentType}</p>
              </div>

              <div className="detail-section">
                <label>Content ID</label>
                <p className="monospace">{selectedFlag.contentId}</p>
              </div>

              <div className="detail-section">
                <label>Reported By</label>
                <p>User #{selectedFlag.userId}</p>
              </div>

              <div className="detail-section">
                <label>Reason</label>
                <p>{selectedFlag.reason}</p>
              </div>

              <div className="detail-section">
                <label>Reported On</label>
                <p>{new Date(selectedFlag.createdAt).toLocaleString()}</p>
              </div>

              {/* Resolution Form */}
              <div className="resolution-form">
                <h4>Take Action</h4>

                <div className="form-group">
                  <label>Decision</label>
                  <div className="radio-group">
                    <label>
                      <input
                        type="radio"
                        value="approved"
                        checked={resolution.action === 'approved'}
                        onChange={(e) => setResolution({ ...resolution, action: e.target.value })}
                      />
                      ✅ Approve (Content is OK)
                    </label>
                    <label>
                      <input
                        type="radio"
                        value="rejected"
                        checked={resolution.action === 'rejected'}
                        onChange={(e) => setResolution({ ...resolution, action: e.target.value })}
                      />
                      ❌ Reject (Violates policy)
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>Resolution Note</label>
                  <textarea
                    value={resolution.reason}
                    onChange={(e) => setResolution({ ...resolution, reason: e.target.value })}
                    placeholder="e.g., User warned, content stays visible"
                  />
                </div>

                <div className="form-actions">
                  <button
                    className="btn-submit"
                    onClick={handleResolve}
                    disabled={!resolution.action || loading}
                  >
                    {loading ? 'Processing...' : 'Submit Decision'}
                  </button>
                  <button
                    className="btn-cancel"
                    onClick={() => setSelectedFlag(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-details">
              <p>Select a flag to review</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Statistics Tab
 */
const StatsTab = ({ stats, loading }) => {
  if (loading) {
    return <div className="stats-loading">Loading statistics...</div>;
  }

  return (
    <div className="stats-container">
      <div className="stats-grid">
        {/* Pending Flags Card */}
        <div className="stat-card urgent">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <p className="stat-label">Pending Review</p>
            <p className="stat-value">{stats?.pending || 0}</p>
            <p className="stat-description">Flags awaiting decision</p>
          </div>
        </div>

        {/* Resolved Flags Card */}
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <p className="stat-label">Resolved</p>
            <p className="stat-value">{stats?.resolved || 0}</p>
            <p className="stat-description">Total flags reviewed</p>
          </div>
        </div>
      </div>

      {/* Recent Actions */}
      {stats?.recentActions && stats.recentActions.length > 0 && (
        <div className="recent-actions">
          <h3>Moderation Actions (Last 30 Days)</h3>
          <div className="action-list">
            {stats.recentActions.map((action, idx) => (
              <div key={idx} className="action-item">
                <span className="action-type">{action.action}</span>
                <span className="action-count">{action.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * User Management Tab
 */
const UserManagementTab = () => {
  return (
    <div className="user-management-container">
      <div className="coming-soon">
        <p>🚀 User Management Features Coming Soon</p>
        <p>Issue warnings, bans, and view user history</p>
      </div>
    </div>
  );
};

export default AdminModeration;
