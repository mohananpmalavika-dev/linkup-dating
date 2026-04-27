import React, { useEffect, useState } from 'react';
import { useLocation } from '../router';
import datingProfileService from '../services/datingProfileService';
import socialService from '../services/socialService';
import BlockReportModal from './BlockReportModal';
import DateJourneyPanel from './DateJourneyPanel';
import { getStoredUserData } from '../utils/auth';
import '../styles/DatingProfile.css';

const getProfileActivityHint = (lastActive) => {
  if (!lastActive) {
    return null;
  }

  const elapsedMinutes = Math.floor((Date.now() - new Date(lastActive).getTime()) / 60000);

  if (elapsedMinutes <= 5) {
    return { label: 'Online now', tone: 'online' };
  }

  if (elapsedMinutes <= 60 * 24) {
    return { label: 'Active recently', tone: 'recent' };
  }

  if (elapsedMinutes <= 60 * 24 * 7) {
    return { label: 'Active this week', tone: 'week' };
  }

  return null;
};

const SOCIAL_PLATFORM_LABELS = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  twitter: 'Twitter',
  facebook: 'Facebook'
};

const buildPublicSocialUrl = (platform, username, fallbackUrl) => {
  if (fallbackUrl) {
    return fallbackUrl;
  }

  const normalizedUsername = String(username || '').replace(/^@+/, '');
  if (!normalizedUsername) {
    return '#';
  }

  switch (platform) {
    case 'instagram':
      return `https://www.instagram.com/${normalizedUsername}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${normalizedUsername}`;
    case 'twitter':
      return `https://x.com/${normalizedUsername}`;
    case 'facebook':
      return `https://www.facebook.com/${normalizedUsername}`;
    default:
      return '#';
  }
};

