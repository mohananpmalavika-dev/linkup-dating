import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await datingProfileService.getMyProfile();
      setProfile(data);
      setEditData(data);
    } catch (err) {
      setError('Failed to load profile');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await datingProfileService.updateProfile(editData);
      setProfile(editData);
      setEditing(false);
    } catch (err) {
      setError('Failed to save profile');
      console.error(err);
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
        // Edit Mode
        <div className="profile-edit">
          <h2>Edit Profile</h2>
          <div className="form-group">
            <label>Bio</label>
            <textarea
              value={editData.bio}
              onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
              placeholder="Tell about yourself"
            ></textarea>
          </div>
          <div className="form-group">
            <label>Interests</label>
            <input
              type="text"
              value={editData.interests?.join(', ')}
              onChange={(e) => setEditData({ ...editData, interests: e.target.value.split(',').map(i => i.trim()) })}
              placeholder="Separate with commas"
            />
          </div>
          <div className="button-group">
            <button onClick={() => setEditing(false)} className="btn-cancel">Cancel</button>
            <button onClick={handleSaveProfile} className="btn-save">Save Changes</button>
          </div>
        </div>
      ) : (
        // View Mode
        <div className="profile-view">
          {/* Header */}
          <div className="profile-header-section">
            {profile.photos && profile.photos.length > 0 && (
              <div className="profile-photo-main">
                <img src={profile.photos[0]} alt={profile.firstName} />
                {profile.profileVerified && (
                  <div className="verified-badge">✓ Verified</div>
                )}
              </div>
            )}
            <h1>{profile.firstName}, {profile.age}</h1>
            <p className="location">📍 {profile.location?.city}, {profile.location?.state}</p>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">27</span>
              <span className="stat-label">Likes</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">12</span>
              <span className="stat-label">Matches</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">89%</span>
              <span className="stat-label">Profile</span>
            </div>
          </div>

          {/* About */}
          <div className="profile-section">
            <h3>About</h3>
            <p>{profile.bio}</p>

            <div className="details-grid">
              {profile.occupation && (
                <div className="detail">
                  <span className="label">Occupation</span>
                  <span className="value">{profile.occupation}</span>
                </div>
              )}
              {profile.education && (
                <div className="detail">
                  <span className="label">Education</span>
                  <span className="value">{profile.education}</span>
                </div>
              )}
              {profile.height && (
                <div className="detail">
                  <span className="label">Height</span>
                  <span className="value">{profile.height} cm</span>
                </div>
              )}
              {profile.relationshipGoals && (
                <div className="detail">
                  <span className="label">Looking For</span>
                  <span className="value">{profile.relationshipGoals}</span>
                </div>
              )}
            </div>
          </div>

          {/* Interests */}
          {profile.interests && profile.interests.length > 0 && (
            <div className="profile-section">
              <h3>Interests</h3>
              <div className="interests-list">
                {profile.interests.map((interest, idx) => (
                  <span key={idx} className="interest-tag">{interest}</span>
                ))}
              </div>
            </div>
          )}

          {/* Photos Gallery */}
          {profile.photos && profile.photos.length > 1 && (
            <div className="profile-section">
              <h3>Photos</h3>
              <div className="photos-gallery">
                {profile.photos.map((photo, idx) => (
                  <img key={idx} src={photo} alt={`Photo ${idx + 1}`} />
                ))}
              </div>
            </div>
          )}

          {/* Verification Status */}
          <div className="profile-section">
            <h3>Verification</h3>
            <div className="verification-items">
              {profile.verifications?.email && (
                <div className="verification-item verified">
                  <span>✓ Email Verified</span>
                </div>
              )}
              {profile.verifications?.phone && (
                <div className="verification-item verified">
                  <span>✓ Phone Verified</span>
                </div>
              )}
              {profile.verifications?.id && (
                <div className="verification-item verified">
                  <span>✓ ID Verified</span>
                </div>
              )}
              {!profile.verifications?.id && (
                <div className="verification-item pending">
                  <span>⚠ Add ID Verification</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="profile-actions">
            <button onClick={() => setEditing(true)} className="btn-edit">
              Edit Profile
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
