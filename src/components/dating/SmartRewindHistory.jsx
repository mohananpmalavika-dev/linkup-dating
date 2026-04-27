import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../utils/api';
import axios from 'axios';
import './SmartRewindHistory.css';

const SmartRewindHistory = ({ userId, onProfileRestore }) => {
  const [view, setView] = useState('by-reason'); // 'by-reason' or 'timeline'
  const [historyData, setHistoryData] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReason, setSelectedReason] = useState(null);
  const [restoring, setRestoring] = useState(null);

  useEffect(() => {
    loadRewindHistory();
  }, []);

  const loadRewindHistory = async () => {
    try {
      setLoading(true);
      
      // Load by-reason view
      const reasonResponse = await axios.get(`${API_BASE_URL}/api/dating/rewind/history/by-reason`, {
        withCredentials: true
      });
      
      setHistoryData(reasonResponse.data.data || []);
      
      // Load timeline view
      const timelineResponse = await axios.get(`${API_BASE_URL}/api/dating/rewind/history?limit=50`, {
        withCredentials: true
      });
      
      setTimelineData(timelineResponse.data.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load rewind history:', err);
      setError('Failed to load rewind history');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreProfile = async (profileId, reason) => {
    try {
      setRestoring(profileId);
      
      const response = await axios.post(
        `${API_BASE_URL}/api/dating/rewind/restore/${profileId}`,
        {},
        { withCredentials: true }
      );
      
      if (response.data.success) {
        // Reload history
        await loadRewindHistory();
        
        // Notify parent component
        if (onProfileRestore) {
          onProfileRestore(response.data.restoredProfile);
        }
      }
    } catch (err) {
      console.error('Failed to restore profile:', err);
      if (err.response?.status === 429) {
        setError('Daily rewind limit reached. Upgrade to Premium for unlimited rewinds!');
      } else {
        setError('Failed to restore profile');
      }
    } finally {
      setRestoring(null);
    }
  };

  if (loading) {
    return <div className="rewind-history-loading">Loading your rewind history...</div>;
  }

  if (error) {
    return (
      <div className="rewind-history-error">
        <p>{error}</p>
        <button onClick={loadRewindHistory}>Retry</button>
      </div>
    );
  }

  return (
    <div className="smart-rewind-history">
      <div className="rewind-header">
        <h2>🔄 Smart Rewind History</h2>
        <p className="subtitle">Profiles you passed on this week - organized by reason</p>
      </div>

      {/* View Toggle */}
      <div className="view-toggle">
        <button 
          className={`toggle-btn ${view === 'by-reason' ? 'active' : ''}`}
          onClick={() => setView('by-reason')}
        >
          📂 By Reason
        </button>
        <button 
          className={`toggle-btn ${view === 'timeline' ? 'active' : ''}`}
          onClick={() => setView('timeline')}
        >
          📅 Timeline
        </button>
      </div>

      {/* By Reason View */}
      {view === 'by-reason' && (
        <div className="by-reason-view">
          {historyData.length === 0 ? (
            <div className="empty-state">
              <p>No passed profiles yet. Start swiping! 👀</p>
            </div>
          ) : (
            <div className="reason-groups">
              {historyData.map((group) => (
                <div key={group.reason} className="reason-group">
                  <div className="reason-header">
                    <span className="reason-icon">{group.icon}</span>
                    <h3>{group.label}</h3>
                    <span className="count-badge">{group.count}</span>
                  </div>

                  <div className="profiles-grid">
                    {group.profiles.map((item) => (
                      <div key={item.decisionId} className="profile-card">
                        {item.profile?.photoUrl && (
                          <div className="profile-photo">
                            <img 
                              src={item.profile.photoUrl} 
                              alt={item.profile.firstName}
                              className="photo"
                            />
                            {item.profile.verified && (
                              <div className="verified-badge">✓</div>
                            )}
                          </div>
                        )}
                        
                        <div className="profile-info">
                          <h4>
                            {item.profile?.firstName}, {item.profile?.age}
                          </h4>
                          <p className="location">{item.profile?.location?.city}</p>
                          
                          {item.profile?.interests && item.profile.interests.length > 0 && (
                            <div className="interests">
                              {item.profile.interests.slice(0, 2).map((interest, idx) => (
                                <span key={idx} className="interest-tag">
                                  {interest}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          <p className="passed-time">
                            Passed {formatTimeAgo(item.passedAt)}
                          </p>
                        </div>

                        <button
                          className="rewind-button"
                          onClick={() => handleRestoreProfile(item.profileId, group.reason)}
                          disabled={restoring === item.profileId}
                        >
                          {restoring === item.profileId ? (
                            '⏳ Rewinding...'
                          ) : (
                            '❤️ Re-like'
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline View */}
      {view === 'timeline' && (
        <div className="timeline-view">
          {timelineData.length === 0 ? (
            <div className="empty-state">
              <p>No passed profiles yet. Start swiping! 👀</p>
            </div>
          ) : (
            <div className="timeline">
              {timelineData.map((item, idx) => (
                <div key={item.decisionId} className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-profile">
                      {item.profile?.photoUrl && (
                        <img 
                          src={item.profile.photoUrl} 
                          alt={item.profile.firstName}
                          className="small-photo"
                        />
                      )}
                      <div className="profile-details">
                        <h4>{item.profile?.firstName}, {item.profile?.age}</h4>
                        <p className="passed-reason">
                          {item.passReasonIcon} {item.passReasonLabel}
                        </p>
                        <p className="time-ago">{formatTimeAgo(item.passedAt)}</p>
                      </div>
                    </div>
                    <button
                      className="rewind-button-small"
                      onClick={() => handleRestoreProfile(item.profileId, item.passReason)}
                      disabled={restoring === item.profileId}
                    >
                      {restoring === item.profileId ? '...' : 'Re-like'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rewind Quota Info */}
      <RewindQuotaInfo />
    </div>
  );
};

/**
 * Rewind Quota Information Component
 */
const RewindQuotaInfo = () => {
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuota();
  }, []);

  const loadQuota = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/dating/rewind/quota`, {
        withCredentials: true
      });
      setQuota(response.data.quota);
    } catch (err) {
      console.error('Failed to load rewind quota:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !quota) return null;

  return (
    <div className="rewind-quota-info">
      <div className="quota-card">
        {quota.isPremium ? (
          <div className="premium-badge">👑 Premium Member</div>
        ) : (
          <div className="free-badge">Free Tier</div>
        )}
        
        <div className="quota-status">
          <p className="quota-message">{quota.message}</p>
          {!quota.isPremium && (
            <div className="quota-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${(quota.usedToday / quota.dailyLimit) * 100}%` }}
                />
              </div>
              <p className="quota-detail">
                {quota.usedToday} of {quota.dailyLimit} used today
              </p>
            </div>
          )}
        </div>

        {!quota.isPremium && (
          <div className="premium-cta">
            <p>Get unlimited rewinds with Premium!</p>
            <a href="/premium-plans" className="upgrade-link">
              Upgrade Now →
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Helper: Format time ago
 */
const formatTimeAgo = (timestamp) => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return time.toLocaleDateString();
};

export default SmartRewindHistory;