const DatingProfileView = ({
  profile: initialProfile,
  profileId,
  onBack,
  onMessage,
  onScheduleVideoCall,
  onVideoCall
}) => {
  const location = useLocation();
  const currentUser = getStoredUserData();
  const currentUserId = currentUser?.id;
  const [profile, setProfile] = useState(initialProfile || null);
  const [loading, setLoading] = useState(Boolean(initialProfile?.userId || profileId));
  const [error, setError] = useState('');
  const [showBlockReportModal, setShowBlockReportModal] = useState(false);
  const [showMessageRequest, setShowMessageRequest] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [compatibility, setCompatibility] = useState(null);
  const [matchExplanation, setMatchExplanation] = useState(null);
  const [loadingCompatibility, setLoadingCompatibility] = useState(false);
  const [showDatePlanner, setShowDatePlanner] = useState(Boolean(location.state?.focusPlanner));
  const [publicSocialProfiles, setPublicSocialProfiles] = useState([]);
  const [friendshipStatus, setFriendshipStatus] = useState(null);
  const [friendActionLoading, setFriendActionLoading] = useState(false);

  useEffect(() => {
    setShowDatePlanner(Boolean(location.state?.focusPlanner));
  }, [location.state?.focusPlanner]);

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
      setMatchExplanation(null);

      try {
        const [latestProfile, subData, publicLinks, friendStatus] = await Promise.all([
          datingProfileService.getProfileById(resolvedProfileId),
          datingProfileService.getMySubscription().catch(() => ({ plan: 'free', isGold: false })),
          socialService.getPublicSocialProfiles(resolvedProfileId).catch(() => []),
          Number(currentUserId) !== Number(resolvedProfileId)
            ? socialService.getFriendStatus(resolvedProfileId).catch(() => null)
            : Promise.resolve({ status: 'self', canSendRequest: false })
        ]);

        // Record profile view and load compatibility
        if (!cancelled) {
          setProfile((currentProfile) => ({
            ...(currentProfile || {}),
            ...latestProfile,
            matchId: currentProfile?.matchId || initialProfile?.matchId || latestProfile.matchId || null
          }));
          setSubscription(subData);
          setPublicSocialProfiles(Array.isArray(publicLinks) ? publicLinks : []);
          setFriendshipStatus(friendStatus);

          // Load compatibility score
          setLoadingCompatibility(true);
          try {
            const [compatData, explanationData] = await Promise.all([
              datingProfileService.getCompatibility(resolvedProfileId),
              datingProfileService.getMatchExplanation(resolvedProfileId).catch(() => null)
            ]);
            if (!cancelled) {
              setCompatibility(compatData);
              setMatchExplanation(explanationData?.explanation || null);
            }
            datingProfileService.trackFunnelEvent('dating_compatibility_viewed', {
              context: {
                viewedUserId: resolvedProfileId
              }
            }).catch(() => {});
          } catch (compatErr) {
            console.error('Failed to load compatibility:', compatErr);
          } finally {
            if (!cancelled) {
              setLoadingCompatibility(false);
            }
          }

          // Record profile view (fire and forget)
          datingProfileService.recordProfileView(resolvedProfileId).catch(() => {});
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
  }, [currentUserId, initialProfile, profileId]);

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
  const canScheduleVideoCall =
    typeof onScheduleVideoCall === 'function' && Boolean(profile.matchId);
  const activityHint = getProfileActivityHint(profile.lastActive);

  const handleBlockUser = async (userId) => {
    try {
      await datingProfileService.blockUser(userId);
      setShowBlockReportModal(false);
      alert('User blocked successfully');
      onBack();
    } catch (err) {
      throw err;
    }
  };

  const handleReportUser = async (userId, reason, description) => {
    try {
      await datingProfileService.reportUser(userId, reason, description);
      setShowBlockReportModal(false);
    } catch (err) {
      throw err;
    }
  };

  const handleSendMessageRequest = async () => {
    if (!requestMessage.trim() || requestMessage.trim().length < 10) {
      setError('Message must be at least 10 characters');
      return;
    }

    try {
      setSendingRequest(true);
      setError('');
      await datingProfileService.sendMessageRequest(profile.userId, requestMessage.trim());
      setShowMessageRequest(false);
      setRequestMessage('');
      alert('Message request sent successfully!');
    } catch (err) {
      setError(err || 'Failed to send message request');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!profile?.userId) {
      return;
    }

    try {
      setFriendActionLoading(true);
      setError('');
      const response = await socialService.sendFriendRequest(profile.userId);
      setFriendshipStatus({
        status: 'outgoing_pending',
        canSendRequest: false,
        friendshipId: response.friendshipId || response.id,
        friendship_id: response.friendshipId || response.id
      });
    } catch (err) {
      setError(err || 'Failed to send friend request');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    const friendshipId = friendshipStatus?.friendshipId || friendshipStatus?.friendship_id;
    if (!friendshipId) {
      return;
    }

    try {
      setFriendActionLoading(true);
      setError('');
      await socialService.acceptFriendRequest(friendshipId);
      setFriendshipStatus({
        status: 'accepted',
        canSendRequest: false,
        friendshipId,
        friendship_id: friendshipId
      });
    } catch (err) {
      setError(err || 'Failed to accept friend request');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const isOwnProfile = Number(currentUserId) === Number(profile.userId);
  const friendshipState = friendshipStatus?.status || (isOwnProfile ? 'self' : 'none');
  const showFriendAction = !isOwnProfile && Boolean(profile.userId);

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
          <div className="profile-header-meta">
            {activityHint ? (
              <span className={`activity-chip ${activityHint.tone}`}>{activityHint.label}</span>
            ) : null}
            {profile.voiceIntroUrl ? (
              <span className="voice-intro-chip">Voice intro available</span>
            ) : null}
          </div>
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

        {profile.voiceIntroUrl ? (
          <div className="profile-section voice-intro-section">
            <div className="section-header-row">
              <div>
                <h3>Voice Intro</h3>
                <p>
                  Hear a short intro before you decide how you want to start the conversation.
                </p>
              </div>
              {profile.voiceIntroDurationSeconds ? (
                <span className="section-meta-pill">{profile.voiceIntroDurationSeconds}s</span>
              ) : null}
            </div>
            <audio controls preload="none" className="voice-intro-player" src={profile.voiceIntroUrl}>
              Your browser does not support audio playback.
            </audio>
          </div>
        ) : null}

        {/* Compatibility Score Section */}
        {compatibility && !compatibility.isExcluded ? (
          <div className="profile-section compatibility-section">
            <h3>💫 Compatibility</h3>
            <div className="compatibility-score-ring">
              <div
                className="compatibility-score"
                style={{
                  color: compatibility.compatibilityScore >= 80 ? '#4caf50' :
                         compatibility.compatibilityScore >= 60 ? '#8bc34a' :
                         compatibility.compatibilityScore >= 40 ? '#ffc107' : '#ff9800'
                }}
              >
                {compatibility.compatibilityScore}%
              </div>
              <span className="compatibility-label">Match Score</span>
            </div>

            {/* Mutual Interests */}
            {compatibility.mutualInterests?.count > 0 ? (
              <div className="mutual-interests">
                <p className="mutual-interests-header">
                  <strong>🤝 {compatibility.mutualInterests.percentage}% Interests Match</strong>
                  <span>({compatibility.mutualInterests.count} shared)</span>
                </p>
                <div className="mutual-interests-tags">
                  {compatibility.mutualInterests.interests.map((interest) => (
                    <span key={interest} className="mutual-interest-tag">{interest}</span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="no-mutual-interests">No shared interests yet</p>
            )}

            {/* Compatibility Reasons */}
            {compatibility.compatibilityReasons?.length > 0 ? (
              <div className="compatibility-reasons">
                <p><strong>Why you match:</strong></p>
                <ul>
                  {compatibility.compatibilityReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Icebreakers */}
            {compatibility.icebreakers?.length > 0 && !compatibility.isMatched ? (
              <div className="icebreakers">
                <p><strong>💬 Conversation Starters:</strong></p>
                <div className="icebreaker-list">
                  {compatibility.icebreakers.map((icebreaker, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="icebreaker-btn"
                      onClick={() => {
                        if (canMessage && onMessage) {
                          onMessage(profile, icebreaker);
                        }
                      }}
                      disabled={!canMessage}
                    >
                      {icebreaker}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : loadingCompatibility ? (
          <div className="profile-section">
            <p>Loading compatibility...</p>
          </div>
        ) : null}

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

        {publicSocialProfiles.length > 0 ? (
          <div className="profile-section social-links-section">
            <div className="section-header-row">
              <div>
                <h3>Public social links</h3>
                <p>These handles were shared intentionally on this profile.</p>
              </div>
            </div>

            <div className="public-social-links">
              {publicSocialProfiles.map((socialLink) => {
                const isPublic = socialLink.isPublic ?? socialLink.is_public;
                if (!isPublic) {
                  return null;
                }

                const platform = socialLink.platform || 'social';
                const username = socialLink.username || '';

                return (
                  <a
                    key={socialLink.id}
                    className="public-social-link"
                    href={buildPublicSocialUrl(platform, username, socialLink.profileUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <strong>{SOCIAL_PLATFORM_LABELS[platform] || platform}</strong>
                    <span>@{username}</span>
                  </a>
                );
              })}
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
          {showFriendAction && friendshipState === 'none' ? (
            <button
              type="button"
              className="btn-save"
              onClick={handleSendFriendRequest}
              disabled={friendActionLoading}
            >
              {friendActionLoading ? 'Sending...' : 'Add Friend'}
            </button>
          ) : null}
          {showFriendAction && friendshipState === 'incoming_pending' ? (
            <button
              type="button"
              className="btn-save"
              onClick={handleAcceptFriendRequest}
              disabled={friendActionLoading}
            >
              {friendActionLoading ? 'Saving...' : 'Accept Friend Request'}
            </button>
          ) : null}
          {showFriendAction && friendshipState === 'outgoing_pending' ? (
            <button type="button" className="btn-cancel" disabled>
              Friend Request Sent
            </button>
          ) : null}
          {showFriendAction && friendshipState === 'accepted' ? (
            <button type="button" className="btn-cancel" disabled>
              Friends on LinkUp
            </button>
          ) : null}
          {canMessage ? (
            <button type="button" className="btn-edit" onClick={() => onMessage(profile)}>
              Open Chat
            </button>
          ) : subscription?.isGold && !profile.matchId ? (
            <button
              type="button"
              className="btn-edit"
              onClick={() => setShowMessageRequest(true)}
            >
              💌 Send Message Request
            </button>
          ) : null}
          {profile.matchId ? (
            <button
              type="button"
              className="btn-edit"
              onClick={() => setShowDatePlanner((currentValue) => !currentValue)}
            >
              {showDatePlanner ? 'Hide Date Plan' : 'Plan a Date'}
            </button>
          ) : null}
          {canScheduleVideoCall ? (
            <button
              type="button"
              className="btn-edit"
              onClick={() => onScheduleVideoCall(profile, location.pathname)}
            >
              Schedule Call
            </button>
          ) : null}
          {canVideoCall ? (
            <button
              type="button"
              className="btn-save"
              onClick={() => onVideoCall(profile, location.pathname)}
            >
              Start Video Call
            </button>
          ) : null}
          <button type="button" className="btn-more-actions" onClick={() => setShowBlockReportModal(true)} title="Block or Report">
            ⋮
          </button>
          <button type="button" className="btn-cancel" onClick={onBack}>
            Back
          </button>
        </div>

        {showDatePlanner && profile.matchId ? (
          <div className="profile-section">
            <DateJourneyPanel
              matchId={profile.matchId}
              match={profile}
              onScheduleVideoCall={(resolvedMatch) => onScheduleVideoCall?.(resolvedMatch, location.pathname)}
            />
          </div>
        ) : null}

        {showMessageRequest && (
          <div className="profile-section message-request-form">
            <h3>Send Message Request</h3>
            <p>Send a message to {profile.firstName} without matching. They can accept or decline.</p>
            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Write a thoughtful message (10-500 characters)..."
              rows={4}
              maxLength={500}
            />
            <div className="request-actions">
              <span className="char-count">{requestMessage.length}/500</span>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowMessageRequest(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-save"
                onClick={handleSendMessageRequest}
                disabled={sendingRequest || requestMessage.trim().length < 10}
              >
                {sendingRequest ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        )}

        {showBlockReportModal && (
          <BlockReportModal
            profile={profile}
            onClose={() => setShowBlockReportModal(false)}
            onBlock={handleBlockUser}
            onReport={handleReportUser}
          />
        )}
      </div>
    </div>
  );
};

export default DatingProfileView;
