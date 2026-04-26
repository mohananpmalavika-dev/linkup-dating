import React, { useEffect, useState } from 'react';
import '../styles/DatingProfile.css';
import datingProfileService from '../services/datingProfileService';

/**
 * DatingProfile Component
 * User's profile view and edit
 */
const DatingProfile = ({ onLogout }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [editData, setEditData] = useState(null);
  const [stats, setStats] = useState({
    likes: 0,
    matches: 0,
    completion: 0
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');

      const [profileData, matchesData, likesData, completionData] = await Promise.all([
        datingProfileService.getMyProfile(),
        datingProfileService.getMatches(100),
        datingProfileService.getLikesReceived(100),
        datingProfileService.getProfileCompletion()
      ]);

      setProfile(profileData);
      setEditData(profileData);
      setStats({
        likes: Array.isArray(likesData) ? likesData.length : 0,
        matches: matchesData.matches?.length || 0,
        completion: completionData.profileCompletionPercent || profileData.profileCompletionPercent || 0
      });
    } catch (loadError) {
      setError('Failed to load profile');
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setError('');
      const response = await datingProfileService.updateProfile({
        bio: editData.bio,
        interests: editData.interests,
        relationshipGoals: editData.relationshipGoals
      });

      setProfile(response.profile);
      setEditData(response.profile);
      setStats((currentStats) => ({
        ...currentStats,
        completion: response.profile?.profileCompletionPercent || currentStats.completion
      }));
      setEditing(false);
    } catch (saveError) {
      setError('Failed to save profile');
      console.error(saveError);
    }
  };

  if (loading) {
    return (
      <div className="profile-container loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container error">
        <p>{error}</p>
        <button onClick={loadProfile}>Retry</button>
      </div>
    );
  }

  return (
    <div className="dating-profile-container">
      {editing ? (
        <div className="profile-edit">
          <h2>Edit Profile</h2>
          <div className="form-group">
            <label>Bio</label>
            <textarea
              value={editData.bio || ''}
              onChange={(event) => setEditData({ ...editData, bio: event.target.value })}
              placeholder="Tell about yourself"
            ></textarea>
          </div>
          <div className="form-group">
            <label>Interests</label>
            <input
              type="text"
              value={editData.interests?.join(', ') || ''}
              onChange={(event) => setEditData({
                ...editData,
                interests: event.target.value
                  .split(',')
                  .map((interest) => interest.trim())
                  .filter(Boolean)
              })}
              placeholder="Separate with commas"
            />
          </div>
          <div className="button-group">
            <button onClick={() => setEditing(false)} className="btn-cancel">Cancel</button>
            <button onClick={handleSaveProfile} className="btn-save">Save Changes</button>
          </div>
        </div>
      ) : (
        <div className="profile-view">
          <div className="profile-header-section">
            {profile.photos?.length > 0 ? (
              <div className="profile-photo-main">
                <img src={profile.photos[0]} alt={profile.firstName} />
                {profile.profileVerified ? (
                  <div className="verified-badge">✓ Verified</div>
                ) : null}
              </div>
            ) : (
              <div className="profile-photo-main profile-photo-fallback">
                <span>{profile.firstName?.charAt(0) || '?'}</span>
              </div>
            )}
            <h1>{profile.firstName}, {profile.age}</h1>
            <p className="location">📍 {profile.location?.city}, {profile.location?.state}</p>
          </div>

          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{stats.likes}</span>
              <span className="stat-label">Likes</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.matches}</span>
              <span className="stat-label">Matches</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.completion}%</span>
              <span className="stat-label">Profile</span>
            </div>
          </div>

          <div className="profile-section">
            <h3>About</h3>
            <p>{profile.bio || 'Add a bio so people can get to know you.'}</p>

            <div className="details-grid">
              {profile.occupation ? (
                <div className="detail">
                  <span className="label">Occupation</span>
                  <span className="value">{profile.occupation}</span>
                </div>
              ) : null}
              {profile.education ? (
                <div className="detail">
                  <span className="label">Education</span>
                  <span className="value">{profile.education}</span>
                </div>
              ) : null}
              {profile.height ? (
                <div className="detail">
                  <span className="label">Height</span>
                  <span className="value">{profile.height} cm</span>
                </div>
              ) : null}
              {profile.relationshipGoals ? (
                <div className="detail">
                  <span className="label">Looking For</span>
                  <span className="value">{profile.relationshipGoals}</span>
                </div>
              ) : null}
            </div>
          </div>

          {profile.interests?.length > 0 ? (
            <div className="profile-section">
              <h3>Interests</h3>
              <div className="interests-list">
                {profile.interests.map((interest) => (
                  <span key={interest} className="interest-tag">{interest}</span>
                ))}
              </div>
            </div>
          ) : null}

          {profile.photos?.length > 1 ? (
            <div className="profile-section">
              <h3>Photos</h3>
              <div className="photos-gallery">
                {profile.photos.map((photo, index) => (
                  <img key={`${photo}-${index}`} src={photo} alt={`${profile.firstName} ${index + 1}`} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="profile-section">
            <h3>Verification</h3>
            <div className="verification-items">
              {profile.verifications?.email ? (
                <div className="verification-item verified">
                  <span>✓ Email Verified</span>
                </div>
              ) : null}
              {profile.verifications?.phone ? (
                <div className="verification-item verified">
                  <span>✓ Phone Verified</span>
                </div>
              ) : null}
              {profile.verifications?.id ? (
                <div className="verification-item verified">
                  <span>✓ ID Verified</span>
                </div>
              ) : (
                <div className="verification-item pending">
                  <span>⚠ Add ID Verification</span>
                </div>
              )}
            </div>
          </div>

          <div className="profile-actions">
            <button onClick={() => setEditing(true)} className="btn-edit">
              Edit Profile
            </button>
            <button onClick={loadProfile} className="btn-cancel">
              Refresh
            </button>
            <button onClick={onLogout} className="btn-logout">
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatingProfile;
