// ========== ICEBREAKER VIDEOS - INTEGRATION EXAMPLES ==========
// Copy-paste ready code snippets for integrating Icebreaker Videos feature

import React, { useState, useEffect, useRef } from 'react';
import IcebreakerVideoRecorder from './components/IcebreakerVideoRecorder';
import IcebreakerVideoPlayer from './components/IcebreakerVideoPlayer';
import IcebreakerVideoGallery from './components/IcebreakerVideoGallery';
import icebreakerVideoService from './services/icebreakerVideoService';
import './styles/IcebreakerVideos.css';

// ===========================
// EXAMPLE 1: Profile View
// ===========================
// Display user's own profile with video management
export const ProfileViewExample = ({ userId }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRecorder, setShowRecorder] = useState(false);

  useEffect(() => {
    fetchUserVideos();
  }, [userId]);

  const fetchUserVideos = async () => {
    try {
      setLoading(true);
      const response = await icebreakerVideoService.getMyVideos();
      setVideos(response.videos || []);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoDeleted = (videoId) => {
    setVideos(videos.filter(v => v.id !== videoId));
  };

  if (loading) {
    return <div className="loading">Loading your icebreaker videos...</div>;
  }

  return (
    <div className="profile-icebreaker-section">
      <h2>📹 My Icebreaker Videos</h2>

      {videos.length === 0 ? (
        <div className="empty-state">
          <p>No videos yet. Create your first icebreaker video!</p>
          <button
            onClick={() => setShowRecorder(true)}
            className="btn-primary"
          >
            Record First Video
          </button>
        </div>
      ) : (
        <IcebreakerVideoGallery
          videos={videos}
          onVideoDeleted={handleVideoDeleted}
          onVideoUploaded={() => {
            fetchUserVideos();
            setShowRecorder(false);
          }}
        />
      )}

      {showRecorder && (
        <IcebreakerVideoRecorder
          onUploadSuccess={() => {
            fetchUserVideos();
            setShowRecorder(false);
          }}
          onCancel={() => setShowRecorder(false)}
        />
      )}
    </div>
  );
};

// ===========================
// EXAMPLE 2: Match/Dating Profile
// ===========================
// Display video when viewing a matched user's profile
export const MatchProfileViewExample = ({ matchedUserId, matchName }) => {
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);

  useEffect(() => {
    fetchMatchVideo();
  }, [matchedUserId]);

  const fetchMatchVideo = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await icebreakerVideoService.getMatchVideo(matchedUserId);
      if (response.video) {
        setVideo(response.video);
      }
    } catch (error) {
      console.error('Failed to load match video:', error);
      setError('Could not load icebreaker video');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="match-video-section loading">
        Loading icebreaker video...
      </div>
    );
  }

  if (error) {
    return (
      <div className="match-video-section error">
        <p>{error}</p>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="match-video-section empty">
        <p>{matchName} hasn't shared an icebreaker video yet</p>
      </div>
    );
  }

  return (
    <div className="match-video-section">
      <div className="video-card">
        {video.thumbnail_url && (
          <img
            src={video.thumbnail_url}
            alt="Video preview"
            className="video-preview-thumbnail"
            onClick={() => setShowPlayer(true)}
            style={{ cursor: 'pointer' }}
          />
        )}
        <div className="video-info">
          <p className="video-title">{video.title || "My Icebreaker"}</p>
          <div className="video-stats">
            <span>👁️ {video.view_count} views</span>
            <span>⭐ {video.average_rating?.toFixed(1)} rating</span>
          </div>
          <button
            onClick={() => setShowPlayer(true)}
            className="btn-watch"
          >
            Watch & Rate
          </button>
        </div>
      </div>

      {showPlayer && (
        <IcebreakerVideoPlayer
          videoId={video.id}
          userId={matchedUserId}
          userInfo={{
            name: matchName,
            avatar: video.user?.avatar_url
          }}
          onClose={() => setShowPlayer(false)}
          onRatingSubmitted={fetchMatchVideo}
        />
      )}
    </div>
  );
};

