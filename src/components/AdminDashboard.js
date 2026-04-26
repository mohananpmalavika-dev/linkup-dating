import React, { useEffect, useState } from 'react';
import adminService from '../services/adminService';
import '../styles/AdminDashboard.css';

const TAB_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'reports', label: 'Reports' },
  { id: 'spam', label: 'Spam Flags' },
  { id: 'fraud', label: 'Fraud Flags' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'actions', label: 'Actions Log' }
];

const defaultDashboardData = {
  metrics: {
    daily_active_users: 0,
    monthly_active_users: 0,
    total_messages: 0,
    total_matches: 0,
    new_users: 0
  },
  pendingReports: 0,
  spamFlags: 0,
  fraudFlags: 0,
  activeUsers: 0,
  recentActions: []
};

const formatTimestamp = (value) => {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleString();
};

const formatActionName = (value = '') =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const normalizeError = (error) =>
  error?.response?.data?.error || error?.message || 'Unable to load admin data';

const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyActionId, setBusyActionId] = useState('');
  const [dashboard, setDashboard] = useState(defaultDashboardData);
  const [reports, setReports] = useState([]);
  const [spamFlags, setSpamFlags] = useState([]);
  const [fraudFlags, setFraudFlags] = useState([]);
  const [analytics, setAnalytics] = useState({ metrics: [], summary: {} });
  const [actionsLog, setActionsLog] = useState([]);

  const loadAdminData = async () => {
    setLoading(true);
    setError('');

    try {
      const [
        dashboardResponse,
        reportsResponse,
        spamFlagsResponse,
        fraudFlagsResponse,
        analyticsResponse,
        actionsResponse
      ] = await Promise.all([
        adminService.getDashboard(),
        adminService.getReports({ limit: 20 }),
        adminService.getSpamFlags({ limit: 20 }),
        adminService.getFraudFlags({ limit: 20 }),
        adminService.getPlatformAnalytics({ days: 30 }),
        adminService.getActionsLog({ limit: 25 })
      ]);

      setDashboard(dashboardResponse || defaultDashboardData);
      setReports(Array.isArray(reportsResponse?.reports) ? reportsResponse.reports : []);
      setSpamFlags(Array.isArray(spamFlagsResponse?.flags) ? spamFlagsResponse.flags : []);
      setFraudFlags(Array.isArray(fraudFlagsResponse?.flags) ? fraudFlagsResponse.flags : []);
      setAnalytics(analyticsResponse || { metrics: [], summary: {} });
      setActionsLog(Array.isArray(actionsResponse?.actions) ? actionsResponse.actions : []);
    } catch (loadError) {
      setError(normalizeError(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const runAdminAction = async (actionId, callback) => {
    setBusyActionId(actionId);
    setError('');

    try {
      await callback();
      await loadAdminData();
    } catch (actionError) {
      setError(normalizeError(actionError));
    } finally {
      setBusyActionId('');
    }
  };

  const resolveReport = (reportId, status, action) =>
    runAdminAction(`report-${reportId}-${action}`, () =>
      adminService.resolveReport(reportId, { status, action })
    );

  const resolveSpamFlag = (flagId, action) =>
    runAdminAction(`spam-${flagId}-${action}`, () =>
      adminService.resolveSpamFlag(flagId, { action })
    );

  const resolveFraudFlag = (flagId, action) =>
    runAdminAction(`fraud-${flagId}-${action}`, () =>
      adminService.resolveFraudFlag(flagId, { action })
    );

  const suspendUser = (userId, reason) =>
    runAdminAction(`suspend-${userId}`, () =>
      adminService.suspendUser(userId, { reason, duration_days: 7 })
    );

  const deleteUser = (userId, reason) => {
    if (!window.confirm('Delete this user account permanently?')) {
      return;
    }

    runAdminAction(`delete-${userId}`, () =>
      adminService.deleteUser(userId, { reason })
    );
  };

  const renderOverview = () => (
    <div className="overview-section">
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Daily Active Users</div>
          <div className="metric-value">{dashboard.metrics?.daily_active_users || 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Monthly Active Users</div>
          <div className="metric-value">{dashboard.metrics?.monthly_active_users || 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Messages Today</div>
          <div className="metric-value">{dashboard.metrics?.total_messages || 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Matches Today</div>
          <div className="metric-value">{dashboard.metrics?.total_matches || 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">New Users</div>
          <div className="metric-value">{dashboard.metrics?.new_users || 0}</div>
        </div>
        <div className="metric-card alert">
          <div className="metric-label">Pending Reports</div>
          <div className="metric-value">{dashboard.pendingReports || 0}</div>
        </div>
        <div className="metric-card alert">
          <div className="metric-label">Open Spam Flags</div>
          <div className="metric-value">{dashboard.spamFlags || 0}</div>
        </div>
        <div className="metric-card alert">
          <div className="metric-label">Open Fraud Flags</div>
          <div className="metric-value">{dashboard.fraudFlags || 0}</div>
        </div>
      </div>

      <div className="recent-actions">
        <h2>Recent Admin Actions</h2>
        <div className="actions-list">
          {(dashboard.recentActions || []).length === 0 ? (
            <div className="action-item">
              <span className="action-type">No activity</span>
              <div className="action-details">
                <span>No moderation actions have been logged yet.</span>
              </div>
            </div>
          ) : (
            dashboard.recentActions.map((action) => (
              <div className="action-item" key={action.id}>
                <span className="action-type">{formatActionName(action.action_type)}</span>
                <div className="action-details">
                  <span>{action.reason || 'Admin action recorded'}</span>
                  <span>{action.email || 'Admin user'}</span>
                  <span className="timestamp">{formatTimestamp(action.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="reports-section">
      <h2>Pending Reports</h2>
      <div className="reports-list">
        {reports.length === 0 ? (
          <div className="report-item">
            <div className="report-details">
              <p>No pending reports right now.</p>
            </div>
          </div>
        ) : (
          reports.map((report) => (
            <div className="report-item" key={report.id}>
              <div className="report-header">
                <span className="report-id">Report #{report.id}</span>
                <span className={`status ${report.status}`}>{formatActionName(report.status)}</span>
              </div>
              <div className="report-details">
                <p><strong>Reason:</strong> {report.reason}</p>
                <p><strong>Reporter:</strong> {report.reporting_user_email || 'Unknown'}</p>
                <p><strong>Reported user:</strong> {report.reported_user_email || 'Unknown'}</p>
                <p><strong>Details:</strong> {report.description || 'No extra details provided.'}</p>
                <p><strong>Submitted:</strong> {formatTimestamp(report.created_at)}</p>
              </div>
              <div className="report-actions">
                <button
                  type="button"
                  className="btn-approve"
                  disabled={busyActionId === `report-${report.id}-approve`}
                  onClick={() => resolveReport(report.id, 'resolved', 'approve')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn-dismiss"
                  disabled={busyActionId === `report-${report.id}-dismiss`}
                  onClick={() => resolveReport(report.id, 'dismissed', 'dismiss')}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderSpamFlags = () => (
    <div className="spam-section">
      <h2>Spam Flags</h2>
      <div className="flags-list">
        {spamFlags.length === 0 ? (
          <div className="flag-item">
            <div className="flag-details">
              <p>No active spam flags.</p>
            </div>
          </div>
        ) : (
          spamFlags.map((flag) => (
            <div className="flag-item" key={flag.id}>
              <div className="flag-header">
                <span className="flag-user">{flag.email || `User ${flag.user_id}`}</span>
                <span className={`severity ${flag.severity || 'low'}`}>{formatActionName(flag.severity)}</span>
              </div>
              <div className="flag-details">
                <p><strong>Reason:</strong> {flag.reason}</p>
                <p><strong>Description:</strong> {flag.description || 'No description available.'}</p>
                <p><strong>Created:</strong> {formatTimestamp(flag.created_at)}</p>
              </div>
              <div className="flag-actions">
                <button
                  type="button"
                  className="btn-warn"
                  disabled={busyActionId === `spam-${flag.id}-warn`}
                  onClick={() => resolveSpamFlag(flag.id, 'warn')}
                >
                  Warn
                </button>
                <button
                  type="button"
                  className="btn-suspend"
                  disabled={busyActionId === `suspend-${flag.user_id}`}
                  onClick={() => suspendUser(flag.user_id, 'Suspicious spam activity')}
                >
                  Suspend
                </button>
                <button
                  type="button"
                  className="btn-dismiss"
                  disabled={busyActionId === `spam-${flag.id}-dismiss`}
                  onClick={() => resolveSpamFlag(flag.id, 'dismiss')}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderFraudFlags = () => (
    <div className="fraud-section">
      <h2>Fraud Flags</h2>
      <div className="flags-list">
        {fraudFlags.length === 0 ? (
          <div className="flag-item">
            <div className="flag-details">
              <p>No active fraud flags.</p>
            </div>
          </div>
        ) : (
          fraudFlags.map((flag) => (
            <div className="flag-item" key={flag.id}>
              <div className="flag-header">
                <span className="flag-user">{flag.email || `User ${flag.user_id}`}</span>
                <span className="confidence">{Math.round(Number(flag.confidence_score || 0) * 100)}%</span>
              </div>
              <div className="flag-details">
                <p><strong>Type:</strong> {formatActionName(flag.flag_type)}</p>
                <p><strong>Description:</strong> {flag.description || 'No description available.'}</p>
                <p><strong>Created:</strong> {formatTimestamp(flag.created_at)}</p>
              </div>
              <div className="flag-actions">
                <button
                  type="button"
                  className="btn-investigate"
                  disabled={busyActionId === `fraud-${flag.id}-investigate`}
                  onClick={() => resolveFraudFlag(flag.id, 'investigate')}
                >
                  Investigate
                </button>
                <button
                  type="button"
                  className="btn-suspend"
                  disabled={busyActionId === `suspend-${flag.user_id}`}
                  onClick={() => suspendUser(flag.user_id, 'Fraud detection threshold exceeded')}
                >
                  Suspend
                </button>
                <button
                  type="button"
                  className="btn-delete"
                  disabled={busyActionId === `delete-${flag.user_id}`}
                  onClick={() => deleteUser(flag.user_id, 'Fraud enforcement')}
                >
                  Delete User
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="analytics-section">
      <h2>Platform Analytics</h2>
      <div className="analytics-summary">
        <div className="summary-card">
          <h3>Current DAU</h3>
          <div className="chart-placeholder">{analytics.summary?.dau || 0}</div>
        </div>
        <div className="summary-card">
          <h3>30 Day Messages</h3>
          <div className="chart-placeholder">{analytics.summary?.totalMessages || 0}</div>
        </div>
        <div className="summary-card">
          <h3>30 Day Matches</h3>
          <div className="chart-placeholder">{analytics.summary?.totalMatches || 0}</div>
        </div>
        <div className="summary-card">
          <h3>30 Day New Users</h3>
          <div className="chart-placeholder">{analytics.summary?.newUsers || 0}</div>
        </div>
      </div>

      <div className="analytics-table">
        <h3>Daily Metrics</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>DAU</th>
              <th>MAU</th>
              <th>Messages</th>
              <th>Matches</th>
              <th>New Users</th>
            </tr>
          </thead>
          <tbody>
            {(analytics.metrics || []).length === 0 ? (
              <tr>
                <td colSpan="6">No analytics data recorded yet.</td>
              </tr>
            ) : (
              analytics.metrics.map((metric) => (
                <tr key={metric.metric_date}>
                  <td>{formatTimestamp(metric.metric_date)}</td>
                  <td>{metric.daily_active_users || 0}</td>
                  <td>{metric.monthly_active_users || 0}</td>
                  <td>{metric.total_messages || 0}</td>
                  <td>{metric.total_matches || 0}</td>
                  <td>{metric.new_users || 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderActionsLog = () => (
    <div className="actions-section">
      <h2>Actions Log</h2>
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Admin</th>
            <th>Reason</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {actionsLog.length === 0 ? (
            <tr>
              <td colSpan="4">No admin actions logged yet.</td>
            </tr>
          ) : (
            actionsLog.map((action) => (
              <tr key={action.id}>
                <td>{formatActionName(action.action_type)}</td>
                <td>{action.admin_email || 'Admin user'}</td>
                <td>{action.reason || 'No reason provided'}</td>
                <td>{formatTimestamp(action.created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'reports':
        return renderReports();
      case 'spam':
        return renderSpamFlags();
      case 'fraud':
        return renderFraudFlags();
      case 'analytics':
        return renderAnalytics();
      case 'actions':
        return renderActionsLog();
      case 'overview':
      default:
        return renderOverview();
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Moderation, analytics, spam filtering, and fraud review.</p>
        </div>
        <button type="button" className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </header>

      {error ? <div className="admin-error">{error}</div> : null}

      <div className="admin-tabs">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <main className="admin-content">
        {loading ? <div className="loading">Loading admin controls...</div> : renderActiveTab()}
      </main>
    </div>
  );
};

export default AdminDashboard;
