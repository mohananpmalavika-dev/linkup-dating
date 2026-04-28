const toTimestamp = (value) => {
  if (!value) {
    return 0;
  }

  const nextDate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(nextDate.getTime()) ? 0 : nextDate.getTime();
};

const normalizeLikeEntry = (like = {}) => ({
  userId: like.userId || like.from_user_id || null,
  firstName: like.firstName || like.first_name || 'Someone',
  age: like.age ?? null,
  location: like.location || { city: like.location_city || '' },
  photoUrl: like.photoUrl || like.photo_url || null,
  likedAt: like.likedAt || like.created_at || like.createdAt || null,
  isRevealed: like.isRevealed !== undefined ? Boolean(like.isRevealed) : true
});

export const mergeInboundLikes = (likesReceived = [], whoLikedMe = []) => {
  const mergedLikes = new Map();

  likesReceived.forEach((like) => {
    const normalizedLike = normalizeLikeEntry(like);
    if (normalizedLike.userId) {
      mergedLikes.set(String(normalizedLike.userId), normalizedLike);
    }
  });

  whoLikedMe.forEach((like) => {
    const normalizedLike = normalizeLikeEntry(like);
    if (!normalizedLike.userId) {
      return;
    }

    mergedLikes.set(String(normalizedLike.userId), {
      ...(mergedLikes.get(String(normalizedLike.userId)) || {}),
      ...normalizedLike
    });
  });

  return [...mergedLikes.values()].sort(
    (leftLike, rightLike) => toTimestamp(rightLike.likedAt) - toTimestamp(leftLike.likedAt)
  );
};

const formatProposalWhen = (proposal = {}) => {
  if (!proposal?.proposedDate) {
    return 'Time to be confirmed';
  }

  const proposedTime = String(proposal.proposedTime || '12:00').slice(0, 5);
  const nextDate = new Date(`${proposal.proposedDate}T${proposedTime}`);

  if (Number.isNaN(nextDate.getTime())) {
    return `${proposal.proposedDate} ${proposedTime}`;
  }

  return nextDate.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const buildDateInboxItems = (dateProposals = []) =>
  (Array.isArray(dateProposals) ? dateProposals : [])
    .filter((proposal) => ['pending', 'accepted'].includes(String(proposal.status || '').toLowerCase()))
    .map((proposal) => {
      const counterpartName =
        proposal.isReceived
          ? proposal.proposerName || 'Your match'
          : proposal.recipientName || 'Your match';
      const isPending = proposal.status === 'pending';
      const isAccepted = proposal.status === 'accepted';
      const isReceived = Boolean(proposal.isReceived);
      const title = isPending
        ? isReceived
          ? `${counterpartName} suggested ${proposal.suggestedActivity}`
          : `Waiting on ${counterpartName} for ${proposal.suggestedActivity}`
        : `${proposal.suggestedActivity} with ${counterpartName} is on the calendar`;

      return {
        id: `date-${proposal.id}`,
        kind: 'date',
        priority: isPending && isReceived ? 1 : isPending ? 2 : 3,
        title,
        subtitle: isPending
          ? `${isReceived ? 'Reply to this plan' : 'You already made the move'} for ${formatProposalWhen(proposal)}.`
          : `Upcoming for ${formatProposalWhen(proposal)}.`,
        meta: isPending
          ? isReceived
            ? 'Date reply needed'
            : 'Waiting on their answer'
          : 'Upcoming date',
        preview: proposal.notes || '',
        primaryLabel: 'Review plan',
        secondaryLabel: 'Open chat',
        createdAt: proposal.createdAt || proposal.proposedDate,
        payload: proposal
      };
    });

export const buildActionInboxItems = ({
  likesReceived = [],
  whoLikedMe = [],
  messageRequests = [],
  actionableMatches = [],
  dateProposals = []
} = {}) => {
  const mergedLikes = mergeInboundLikes(likesReceived, whoLikedMe);
  const dateItems = buildDateInboxItems(dateProposals);

  const likeItems = mergedLikes.map((like) => ({
    id: `like-${like.userId}`,
    kind: 'like',
    priority: like.isRevealed ? 3 : 4,
    title: like.isRevealed ? `${like.firstName} liked you` : 'Someone liked you',
    subtitle: like.isRevealed
      ? 'Like back to turn this into a real conversation.'
      : 'Like back to see whether this becomes a match.',
    meta: like.isRevealed ? like.location?.city || 'Nearby on LinkUp' : 'Premium reveal available',
    primaryLabel: 'Like back',
    secondaryLabel: 'View profile',
    createdAt: like.likedAt,
    payload: like
  }));

  const requestItems = (Array.isArray(messageRequests) ? messageRequests : []).map((request) => ({
    id: `request-${request.id}`,
    kind: 'request',
    priority: 0,
    title: `${request.firstName} sent a message request`,
    subtitle: request.message || 'A new request is waiting for you.',
    meta: request.location?.city || 'Nearby on LinkUp',
    primaryLabel: 'Accept',
    secondaryLabel: 'Decline',
    createdAt: request.createdAt,
    payload: request
  }));

  const rescueItems = (Array.isArray(actionableMatches) ? actionableMatches : []).map(
    ({ match, suggestion }) => ({
      id: `rescue-${match.id}-${suggestion.kind}`,
      kind: 'rescue',
      priority: 5,
      title: suggestion.title,
      subtitle: suggestion.description,
      meta:
        suggestion.kind === 'ready_to_plan'
          ? 'Next best step'
          : suggestion.kind === 'revive'
            ? 'Rescue nudge'
            : 'Fresh match',
      preview: suggestion.prefillMessage || suggestion.secondaryPrefillMessage || '',
      primaryLabel: suggestion.ctaLabel,
      secondaryLabel: suggestion.secondaryCtaLabel || '',
      createdAt: match.lastMessageAt || match.matchedAt || match.createdAt,
      payload: {
        match,
        suggestion
      }
    })
  );

  return [...requestItems, ...dateItems, ...likeItems, ...rescueItems].sort((leftItem, rightItem) => {
    if (leftItem.priority !== rightItem.priority) {
      return leftItem.priority - rightItem.priority;
    }

    return toTimestamp(rightItem.createdAt) - toTimestamp(leftItem.createdAt);
  });
};
