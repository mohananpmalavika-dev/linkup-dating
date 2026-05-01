import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from '../router';
import '../styles/Matches.css';
import datingProfileService from '../services/datingProfileService';
import { getActionableMatches } from '../utils/datingRescue';
import { buildActionInboxItems } from '../utils/actionInbox';
import { calculateConversationHealth } from '../utils/datingPhaseTwo';

/**
 * Matches Component
 * Display and manage user matches
 */
const buildLikeProfileContext = (like) => ({
  userId: like.from_user_id,
  firstName: like.first_name || '',
  age: like.age ?? null,
  photos: like.photo_url ? [like.photo_url] : [],
  location: {
    city: like.location_city || ''
  }
});

const buildInboxLikeProfileContext = (like) => ({
  userId: like.userId || like.from_user_id,
  firstName: like.firstName || like.first_name || '',
  age: like.age ?? null,
  photos: (like.photoUrl || like.photo_url) ? [like.photoUrl || like.photo_url] : [],
  location: {
    city: like.location?.city || like.location_city || ''
  }
});

const MATCH_STATE_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Hidden' },
  { value: 'snoozed', label: 'Paused' },
  { value: 'all', label: 'All' }
];

const formatMatchName = (match = {}) => {
  const name = match.firstName || match.name || 'Your match';
  return match.age ? `${name}, ${match.age}` : name;
};

const formatMatchLocation = (location = {}) => location?.city || 'Nearby';

const formatLastMessage = (match = {}) => {
  const message = match.lastMessage?.text || '';

  if (!message) {
    return 'No messages yet';
  }

  return `${message.substring(0, 70)}${message.length > 70 ? '...' : ''}`;
};

const getMatchHint = (match = {}, conversationHealth = {}) => {
  const messageCount = Number(match.messageCount || conversationHealth.messageCount || 0);

  if (!match.lastMessage && messageCount === 0) {
    return {
      tone: 'new',
      label: 'New match',
      copy: 'Send a friendly first message when you are ready.'
    };
  }

  if (conversationHealth.readyForCall) {
    return {
      tone: 'warm',
      label: 'Good momentum',
      copy: 'This chat looks ready for a call or simple date plan.'
    };
  }

  if (conversationHealth.needsRevive) {
    return {
      tone: 'paused',
      label: 'Quiet chat',
      copy: 'A light check-in can restart the conversation.'
    };
  }

  return {
    tone: conversationHealth.score >= 65 ? 'warm' : 'steady',
    label: 'Next step',
    copy: conversationHealth.nextBestMove || 'Keep the chat moving with one specific question.'
  };
};

const getManagementCopy = (management = {}) => {
  if (!management?.state || management.state === 'active') {
    return '';
  }

  if (management.state === 'archived') {
    return 'Hidden from your active list';
  }

  if (management.state === 'snoozed') {
    const snoozedUntil = management.snoozedUntil ? new Date(management.snoozedUntil) : null;
    const dateLabel = snoozedUntil && !Number.isNaN(snoozedUntil.getTime())
      ? snoozedUntil.toLocaleDateString()
      : 'later';
    return `Paused until ${dateLabel}`;
  }

  return '';
};

