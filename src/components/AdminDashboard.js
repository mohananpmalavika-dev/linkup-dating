import React, { useEffect, useState } from 'react';
import adminService from '../services/adminService';
import '../styles/AdminDashboard.css';

const TAB_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'queue', label: 'Moderation Queue' },
  { id: 'reviews', label: 'User Reviews' },
  { id: 'photos', label: 'Photo Review' },
  { id: 'bans', label: 'Bans' },
  { id: 'appeals', label: 'Appeals' },
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
  moderation: {
    pendingPhotoReviews: 0,
    pendingAppeals: 0,
    activeBans: 0,
    openManualFlags: 0,
    pendingQueue: 0,
    reviewCandidates: 0
  },
  queuePreview: [],
  recentActions: [],
  flaggedUsers: []
};

const defaultAnalytics = {
  metrics: [],
  summary: {},
  breakdowns: {
    reportReasons: [],
    spamReasons: [],
    fraudTypes: [],
    manualFlagCategories: []
  }
};

const defaultManualFlagForm = {
  flagCategory: 'behavior',
  severity: 'medium',
  title: '',
  reason: ''
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

const formatDate = (value) => {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString();
};

const formatActionName = (value = '') =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const normalizeError = (error) =>
  error?.response?.data?.error || error?.message || 'Unable to load admin data';

const parsePositiveInteger = (value, fallbackValue) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
};

const EmptyState = ({ title, description }) => (
  <div className="empty-state">
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
);

const AdminDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyActionId, setBusyActionId] = useState('');
  const [dashboard, setDashboard] = useState(defaultDashboardData);
  const [queue, setQueue] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedReviewId, setSelectedReviewId] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);
  const [photoReviews, setPhotoReviews] = useState([]);
  const [bans, setBans] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [analytics, setAnalytics] = useState(defaultAnalytics);
  const [actionsLog, setActionsLog] = useState([]);
  const [reviewSearch, setReviewSearch] = useState('');
  const [manualFlagForm, setManualFlagForm] = useState(defaultManualFlagForm);

  const loadReviewDetail = async (userId) => {
    if (!userId) {
      setSelectedReview(null);
      return;
    }

    setDetailLoading(true);

    try {
      const reviewDetail = await adminService.getUserReview(userId);
      setSelectedReview(reviewDetail);
    } catch (detailError) {
      setError(normalizeError(detailError));
      setSelectedReview(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadAdminData = async () => {
    setLoading(true);
    setError('');

    try {
      const [
        dashboardResponse,
        queueResponse,
        reviewsResponse,
        photoResponse,
        bansResponse,
        appealsResponse,
        analyticsResponse,
        actionsResponse
      ] = await Promise.all([
        adminService.getDashboard(),
        adminService.getModerationQueue({ limit: 20 }),
        adminService.getReviewCandidates({ limit: 30 }),
        adminService.getPhotoModeration({ status: 'pending', limit: 20 }),
        adminService.getBans({ status: 'active', limit: 20 }),
        adminService.getAppeals({ status: 'pending', limit: 20 }),
        adminService.getModerationAnalytics({ days: 30 }),
        adminService.getActionsLog({ limit: 25 })
      ]);

      const nextReviews = Array.isArray(reviewsResponse?.reviews) ? reviewsResponse.reviews : [];
      const nextSelectedReviewId =
        selectedReviewId && nextReviews.some((review) => review.userId === selectedReviewId)
          ? selectedReviewId
          : nextReviews[0]?.userId || null;

      setDashboard(dashboardResponse || defaultDashboardData);
      setQueue(Array.isArray(queueResponse?.queue) ? queueResponse.queue : []);
      setReviews(nextReviews);
      setPhotoReviews(Array.isArray(photoResponse?.items) ? photoResponse.items : []);
      setBans(Array.isArray(bansResponse?.bans) ? bansResponse.bans : []);
      setAppeals(Array.isArray(appealsResponse?.appeals) ? appealsResponse.appeals : []);
      setAnalytics(analyticsResponse || defaultAnalytics);
      setActionsLog(Array.isArray(actionsResponse?.actions) ? actionsResponse.actions : []);

      if (nextSelectedReviewId !== selectedReviewId) {
        setSelectedReviewId(nextSelectedReviewId);
      } else if (nextSelectedReviewId) {
        await loadReviewDetail(nextSelectedReviewId);
      } else {
        setSelectedReview(null);
      }
    } catch (loadError) {
      setError(normalizeError(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedReviewId) {
      loadReviewDetail(selectedReviewId);
    } else {
      setSelectedReview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReviewId]);

  const refreshSelectedReview = async () => {
    if (selectedReviewId) {
      await loadReviewDetail(selectedReviewId);
    }
  };

  const runAdminAction = async (actionId, callback, options = {}) => {
    setBusyActionId(actionId);
    setError('');

    try {
      await callback();

      if (options.reloadAll === false) {
        if (options.reloadSelectedReview !== false) {
          await refreshSelectedReview();
        }
      } else {
        await loadAdminData();
      }
    } catch (actionError) {
      setError(normalizeError(actionError));
    } finally {
      setBusyActionId('');
    }
  };

  const handleSuspendUser = (userId, defaultReason = 'Moderation review required') => {
    const reason = window.prompt('Reason for suspension:', defaultReason);

    if (!reason) {
      return;
    }

    const durationInput = window.prompt('Suspend for how many days?', '7');
    const durationDays = parsePositiveInteger(durationInput, 7);

    runAdminAction(`suspend-${userId}`, () =>
      adminService.suspendUser(userId, { reason, duration_days: durationDays })
    );
  };

  const handleBanUser = (userId, defaultReason = 'Severe moderation violation') => {
    const reason = window.prompt('Reason for permanent ban:', defaultReason);

    if (!reason) {
      return;
    }

    runAdminAction(`ban-${userId}`, () =>
      adminService.banUser(userId, {
        reason,
        notes: 'Issued from admin moderation console',
        banType: 'permanent'
      })
    );
  };

  const handleDeleteUser = (userId, defaultReason = 'Fraud or severe safety violation') => {
    const reason = window.prompt('Reason for deleting this account:', defaultReason);

    if (!reason) {
      return;
    }

    if (!window.confirm('Delete this user account permanently?')) {
      return;
    }

    runAdminAction(`delete-${userId}`, () =>
      adminService.deleteUser(userId, { reason })
    );
  };

  const handleQueueAction = (item, action) => {
    if (!item) {
      return;
    }

    if (action === 'suspend') {
      handleSuspendUser(item.userId, `Queue escalation: ${item.title}`);
      return;
    }

    if (action === 'ban') {
      handleBanUser(item.userId, `Queue escalation: ${item.title}`);
      return;
    }

    const notes = window.prompt('Optional moderator notes:', '') || '';

    if (item.type === 'report') {
      runAdminAction(`queue-report-${item.sourceId}-${action}`, () =>
        adminService.resolveReport(item.sourceId, {
          status: action === 'dismiss' ? 'dismissed' : 'resolved',
          action,
          notes
        })
      );
      return;
    }

    if (item.type === 'spam') {
      runAdminAction(`queue-spam-${item.sourceId}-${action}`, () =>
        adminService.resolveSpamFlag(item.sourceId, { action, notes })
      );
      return;
    }

    if (item.type === 'fraud') {
      runAdminAction(`queue-fraud-${item.sourceId}-${action}`, () =>
        adminService.resolveFraudFlag(item.sourceId, { action, notes })
      );
      return;
    }

    if (item.type === 'manual_flag') {
      runAdminAction(`queue-manual-${item.sourceId}-${action}`, () =>
        adminService.reviewModerationFlag(item.sourceId, {
          status: action === 'dismiss' ? 'dismissed' : 'resolved',
          notes
        })
      );
      return;
    }

    if (item.type === 'photo') {
      runAdminAction(`queue-photo-${item.sourceId}-${action}`, () =>
        adminService.reviewPhotoModeration(item.sourceId, { action, notes })
      );
      return;
    }

    if (item.type === 'appeal') {
      runAdminAction(`queue-appeal-${item.sourceId}-${action}`, () =>
        adminService.reviewAppeal(item.sourceId, { action, reviewNotes: notes })
      );
    }
  };

  const handlePhotoAction = (item, action) => {
    const notes = window.prompt('Optional photo review notes:', '') || '';

    runAdminAction(`photo-${item.id}-${action}`, () =>
      adminService.reviewPhotoModeration(item.id, { action, notes })
    );
  };

  const handleAppealAction = (appeal, action) => {
    const reviewNotes = window.prompt('Optional appeal review notes:', '') || '';

    runAdminAction(`appeal-${appeal.id}-${action}`, () =>
      adminService.reviewAppeal(appeal.id, { action, reviewNotes })
    );
  };

  const handleRevokeBan = (ban) => {
    const reason = window.prompt('Reason for revoking this restriction:', 'Appeal approved');

    if (!reason) {
      return;
    }

    runAdminAction(`ban-revoke-${ban.id}`, () =>
      adminService.revokeBan(ban.id, { reason })
    );
  };

  const handleManualFlagSubmit = (event) => {
    event.preventDefault();

    if (!selectedReviewId || !manualFlagForm.reason.trim()) {
      return;
    }

    runAdminAction(`manual-flag-${selectedReviewId}`, () =>
      adminService.createUserFlag(selectedReviewId, {
        flagCategory: manualFlagForm.flagCategory,
        severity: manualFlagForm.severity,
        title: manualFlagForm.title,
        reason: manualFlagForm.reason
      }),
    ).then(() => {
      setManualFlagForm(defaultManualFlagForm);
    });
  };

  const filteredReviews = reviews.filter((review) => {
    const normalizedQuery = reviewSearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return true;
    }

    return (
      String(review.email || '').toLowerCase().includes(normalizedQuery) ||
      String(review.firstName || '').toLowerCase().includes(normalizedQuery)
    );
  });

  const isQueueActionBusy = (item, action) => {
    const possibleIds = [`queue-${item.type}-${item.sourceId}-${action}`];

    if (action === 'suspend') {
      possibleIds.push(`suspend-${item.userId}`);
    }

    if (action === 'ban') {
      possibleIds.push(`ban-${item.userId}`);
    }

    return possibleIds.includes(busyActionId);
  };

  const renderQueueActions = (item) => {
    const buttonConfigByType = {
      report: [
        { id: 'approve', label: 'Resolve', className: 'btn-approve' },
        { id: 'dismiss', label: 'Dismiss', className: 'btn-dismiss' }
      ],
      spam: [
        { id: 'warn', label: 'Warn', className: 'btn-warn' },
        { id: 'suspend', label: 'Suspend', className: 'btn-suspend' },
        { id: 'dismiss', label: 'Resolve', className: 'btn-dismiss' }
      ],
      fraud: [
        { id: 'investigate', label: 'Investigate', className: 'btn-investigate' },
        { id: 'suspend', label: 'Suspend', className: 'btn-suspend' },
        { id: 'ban', label: 'Ban', className: 'btn-delete' }
      ],
      manual_flag: [
        { id: 'approve', label: 'Resolve', className: 'btn-approve' },
        { id: 'suspend', label: 'Suspend', className: 'btn-suspend' },
        { id: 'dismiss', label: 'Dismiss', className: 'btn-dismiss' }
      ],
      photo: [
        { id: 'approve', label: 'Approve', className: 'btn-approve' },
        { id: 'reject', label: 'Reject', className: 'btn-delete' },
        { id: 'escalate', label: 'Escalate', className: 'btn-investigate' }
      ],
      appeal: [
        { id: 'approve', label: 'Approve', className: 'btn-approve' },
        { id: 'deny', label: 'Deny', className: 'btn-dismiss' }
      ]
    };

    const buttons = buttonConfigByType[item.type] || [];

    return (
      <div className="queue-actions">
        {buttons.map((button) => (
          <button
            key={button.id}
            type="button"
            className={button.className}
            disabled={isQueueActionBusy(item, button.id)}
            onClick={() => handleQueueAction(item, button.id)}
          >
            {button.label}
          </button>
        ))}
      </div>
    );
  };

  const renderOverview = () => (
    <div className="admin-stack">
      <section className="metrics-grid">
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
        <div className="metric-card">
          <div className="metric-label">Active Users Now</div>
          <div className="metric-value">{dashboard.activeUsers || 0}</div>
        </div>
        <div className="metric-card alert">
          <div className="metric-label">Open Queue</div>
          <div className="metric-value">{dashboard.moderation?.pendingQueue || 0}</div>
        </div>
        <div className="metric-card alert">
          <div className="metric-label">Pending Reports</div>
          <div className="metric-value">{dashboard.pendingReports || 0}</div>
        </div>
        <div className="metric-card alert">
          <div className="metric-label">Spam Flags</div>
          <div className="metric-value">{dashboard.spamFlags || 0}</div>
        </div>
        <div className="metric-card alert">
          <div className="metric-label">Fraud Flags</div>
          <div className="metric-value">{dashboard.fraudFlags || 0}</div>
        </div>
        <div className="metric-card alert">
          <div className="metric-label">Photo Reviews</div>
          <div className="metric-value">{dashboard.moderation?.pendingPhotoReviews || 0}</div>
        </div>
        <div className="metric-card alert">
          <div className="metric-label">Pending Appeals</div>
          <div className="metric-value">{dashboard.moderation?.pendingAppeals || 0}</div>
        </div>
        <div className="metric-card alert">
          <div className="metric-label">Active Bans</div>
          <div className="metric-value">{dashboard.moderation?.activeBans || 0}</div>
        </div>
        <div className="metric-card alert">
          <div className="metric-label">Manual Flags</div>
          <div className="metric-value">{dashboard.moderation?.openManualFlags || 0}</div>
        </div>
      </section>

      <section className="content-grid">
        <div className="panel-card">
          <div className="panel-header">
            <h2>Queue Preview</h2>
            <button type="button" className="text-link" onClick={() => setActiveTab('queue')}>
              Open full queue
            </button>
          </div>
          {dashboard.queuePreview?.length ? (
            <div className="queue-list compact">
              {dashboard.queuePreview.map((item) => (
                <div className="queue-item" key={item.id}>
                  <div className="queue-item-main">
                    <div className="queue-item-title-row">
                      <span className={`queue-badge ${item.type}`}>{formatActionName(item.type)}</span>
                      <span className={`severity ${item.severity || 'medium'}`}>{formatActionName(item.severity)}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    <div className="queue-meta">
                      <span>{item.userName || item.userEmail || `User ${item.userId}`}</span>
                      <span>{formatTimestamp(item.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Queue is clear" description="No moderation items are waiting right now." />
          )}
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <h2>Flagged Users</h2>
            <button type="button" className="text-link" onClick={() => setActiveTab('reviews')}>
              Open review board
            </button>
          </div>
          {dashboard.flaggedUsers?.length ? (
            <div className="compact-list">
              {dashboard.flaggedUsers.map((review) => (
                <button
                  type="button"
                  className="compact-list-item"
                  key={review.userId}
                  onClick={() => {
                    setSelectedReviewId(review.userId);
                    setActiveTab('reviews');
                  }}
                >
                  <div>
                    <strong>{review.firstName || review.email}</strong>
                    <p>{review.email}</p>
                  </div>
                  <span className="count-pill">{review.totalFlags}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No flagged users" description="User review workload is currently low." />
          )}
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <h2>Recent Admin Actions</h2>
          <button type="button" className="text-link" onClick={() => setActiveTab('actions')}>
            Open action log
          </button>
        </div>
        {dashboard.recentActions?.length ? (
          <div className="activity-list">
            {dashboard.recentActions.map((action) => (
              <div className="activity-item" key={action.id}>
                <span className="activity-type">{formatActionName(action.action_type)}</span>
                <div className="activity-copy">
                  <p>{action.reason || 'Admin action recorded'}</p>
                  <span>{action.email || 'Admin user'}</span>
                  <span>{formatTimestamp(action.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No recent admin activity" description="Moderation actions will appear here." />
        )}
      </section>
    </div>
  );

  const renderQueue = () => (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <h2>Content Moderation Queue</h2>
          <p>Reports, automated spam and fraud signals, photo review, manual flags, and appeals.</p>
        </div>
      </div>

      {queue.length ? (
        <div className="queue-list">
          {queue.map((item) => (
            <div className="queue-item" key={item.id}>
              <div className="queue-item-main">
                <div className="queue-item-title-row">
                  <span className={`queue-badge ${item.type}`}>{formatActionName(item.type)}</span>
                  <span className={`severity ${item.severity || 'medium'}`}>{formatActionName(item.severity)}</span>
                  <span className={`status-tag ${item.status || 'pending'}`}>{formatActionName(item.status)}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <div className="queue-meta">
                  <span>{item.userName || item.userEmail || `User ${item.userId}`}</span>
                  {item.sourceActorEmail ? <span>Reported by {item.sourceActorEmail}</span> : null}
                  <span>{formatTimestamp(item.createdAt)}</span>
                </div>
              </div>
              {renderQueueActions(item)}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No queue items" description="The moderation queue is empty." />
      )}
    </section>
  );

  const renderReviewDetailList = (title, items, formatter) => (
    <div className="detail-section">
      <h3>{title}</h3>
      {items?.length ? (
        <div className="detail-list">
          {items.map((item) => (
            <div className="detail-list-item" key={`${title}-${item.id}`}>
              {formatter(item)}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted-copy">No items in this section.</p>
      )}
    </div>
  );

  const renderReviews = () => (
    <div className="review-layout">
      <section className="panel-card review-list-panel">
        <div className="panel-header">
          <div>
            <h2>User Review System</h2>
            <p>Prioritize accounts with combined reports, automated detections, bans, and appeals.</p>
          </div>
        </div>

        <div className="search-row">
          <input
            type="text"
            value={reviewSearch}
            onChange={(event) => setReviewSearch(event.target.value)}
            placeholder="Search by email or name"
            className="admin-input"
          />
        </div>

        {filteredReviews.length ? (
          <div className="review-list">
            {filteredReviews.map((review) => (
              <button
                type="button"
                key={review.userId}
                className={`review-list-item ${selectedReviewId === review.userId ? 'active' : ''}`}
                onClick={() => setSelectedReviewId(review.userId)}
              >
                <div className="review-list-copy">
                  <strong>{review.firstName || review.email}</strong>
                  <p>{review.email}</p>
                  <span>{formatTimestamp(review.lastFlaggedAt)}</span>
                </div>
                <div className="review-counts">
                  <span className="count-pill">{review.totalFlags}</span>
                  {review.activeBanCount ? <span className="status-chip danger">Banned</span> : null}
                  {review.pendingAppealCount ? <span className="status-chip warning">Appeal</span> : null}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="No review candidates" description="No users currently need moderator review." />
        )}
      </section>

      <section className="panel-card review-detail-panel">
        <div className="panel-header">
          <div>
            <h2>Review Detail</h2>
            <p>Use manual flags, suspensions, and bans to manage the account lifecycle.</p>
          </div>
        </div>

        {detailLoading ? (
          <div className="loading">Loading user review details...</div>
        ) : !selectedReview ? (
          <EmptyState title="Select a user" description="Choose a flagged user to inspect their moderation history." />
        ) : (
          <div className="review-detail-content">
            <div className="review-hero">
              <div>
                <h3>{selectedReview.user?.first_name || selectedReview.user?.email}</h3>
                <p>{selectedReview.user?.email}</p>
              </div>
              <div className="review-hero-tags">
                <span className={`status-chip ${selectedReview.user?.is_active === false ? 'danger' : 'ok'}`}>
                  {selectedReview.user?.is_active === false ? 'Restricted' : 'Active'}
                </span>
                <span className={`status-chip ${selectedReview.user?.profile_verified ? 'ok' : 'warning'}`}>
                  {selectedReview.user?.profile_verified ? 'Verified' : formatActionName(selectedReview.user?.verification_status || 'unverified')}
                </span>
              </div>
            </div>

            <div className="detail-stat-grid">
              <div className="summary-card">
                <h3>Reports</h3>
                <div className="chart-placeholder">{selectedReview.reports?.length || 0}</div>
              </div>
              <div className="summary-card">
                <h3>Spam Flags</h3>
                <div className="chart-placeholder">{selectedReview.spamFlags?.length || 0}</div>
              </div>
              <div className="summary-card">
                <h3>Fraud Flags</h3>
                <div className="chart-placeholder">{selectedReview.fraudFlags?.length || 0}</div>
              </div>
              <div className="summary-card">
                <h3>Manual Flags</h3>
                <div className="chart-placeholder">{selectedReview.manualFlags?.length || 0}</div>
              </div>
            </div>

            <div className="quick-action-row">
              <button type="button" className="btn-suspend" onClick={() => handleSuspendUser(selectedReview.user.id)}>
                Suspend 7 Days
              </button>
              <button type="button" className="btn-delete" onClick={() => handleBanUser(selectedReview.user.id)}>
                Permanent Ban
              </button>
              <button type="button" className="btn-dismiss" onClick={() => handleDeleteUser(selectedReview.user.id)}>
                Delete Account
              </button>
            </div>

            <form className="flag-form" onSubmit={handleManualFlagSubmit}>
              <h3>Flag This User</h3>
              <div className="form-grid">
                <label>
                  Category
                  <select
                    className="admin-input"
                    value={manualFlagForm.flagCategory}
                    onChange={(event) =>
                      setManualFlagForm((currentForm) => ({
                        ...currentForm,
                        flagCategory: event.target.value
                      }))
                    }
                  >
                    <option value="behavior">Behavior</option>
                    <option value="content">Content</option>
                    <option value="fraud">Fraud</option>
                    <option value="spam">Spam</option>
                    <option value="safety">Safety</option>
                  </select>
                </label>
                <label>
                  Severity
                  <select
                    className="admin-input"
                    value={manualFlagForm.severity}
                    onChange={(event) =>
                      setManualFlagForm((currentForm) => ({
                        ...currentForm,
                        severity: event.target.value
                      }))
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
              </div>
              <label>
                Title
                <input
                  type="text"
                  className="admin-input"
                  value={manualFlagForm.title}
                  onChange={(event) =>
                    setManualFlagForm((currentForm) => ({
                      ...currentForm,
                      title: event.target.value
                    }))
                  }
                  placeholder="Optional short title"
                />
              </label>
              <label>
                Reason
                <textarea
                  className="admin-input admin-textarea"
                  value={manualFlagForm.reason}
                  onChange={(event) =>
                    setManualFlagForm((currentForm) => ({
                      ...currentForm,
                      reason: event.target.value
                    }))
                  }
                  placeholder="Describe why this user needs attention"
                />
              </label>
              <button type="submit" className="btn-investigate" disabled={busyActionId === `manual-flag-${selectedReview.user.id}`}>
                Add Manual Flag
              </button>
            </form>

            {renderReviewDetailList('Reports', selectedReview.reports, (item) => (
              <>
                <strong>{formatActionName(item.reason)}</strong>
                <p>{item.description || 'No extra details provided.'}</p>
                <span>{formatTimestamp(item.created_at)}</span>
              </>
            ))}

            {renderReviewDetailList('Spam Flags', selectedReview.spamFlags, (item) => (
              <>
                <strong>{formatActionName(item.reason)}</strong>
                <p>{item.description || 'No description provided.'}</p>
                <span>{formatTimestamp(item.created_at)}</span>
              </>
            ))}

            {renderReviewDetailList('Fraud Flags', selectedReview.fraudFlags, (item) => (
              <>
                <strong>{formatActionName(item.flag_type)}</strong>
                <p>{item.description || 'No description provided.'}</p>
                <span>{Math.round(Number(item.confidence_score || 0) * 100)}% confidence</span>
              </>
            ))}

            {renderReviewDetailList('Manual Flags', selectedReview.manualFlags, (item) => (
              <>
                <strong>{item.title || formatActionName(item.flag_category)}</strong>
                <p>{item.reason}</p>
                <span>{formatActionName(item.severity)} severity</span>
              </>
            ))}

            {renderReviewDetailList('Bans', selectedReview.bans, (item) => (
              <>
                <strong>{formatActionName(item.banType)}</strong>
                <p>{item.reason}</p>
                <span>{item.status === 'active' ? 'Active' : formatActionName(item.status)}</span>
              </>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const renderPhotoModeration = () => (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <h2>Photo Moderation Workflow</h2>
          <p>Approve or reject verification selfies and higher-risk profile photos.</p>
        </div>
      </div>

      {photoReviews.length ? (
        <div className="photo-grid">
          {photoReviews.map((item) => (
            <div className="photo-card" key={item.id}>
              <div className="photo-frame">
                <img src={item.photo_url} alt="Moderation review" />
              </div>
              <div className="photo-copy">
                <div className="queue-item-title-row">
                  <span className={`queue-badge ${item.source_type}`}>{formatActionName(item.source_type)}</span>
                  <span className={`severity ${Number(item.automated_risk_score || 0) >= 70 ? 'critical' : Number(item.automated_risk_score || 0) >= 45 ? 'high' : 'medium'}`}>
                    Risk {item.automated_risk_score || 0}
                  </span>
                </div>
                <h3>{item.first_name || item.email || `User ${item.user_id}`}</h3>
                <p>{Array.isArray(item.automated_reasons) && item.automated_reasons.length ? item.automated_reasons.join(', ') : 'No automated reasons recorded.'}</p>
                <span>{formatTimestamp(item.submitted_at)}</span>
              </div>
              <div className="photo-actions">
                <button
                  type="button"
                  className="btn-approve"
                  disabled={busyActionId === `photo-${item.id}-approve`}
                  onClick={() => handlePhotoAction(item, 'approve')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn-delete"
                  disabled={busyActionId === `photo-${item.id}-reject`}
                  onClick={() => handlePhotoAction(item, 'reject')}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn-investigate"
                  disabled={busyActionId === `photo-${item.id}-escalate`}
                  onClick={() => handlePhotoAction(item, 'escalate')}
                >
                  Escalate
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No pending photo reviews" description="Photo moderation is caught up." />
      )}
    </section>
  );

  const renderBans = () => (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <h2>Ban Management</h2>
          <p>Track active restrictions, their reasons, and any connected appeals.</p>
        </div>
      </div>

      {bans.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Type</th>
                <th>Reason</th>
                <th>Issued</th>
                <th>Expires</th>
                <th>Appeals</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {bans.map((ban) => (
                <tr key={ban.id}>
                  <td>{ban.userName || ban.userEmail || `User ${ban.userId}`}</td>
                  <td>{formatActionName(ban.banType)}</td>
                  <td>{ban.reason}</td>
                  <td>{formatTimestamp(ban.issuedAt)}</td>
                  <td>{ban.expiresAt ? formatTimestamp(ban.expiresAt) : 'Permanent'}</td>
                  <td>{ban.appealCount || 0}</td>
                  <td>
                    <button type="button" className="btn-approve inline-btn" onClick={() => handleRevokeBan(ban)}>
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No active bans" description="There are no active restrictions right now." />
      )}
    </section>
  );

  const renderAppeals = () => (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <h2>Appeal System</h2>
          <p>Review user appeals and either lift or uphold the moderation action.</p>
        </div>
      </div>

      {appeals.length ? (
        <div className="queue-list">
          {appeals.map((appeal) => (
            <div className="queue-item" key={appeal.id}>
              <div className="queue-item-main">
                <div className="queue-item-title-row">
                  <span className="queue-badge appeal">Appeal</span>
                  <span className="status-tag pending">{formatActionName(appeal.status)}</span>
                </div>
                <h3>{appeal.subject || 'Moderation appeal'}</h3>
                <p>{appeal.message}</p>
                <div className="queue-meta">
                  <span>{appeal.first_name || appeal.email || `User ${appeal.user_id}`}</span>
                  <span>{appeal.ban_reason || 'No linked ban reason recorded'}</span>
                  <span>{formatTimestamp(appeal.created_at)}</span>
                </div>
              </div>
              <div className="queue-actions">
                <button type="button" className="btn-approve" onClick={() => handleAppealAction(appeal, 'approve')}>
                  Approve Appeal
                </button>
                <button type="button" className="btn-dismiss" onClick={() => handleAppealAction(appeal, 'deny')}>
                  Deny Appeal
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No pending appeals" description="There are no open appeals to review." />
      )}
    </section>
  );

  const renderAnalyticsBreakdown = (title, items) => (
    <div className="summary-card">
      <h3>{title}</h3>
      {items.length ? (
        <div className="breakdown-list">
          {items.map((item) => (
            <div className="breakdown-item" key={`${title}-${item.label}`}>
              <span>{formatActionName(item.label)}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted-copy">No data in this period.</p>
      )}
    </div>
  );

  const renderAnalytics = () => (
    <div className="admin-stack">
      <section className="analytics-section">
        <h2>Moderation Analytics</h2>
        <div className="analytics-summary">
          <div className="summary-card">
            <h3>30 Day Reports</h3>
            <div className="chart-placeholder">{analytics.summary?.reports || 0}</div>
          </div>
          <div className="summary-card">
            <h3>30 Day Spam Flags</h3>
            <div className="chart-placeholder">{analytics.summary?.spamFlags || 0}</div>
          </div>
          <div className="summary-card">
            <h3>30 Day Fraud Flags</h3>
            <div className="chart-placeholder">{analytics.summary?.fraudFlags || 0}</div>
          </div>
          <div className="summary-card">
            <h3>Pending Photo Reviews</h3>
            <div className="chart-placeholder">{analytics.summary?.currentPendingPhotoReviews || 0}</div>
          </div>
          <div className="summary-card">
            <h3>Pending Appeals</h3>
            <div className="chart-placeholder">{analytics.summary?.currentPendingAppeals || 0}</div>
          </div>
          <div className="summary-card">
            <h3>Active Bans</h3>
            <div className="chart-placeholder">{analytics.summary?.currentActiveBans || 0}</div>
          </div>
        </div>
      </section>

      <section className="analytics-section">
        <h2>Daily Moderation Trend</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reports</th>
                <th>Spam</th>
                <th>Fraud</th>
                <th>Pending Photos</th>
                <th>Pending Appeals</th>
                <th>Active Bans</th>
              </tr>
            </thead>
            <tbody>
              {analytics.metrics?.length ? (
                analytics.metrics.map((metric) => (
                  <tr key={metric.metric_date}>
                    <td>{formatDate(metric.metric_date)}</td>
                    <td>{metric.reported_users || 0}</td>
                    <td>{metric.spam_flagged_users || 0}</td>
                    <td>{metric.fraud_flagged_users || 0}</td>
                    <td>{metric.pending_photo_reviews || 0}</td>
                    <td>{metric.pending_appeals || 0}</td>
                    <td>{metric.active_bans || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7">No moderation analytics available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="breakdown-grid">
        {renderAnalyticsBreakdown('Report Reasons', analytics.breakdowns?.reportReasons || [])}
        {renderAnalyticsBreakdown('Spam Signals', analytics.breakdowns?.spamReasons || [])}
        {renderAnalyticsBreakdown('Fraud Types', analytics.breakdowns?.fraudTypes || [])}
        {renderAnalyticsBreakdown('Manual Flag Categories', analytics.breakdowns?.manualFlagCategories || [])}
      </section>
    </div>
  );

  const renderActionsLog = () => (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <h2>Moderation Actions Log</h2>
          <p>Full audit trail of admin actions across flags, bans, photo review, and appeals.</p>
        </div>
      </div>

      {actionsLog.length ? (
        <div className="table-wrap">
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
              {actionsLog.map((action) => (
                <tr key={action.id}>
                  <td>{formatActionName(action.action_type)}</td>
                  <td>{action.admin_email || 'Admin user'}</td>
                  <td>{action.reason || 'No reason recorded'}</td>
                  <td>{formatTimestamp(action.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No actions recorded" description="Moderation actions will appear here." />
      )}
    </section>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'queue':
        return renderQueue();
      case 'reviews':
        return renderReviews();
      case 'photos':
        return renderPhotoModeration();
      case 'bans':
        return renderBans();
      case 'appeals':
        return renderAppeals();
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
          <h1>Moderation Console</h1>
          <p>Content review, automated enforcement, user bans, appeals, and analytics in one place.</p>
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
        {loading ? <div className="loading">Loading moderation controls...</div> : renderActiveTab()}
      </main>
    </div>
  );
};

export default AdminDashboard;
