import React, { useState, useEffect } from 'react';
import momentService from '../services/momentService';
import MomentsUpload from './MomentsUpload';
import MomentsViewer from './MomentsViewer';
import './Moments.css';

const MomentsFeed = () => {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedMoment, setSelectedMoment] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchMoments();
    fetchStats();
  }, []);

  const fetchMoments = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await momentService.getMatchesMoments();

      if (result.success) {
        setMoments(result.moments || []);
      } else {
        setError(result.error || 'Failed to load moments');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const result = await momentService.getMomentsStats();
      if (result.success) {
        setStats(result.stats);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleMomentClick = async (moment) => {
    setSelectedMoment(moment);

    // Record the view
    if (!moment.hasViewed) {
      await momentService.recordMomentView(moment.id);
    }
  };

  const handleUploadSuccess = () => {
    fetchMoments();
    fetchStats();
  };

  if (loading) {
    return (
      <div className="moments-feed loading">
        <div className="spinner"></div>
        <p>Loading moments...</p>
      </div>
    );
  }

  return (
    <div className="moments-feed-container">
      {showUpload && (
        <MomentsUpload
          onUploadSuccess={handleUploadSuccess}
          onClose={() => setShowUpload(false)}
        />
      )}

      {selectedMoment && (
        <MomentsViewer
          moment={selectedMoment}
          onClose={() => setSelectedMoment(null)}
        />
      )}

      <div className="feed-header">
        <div className="header-content">
          <h1>📸 Moments</h1>
          <p>24-hour stories from your matches</p>
        </div>
        <button
          className="btn-create-moment"
          onClick={() => setShowUpload(true)}
        >
          + New Moment
        </button>
      </div>

      {/* Stats Banner */}
      {stats && (
        <div className="moments-stats-banner">
          <div className="stat-item">
            <span className="icon">📸</span>
            <div>
              <span className="label">Your Moments</span>
              <span className="value">{stats.activeMoments}</span>
            </div>
          </div>
          <div className="stat-item">
            <span className="icon">👁️</span>
            <div>
              <span className="label">Total Views</span>
              <span className="value">{stats.totalViews}</span>
            </div>
          </div>
          <div className="stat-item">
            <span className="icon">👤</span>
            <div>
              <span className="label">Viewers</span>
              <span className="value">{stats.uniqueViewers}</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={fetchMoments} className="btn-retry">
            Retry
          </button>
        </div>
      )}

      {moments.length === 0 ? (
        <div className="empty-feed">
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <h2>No Moments Yet</h2>
            <p>Your matches haven't shared any moments yet.</p>
            <p className="hint">Create your moment to build FOMO!</p>
            <button
              className="btn-create-moment-large"
              onClick={() => setShowUpload(true)}
            >
              Share Your First Moment
            </button>
          </div>
        </div>
      ) : (
        <div className="moments-grid">
          {moments.map(moment => (
            <div
              key={moment.id}
              className={`moment-card ${moment.hasViewed ? 'viewed' : 'unviewed'}`}
              onClick={() => handleMomentClick(moment)}
            >
              <div className="moment-image-container">
                <img
                  src={moment.photoUrl}
                  alt="moment"
                  className="moment-image"
                />
                {!moment.hasViewed && <div className="unviewed-badge">New</div>}
              </div>

              <div className="moment-info-overlay">
                <div className="user-info">
                  <img
                    src={moment.userPhoto}
                    alt={moment.userName}
                    className="user-photo"
                  />
                  <div>
                    <p className="user-name">{moment.userName}</p>
                    <p className="time-until">{moment.timeUntilExpiry}</p>
                  </div>
                </div>

                <div className="moment-stats">
                  <span className="view-count">👁️ {moment.viewCount}</span>
                </div>
              </div>

              <div className="expiry-indicator">
                <div
                  className="expiry-bar"
                  style={{
                    width: `${Math.round(
                      ((new Date(moment.expiresAt) - new Date()) /
                        (24 * 60 * 60 * 1000)) *
                        100
                    )}%`,
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FOMO Section */}
      {moments.length > 0 && (
        <div className="fomo-section">
          <div className="fomo-card">
            <span className="fomo-icon">⚡</span>
            <h3>Building FOMO</h3>
            <p>{moments.length} matches have shared moments today</p>
            <p className="fomo-hint">Don't miss out - view and react to moments!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MomentsFeed;