const Matches = ({
  pageLabel = 'Matches',
  onMatchCreated,
  onPlanDate,
  onScheduleVideoCall,
  onSelectMatch,
  onUnmatch,
  onViewProfile,
  onStartVideoCall
}) => {
  const location = useLocation();
  const [matches, setMatches] = useState([]);
  const [likesReceived, setLikesReceived] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [likingBackUserId, setLikingBackUserId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [navigationNotice, setNavigationNotice] = useState('');
  const [matchStateFilter, setMatchStateFilter] = useState('active');
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' | 'likes' | 'requests'
  const [whoLikedMe, setWhoLikedMe] = useState([]);
  const [loadingWhoLiked, setLoadingWhoLiked] = useState(false);
  const [messageRequests, setMessageRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [dateProposals, setDateProposals] = useState([]);
  const [loadingDateProposals, setLoadingDateProposals] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [requestActionLoading, setRequestActionLoading] = useState(null);
  const [matchStateLoadingId, setMatchStateLoadingId] = useState(null);
  const [openMenuMatchId, setOpenMenuMatchId] = useState(null);
  const isMessagesPage = pageLabel === 'Messages';

  useEffect(() => {
    loadMatches();
    loadLikesReceived();
    if (isMessagesPage) {
      loadWhoLikedMe();
      loadMessageRequests();
      loadDateProposals();
      datingProfileService.trackFunnelEvent('dating_action_inbox_viewed').catch(() => {});
    }
  }, [isMessagesPage]);

  useEffect(() => {
    if (!location.state?.focusMessages) {
      setNavigationNotice('');
      return;
    }

    if (matches.length > 0) {
      setNavigationNotice('Opening messages is available once you choose a match.');
      return;
    }

    setNavigationNotice('No conversations yet. Match with someone first, then tap Messages to open the chat.');
  }, [location.state?.focusMessages, location.state?.messagesRequestedAt, matches.length]);

  const loadMatches = async () => {
    setLoading(true);
    setLoadError('');

    try {
      const data = await datingProfileService.getMatches(50);
      setMatches(data.matches || []);
    } catch (loadError) {
      setLoadError('We could not load your matches. Please try again.');
      console.error(loadError);
    } finally {
      setLoading(false);
    }
  };

  const loadLikesReceived = async () => {
    setLoadingLikes(true);

    try {
      const data = await datingProfileService.getLikesReceived(20);
      setLikesReceived(Array.isArray(data) ? data : []);
    } catch (loadError) {
      console.error('Failed to load likes received:', loadError);
    } finally {
      setLoadingLikes(false);
    }
  };

  const loadWhoLikedMe = async () => {
    setLoadingWhoLiked(true);

    try {
      const data = await datingProfileService.getWhoLikedMe();
      setWhoLikedMe(data.likers || []);
      setIsPremium(data.isPremium || false);
    } catch (loadError) {
      console.error('Failed to load who liked me:', loadError);
    } finally {
      setLoadingWhoLiked(false);
    }
  };

  const loadMessageRequests = async () => {
    setLoadingRequests(true);

    try {
      const data = await datingProfileService.getMessageRequests();
      setMessageRequests(data.requests || []);
    } catch (loadError) {
      console.error('Failed to load message requests:', loadError);
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadDateProposals = async () => {
    setLoadingDateProposals(true);

    try {
      const data = await datingProfileService.getDateProposals('all');
      setDateProposals(data.proposals || []);
    } catch (loadError) {
      console.error('Failed to load date proposals:', loadError);
    } finally {
      setLoadingDateProposals(false);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    setRequestActionLoading(requestId);

    try {
      await datingProfileService.acceptMessageRequest(requestId);
      setMessageRequests((current) => current.filter((req) => req.id !== requestId));
      await loadMatches();
      onMatchCreated?.();
    } catch (err) {
      setActionError('Could not accept this request. Please try again.');
      console.error(err);
    } finally {
      setRequestActionLoading(null);
    }
  };

  const handleDeclineRequest = async (requestId) => {
    setRequestActionLoading(requestId);

    try {
      await datingProfileService.declineMessageRequest(requestId);
      setMessageRequests((current) => current.filter((req) => req.id !== requestId));
    } catch (err) {
      setActionError('Could not decline this request. Please try again.');
      console.error(err);
    } finally {
      setRequestActionLoading(null);
    }
  };

  const handleUnmatch = async (matchId) => {
    if (!window.confirm('Unmatch with this person?')) {
      return;
    }

    try {
      await datingProfileService.unmatch(matchId);
      setMatches((currentMatches) => currentMatches.filter((match) => match.id !== matchId));
      onUnmatch?.(matchId);
    } catch (unmatchError) {
      setActionError('Could not unmatch right now. Please try again.');
      console.error('Failed to unmatch:', unmatchError);
    }
  };

  const handleUpdateMatchState = async (matchId, state) => {
    setMatchStateLoadingId(matchId);

    try {
      const response = await datingProfileService.updateMatchState(matchId, {
        state,
        snoozedUntil:
          state === 'snoozed'
            ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
            : null
      });

      setMatches((currentMatches) =>
        currentMatches.map((match) => (
          String(match.id) === String(matchId)
            ? { ...match, management: response.management }
            : match
        ))
      );
    } catch (stateError) {
      setActionError(typeof stateError === 'string' ? stateError : 'Could not update this match. Please try again.');
    } finally {
      setMatchStateLoadingId(null);
    }
  };

  const handleLikeBack = async (like) => {
    if (!like?.from_user_id) {
      return;
    }

    setLikingBackUserId(like.from_user_id);
    setActionError('');

    try {
      const result = await datingProfileService.likeProfile(like.from_user_id);

      if (!result.isMatch) {
        setActionError('Like sent. We will show the match here once it is mutual.');
        return;
      }

      setLikesReceived((currentLikes) => (
        currentLikes.filter((currentLike) => currentLike.from_user_id !== like.from_user_id)
      ));
      await loadMatches();
      onMatchCreated?.();
    } catch (likeError) {
      try {
        const existingMatch = await datingProfileService.checkMatch(like.from_user_id);

        if (existingMatch?.isMatched && existingMatch.match?.status === 'active') {
          setLikesReceived((currentLikes) => (
            currentLikes.filter((currentLike) => currentLike.from_user_id !== like.from_user_id)
          ));
          await loadMatches();
          onMatchCreated?.();
          return;
        }
      } catch (recoveryError) {
        console.error('Failed to recover like-back state:', recoveryError);
      }

      setActionError('Could not like this profile back. Please try again.');
      console.error('Failed to like back:', likeError);
    } finally {
      setLikingBackUserId(null);
    }
  };

  const filteredMatches = matches
    .filter((match) => {
      const managementState = match.management?.state || 'active';

      if (matchStateFilter !== 'all' && managementState !== matchStateFilter) {
        return false;
      }

      return true;
    })
    .sort((leftMatch, rightMatch) => {
      const leftDate = leftMatch.lastMessageAt || leftMatch.matchedAt || leftMatch.createdAt || '';
      const rightDate = rightMatch.lastMessageAt || rightMatch.matchedAt || rightMatch.createdAt || '';
      return new Date(rightDate).getTime() - new Date(leftDate).getTime();
    });

  const messageMatches = matches
    .filter((match) => {
      const managementState = match.management?.state || 'active';
      if (matchStateFilter !== 'all' && managementState !== matchStateFilter) {
        return false;
      }
      return Boolean(match.lastMessage || match.messageCount > 0);
    })
    .sort((leftMatch, rightMatch) => {
      const leftDate = leftMatch.lastMessageAt || leftMatch.matchedAt || leftMatch.createdAt || '';
      const rightDate = rightMatch.lastMessageAt || rightMatch.matchedAt || rightMatch.createdAt || '';
      return new Date(rightDate).getTime() - new Date(leftDate).getTime();
    });

  const displayMatches = isMessagesPage ? messageMatches : filteredMatches;
  const actionableMatches = useMemo(
    () => getActionableMatches(
      matches.filter((match) => !match.management?.isArchived && !match.management?.isSnoozed)
    ).slice(0, 3),
    [matches]
  );
  const actionInboxItems = useMemo(
    () => buildActionInboxItems({
      likesReceived,
      whoLikedMe,
      messageRequests,
      actionableMatches,
      dateProposals
    }),
    [actionableMatches, dateProposals, likesReceived, messageRequests, whoLikedMe]
  );
  const tabCounts = {
    matches: filteredMatches.length,
    likes: whoLikedMe.length || likesReceived.length,
    requests: messageRequests.length
  };
  const activeHeaderCount = isMessagesPage
    ? actionInboxItems.length
    : activeTab === 'likes'
      ? tabCounts.likes
      : activeTab === 'requests'
        ? tabCounts.requests
        : displayMatches.length;
  const headerTitle = isMessagesPage
    ? 'Inbox'
    : activeTab === 'likes'
      ? 'Likes'
      : activeTab === 'requests'
        ? 'Requests'
        : 'Matches';
  const shouldShowQuickLikes = !isMessagesPage && activeTab === 'matches' && (
    loadingLikes || likesReceived.length > 0 || Boolean(actionError) || Boolean(navigationNotice)
  );

  const handleOpenSuggestedMessage = (match, prefillMessage) => {
    onSelectMatch?.(match, location.pathname, { prefillMessage });
  };

  const handlePrimarySuggestion = (match, suggestion) => {
    if (!suggestion) {
      return;
    }

    if (suggestion.actionType === 'plan') {
      onPlanDate?.(match, location.pathname);
      return;
    }

    handleOpenSuggestedMessage(match, suggestion.prefillMessage);
  };

  const handleSecondarySuggestion = (match, suggestion) => {
    if (!suggestion?.secondaryActionType) {
      return;
    }

    if (suggestion.secondaryActionType === 'plan') {
      onPlanDate?.(match, location.pathname);
      return;
    }

    handleOpenSuggestedMessage(match, suggestion.secondaryPrefillMessage);
  };

  const handleActionInboxPrimary = (item) => {
    if (!item) {
      return;
    }

    if (item.kind === 'date') {
      const proposal = item.payload;
      const existingMatch = matches.find((match) => String(match.id) === String(proposal.matchId));
      const fallbackMatch = {
        id: proposal.matchId,
        matchId: proposal.matchId,
        userId: proposal.isReceived ? proposal.proposerId : proposal.recipientId,
        firstName: proposal.isReceived ? proposal.proposerName : proposal.recipientName,
        location: {
          city: proposal.isReceived ? proposal.proposerCity : proposal.recipientCity
        }
      };

      onPlanDate?.(existingMatch || fallbackMatch, location.pathname, {
        focusPlanner: true,
        proposalId: proposal.id
      });
      return;
    }

    if (item.kind === 'request') {
      handleAcceptRequest(item.payload.id);
      return;
    }

    if (item.kind === 'like') {
      handleLikeBack({
        from_user_id: item.payload.userId,
        first_name: item.payload.firstName
      });
      return;
    }

    if (item.kind === 'rescue') {
      handlePrimarySuggestion(item.payload.match, item.payload.suggestion);
    }
  };

  const handleActionInboxSecondary = (item) => {
    if (!item) {
      return;
    }

    if (item.kind === 'date') {
      const proposal = item.payload;
      const existingMatch = matches.find((match) => String(match.id) === String(proposal.matchId));
      const fallbackMatch = {
        id: proposal.matchId,
        matchId: proposal.matchId,
        userId: proposal.isReceived ? proposal.proposerId : proposal.recipientId,
        firstName: proposal.isReceived ? proposal.proposerName : proposal.recipientName,
        location: {
          city: proposal.isReceived ? proposal.proposerCity : proposal.recipientCity
        }
      };

      onSelectMatch?.(existingMatch || fallbackMatch, location.pathname);
      return;
    }

    if (item.kind === 'request') {
      handleDeclineRequest(item.payload.id);
      return;
    }

    if (item.kind === 'like') {
      if (!item.payload.isRevealed) {
        return;
      }

      onViewProfile?.(buildInboxLikeProfileContext(item.payload));
      return;
    }

    if (item.kind === 'rescue') {
      handleSecondarySuggestion(item.payload.match, item.payload.suggestion);
    }
  };

  if (loading) {
    return (
      <div className="matches-container loading">
        <div className="spinner"></div>
        <p>Loading matches...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="matches-container error">
        <p>{loadError}</p>
        <button onClick={loadMatches}>Retry</button>
      </div>
    );
  }

  return (
    <div className="matches-container">
      <div className="matches-header">
        <div className="matches-title-row">
          <div>
            <h2>
              {headerTitle}
              {' '}
              <span className="matches-count">{activeHeaderCount}</span>
            </h2>
            <p className="matches-header-copy">
              {isMessagesPage
                ? 'Quick actions and conversations in one simple place.'
                : 'People who matched with you. Start with a message, call, or simple plan.'}
            </p>
          </div>
        </div>
        {!isMessagesPage ? (
          <>
            <div className="filter-tabs" aria-label="Matches sections">
              <button
                className={`filter-btn ${activeTab === 'matches' ? 'active' : ''}`}
                onClick={() => setActiveTab('matches')}
                aria-pressed={activeTab === 'matches'}
              >
                Matches <span className="tab-count">{tabCounts.matches}</span>
              </button>
              <button
                className={`filter-btn ${activeTab === 'likes' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('likes');
                  loadWhoLikedMe();
                }}
                aria-pressed={activeTab === 'likes'}
              >
                Likes <span className="tab-count">{tabCounts.likes}</span>
              </button>
              <button
                className={`filter-btn ${activeTab === 'requests' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('requests');
                  loadMessageRequests();
                }}
                aria-pressed={activeTab === 'requests'}
              >
                Requests <span className="tab-count">{tabCounts.requests}</span>
              </button>
            </div>

            {activeTab === 'matches' ? (
              <div className="filter-tabs match-state-tabs" aria-label="Match filters">
                {MATCH_STATE_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    className={`filter-btn ${matchStateFilter === filter.value ? 'active' : ''}`}
                    onClick={() => setMatchStateFilter(filter.value)}
                    aria-pressed={matchStateFilter === filter.value}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {activeTab === 'likes' ? (
        <div className="likes-you-section">
          <div className="likes-you-header">
            <div>
              <h3>Likes</h3>
              <p>{isPremium ? 'People who liked you. Like back to make a match.' : 'Upgrade to see who liked you.'}</p>
            </div>
            <button type="button" className="likes-refresh-btn" onClick={loadWhoLikedMe}>
              Refresh
            </button>
          </div>

          {actionError ? (
            <div className="likes-you-feedback" role="status">
              {actionError}
            </div>
          ) : null}

          {loadingWhoLiked ? (
            <div className="likes-you-empty"><p>Checking likes...</p></div>
          ) : whoLikedMe.length > 0 ? (
            <div className="likes-you-list">
              {whoLikedMe.map((liker) => (
                <div key={liker.userId} className="like-card">
                  <div
                    className="like-card-photo"
                    style={{
                      backgroundImage: liker.photoUrl && liker.isRevealed
                        ? `url(${liker.photoUrl})`
                        : 'linear-gradient(135deg, #f97316, #fb7185)',
                      filter: liker.isRevealed ? 'none' : 'blur(8px)'
                    }}
                  />
                  <div className="like-card-body">
                    <h4>{liker.isRevealed ? `${liker.firstName}, ${liker.age}` : 'Someone liked you'}</h4>
                    <p>{liker.isRevealed ? (liker.location?.city || 'Nearby') : 'Premium can reveal this profile'}</p>
                    {liker.isRevealed ? (
                      <div className="like-card-actions">
                        <button
                          type="button"
                          className="like-card-primary"
                          onClick={() => handleLikeBack({ from_user_id: liker.userId, first_name: liker.firstName })}
                        >
                          Like Back
                        </button>
                      </div>
                    ) : (
                      <div className="like-card-actions">
                        <button type="button" className="like-card-secondary" disabled>
                          Premium only
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="likes-you-empty">
              <p>No likes yet. Keep your profile active and check back soon.</p>
            </div>
          )}
        </div>
      ) : activeTab === 'requests' ? (
        <div className="likes-you-section">
          <div className="likes-you-header">
            <div>
              <h3>Requests</h3>
              <p>People who asked to start a chat. Accept only if you feel comfortable.</p>
            </div>
            <button type="button" className="likes-refresh-btn" onClick={loadMessageRequests}>
              Refresh
            </button>
          </div>

          {actionError ? (
            <div className="likes-you-feedback" role="status">
              {actionError}
            </div>
          ) : null}

          {loadingRequests ? (
            <div className="likes-you-empty"><p>Checking requests...</p></div>
          ) : messageRequests.length > 0 ? (
            <div className="likes-you-list">
              {messageRequests.map((req) => (
                <div key={req.id} className="like-card">
                  <div
                    className="like-card-photo"
                    style={{
                      backgroundImage: req.photoUrl
                        ? `url(${req.photoUrl})`
                        : 'linear-gradient(135deg, #f97316, #fb7185)'
                    }}
                  />
                  <div className="like-card-body">
                    <h4>{req.firstName}, {req.age}</h4>
                    <p>{req.location?.city || 'Nearby'}</p>
                    <div className="request-message"><em>"{req.message}"</em></div>
                    <div className="like-card-actions">
                      <button
                        type="button"
                        className="like-card-secondary"
                        onClick={() => handleDeclineRequest(req.id)}
                        disabled={requestActionLoading === req.id}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        className="like-card-primary"
                        onClick={() => handleAcceptRequest(req.id)}
                        disabled={requestActionLoading === req.id}
                      >
                        {requestActionLoading === req.id ? 'Processing...' : 'Accept'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="likes-you-empty">
              <p>No message requests. When someone sends you a request, it will appear here.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {isMessagesPage ? (
            <section className="action-inbox-panel">
              <div className="action-inbox-header">
                <div>
                  <h3>Needs attention</h3>
                  <p>Quick actions for likes, requests, date plans, and chats that may need a reply.</p>
                </div>
                <button
                  type="button"
                  className="likes-refresh-btn"
                  onClick={() => {
                    loadLikesReceived();
                    loadWhoLikedMe();
                    loadMessageRequests();
                    loadDateProposals();
                  }}
                >
                  Refresh
                </button>
              </div>

              {actionError ? (
                <div className="likes-you-feedback" role="status">
                  {actionError}
                </div>
              ) : null}

              {navigationNotice ? (
                <div className="matches-navigation-notice" role="status">
                  {navigationNotice}
                </div>
              ) : null}

              {actionInboxItems.length > 0 ? (
                <div className="action-inbox-list">
                  {actionInboxItems.map((item) => (
                    <article key={item.id} className={`action-inbox-card ${item.kind}`}>
                      <div className="action-inbox-copy">
                        <span className={`action-inbox-kind ${item.kind}`}>{item.meta}</span>
                        <h4>{item.title}</h4>
                        <p>{item.subtitle}</p>
                        {item.preview ? (
                          <div className="action-inbox-preview">
                            <strong>Suggested next step</strong>
                            <span>{item.preview}</span>
                          </div>
                        ) : null}
                      </div>
                      <div className="action-inbox-actions">
                        <button
                          type="button"
                          className="match-rescue-primary"
                          onClick={() => handleActionInboxPrimary(item)}
                          disabled={
                            (item.kind === 'request' && requestActionLoading === item.payload.id) ||
                            (item.kind === 'like' && likingBackUserId === item.payload.userId)
                          }
                        >
                          {item.kind === 'request' && requestActionLoading === item.payload.id
                            ? 'Processing...'
                            : item.kind === 'like' && likingBackUserId === item.payload.userId
                              ? 'Matching...'
                              : item.primaryLabel}
                        </button>
                        {item.secondaryLabel ? (
                          <button
                            type="button"
                            className="match-rescue-secondary"
                            onClick={() => handleActionInboxSecondary(item)}
                            disabled={item.kind === 'like' && !item.payload.isRevealed}
                          >
                            {item.secondaryLabel}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="likes-you-empty">
                  <p>
                    {loadingDateProposals
                      ? 'Refreshing your inbox...'
                      : 'All caught up. New likes, requests, plans, and helpful chat reminders will appear here.'}
                  </p>
                </div>
              )}
            </section>
          ) : shouldShowQuickLikes ? (
            <div className="likes-you-section">
              <div className="likes-you-header">
                <div>
                  <h3>New likes</h3>
                  <p>Like back to create a match.</p>
                </div>
                <button type="button" className="likes-refresh-btn" onClick={loadLikesReceived}>
                  Refresh
                </button>
              </div>

              {actionError ? (
                <div className="likes-you-feedback" role="status">
                  {actionError}
                </div>
              ) : null}

              {navigationNotice ? (
                <div className="matches-navigation-notice" role="status">
                  {navigationNotice}
                </div>
              ) : null}

              {loadingLikes ? (
                <div className="likes-you-empty">
                  <p>Checking new likes...</p>
                </div>
              ) : likesReceived.length > 0 ? (
                <div className="likes-you-list">
                  {likesReceived.map((like) => (
                    <div key={`${like.from_user_id}-${like.created_at}`} className="like-card">
                      <div
                        className="like-card-photo"
                        style={{
                          backgroundImage: like.photo_url
                            ? `url(${like.photo_url})`
                            : 'linear-gradient(135deg, #f97316, #fb7185)'
                        }}
                      />
                      <div className="like-card-body">
                        <h4>
                          {like.first_name}
                          {like.age ? `, ${like.age}` : ''}
                        </h4>
                        <p>{like.location_city || 'Nearby'}</p>
                        <div className="like-card-actions">
                          <button
                            type="button"
                            className="like-card-secondary"
                            onClick={() => onViewProfile?.(buildLikeProfileContext(like))}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="like-card-primary"
                            onClick={() => handleLikeBack(like)}
                            disabled={likingBackUserId === like.from_user_id}
                          >
                            {likingBackUserId === like.from_user_id ? 'Matching...' : 'Like Back'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="likes-you-empty">
                  <p>No new likes right now.</p>
                </div>
              )}
            </div>
          ) : null}

          {!isMessagesPage && activeTab === 'matches' && actionableMatches.length > 0 ? (
            <section className="match-rescue-panel">
              <div className="match-rescue-header">
                <div>
                  <h3>Helpful next steps</h3>
                  <p>Simple suggestions to start, restart, or move a good chat forward.</p>
                </div>
              </div>

              <div className="match-rescue-list">
                {actionableMatches.map(({ match, suggestion }) => (
                  <article key={`rescue-${match.id}-${suggestion.kind}`} className="match-rescue-card">
                    <div className="match-rescue-copy">
                      <span className={`match-rescue-kind ${suggestion.kind}`}>
                        {suggestion.kind === 'first_message'
                          ? 'Say hello'
                          : suggestion.kind === 'revive'
                            ? 'Check in'
                            : 'Ready to meet'}
                      </span>
                      <h4>{suggestion.title}</h4>
                      <p>{suggestion.description}</p>
                      {suggestion.prefillMessage ? (
                        <div className="match-rescue-preview">
                          <strong>Message you can send</strong>
                          <span>{suggestion.prefillMessage}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="match-rescue-actions">
                      <button
                        type="button"
                        className="match-rescue-primary"
                        onClick={() => handlePrimarySuggestion(match, suggestion)}
                      >
                        {suggestion.ctaLabel}
                      </button>
                      {suggestion.secondaryCtaLabel ? (
                        <button
                          type="button"
                          className="match-rescue-secondary"
                          onClick={() => handleSecondarySuggestion(match, suggestion)}
                        >
                          {suggestion.secondaryCtaLabel}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {displayMatches.length > 0 ? (
            <div className="matches-list">
              {displayMatches.map((match) => {
                const conversationHealth = calculateConversationHealth({ match });
                const matchHint = getMatchHint(match, conversationHealth);
                const managementCopy = getManagementCopy(match.management);
                const isMenuOpen = String(openMenuMatchId) === String(match.id);
                const matchName = formatMatchName(match);
                const isActiveMatch = !match.management?.state || match.management.state === 'active';

                return (
                <div key={match.id} className="match-item">
                  <button
                    type="button"
                    className="match-photo"
                    onClick={() => onViewProfile?.(match)}
                    aria-label={`View ${matchName}'s profile`}
                    style={{
                      backgroundImage: match.photos?.[0]
                        ? `url(${match.photos[0]})`
                        : 'linear-gradient(135deg, #667eea, #764ba2)'
                    }}
                  >
                    {match.profileVerified ? (
                      <span className="verified-indicator" aria-label="Verified profile">✓</span>
                    ) : null}
                  </button>

                  <div className="match-info">
                    <div className="match-header-row">
                      <h3>{matchName}</h3>
                      {(match.unreadCount || 0) > 0 ? (
                        <span className="unread-badge" aria-label={`${match.unreadCount} unread messages`}>
                          {match.unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <p className="match-location">{formatMatchLocation(match.location)}</p>
                    <p className="last-message">
                      {formatLastMessage(match)}
                    </p>
                    <div className={`match-next-step ${matchHint.tone}`}>
                      <span>{matchHint.label}</span>
                      <p>{matchHint.copy}</p>
                    </div>
                    {managementCopy ? (
                      <p className="match-management-copy">{managementCopy}</p>
                    ) : null}
                    {match.journey ? (
                      <div className="match-journey">
                        <div className="match-journey-top">
                          <span className="match-journey-progress">
                            {match.journey.progressCount || 0} of {match.journey.milestones?.length || 5} steps done
                          </span>
                          {match.journey.nudge ? (
                            <span className="match-journey-pill">{match.journey.nudge.title}</span>
                          ) : null}
                        </div>
                        {match.journey.nudge ? (
                          <p className="match-journey-copy">{match.journey.nudge.message}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="match-actions">
                    <button
                      className="btn-message"
                      onClick={() => onSelectMatch?.(match)}
                      title="Open chat"
                    >
                      Chat
                    </button>
                    <button
                      className="btn-video"
                      onClick={() => onStartVideoCall?.(match, location.pathname)}
                      title="Start video call"
                    >
                      Call
                    </button>
                    <button
                      className="btn-plan"
                      onClick={() => onPlanDate?.(match, location.pathname)}
                      title="Plan a date"
                    >
                      Plan
                    </button>
                    <button
                      className="btn-more"
                      onClick={() => setOpenMenuMatchId(isMenuOpen ? null : match.id)}
                      title="More options"
                      aria-expanded={isMenuOpen}
                      aria-controls={`menu-${match.id}`}
                    >
                      More
                    </button>
                    <div id={`menu-${match.id}`} className={`action-menu ${isMenuOpen ? 'visible' : ''}`}>
                      <button onClick={() => {
                        setOpenMenuMatchId(null);
                        onViewProfile?.(match);
                      }}>
                        View Profile
                      </button>
                      <button onClick={() => {
                        setOpenMenuMatchId(null);
                        onPlanDate?.(match, location.pathname);
                      }}>
                        Plan Date
                      </button>
                      <button onClick={() => {
                        setOpenMenuMatchId(null);
                        onScheduleVideoCall?.(match, location.pathname);
                      }}>
                        Schedule Video Call
                      </button>
                      {isActiveMatch ? (
                        <button
                          onClick={() => {
                            setOpenMenuMatchId(null);
                            handleUpdateMatchState(match.id, 'archived');
                          }}
                          disabled={matchStateLoadingId === match.id}
                        >
                          {matchStateLoadingId === match.id ? 'Saving...' : 'Hide from Active'}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setOpenMenuMatchId(null);
                            handleUpdateMatchState(match.id, 'active');
                          }}
                          disabled={matchStateLoadingId === match.id}
                        >
                          {matchStateLoadingId === match.id ? 'Saving...' : 'Show in Active'}
                        </button>
                      )}
                      {match.management?.state !== 'snoozed' ? (
                        <button
                          onClick={() => {
                            setOpenMenuMatchId(null);
                            handleUpdateMatchState(match.id, 'snoozed');
                          }}
                          disabled={matchStateLoadingId === match.id}
                        >
                          {matchStateLoadingId === match.id ? 'Saving...' : 'Pause 3 Days'}
                        </button>
                      ) : null}
                      <button onClick={() => {
                        setOpenMenuMatchId(null);
                        handleUnmatch(match.id);
                      }}>
                        Unmatch
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="no-matches">
              <h3>{isMessagesPage ? 'No messages yet' : 'No matches yet'}</h3>
              <p>{isMessagesPage ? 'No messages yet. Start a conversation from your matches!' : 'No matches yet. Visit Discover and like profiles to make a match.'}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Matches;
