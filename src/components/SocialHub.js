import React, { useEffect, useState } from 'react';
import FriendsList from './FriendsList';
import ReferralShareModal from './ReferralShareModal';
import SocialIntegration from './SocialIntegration';
import socialService from '../services/socialService';
import '../styles/SocialHub.css';

const buildFriendProfileContext = (friend) => ({
  userId: friend.friendId || friend.friend_id,
  firstName: friend.firstName || friend.first_name || friend.displayName || '',
  photos: friend.photoUrl || friend.photo_url ? [friend.photoUrl || friend.photo_url] : [],
  location: {
    city: friend.locationCity || friend.location_city || ''
  }
});

const buildReferralProfileContext = (referral) => ({
  userId: referral.referredUserId || referral.referred_user_id,
  firstName: referral.referredFirstName || referral.referred_first_name || '',
  age: referral.referredAge || referral.referred_age || null,
  photos: referral.referredPhotoUrl || referral.referred_photo_url ? [referral.referredPhotoUrl || referral.referred_photo_url] : [],
  location: {
    city: referral.referredLocationCity || referral.referred_location_city || ''
  }
});

const SocialHub = ({
  onMatchCreated,
  onBrowseChatrooms,
  onOpenLobby,
  onOpenChatroom,
  onOpenProfile
}) => {
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [requestActionId, setRequestActionId] = useState(null);
  const [introductionActionId, setIntroductionActionId] = useState(null);
  const [roomActionSlug, setRoomActionSlug] = useState('');
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showSocialLinksModal, setShowSocialLinksModal] = useState(false);

  const loadHub = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await socialService.getHub();
      setHub(data);
    } catch (err) {
      setError(err || 'Failed to load social hub');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHub();
  }, []);

  const handleAcceptFriend = async (friendshipId) => {
    setRequestActionId(friendshipId);
    setActionError('');

    try {
      await socialService.acceptFriendRequest(friendshipId);
      await loadHub();
    } catch (err) {
      setActionError(err || 'Failed to accept friend request');
    } finally {
      setRequestActionId(null);
    }
  };

  const handleDeclineFriend = async (friendshipId) => {
    setRequestActionId(friendshipId);
    setActionError('');

    try {
      await socialService.declineFriendRequest(friendshipId);
      await loadHub();
    } catch (err) {
      setActionError(err || 'Failed to decline friend request');
    } finally {
      setRequestActionId(null);
    }
  };

  const handleAcceptIntroduction = async (referralId) => {
    setIntroductionActionId(referralId);
    setActionError('');

    try {
      await socialService.acceptDatingReferral(referralId);
      onMatchCreated?.();
      await loadHub();
    } catch (err) {
      setActionError(err || 'Failed to accept introduction');
    } finally {
      setIntroductionActionId(null);
    }
  };

  const handleJoinRoom = async (roomSlug) => {
    setRoomActionSlug(roomSlug);
    setActionError('');

    try {
      const result = await socialService.joinCommunityRoom(roomSlug);
      const chatroomId = result.chatroomId || result.chatroom_id;
      if (chatroomId) {
        onOpenChatroom?.(chatroomId);
      }
      await loadHub();
    } catch (err) {
      setActionError(err || 'Failed to join room');
    } finally {
      setRoomActionSlug('');
    }
  };

  const handleCopyReferralCode = async () => {
    if (!hub?.referral?.code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(hub.referral.code);
    } catch (err) {
      setActionError('Failed to copy referral code');
    }
  };

  const handleViewFriendProfile = (friend) => {
    onOpenProfile?.(buildFriendProfileContext(friend));
  };

  const handleViewReferralProfile = (referral) => {
    onOpenProfile?.(buildReferralProfileContext(referral));
  };

  if (loading) {
    return (
      <div className="social-hub-page">
        <div className="social-hub-shell social-hub-loading">
          <div className="spinner"></div>
          <p>Loading your social hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="social-hub-page">
      <div className="social-hub-shell">
        <section className="social-hero-card">
          <div>
            <p className="social-eyebrow">Warm-up layer</p>
            <h1>Dating-first spaces that support matching</h1>
            <p className="social-hero-copy">
              Keep referrals, profile links, friend energy, and gated warm-up spaces close by without turning LinkUp into a general social app.
            </p>
            <div className="social-hero-actions">
              <button type="button" className="social-btn social-btn-hero" onClick={() => onBrowseChatrooms?.()}>
                Browse chatrooms
              </button>
              <button type="button" className="social-btn social-btn-muted social-btn-hero-alt" onClick={() => onOpenLobby?.()}>
                Open lobby
              </button>
            </div>
          </div>
          <div className="social-hero-stats">
            <div className="hero-stat">
              <strong>{hub?.summary?.totalFriends || 0}</strong>
              <span>Friends</span>
            </div>
            <div className="hero-stat">
              <strong>{hub?.summary?.totalPendingIncoming || 0}</strong>
              <span>Pending</span>
            </div>
            <div className="hero-stat">
              <strong>{hub?.summary?.totalIntroductions || 0}</strong>
              <span>Introductions</span>
            </div>
          </div>
        </section>

        {error ? <div className="social-banner social-error">{error}</div> : null}
        {actionError ? <div className="social-banner social-warning">{actionError}</div> : null}

        <section className="social-card-grid">
          <article className="social-card">
            <div className="social-card-header">
              <div>
                <h2>Warm-up spaces</h2>
                <p>Small, gated rooms built to warm people into dating intent before a match begins.</p>
              </div>
              <button type="button" className="social-link-button" onClick={() => onBrowseChatrooms?.()}>
                View all rooms
              </button>
            </div>

            <div className="chat-spaces-actions">
              <button type="button" className="social-btn" onClick={() => onBrowseChatrooms?.()}>
                Browse chatrooms
              </button>
              <button type="button" className="social-btn social-btn-muted chat-spaces-secondary" onClick={() => onOpenLobby?.()}>
                Open lobby
              </button>
            </div>

            {hub?.communityRooms?.length ? (
              <div className="room-list">
                {hub.communityRooms.map((room) => {
                  const isBusy = roomActionSlug === room.slug;
                  const isMember = room.isMember || room.is_member;

                  return (
                    <div key={room.slug} className="room-card">
                      <div>
                        <strong>{room.name}</strong>
                        <p>{room.description}</p>
                        {room.warmUpPrompt ? <p>{room.warmUpPrompt}</p> : null}
                        {room.audioPrompt ? <p>{room.audioPrompt}</p> : null}
                        <span className="room-meta">{room.memberCount || room.member_count || 0} members</span>
                        {room.eligibility?.blockers?.length ? (
                          <span className="room-meta">{room.eligibility.blockers[0]}</span>
                        ) : null}
                        {room.datingIntentOnly ? (
                          <span className="visibility-pill private">Dating intent only</span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="social-btn"
                        onClick={() => {
                          if (isMember && (room.chatroomId || room.chatroom_id)) {
                            onOpenChatroom?.(room.chatroomId || room.chatroom_id);
                            return;
                          }

                          handleJoinRoom(room.slug);
                        }}
                        disabled={isBusy || room.eligibility?.canJoin === false}
                      >
                        {isBusy ? 'Opening...' : isMember ? 'Open room' : room.eligibility?.canJoin === false ? 'Finish profile' : 'Join room'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="social-empty">Community room suggestions will show up after we learn more about your profile.</p>
            )}

            <div className="lobby-card">
              <div>
                <strong>Why these stay gated</strong>
                <p>Warm-up spaces are intentionally small, private, and tied to dating goals so they support matching instead of replacing it.</p>
              </div>
            </div>
          </article>

          <article className="social-card">
            <div className="social-card-header">
              <div>
                <h2>Connections hub</h2>
                <p>Friend requests, accepted friends, and warm introductions stay one tap away.</p>
              </div>
              <button type="button" className="social-link-button" onClick={() => setShowFriendsList(true)}>
                Open full list
              </button>
            </div>

            <div className="social-summary-row">
              <div className="social-summary-pill">
                <strong>{hub?.summary?.totalFriends || 0}</strong>
                <span>Accepted friends</span>
              </div>
              <div className="social-summary-pill">
                <strong>{hub?.summary?.totalPendingIncoming || 0}</strong>
                <span>Incoming requests</span>
              </div>
              <div className="social-summary-pill">
                <strong>{hub?.summary?.totalIntroductions || 0}</strong>
                <span>Introductions</span>
              </div>
            </div>

            <div className="social-subsection">
              <div className="social-subsection-header">
                <h3>Pending requests</h3>
              </div>
              {hub?.pendingRequests?.length ? (
                <div className="social-list">
                  {hub.pendingRequests.map((friend) => {
                    const friendshipId = friend.friendshipId || friend.friendship_id;
                    const displayName = friend.firstName || friend.first_name || friend.displayName || friend.email;

                    return (
                      <div key={friendshipId} className="social-list-item">
                        <div className="social-person">
                          <div className="social-avatar">
                            {displayName?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <strong>{displayName}</strong>
                            <span>{friend.locationCity || friend.location_city || 'Nearby on LinkUp'}</span>
                          </div>
                        </div>
                        <div className="social-actions">
                          <button
                            type="button"
                            className="social-btn social-btn-muted"
                            onClick={() => handleDeclineFriend(friendshipId)}
                            disabled={requestActionId === friendshipId}
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            className="social-btn"
                            onClick={() => handleAcceptFriend(friendshipId)}
                            disabled={requestActionId === friendshipId}
                          >
                            {requestActionId === friendshipId ? 'Saving...' : 'Accept'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="social-empty">No incoming friend requests right now.</p>
              )}
            </div>

            <div className="social-subsection">
              <div className="social-subsection-header">
                <h3>Accepted friends</h3>
              </div>
              {hub?.friends?.length ? (
                <div className="social-list">
                  {hub.friends.slice(0, 3).map((friend) => {
                    const friendshipId = friend.friendshipId || friend.friendship_id;
                    const displayName = friend.firstName || friend.first_name || friend.displayName || friend.email;

                    return (
                      <div key={friendshipId} className="social-list-item">
                        <div className="social-person">
                          <div className="social-avatar social-avatar-accent">
                            {displayName?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <strong>{displayName}</strong>
                            <span>{friend.locationCity || friend.location_city || 'On LinkUp'}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="social-btn social-btn-muted"
                          onClick={() => handleViewFriendProfile(friend)}
                        >
                          View profile
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="social-empty">Accepted friends will show up here once requests start landing.</p>
              )}
            </div>

            <div className="social-subsection">
              <div className="social-subsection-header">
                <h3>Warm introductions</h3>
              </div>
              {hub?.introductions?.length ? (
                <div className="social-list">
                  {hub.introductions.map((referral) => {
                    const referralId = referral.id;

                    return (
                      <div key={referralId} className="social-introduction-card">
                        <div className="social-introduction-copy">
                          <strong>
                            {referral.referrerFirstName || referral.referrer_first_name || 'A friend'} introduced{' '}
                            {referral.referredFirstName || referral.referred_first_name || 'someone'} to you
                          </strong>
                          <p>{referral.referralMessage || referral.referral_message || 'They think you might click.'}</p>
                        </div>
                        <div className="social-actions">
                          <button
                            type="button"
                            className="social-btn social-btn-muted"
                            onClick={() => handleViewReferralProfile(referral)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="social-btn"
                            onClick={() => handleAcceptIntroduction(referralId)}
                            disabled={introductionActionId === referralId}
                          >
                            {introductionActionId === referralId ? 'Matching...' : 'Accept intro'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="social-empty">No introductions yet. When friends recommend someone, it shows up here.</p>
              )}
            </div>
          </article>
        </section>

        <section className="social-card-grid social-card-grid-secondary">
          <article className="social-card">
            <div className="social-card-header">
              <div>
                <h2>Profile links</h2>
                <p>Show a little more context on your profile with optional public handles.</p>
              </div>
              <button type="button" className="social-link-button" onClick={() => setShowSocialLinksModal(true)}>
                Manage links
              </button>
            </div>

            {hub?.socialIntegrations?.length ? (
              <div className="social-link-list">
                {hub.socialIntegrations.map((integration) => (
                  <div key={integration.id} className="social-link-item">
                    <div>
                      <strong>{integration.platform}</strong>
                      <span>@{integration.username}</span>
                    </div>
                    <span className={`visibility-pill ${(integration.isPublic || integration.is_public) ? 'public' : 'private'}`}>
                      {(integration.isPublic || integration.is_public) ? 'Public on profile' : 'Private'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="social-empty">
                No social handles linked yet. Add the ones you feel comfortable showing.
              </p>
            )}
          </article>

          <article className="social-card">
            <div className="social-card-header">
              <div>
                <h2>Referral rewards</h2>
                <p>Starter rewards help someone join well. Your bigger upside comes when they become a quality activated dater.</p>
              </div>
              <button type="button" className="social-link-button" onClick={() => setShowReferralModal(true)}>
                Share tools
              </button>
            </div>

            <div className="referral-code-block">
              <span className="referral-code-label">Active code</span>
              <div className="referral-code-row">
                <strong>{hub?.referral?.code || 'Unavailable'}</strong>
                <button type="button" className="social-btn social-btn-muted" onClick={handleCopyReferralCode}>
                  Copy
                </button>
              </div>
            </div>

            <div className="reward-chip-row">
              <span className="reward-chip">Starter: +{hub?.referral?.starterReward?.boostCredits || hub?.referral?.rewardOffer?.boostCredits || 0} boost</span>
              <span className="reward-chip">Starter: +{hub?.referral?.starterReward?.superlikeCredits || hub?.referral?.rewardOffer?.superlikeCredits || 0} superlikes</span>
              <span className="reward-chip">Quality bonus: +{hub?.referral?.qualityBonus?.premiumTrialDays || 0} premium days</span>
            </div>

            <div className="wallet-grid">
              <div className="wallet-stat">
                <strong>{hub?.rewardWallet?.boostCredits || 0}</strong>
                <span>Boost credits</span>
              </div>
              <div className="wallet-stat">
                <strong>{hub?.rewardWallet?.superlikeCredits || 0}</strong>
                <span>Extra superlikes</span>
              </div>
              <div className="wallet-stat">
                <strong>{hub?.rewardWallet?.premiumDaysAwarded || 0}</strong>
                <span>Premium days earned</span>
              </div>
            </div>

            <div className="social-summary-row">
              <div className="social-summary-pill">
                <strong>{hub?.referral?.stats?.completed || 0}</strong>
                <span>Completed invites</span>
              </div>
              <div className="social-summary-pill">
                <strong>{hub?.referral?.stats?.pending || 0}</strong>
                <span>Open invites</span>
              </div>
              <div className="social-summary-pill">
                <strong>{hub?.referral?.qualityMetrics?.referralToActivatedUserQuality || 0}%</strong>
                <span>Activated-user quality</span>
              </div>
              <div className="social-summary-pill">
                <strong>{hub?.referral?.qualityMetrics?.qualityActivated || 0}</strong>
                <span>Quality activations</span>
              </div>
            </div>
          </article>
        </section>
      </div>

      {showFriendsList ? (
        <FriendsList
          onClose={() => {
            setShowFriendsList(false);
            loadHub();
          }}
          onSelectFriend={handleViewFriendProfile}
        />
      ) : null}

      {showReferralModal ? (
        <ReferralShareModal
          onClose={() => {
            setShowReferralModal(false);
            loadHub();
          }}
        />
      ) : null}

      {showSocialLinksModal ? (
        <SocialIntegration
          onClose={() => {
            setShowSocialLinksModal(false);
            loadHub();
          }}
        />
      ) : null}
    </div>
  );
};

export default SocialHub;
