import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from '../router';
import datingProfileService from '../services/datingProfileService';
import socialService from '../services/socialService';
import BlockReportModal from './BlockReportModal';
import DateJourneyPanel from './DateJourneyPanel';
import { getStoredUserData } from '../utils/auth';
import { buildLocalIdentityPack, buildTrustSummary } from '../utils/datingPhaseTwo';
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

const uniqueStrings = (values = []) => [...new Set(values.filter(Boolean))];

const formatCompatibilityFactorLabel = (value) =>
  String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

const buildIntentTemplates = ({ profile, compatibility, identityPack, matchExplanation }) =>
  uniqueStrings([
    compatibility?.icebreakers?.[0] || '',
    compatibility?.icebreakers?.[1] || '',
    identityPack?.languageIcebreakers?.[0] || '',
    identityPack?.cityBasedPrompts?.[0] || '',
    matchExplanation?.startConversation || '',
    profile?.relationshipGoals
      ? `I like that you're here for ${profile.relationshipGoals}. What does a good connection look like to you right now?`
      : ''
  ]).slice(0, 5);

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
  const [requestType, setRequestType] = useState('intent');
  const [requestPriority, setRequestPriority] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState('');
  const [subscription, setSubscription] = useState(null);
  const [compatibility, setCompatibility] = useState(null);
  const [matchExplanation, setMatchExplanation] = useState(null);
  const [compatibilityFactorsData, setCompatibilityFactorsData] = useState(null);
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
      setCompatibilityFactorsData(null);

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
            const [compatData, explanationData, factorData] = await Promise.all([
              datingProfileService.getCompatibility(resolvedProfileId),
              datingProfileService.getMatchExplanation(resolvedProfileId).catch(() => null),
              datingProfileService.getCompatibilityFactors(resolvedProfileId).catch(() => null)
            ]);
            if (!cancelled) {
              setCompatibility(compatData);
              setMatchExplanation(explanationData?.matchExplanation || explanationData?.explanation || null);
              setCompatibilityFactorsData(factorData || null);
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

  const canMessage = typeof onMessage === 'function' && Boolean(profile?.matchId);
  const canVideoCall = typeof onVideoCall === 'function' && Boolean(profile?.matchId);
  const canScheduleVideoCall =
    typeof onScheduleVideoCall === 'function' && Boolean(profile?.matchId);
  const activityHint = getProfileActivityHint(profile?.lastActive);
  const identityPack = useMemo(() => buildLocalIdentityPack(profile || {}), [profile]);
  const trustSummary = useMemo(() => buildTrustSummary({ profile: profile || {} }), [profile]);
  const intentTemplates = useMemo(
    () => buildIntentTemplates({ profile, compatibility, identityPack, matchExplanation }),
    [compatibility, identityPack, matchExplanation, profile]
  );
  const compatibilityFactorEntries = useMemo(
    () => Object.entries(compatibilityFactorsData?.factors || {}),
    [compatibilityFactorsData]
  );
  const supportsPriorityIntro = subscription?.isPremium || subscription?.isGold;
  const supportsDirectRequest = subscription?.isGold;

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
      setRequestSuccess('');
      const response = await datingProfileService.sendMessageRequest(profile.userId, requestMessage.trim(), {
        requestType,
        isPriority: requestPriority
      });
      setShowMessageRequest(false);
      setRequestMessage('');
      setRequestType('intent');
      setRequestPriority(false);
      setRequestSuccess(
        response?.message ||
          (requestType === 'message_request'
            ? 'Direct message request sent.'
            : requestPriority
              ? 'Priority intro sent.'
              : 'Intent sent.')
      );
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
        {requestSuccess ? (
          <div className="profile-inline-success" role="status">
            {requestSuccess}
          </div>
        ) : null}

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

        <div className="profile-section">
          <div className="section-header-row">
            <div>
              <h3>Local Identity Pack</h3>
              <p>Small local and cultural cues that make starting the right conversation easier.</p>
            </div>
            {identityPack.cityVibe ? (
              <span className="section-meta-pill">{identityPack.cityVibe}</span>
            ) : null}
          </div>

          {identityPack.culturalBadges.length > 0 ? (
            <div className="interests-list">
              {identityPack.culturalBadges.map((badge) => (
                <span key={badge.label} className={`interest-tag identity-tag ${badge.tone}`}>
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}

          {identityPack.cityBasedPrompts.length > 0 ? (
            <div className="compatibility-reasons">
              <p><strong>City prompts</strong></p>
              <ul>
                {identityPack.cityBasedPrompts.map((prompt) => (
                  <li key={prompt}>{prompt}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {identityPack.languageIcebreakers.length > 0 ? (
            <div className="icebreakers">
              <p><strong>Language-based openers</strong></p>
              <div className="icebreaker-list">
                {identityPack.languageIcebreakers.map((icebreaker) => (
                  <button
                    key={icebreaker}
                    type="button"
                    className="icebreaker-btn"
                    onClick={() => {
                      if (canMessage && onMessage) {
                        onMessage(profile, icebreaker);
                        return;
                      }

                      setShowMessageRequest(true);
                      setRequestMessage(icebreaker);
                    }}
                  >
                    {icebreaker}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {identityPack.localDateSuggestions.length > 0 ? (
            <div className="compatibility-reasons">
              <p><strong>Local date suggestions</strong></p>
              <ul>
                {identityPack.localDateSuggestions.map((idea) => (
                  <li key={`${idea.type}-${idea.title}`}>
                    <strong>{idea.title}</strong> {idea.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="profile-section">
          <div className="section-header-row">
            <div>
              <h3>Trust Snapshot</h3>
              <p>Clearer verification signals, photo readiness checks, and trust badges.</p>
            </div>
            <span className={`section-meta-pill trust-pill ${trustSummary.level}`}>
              {trustSummary.level === 'trusted'
                ? 'High trust'
                : trustSummary.level === 'strong'
                  ? 'Strong trust'
                  : trustSummary.level === 'pending'
                    ? 'Pending'
                    : trustSummary.level === 'basic'
                      ? 'Basic'
                      : 'New'}
            </span>
          </div>

          {trustSummary.badges.length > 0 ? (
            <div className="interests-list">
              {trustSummary.badges.map((badge) => (
                <span key={badge.label} className={`interest-tag trust-tag ${badge.tone}`}>
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}

          <div className="verification-items trust-ladder">
            {trustSummary.ladder.map((step) => (
              <div
                key={step.key}
                className={`verification-item ${step.completed ? 'verified' : 'pending'}`}
              >
                <span>{step.label}</span>
              </div>
            ))}
          </div>

          <div className="verification-items trust-photo-checks">
            {trustSummary.photoChecks.map((check) => (
              <div
                key={check.label}
                className={`verification-item ${check.passed ? 'verified' : 'pending'}`}
              >
                <strong>{check.label}</strong>
                <span>{check.detail}</span>
              </div>
            ))}
          </div>

          {trustSummary.warnings.length > 0 ? (
            <div className="compatibility-reasons">
              <p><strong>Heads up</strong></p>
              <ul>
                {trustSummary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
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

            {(Array.isArray(matchExplanation?.recommendations) && matchExplanation.recommendations.length > 0) ||
            (Array.isArray(matchExplanation?.factors) && matchExplanation.factors.length > 0) ||
            compatibilityFactorEntries.length > 0 ? (
              <div className="compatibility-deep-dive">
                <p><strong>Compatibility deep dive</strong></p>

                {Array.isArray(matchExplanation?.recommendations) && matchExplanation.recommendations.length > 0 ? (
                  <ul className="compatibility-deep-list">
                    {matchExplanation.recommendations.map((recommendation) => (
                      <li key={recommendation}>{recommendation}</li>
                    ))}
                  </ul>
                ) : null}

                {Array.isArray(matchExplanation?.factors) && matchExplanation.factors.length > 0 ? (
                  <div className="compatibility-tag-row">
                    {matchExplanation.factors.map((factor) => (
                      <span key={factor} className="compatibility-tag-pill">
                        {factor}
                      </span>
                    ))}
                  </div>
                ) : null}

                {compatibilityFactorEntries.length > 0 ? (
                  <div className="compatibility-factor-grid">
                    {compatibilityFactorEntries.map(([factorKey, factorValue]) => {
                      const score = typeof factorValue?.score === 'number'
                        ? Math.round(factorValue.score)
                        : factorValue === true
                          ? 100
                          : 0;

                      return (
                        <div key={factorKey} className="compatibility-factor-card">
                          <div className="compatibility-factor-top">
                            <strong>{formatCompatibilityFactorLabel(factorKey)}</strong>
                            <span>{score}%</span>
                          </div>
                          <div className="compatibility-factor-bar">
                            <div
                              className="compatibility-factor-fill"
                              style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                            />
                          </div>
                          {factorValue?.details ? (
                            <small>
                              {Array.isArray(factorValue.details)
                                ? factorValue.details.join(', ')
                                : typeof factorValue.details === 'object'
                                  ? Object.values(factorValue.details).filter(Boolean).join(', ')
                                  : factorValue.details}
                            </small>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
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
                          return;
                        }

                        setShowMessageRequest(true);
                        setRequestMessage(icebreaker);
                      }}
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
          ) : !profile.matchId ? (
            <button
              type="button"
              className="btn-edit"
              onClick={() => {
                setShowMessageRequest(true);
                setRequestSuccess('');
              }}
            >
              Send Direct Intent
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
            <h3>Direct Intent Message</h3>
            <p>
              Send one thoughtful note to {profile.firstName} before matching. Use this when you want
              more clarity than a passive like.
            </p>

            <div className="intent-capability-row">
              <span className="intent-capability-pill">
                {supportsPriorityIntro ? 'Priority intros available' : 'Free plan: 1 intro/day'}
              </span>
              <span className="intent-capability-pill">
                {supportsDirectRequest ? 'Gold direct message requests unlocked' : 'Gold unlocks direct message requests'}
              </span>
            </div>

            {supportsDirectRequest ? (
              <div className="intent-mode-row">
                <button
                  type="button"
                  className={`intent-mode-pill ${requestType === 'intent' ? 'active' : ''}`}
                  onClick={() => setRequestType('intent')}
                >
                  Intent intro
                </button>
                <button
                  type="button"
                  className={`intent-mode-pill ${requestType === 'message_request' ? 'active' : ''}`}
                  onClick={() => {
                    setRequestType('message_request');
                    setRequestPriority(false);
                  }}
                >
                  Direct message request
                </button>
              </div>
            ) : null}

            {intentTemplates.length > 0 ? (
              <div className="intent-template-list">
                {intentTemplates.map((template) => (
                  <button
                    key={template}
                    type="button"
                    className="intent-template-chip"
                    onClick={() => setRequestMessage(template)}
                  >
                    {template}
                  </button>
                ))}
              </div>
            ) : null}

            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder={
                requestType === 'message_request'
                  ? 'Write a clear, respectful direct message request (10-500 characters)...'
                  : 'Write a thoughtful intro (10-500 characters)...'
              }
              rows={4}
              maxLength={500}
            />
            {supportsPriorityIntro && requestType === 'intent' ? (
              <label className="date-feedback-toggle">
                <input
                  type="checkbox"
                  checked={requestPriority}
                  onChange={(event) => setRequestPriority(event.target.checked)}
                />
                <span>Send as a priority intro</span>
              </label>
            ) : null}
            <div className="request-actions">
              <span className="char-count">{requestMessage.length}/500</span>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  setShowMessageRequest(false);
                  setRequestType('intent');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-save"
                onClick={handleSendMessageRequest}
                disabled={sendingRequest || requestMessage.trim().length < 10}
              >
                {sendingRequest
                  ? 'Sending...'
                  : requestType === 'message_request'
                    ? 'Send Direct Message Request'
                    : requestPriority
                      ? 'Send Priority Intro'
                      : 'Send Intent'}
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
