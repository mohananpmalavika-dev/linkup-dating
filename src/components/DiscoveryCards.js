import React, { useState, useEffect } from 'react';
import '../styles/DiscoveryCards.css';
import datingProfileService from '../services/datingProfileService';

/**
 * DiscoveryCards Component
 * Swipe-based profile discovery interface
 */
const DiscoveryCards = ({ onMatch, onProfileView }) => {
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noMoreProfiles, setNoMoreProfiles] = useState(false);

  // Load initial profiles
  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await datingProfileService.getDiscoveryProfiles();
      setProfiles(data.profiles || []);
      if (!data.profiles || data.profiles.length === 0) {
        setNoMoreProfiles(true);
      }
    } catch (err) {
      setError('Failed to load profiles. Please try again.');
      console.error('Profile loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentProfile = () => {
    return profiles[currentIndex];
  };

  const handleLike = async () => {
    const profile = getCurrentProfile();
    if (!profile) return;

    try {
      const result = await datingProfileService.likeProfile(profile.userId);
      if (result.isMatch) {
        onMatch?.({
          ...profile,
          matchId: result.match?.id || profile.matchId || null
        });
      }
      moveToNextCard();
    } catch (err) {
      setError('Failed to like profile');
      console.error(err);
    }
  };

  const handlePass = async () => {
    const profile = getCurrentProfile();
    if (!profile) return;

    try {
      await datingProfileService.passProfile(profile.userId);
      moveToNextCard();
    } catch (err) {
      setError('Failed to pass profile');
      console.error(err);
    }
  };

  const moveToNextCard = () => {
    if (currentIndex < profiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setNoMoreProfiles(true);
    }
  };

  const reloadProfiles = () => {
    setCurrentIndex(0);
    setNoMoreProfiles(false);
    loadProfiles();
  };

  const currentProfile = getCurrentProfile();

  if (loading) {
    return (
      <div className="discovery-container loading">
        <div className="spinner"></div>
        <p>Finding profiles for you...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="discovery-container error">
        <p className="error-message">{error}</p>
        <button onClick={loadProfiles} className="btn-retry">Retry</button>
      </div>
    );
  }

  if (noMoreProfiles || !currentProfile) {
    return (
      <div className="discovery-container no-profiles">
        <div className="empty-state">
          <h2>No More Profiles</h2>
          <p>You've reviewed all available profiles!</p>
          <button onClick={reloadProfiles} className="btn-primary">Reload Profiles</button>
        </div>
      </div>
    );
  }

  return (
    <div className="discovery-container">
      {/* Card Stack */}
      <div className="card-stack">
        <div className="profile-card active">
          {/* Photo Gallery */}
          <div className="photo-container">
            {currentProfile.photos && currentProfile.photos.length > 0 ? (
              <>
                <img
                  src={currentProfile.photos[0]}
                  alt={currentProfile.firstName}
                  className="profile-photo"
                  onError={(e) => e.target.src = 'https://via.placeholder.com/400x600?text=No+Photo'}
                />
                {currentProfile.photos.length > 1 && (
                  <div className="photo-indicators">
                    {currentProfile.photos.map((_, idx) => (
                      <div
                        key={idx}
                        className={`indicator ${idx === 0 ? 'active' : ''}`}
                      ></div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="no-photo">No Photos</div>
            )}

            {/* Age & Location Badge */}
            <div className="profile-header">
              <div className="name-age">
                <h2>{currentProfile.firstName}</h2>
                <span className="age">{currentProfile.age}</span>
              </div>
              {currentProfile.profileVerified && (
                <div className="verified-badge" title="Verified Profile">
                  ✓
                </div>
              )}
            </div>

            {/* Location */}
            <div className="location">
              📍 {currentProfile.location?.city}, {currentProfile.location?.state}
            </div>
          </div>

          {/* Profile Info */}
          <div className="profile-info">
            {/* Bio */}
            {currentProfile.bio && (
              <div className="bio">
                <p>{currentProfile.bio}</p>
              </div>
            )}

            {/* Details Grid */}
            <div className="details-grid">
              {currentProfile.occupation && (
                <div className="detail-item">
                  <span className="label">Occupation</span>
                  <span className="value">{currentProfile.occupation}</span>
                </div>
              )}
              {currentProfile.education && (
                <div className="detail-item">
                  <span className="label">Education</span>
                  <span className="value">{currentProfile.education}</span>
                </div>
              )}
              {currentProfile.relationshipGoals && (
                <div className="detail-item">
                  <span className="label">Looking For</span>
                  <span className="value">{currentProfile.relationshipGoals}</span>
                </div>
              )}
            </div>

            {/* Interests */}
            {currentProfile.interests && currentProfile.interests.length > 0 && (
              <div className="interests">
                <h4>Interests</h4>
                <div className="interest-tags">
                  {currentProfile.interests.map((interest, idx) => (
                    <span key={idx} className="tag">{interest}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button
          onClick={handlePass}
          className="btn-action btn-pass"
          title="Not interested"
          aria-label="Pass"
        >
          ✕
        </button>
        <button
          onClick={() => onProfileView?.(currentProfile)}
          className="btn-action btn-view"
          title="View full profile"
          aria-label="View Profile"
        >
          ⓘ
        </button>
        <button
          onClick={handleLike}
          className="btn-action btn-like"
          title="Like this profile"
          aria-label="Like"
        >
          ♥
        </button>
      </div>

      {/* Card Counter */}
      <div className="card-counter">
        {currentIndex + 1} of {profiles.length}
      </div>
    </div>
  );
};

export default DiscoveryCards;
