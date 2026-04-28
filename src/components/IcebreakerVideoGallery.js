import React, { useState, useEffect } from 'react';
import '../styles/IcebreakerVideos.css';

/**
 * IcebreakerVideoGallery
 * Manage and view user's own icebreaker videos
 */
function IcebreakerVideoGallery({ onRecordNew, videos, stats, onDelete }) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  /**
   * Handle video deletion
   */
  const handleDeleteVideo = async (videoId) => {
    if (!window.confirm('Are you sure you want to delete this video?')) {
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteError(null);
      await onDelete(videoId);
    } catch (error) {
      setDeleteError('Failed to delete video');
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Format view count
   */
  const formatCount = (count) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  if (!videos || videos.length === 0) {
    return (
      <div className="gallery-container">
        <div className="gallery-header">
          <h2>📹 My Icebreaker Videos</h2>
        </div>
        <div className="empty-gallery">
          <span className="empty-icon">🎬</span>
          <h3>No Videos Yet</h3>
          <p>Record your first icebreaker video to make a great first impression!</p>
          <button onClick={onRecordNew} className="btn-record-first">
            🎥 Record Your First Video
          </button>
        </div>
      </div>
    );
  }

  const activeVideo = videos.find((v) => v.is_active);

  return (
    <div className="gallery-container">
      <div className="gallery-header">
        <h2>📹 My Icebreaker Videos ({videos.length})</h2>
        <button onClick={onRecordNew} className="btn-record-new">
          + Record New
        </button>
      </div>

      {/* Stats banner */}
      {stats && (
        <div className="gallery-stats-banner">
          <div className="stat-item">
            <span className="stat-label">Total Views</span>
            <span className="stat-value">{formatCount(stats.total_views)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Average Rating</span>
            <span className="stat-value">
              {stats.average_rating ? stats.average_rating.toFixed(1) : 'N/A'} ⭐
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Authenticity Score</span>
            <span className="stat-value">{stats.authenticity_score}%</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Ratings</span>
            <span className="stat-value">{stats.total_ratings}</span>
          </div>
        </div>
      )}

      {/* Video grid */}
      <div className="video-grid">
        {videos.map((video) => (
          <div
            key={video.id}
            className={`video-card ${video.is_active ? 'active' : ''}`}
          >
            {/* Thumbnail */}
            <div className="video-thumbnail">
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className="thumbnail-image"
              />
              <div className="duration-badge">
                ⏱ {video.duration_seconds}s
              </div>

              {video.is_active && (
                <div className="active-badge">Active</div>
              )}

              {/* Hover overlay */}
              <div className="thumbnail-overlay">
                <button
                  onClick={() => setSelectedVideo(video)}
                  className="btn-preview"
                >
                  ▶️ Preview
                </button>
              </div>
            </div>

            {/* Video info */}
            <div className="video-card-info">
              <h4 className="video-title">{video.title}</h4>

              {/* Stats */}
              <div className="video-card-stats">
                <span>
                  👁 {formatCount(video.view_count)}
                </span>
                <span>
                  ⭐ {video.average_rating ? video.average_rating.toFixed(1) : 'N/A'}
                </span>
                <span>
                  ✨ {video.authenticity_score}%
                </span>
              </div>

              {/* Date */}
              <small className="video-date">
                {new Date(video.created_at).toLocaleDateString()}
              </small>

              {/* Actions */}
              <div className="video-card-actions">
                <button
                  onClick={() => setSelectedVideo(video)}
                  className="btn-view-stats"
                >
                  📊 Stats
                </button>
                <button
                  onClick={() => handleDeleteVideo(video.id)}
                  className="btn-delete"
                  disabled={isDeleting}
                >
                  🗑 Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Video detail modal */}
      {selectedVideo && (
        <div className="video-detail-modal">
          <div className="modal-content">
            <button
              onClick={() => setSelectedVideo(null)}
              className="btn-modal-close"
            >
              ✕
            </button>

            {/* Video player */}
            <video
              src={selectedVideo.video_url}
              controls
              autoPlay
              className="detail-video"
            />

            {/* Details */}
            <div className="detail-info">
              <h3>{selectedVideo.title}</h3>
              <div className="detail-meta">
                <span>📝 {selectedVideo.prompt}</span>
                <span>⏱ {selectedVideo.duration_seconds}s</span>
                <span>📅 {new Date(selectedVideo.created_at).toLocaleDateString()}</span>
              </div>

              {/* Detailed stats */}
              <div className="detail-stats">
                <h4>📊 Performance Stats</h4>
                <div className="stats-grid">
                  <div className="stat-box">
                    <span className="stat-label">Views</span>
                    <span className="stat-big">{selectedVideo.view_count}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Average Rating</span>
                    <span className="stat-big">
                      {selectedVideo.average_rating?.toFixed(1)}⭐
                    </span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Authenticity Score</span>
                    <span className="stat-big">{selectedVideo.authenticity_score}%</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Likes</span>
                    <span className="stat-big">{selectedVideo.like_count}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="modal-actions">
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="btn-close-modal"
                >
                  Close
                </button>
                {!selectedVideo.is_active && (
                  <button className="btn-make-active">
                    ✓ Set as Active
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete error */}
      {deleteError && (
        <div className="error-notification">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)}>✕</button>
        </div>
      )}
    </div>
  );
}

export default IcebreakerVideoGallery;
