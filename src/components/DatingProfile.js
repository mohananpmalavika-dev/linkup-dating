import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '../router';
import datingProfileService from '../services/datingProfileService';
import '../styles/DatingProfile.css';

const normalizeInterests = (interests) => (Array.isArray(interests) ? interests : []);

const getPhotoUrl = (photo) => {
  if (!photo) {
    return '';
  }

  if (typeof photo === 'string') {
    return photo;
  }

  return photo.photoUrl || photo.photo_url || photo.url || '';
};

const getProfileLocation = (profile) => {
  if (typeof profile?.location === 'string' && profile.location.trim()) {
    return profile.location;
  }

  const city = profile?.location?.city || profile?.city || 'Unknown city';
  const state = profile?.location?.state || profile?.state || '';

  return state ? `${city}, ${state}` : city;
};

const formatValue = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ');
  }

  return value || '';
};

const hydrateEditData = (profileData) => ({
  ...profileData,
  bio: profileData?.bio || '',
  interests: normalizeInterests(profileData?.interests),
  relationshipGoals: formatValue(profileData?.relationshipGoals)
});

const DatingProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [editData, setEditData] = useState(null);
  const [stats, setStats] = useState({
    likes: 0,
    matches: 0,
    completion: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [profileData, matchesData, likesData, completionData] = await Promise.all([
        datingProfileService.getMyProfile(),
        datingProfileService.getMatches(100).catch(() => ({ matches: [] })),
        datingProfileService.getLikesReceived(100).catch(() => []),
        datingProfileService.getProfileCompletion().catch(() => ({}))
      ]);

      setProfile(profileData);
      setEditData(hydrateEditData(profileData));
      setStats({
        likes: Array.isArray(likesData) ? likesData.length : 0,
        matches: matchesData.matches?.length || 0,
        completion: completionData.profileCompletionPercent || profileData?.profileCompletionPercent || 0
      });
    } catch (loadError) {
      setError('Failed to load profile');
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const completionChecklist = useMemo(() => [
    {
      key: 'bio',
      label: 'Add a short bio',
      done: Boolean(profile?.bio && profile.bio.trim()),
      hint: 'A few honest lines help matches understand you faster.'
    },
    {
      key: 'photos',
      label: 'Add at least 3 photos',
      done: Array.isArray(profile?.photos) && profile.photos.length >= 3,
      hint: 'Use clear, recent photos so your profile feels trustworthy.'
    },
    {
      key: 'interests',
      label: 'Add interests',
      done: normalizeInterests(profile?.interests).length > 0,
      hint: 'Interests make discovery and conversation starters better.'
    },
    {
      key: 'goals',
      label: 'Set relationship goals',
      done: Boolean(formatValue(profile?.relationshipGoals)),
      hint: 'Let people know what kind of connection you want.'
    },
    {
      key: 'verification',
      label: 'Verify your profile',
      done: Boolean(profile?.profileVerified || profile?.verifications?.id),
      hint: 'Verification helps people feel safer saying hello.'
    }
  ], [profile]);

  const completedSteps = completionChecklist.filter((item) => item.done).length;
  const completionPercent = Math.round((completedSteps / completionChecklist.length) * 100);
  const missingSteps = completionChecklist.filter((item) => !item.done);
  const photos = normalizeInterests(profile?.photos).map(getPhotoUrl).filter(Boolean);
  const primaryPhoto = photos[0];
  const relationshipGoals = formatValue(profile?.relationshipGoals);
  const displayedCompletion = stats.completion || completionPercent;

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setError('');

      const response = await datingProfileService.updateProfile({
        bio: editData.bio,
        interests: normalizeInterests(editData.interests),
        relationshipGoals: editData.relationshipGoals
      });

      const nextProfile = response?.profile || {
        ...profile,
        bio: editData.bio,
        interests: normalizeInterests(editData.interests),
        relationshipGoals: editData.relationshipGoals
      };

      setProfile(nextProfile);
      setEditData(hydrateEditData(nextProfile));
      setStats((currentStats) => ({
        ...currentStats,
        completion: response?.profile?.profileCompletionPercent || currentStats.completion
      }));
      setEditing(false);
    } catch (saveError) {
      setError('Failed to save profile');
      console.error(saveError);
    } finally {
      setSaving(false);
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
        <p>{error || 'Profile unavailable'}</p>
        <button type="button" onClick={loadProfile}>Retry</button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="dating-profile-container">
        <div className="profile-edit">
          <h2>Edit Profile</h2>

          {error ? <p className="profile-inline-error">{error}</p> : null}

          <div className="form-group">
            <label htmlFor="profile-bio">Bio</label>
            <textarea
              id="profile-bio"
              value={editData.bio || ''}
              onChange={(event) => setEditData({ ...editData, bio: event.target.value })}
              placeholder="Tell people about yourself"
            />
          </div>

          <div className="form-group">
            <label htmlFor="profile-interests">Interests</label>
            <input
              id="profile-interests"
              type="text"
              value={normalizeInterests(editData.interests).join(', ')}
              onChange={(event) => setEditData({
                ...editData,
                interests: event.target.value
                  .split(',')
                  .map((interest) => interest.trim())
                  .filter(Boolean)
              })}
              placeholder="Music, travel, food"
            />
          </div>

          <div className="form-group">
            <label htmlFor="profile-goals">Relationship Goals</label>
            <input
              id="profile-goals"
              type="text"
              value={editData.relationshipGoals || ''}
              onChange={(event) => setEditData({ ...editData, relationshipGoals: event.target.value })}
              placeholder="Dating, relationship, marriage"
            />
          </div>

          <div className="button-group">
            <button type="button" onClick={() => setEditing(false)} className="btn-cancel">
              Cancel
            </button>
            <button type="button" onClick={handleSaveProfile} className="btn-save" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dating-profile-container">
      <div className="profile-view simple-profile-view">
        <div className="profile-header-section simple-profile-header">
          <div className="profile-photo-main">
            {primaryPhoto ? (
              <img src={primaryPhoto} alt={profile.firstName || 'Profile'} />
            ) : (
              <div className="profile-photo-fallback">
                <span>{profile.firstName?.charAt(0) || '?'}</span>
              </div>
            )}
            {profile.profileVerified ? (
              <div className="verified-badge">Verified</div>
            ) : null}
          </div>

          <div className="simple-profile-heading">
            <h1>{profile.firstName || 'Your profile'}{profile.age ? `, ${profile.age}` : ''}</h1>
            <p className="location">{getProfileLocation(profile)}</p>
          </div>

          <div className="profile-header-actions">
            <button type="button" onClick={() => setEditing(true)} className="btn-edit">
              Edit Profile
            </button>
            <button type="button" onClick={() => navigate('/more')} className="btn-cancel">
              More
            </button>
          </div>
        </div>

        <div className="stats-grid simple-stats-grid">
          <div className="stat-item">
            <span className="stat-value">{stats.likes}</span>
            <span className="stat-label">Likes</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.matches}</span>
            <span className="stat-label">Matches</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{displayedCompletion}%</span>
            <span className="stat-label">Complete</span>
          </div>
        </div>

        {error ? (
          <div className="profile-section">
            <p className="profile-inline-error">{error}</p>
          </div>
        ) : null}

        <div className="profile-section completion-section simple-completion-section">
          <div className="completion-header">
            <div>
              <h3>Profile checklist</h3>
              <p>
                {completionPercent >= 100
                  ? 'Your profile is ready for discovery.'
                  : `${completedSteps} of ${completionChecklist.length} important steps complete.`}
              </p>
            </div>
            <div className="completion-pill">{completionPercent}%</div>
          </div>

          <div className="completion-bar" aria-hidden="true">
            <div className="completion-bar-fill" style={{ width: `${completionPercent}%` }}></div>
          </div>

          {missingSteps.length > 0 ? (
            <div className="completion-list simple-completion-list">
              {missingSteps.slice(0, 3).map((item) => (
                <div key={item.key} className="completion-item">
                  <div className="completion-item-icon">*</div>
                  <div className="completion-item-copy">
                    <strong>{item.label}</strong>
                    <span>{item.hint}</span>
                  </div>
                </div>
              ))}
              <button type="button" className="section-link-btn simple-inline-action" onClick={() => setEditing(true)}>
                Improve profile
              </button>
            </div>
          ) : (
            <div className="completion-all-done">
              Nice work. Your key profile details are complete.
            </div>
          )}
        </div>

        <div className="profile-section">
          <h3>About</h3>
          <p>{profile.bio || 'Add a short bio so people can get to know you.'}</p>

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
            {relationshipGoals ? (
              <div className="detail">
                <span className="label">Looking For</span>
                <span className="value">{relationshipGoals}</span>
              </div>
            ) : null}
          </div>
        </div>

        {normalizeInterests(profile.interests).length > 0 ? (
          <div className="profile-section">
            <h3>Interests</h3>
            <div className="interests-list">
              {normalizeInterests(profile.interests).map((interest) => (
                <span key={interest} className="interest-tag">{interest}</span>
              ))}
            </div>
          </div>
        ) : null}

        {photos.length > 1 ? (
          <div className="profile-section">
            <h3>Photos</h3>
            <div className="photos-gallery">
              {photos.map((photo, index) => (
                <img key={`${photo}-${index}`} src={photo} alt={`${profile.firstName || 'Profile'} ${index + 1}`} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="profile-section profile-manage-section">
          <div className="section-header-row">
            <div>
              <h3>Manage</h3>
              <p>Keep profile editing here. Everything else lives in More.</p>
            </div>
          </div>

          <div className="profile-action-grid">
            <button type="button" className="profile-action-card" onClick={() => setEditing(true)}>
              <strong>Edit Profile</strong>
              <span>Bio, interests, and goals</span>
            </button>
            <button type="button" className="profile-action-card" onClick={() => navigate('/account-settings')}>
              <strong>Account Settings</strong>
              <span>Privacy, notifications, and legal</span>
            </button>
            <button type="button" className="profile-action-card" onClick={() => navigate('/more')}>
              <strong>More Tools</strong>
              <span>Boosts, analytics, safety, referrals</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatingProfile;
