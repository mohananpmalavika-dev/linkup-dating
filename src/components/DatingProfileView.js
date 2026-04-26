import React, { useEffect, useState } from 'react';
import datingProfileService from '../services/datingProfileService';
import '../styles/DatingProfile.css';

const DatingProfileView = ({ profile: initialProfile, profileId, onBack, onMessage, onVideoCall }) => {
  const [profile, setProfile] = useState(initialProfile || null);
  const [loading, setLoading] = useState(Boolean(initialProfile?.userId || profileId));
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const resolvedProfileId = initialProfile?.userId || profileId;

    const loadProfile = async () => {
      if (!resolvedProfileId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const latestProfile = await datingProfileService.getProfileById(resolvedProfileId);
        if (!cancelled) {
          setProfile((currentProfile) => ({
            ...(currentProfile || {}),
            ...latestProfile,
            matchId: currentProfile?.matchId || initialProfile?.matchId || latestProfile.matchId || null
          }));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError('Failed to load profile');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    setProfile(initialProfile || null);
    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [initialProfile, profileId]);

  if (loading && !profile) {
    return (
      <div className="profile-container loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container error">
        <p>{error || 'Profile not available'}</p>
        {onBack ? <button onClick={onBack}>Back</button> : null}
      </div>
    );
  }

  const canMessage = typeof onMessage === 'function' && Boolean(profile.matchId);
  const canVideoCall = typeof onVideoCall === 'function' && Boolean(profile.matchId);

  return (
    <div className="dating-profile-container">
      <div className="profile-view">
        <div className="profile-view-topbar">
          <button type="button" className="btn-back-inline" onClick={onBack}>
            Back
          </button>
          {error ? <span className="profile-inline-error">{error}</span> : null}
        </div>

        <div className="profile-header-section">
          {profile.photos?.length > 0 ? (
            <div className="profile-photo-main">
              <img src={profile.photos[0]} alt={profile.firstName} />
              {profile.profileVerified ? (
                <div className="verified-badge">Verified</div>
              ) : null}
            </div>
          ) : (
            <div className="profile-photo-main profile-photo-fallback">
              <span>{profile.firstName?.charAt(0) || '?'}</span>
            </div>
          )}
          <h1>{profile.firstName}, {profile.age}</h1>
          <p className="location">
            {profile.location?.city || 'Unknown city'}
            {profile.location?.state ? `, ${profile.location.state}` : ''}
          </p>
        </div>

        <div className="profile-section">
          <h3>About</h3>
          <p>{profile.bio || 'No bio added yet.'}</p>

          <div className="details-grid">
            {profile.relationshipGoals ? (
              <div className="detail">
                <span className="label">Looking For</span>
                <span className="value">{profile.relationshipGoals}</span>
              </div>
            ) : null}
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
          </div>
        </div>

        {profile.interests?.length ? (
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

        <div className="profile-actions">
          {canMessage ? (
            <button type="button" className="btn-edit" onClick={() => onMessage(profile)}>
              Open Chat
            </button>
          ) : null}
          {canVideoCall ? (
            <button type="button" className="btn-save" onClick={() => onVideoCall(profile)}>
              Start Video Call
            </button>
          ) : null}
          <button type="button" className="btn-cancel" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatingProfileView;
