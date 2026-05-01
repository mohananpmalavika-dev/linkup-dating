const DAY_MS = 24 * 60 * 60 * 1000;

export const RESURFACE_AFTER_DAYS = 3;
export const READY_TO_PLAN_MESSAGE_COUNT = 6;

const toDate = (value) => {
  if (!value) {
    return null;
  }

  const nextDate = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(nextDate.getTime()) ? null : nextDate;
};

const getMatchName = (match = {}) => match.firstName || 'there';

const getPrimaryInterest = (match = {}) =>
  Array.isArray(match.interests) ? match.interests.find(Boolean) || '' : '';

const getLatestMessageDate = (match = {}, messages = []) => {
  const messageDates = Array.isArray(messages)
    ? messages
        .map((message) => toDate(message?.timestamp || message?.createdAt || message?.created_at))
        .filter(Boolean)
    : [];

  if (messageDates.length > 0) {
    return messageDates.reduce((latest, current) => (
      current.getTime() > latest.getTime() ? current : latest
    ));
  }

  return (
    toDate(match.lastMessageAt) ||
    toDate(match.lastMessage?.createdAt) ||
    toDate(match.lastMessage?.created_at) ||
    toDate(match.lastMessage?.timestamp) ||
    null
  );
};

const getEstimatedMessageCount = (match = {}, messages = []) => {
  if (Array.isArray(messages) && messages.length > 0) {
    return messages.length;
  }

  return Number(match.messageCount || 0);
};

const hasConversation = (match = {}, messages = []) =>
  getEstimatedMessageCount(match, messages) > 0 || Boolean(match.lastMessage?.text || match.lastMessage);

const getJourneyProgress = (match = {}) => Number(match.journey?.progressCount || 0);

const getProposalValue = (proposal, camelCaseKey, snakeCaseKey) =>
  proposal?.[camelCaseKey] ?? proposal?.[snakeCaseKey] ?? null;

const toProposalDate = (proposal) => {
  const proposedDate = getProposalValue(proposal, 'proposedDate', 'proposed_date');
  if (!proposedDate) {
    return null;
  }

  const proposedTime = String(
    getProposalValue(proposal, 'proposedTime', 'proposed_time') || '12:00'
  ).slice(0, 5);
  return toDate(`${proposedDate}T${proposedTime}`);
};

export const hasActiveDatePlan = (match = {}, now = Date.now()) => {
  const pendingProposal = match.journey?.pendingProposal;
  if (
    pendingProposal?.status === 'pending' ||
    pendingProposal?.isReceived ||
    pendingProposal?.isSent ||
    pendingProposal?.is_received ||
    pendingProposal?.is_sent
  ) {
    return true;
  }

  const acceptedProposal = match.journey?.latestAcceptedProposal;
  const acceptedProposalStatus = String(acceptedProposal?.status || '').toLowerCase();
  const acceptedProposalDate = toProposalDate(acceptedProposal);
  if (
    acceptedProposal &&
    (acceptedProposalStatus === 'accepted' || !acceptedProposalStatus) &&
    acceptedProposalDate &&
    acceptedProposalDate.getTime() >= now - DAY_MS
  ) {
    return true;
  }

  return false;
};

const formatInactiveLabel = (inactiveDays) => {
  if (inactiveDays <= 1) {
    return 'about a day';
  }

  return `${inactiveDays} days`;
};

export const buildFirstMessageSuggestion = (match = {}) => {
  const name = getMatchName(match);
  const primaryInterest = getPrimaryInterest(match);

  if (primaryInterest) {
    return `Hey ${name}, I noticed we're both into ${primaryInterest}. What got you into it?`;
  }

  if (match.location?.city) {
    return `Hey ${name}, what is your favorite thing to do around ${match.location.city}?`;
  }

  if (match.occupation) {
    return `Hey ${name}, what do you enjoy most about working in ${match.occupation}?`;
  }

  return `Hey ${name}, I liked your profile. What usually makes a conversation click for you?`;
};

export const buildReviveMessageSuggestion = (match = {}, inactiveDays = RESURFACE_AFTER_DAYS) => {
  const name = getMatchName(match);
  const primaryInterest = getPrimaryInterest(match);

  if (primaryInterest) {
    return `Hey ${name}, checking back in because I still want to swap ${primaryInterest} recommendations sometime. How has your week been going?`;
  }

  if (match.location?.city) {
    return `Hey ${name}, I wanted to circle back. Has anything fun happened in ${match.location.city} lately?`;
  }

  return `Hey ${name}, checking back in after ${formatInactiveLabel(inactiveDays)}. How has your week been treating you?`;
};

