import React, { useState, useEffect } from 'react';
import momentService from '../services/momentService';
import './Moments.css';

const MomentsViewer = ({ moment, onClose }) => {
  const [viewers, setViewers] = useState([]);
  const [showViewers, setShowViewers] = useState(false);
  const [loading, setLoading] = useState(false);
  const progressPercent = Math.round(
    ((new Date(moment.expiresAt) - new Date()) / (24 * 60 * 60 * 1000)) * 100
  );

  const fetchViewers = async () => {
    setLoading(true);
    const result = await momentService.getMomentViewers(moment.id);
    if (result.success) {
      setViewers(result.viewers || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (showViewers) {
      fetchViewers();
    }
  }, [showViewers]);

  return (
    <div className="moment-viewer-overlay" onClick={onClose}>
      <div className="moment-viewer" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="btn-viewer-close" onClick={onClose}>
          ✕
        </button>

        {/* Progress Bar */}
        <div className="viewer-progress">
          <div
            className="progress-bar"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>

        {/* Main Image */}
        <div className="viewer-image-container">
          <img
            src={moment.photoUrl}
            alt="moment"
            className="viewer-image"
          />

          {/* Caption */}
          {moment.caption && (
            <div className="viewer-caption">
              {moment.caption}
            </div>
          )}
        </div>

        {/* Bottom Info Bar */}
        <div className="viewer-bottom-bar">
          <div className="viewer-user-info">
            <div className="viewer-avatar">
              {moment.userPhoto && (
                <img src={moment.userPhoto} alt={moment.userName} />
              )}
            </div>
            <div>
              <p className="viewer-username">{moment.userName}</p>
              <p className="viewer-time">Expires in {moment.timeUntilExpiry}</p>
            </div>
          </div>

          <button
            className="btn-viewers"
            onClick={() => setShowViewers(!showViewers)}
          >
            👁️ {moment.viewCount}
          </button>
        </div>

        {/* Viewers List */}
        {showViewers && (
          <div className="viewers-panel">
            <div className="viewers-header">
              <h3>Viewed by ({viewers.length})</h3>
              <button
                className="btn-close-viewers"
                onClick={() => setShowViewers(false)}
              >
                ✕
              </button>
            </div>

            {loading ? (
              <div className="viewers-loading">
                <div className="spinner"></div>
                <p>Loading viewers...</p>
              </div>
            ) : viewers.length === 0 ? (
              <div className="viewers-empty">
                <p>No one has viewed this moment yet</p>
              </div>
            ) : (
              <div className="viewers-list">
                {viewers.map((viewer, index) => (
                  <div key={index} className="viewer-item">
                    <div className="viewer-item-avatar">
                      {viewer.userPhoto && (
                        <img src={viewer.userPhoto} alt={viewer.userName} />
                      )}
                    </div>
                    <div className="viewer-item-info">
                      <p className="viewer-item-name">{viewer.userName}</p>
                      <p className="viewer-item-time">
                        {new Date(viewer.viewedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MomentsViewer;
