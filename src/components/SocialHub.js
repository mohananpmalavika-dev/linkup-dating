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

const getFriendDisplayName = (friend) =>
  friend.firstName || friend.first_name || friend.displayName || friend.email || 'LinkUp friend';

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

  const pendingRequests = hub?.pendingRequests || [];
  const friends = hub?.friends || [];
  const introductions = hub?.introductions || [];
  const rooms = hub?.communityRooms || [];

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
        <section className="social-hero-card" aria-labelledby="social-title">
          <p className="social-eyebrow">Social</p>
          <h1 id="social-title">Friends and chat rooms</h1>
          <p className="social-hero-copy">
            Use this page to talk in rooms, see friend requests, and manage people you know.
          </p>
        </section>

        {error ? <div className="social-banner social-error">{error}</div> : null}
        {actionError ? <div className="social-banner social-warning">{actionError}</div> : null}

        <section className="social-action-grid" aria-label="Main social actions">
          <button type="button" className="social-action-card" onClick={() => onBrowseChatrooms?.()}>
            <strong>Chat Rooms</strong>
            <span>Join group conversations</span>
          </button>
          <button type="button" className="social-action-card" onClick={() => onOpenLobby?.()}>
            <strong>Lobby</strong>
            <span>See who is around now</span>
          </button>
          <button type="button" className="social-action-card" onClick={() => setShowFriendsList(true)}>
            <strong>Friends</strong>
            <span>{friends.length} saved</span>
          </button>
          <button type="button" className="social-action-card" onClick={() => setShowReferralModal(true)}>
            <strong>Invite</strong>
            <span>Share LinkUp</span>
          </button>
        </section>

        <section className="social-simple-layout">
          <article className="social-card social-card-primary">
            <div className="social-card-header">
              <div>
                <h2>Friend Requests</h2>
                <p>People who want to connect with you.</p>
              </div>
              <span className="social-count-badge">{pendingRequests.length}</span>
            </div>

            {pendingRequests.length ? (
              <div className="social-list">
                {pendingRequests.map((friend) => {
                  const friendshipId = friend.friendshipId || friend.friendship_id;
                  const displayName = getFriendDisplayName(friend);

                  return (
                    <div key={friendshipId} className="social-list-item">
                      <div className="social-person">
                        <div className="social-avatar">{displayName?.charAt(0)?.toUpperCase() || '?'}</div>
                        <div>
                          <strong>{displayName}</strong>
                          <span>{friend.locationCity || friend.location_city || 'On LinkUp'}</span>
                        </div>
                      </div>
                      <div className="social-actions">
                        <button
                          type="button"
                          className="social-btn social-btn-muted"
                          onClick={() => handleDeclineFriend(friendshipId)}
                          disabled={requestActionId === friendshipId}
                        >
                          Not Now
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
              <p className="social-empty">No friend requests right now.</p>
            )}
          </article>

          <article className="social-card">
            <div className="social-card-header">
              <div>
                <h2>Your Friends</h2>
                <p>People you already know on LinkUp.</p>
              </div>
              <button type="button" className="social-link-button" onClick={() => setShowFriendsList(true)}>
                See All
              </button>
            </div>

            {friends.length ? (
              <div className="social-list">
                {friends.slice(0, 4).map((friend) => {
                  const friendshipId = friend.friendshipId || friend.friendship_id;
                  const displayName = getFriendDisplayName(friend);

                  return (
                    <div key={friendshipId} className="social-list-item compact">
                      <div className="social-person">
                        <div className="social-avatar social-avatar-accent">{displayName?.charAt(0)?.toUpperCase() || '?'}</div>
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
                        Profile
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="social-empty">Your friends will appear here after you accept requests.</p>
            )}
          </article>

          <article className="social-card">
            <div className="social-card-header">
              <div>
                <h2>Introductions</h2>
                <p>Suggestions sent by friends.</p>
              </div>
              <span className="social-count-badge">{introductions.length}</span>
            </div>

            {introductions.length ? (
              <div className="social-list">
                {introductions.map((referral) => {
                  const referralId = referral.id;

                  return (
                    <div key={referralId} className="social-list-item">
                      <div className="social-introduction-copy">
                        <strong>
                          {referral.referrerFirstName || referral.referrer_first_name || 'A friend'} suggested{' '}
                          {referral.referredFirstName || referral.referred_first_name || 'someone'}
                        </strong>
                        <p>{referral.referralMessage || referral.referral_message || 'They think you may like this person.'}</p>
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
                          {introductionActionId === referralId ? 'Saving...' : 'Accept'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="social-empty">No introductions right now.</p>
            )}
          </article>

          <article className="social-card">
            <div className="social-card-header">
              <div>
                <h2>Chat Rooms</h2>
                <p>Simple group spaces you can join.</p>
              </div>
              <button type="button" className="social-link-button" onClick={() => onBrowseChatrooms?.()}>
                Browse
              </button>
            </div>

            {rooms.length ? (
              <div className="social-list">
                {rooms.slice(0, 3).map((room) => {
                  const isBusy = roomActionSlug === room.slug;
                  const isMember = room.isMember || room.is_member;

                  return (
                    <div key={room.slug} className="social-list-item">
                      <div>
                        <strong>{room.name}</strong>
                        <p>{room.description || `${room.memberCount || room.member_count || 0} members`}</p>
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
                        {isBusy ? 'Opening...' : isMember ? 'Open' : room.eligibility?.canJoin === false ? 'Finish Profile' : 'Join'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="social-empty">Chat rooms will appear here when they are available.</p>
            )}
          </article>
        </section>

        <section className="social-more-card">
          <div>
            <h2>More Options</h2>
            <p>Keep these here when you need them.</p>
          </div>
          <div className="social-more-actions">
            <button type="button" className="social-btn social-btn-muted" onClick={() => setShowSocialLinksModal(true)}>
              Profile Links
            </button>
            <button type="button" className="social-btn social-btn-muted" onClick={handleCopyReferralCode} disabled={!hub?.referral?.code}>
              Copy Invite Code
            </button>
          </div>
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