// ===========================
// EXAMPLE 3: Quick Upload in Chat
// ===========================
// Send icebreaker video in chat interface
export const ChatIcebreakerUploadExample = ({ matchId, onVideoSent }) => {
  const [showRecorder, setShowRecorder] = useState(false);
  const recorderRef = useRef();

  const handleOpenRecorder = () => {
    setShowRecorder(true);
  };

  const handleVideoUploaded = (video) => {
    setShowRecorder(false);
    if (onVideoSent) {
      onVideoSent(video);
    }
  };

  return (
    <>
      <button
        onClick={handleOpenRecorder}
        className="btn-icebreaker-chat"
        title="Send icebreaker video"
      >
        📹 Send Video
      </button>

      {showRecorder && (
        <IcebreakerVideoRecorder
          ref={recorderRef}
          onUploadSuccess={handleVideoUploaded}
          onCancel={() => setShowRecorder(false)}
          context="chat"
        />
      )}
    </>
  );
};

// ===========================
// EXAMPLE 4: Discover/Featured Videos
// ===========================
// Show featured/trending videos in discover section
export const DiscoverIcebreakerVideosExample = () => {
  const [videos, setVideos] = useState([]);
  const [tab, setTab] = useState('featured'); // featured | trending
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    fetchVideos();
  }, [tab]);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response =
        tab === 'featured'
          ? await icebreakerVideoService.getFeaturedVideos(12)
          : await icebreakerVideoService.getTrendingVideos(12, 7);
      setVideos(response.videos || []);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="discover-icebreaker-section">
      <h2>📹 Icebreaker Videos</h2>

      <div className="tabs">
        <button
          className={`tab ${tab === 'featured' ? 'active' : ''}`}
          onClick={() => setTab('featured')}
        >
          Featured ⭐
        </button>
        <button
          className={`tab ${tab === 'trending' ? 'active' : ''}`}
          onClick={() => setTab('trending')}
        >
          Trending 🔥
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading videos...</div>
      ) : (
        <div className="video-grid">
          {videos.map((video) => (
            <div
              key={video.id}
              className="discover-video-card"
              onClick={() => setSelectedVideo(video)}
            >
              {video.thumbnail_url && (
                <img
                  src={video.thumbnail_url}
                  alt={video.user?.name}
                  className="card-thumbnail"
                />
              )}
              <div className="card-overlay">
                <div className="card-info">
                  <p className="card-name">{video.user?.name}</p>
                  <div className="card-stats">
                    <span>⭐ {video.average_rating?.toFixed(1)}</span>
                    <span>👁️ {video.view_count}</span>
                  </div>
                </div>
                <button className="btn-watch-small">▶ Watch</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedVideo && (
        <IcebreakerVideoPlayer
          videoId={selectedVideo.id}
          userId={selectedVideo.user_id}
          userInfo={{
            name: selectedVideo.user?.name,
            avatar: selectedVideo.user?.avatar_url
          }}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
};

// ===========================
// EXAMPLE 5: Video Stats Dashboard
// ===========================
// Show analytics for your videos
export const VideoStatsDashboardExample = ({ videoId }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [videoId]);

  const fetchStats = async () => {
    try {
      const response = await icebreakerVideoService.getVideoStats(videoId);
      setStats(response.stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return <div className="loading">Loading statistics...</div>;
  }

  return (
    <div className="stats-dashboard">
      <h3>Video Performance</h3>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-value">{stats.viewCount}</div>
          <div className="metric-label">Views</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{stats.likeCount}</div>
          <div className="metric-label">Likes</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">
            {stats.averageRating?.toFixed(1)}/5
          </div>
          <div className="metric-label">Rating</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{stats.authenticity_score}%</div>
          <div className="metric-label">Authenticity</div>
        </div>
      </div>

      {/* Reactions Breakdown */}
      <div className="stats-section">
        <h4>Reactions</h4>
        <div className="reactions-chart">
          {Object.entries(stats.reactions || {}).map(([reaction, count]) => (
            <div key={reaction} className="reaction-bar">
              <span className="reaction-emoji">
                {reaction === 'like' && '👍'}
                {reaction === 'love' && '❤️'}
                {reaction === 'funny' && '😂'}
                {reaction === 'wow' && '🤩'}
                {reaction === 'inspiring' && '✨'}
              </span>
              <div className="bar-container">
                <div
                  className="bar"
                  style={{
                    width: `${(count / stats.totalRatings) * 100}%`
                  }}
                />
              </div>
              <span className="count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rating Distribution */}
      <div className="stats-section">
        <h4>Star Ratings</h4>
        <div className="rating-chart">
          {[5, 4, 3, 2, 1].map((star) => (
            <div key={star} className="rating-row">
              <span className="stars">{'⭐'.repeat(star)}</span>
              <div className="bar-container">
                <div
                  className="bar"
                  style={{
                    width: `${
                      ((stats.ratingDistribution?.[star] || 0) /
                        stats.totalRatings) *
                      100
                    }%`
                  }}
                />
              </div>
              <span className="count">
                {stats.ratingDistribution?.[star] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="stats-section">
        <h4>Engagement</h4>
        <div className="engagement-metrics">
          <div className="metric">
            <span className="label">Helpful</span>
            <span className="value">{stats.helpfulCount}</span>
          </div>
          <div className="metric">
            <span className="label">Would Match</span>
            <span className="value">{stats.wouldMatchCount}</span>
          </div>
          <div className="metric">
            <span className="label">Comments</span>
            <span className="value">{stats.totalComments || 0}</span>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <button onClick={fetchStats} className="btn-refresh">
        🔄 Refresh Stats
      </button>
    </div>
  );
};

// ===========================
// EXAMPLE 6: Premium Feature Banner
// ===========================
// Show premium feature gate/upsell
export const PremiumIcebreakerBannerExample = ({ isPremium, onUpgrade }) => {
  if (isPremium) {
    return null; // Hide banner for premium users
  }

  return (
    <div className="premium-banner icebreaker-banner">
      <div className="banner-content">
        <h3>🎬 Unlock Icebreaker Videos</h3>
        <p>
          Send authentic 5-second video intros instead of text.
          Increase your match rate instantly!
        </p>
        <ul className="benefits">
          <li>✅ 5-second authentic introductions</li>
          <li>✅ Increase authenticity perception</li>
          <li>✅ Get more matches faster</li>
          <li>✅ Premium-only feature</li>
        </ul>
      </div>
      <button onClick={onUpgrade} className="btn-upgrade">
        Upgrade Now
      </button>
    </div>
  );
};

// ===========================
// EXAMPLE 7: Edit/Re-record Video
// ===========================
// Allow user to re-record and replace video
export const VideoEditExample = ({ videoId, currentVideo, onUpdated }) => {
  const [showRecorder, setShowRecorder] = useState(false);

  const handleRerecord = async () => {
    setShowRecorder(true);
  };

  const handleNewVideoUploaded = async (newVideo) => {
    // Delete old video
    try {
      await icebreakerVideoService.deleteVideo(
        videoId,
        currentVideo.video_key
      );
    } catch (error) {
      console.error('Failed to delete old video:', error);
    }

    setShowRecorder(false);
    if (onUpdated) {
      onUpdated(newVideo);
    }
  };

  return (
    <div className="video-edit">
      <div className="video-preview">
        {currentVideo.thumbnail_url && (
          <img src={currentVideo.thumbnail_url} alt="Current video" />
        )}
        <button
          onClick={handleRerecord}
          className="btn-rerecord"
          title="Re-record this video"
        >
          🔄 Re-record
        </button>
      </div>

      {showRecorder && (
        <IcebreakerVideoRecorder
          onUploadSuccess={handleNewVideoUploaded}
          onCancel={() => setShowRecorder(false)}
        />
      )}
    </div>
  );
};

// ===========================
// EXAMPLE 8: Notifications
// ===========================
// Show notifications when someone rates your video
export const VideoRatingNotificationExample = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Listen for rating notifications (via Socket.IO or polling)
    const handleNewRating = (ratingData) => {
      const notification = {
        id: Date.now(),
        type: 'video_rating',
        message: `Someone rated your icebreaker video ${ratingData.rating} ⭐`,
        timestamp: new Date(),
        videoId: ratingData.videoId
      };

      setNotifications((prev) => [notification, ...prev]);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((n) => n.id !== notification.id)
        );
      }, 5000);
    };

    // TODO: Connect to your notification system
    // window.addEventListener('video_rating', handleNewRating);

    return () => {
      // window.removeEventListener('video_rating', handleNewRating);
    };
  }, []);

  return (
    <div className="notifications-container">
      {notifications.map((notification) => (
        <div key={notification.id} className="notification">
          <span className="notification-message">
            {notification.message}
          </span>
          <button
            onClick={() =>
              setNotifications((prev) =>
                prev.filter((n) => n.id !== notification.id)
              )
            }
            className="btn-close"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

// ===========================
// EXAMPLE 9: Hook for Video Playback
// ===========================
// Reusable hook for managing video playback state
export const useIcebreakerVideoPlayback = (videoId) => {
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rating, setRating] = useState(null);

  useEffect(() => {
    fetchVideo();
  }, [videoId]);

  const fetchVideo = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await icebreakerVideoService.getVideo(videoId);
      setVideo(response.video);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitRating = async (ratingData) => {
    try {
      const response = await icebreakerVideoService.rateVideo(
        videoId,
        ratingData
      );
      setRating(response.rating);
      return response;
    } catch (err) {
      throw err;
    }
  };

  return {
    video,
    loading,
    error,
    isPlaying,
    setIsPlaying,
    rating,
    submitRating,
    refresh: fetchVideo
  };
};

// ===========================
// EXAMPLE 10: Context Provider
// ===========================
// Global state for icebreaker videos
export const IcebreakerVideoContext = React.createContext();

export const IcebreakerVideoProvider = ({ children }) => {
  const [userVideos, setUserVideos] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadUserVideos = async () => {
    try {
      setIsLoading(true);
      const response = await icebreakerVideoService.getMyVideos();
      setUserVideos(response.videos || []);
    } catch (error) {
      console.error('Failed to load user videos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const uploadVideo = async (videoData) => {
    try {
      const response = await icebreakerVideoService.uploadVideo(videoData);
      await loadUserVideos();
      return response;
    } catch (error) {
      console.error('Failed to upload video:', error);
      throw error;
    }
  };

  const deleteVideo = async (videoId, videoKey) => {
    try {
      await icebreakerVideoService.deleteVideo(videoId, videoKey);
      setUserVideos(userVideos.filter((v) => v.id !== videoId));
    } catch (error) {
      console.error('Failed to delete video:', error);
      throw error;
    }
  };

  const value = {
    userVideos,
    activeVideo,
    setActiveVideo,
    isLoading,
    loadUserVideos,
    uploadVideo,
    deleteVideo
  };

  return (
    <IcebreakerVideoContext.Provider value={value}>
      {children}
    </IcebreakerVideoContext.Provider>
  );
};

// Hook to use context
export const useIcebreakerVideos = () => {
  const context = React.useContext(IcebreakerVideoContext);
  if (!context) {
    throw new Error(
      'useIcebreakerVideos must be used within IcebreakerVideoProvider'
    );
  }
  return context;
};

// ========== END OF INTEGRATION EXAMPLES ==========