export const buildPlanSuggestionMessage = (match = {}) => {
  const name = getMatchName(match);
  return `Hey ${name}, I am enjoying this conversation. Would you be up for something easy like coffee, a walk, or a quick video check-in this week?`;
};

export const getMatchRescueSuggestion = (match = {}, now = Date.now()) => {
  if (!match || hasActiveDatePlan(match, now)) {
    return null;
  }

  const latestMessageDate = getLatestMessageDate(match);
  const inactiveDays = latestMessageDate
    ? Math.floor((now - latestMessageDate.getTime()) / DAY_MS)
    : 0;
  const messageCount = getEstimatedMessageCount(match);
  const journeyProgress = getJourneyProgress(match);

  if (!hasConversation(match)) {
    return {
      kind: 'first_message',
      priority: 0,
      title: `Start the conversation with ${getMatchName(match)}`,
      description: 'New matches usually respond better to a specific opener than a generic hello.',
      ctaLabel: 'Send opener',
      actionType: 'message',
      prefillMessage: buildFirstMessageSuggestion(match),
    };
  }

  if (latestMessageDate && inactiveDays >= RESURFACE_AFTER_DAYS) {
    return {
      kind: 'revive',
      priority: 1,
      title: `Pick this chat back up`,
      description: `Things have been quiet for ${formatInactiveLabel(inactiveDays)}. A light check-in can restart the conversation without pressure.`,
      ctaLabel: 'Revive chat',
      actionType: 'message',
      prefillMessage: buildReviveMessageSuggestion(match, inactiveDays),
    };
  }

  if (messageCount >= READY_TO_PLAN_MESSAGE_COUNT || journeyProgress >= 2) {
    return {
      kind: 'ready_to_plan',
      priority: 2,
      title: `${getMatchName(match)} feels ready for a plan`,
      description: 'There is already good momentum here. Suggesting something simple now can keep the energy up.',
      ctaLabel: 'Plan date',
      actionType: 'plan',
      prefillMessage: '',
      secondaryCtaLabel: 'Suggest it in chat',
      secondaryActionType: 'message',
      secondaryPrefillMessage: buildPlanSuggestionMessage(match),
    };
  }

  return null;
};

export const getActionableMatches = (matches = [], now = Date.now()) =>
  matches
    .map((match) => ({
      match,
      suggestion: getMatchRescueSuggestion(match, now),
      latestActivityAt:
        getLatestMessageDate(match)?.getTime() ||
        toDate(match.matchedAt)?.getTime() ||
        toDate(match.createdAt)?.getTime() ||
        0,
    }))
    .filter((entry) => entry.suggestion)
    .sort((leftEntry, rightEntry) => {
      if (leftEntry.suggestion.priority !== rightEntry.suggestion.priority) {
        return leftEntry.suggestion.priority - rightEntry.suggestion.priority;
      }

      return rightEntry.latestActivityAt - leftEntry.latestActivityAt;
    });

export const getConversationRescuePlan = (match = {}, messages = [], now = Date.now()) => {
  if (!match || hasActiveDatePlan(match, now) || !hasConversation(match, messages)) {
    return null;
  }

  const latestMessageDate = getLatestMessageDate(match, messages);
  const inactiveDays = latestMessageDate
    ? Math.floor((now - latestMessageDate.getTime()) / DAY_MS)
    : 0;
  const messageCount = getEstimatedMessageCount(match, messages);
  const primaryInterest = getPrimaryInterest(match);

  if (latestMessageDate && inactiveDays >= RESURFACE_AFTER_DAYS) {
    return {
      label: 'Restart gently',
      actions: [
        {
          id: 'revive-primary',
          type: 'message',
          label: 'Check in',
          message: buildReviveMessageSuggestion(match, inactiveDays),
        },
        {
          id: 'revive-interest',
          type: 'message',
          label: primaryInterest ? `Ask about ${primaryInterest}` : 'Ask an easy question',
          message: primaryInterest
            ? `We never finished this conversation and I still want your ${primaryInterest} take. What have you been into lately?`
            : `I wanted to circle back because this felt promising. What has been good in your world lately?`,
        },
      ],
    };
  }

  if (messageCount >= READY_TO_PLAN_MESSAGE_COUNT || getJourneyProgress(match) >= 2) {
    return {
      label: 'Keep the momentum going',
      actions: [
        {
          id: 'plan-date',
          type: 'plan',
          label: 'Open date planner',
        },
        {
          id: 'plan-chat',
          type: 'message',
          label: 'Suggest something easy',
          message: buildPlanSuggestionMessage(match),
        },
        {
          id: 'plan-video',
          type: 'message',
          label: 'Suggest a quick video call',
          message: `I would be up for a quick video vibe check sometime this week if you are.`,
        },
      ],
    };
  }

  return null;
};
