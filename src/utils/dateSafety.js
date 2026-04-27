const PROPOSAL_PRIORITY = ['accepted', 'outgoing', 'incoming'];

const getProposalDateValue = (proposal = {}) => {
  if (!proposal?.proposedDate) {
    return null;
  }

  const proposedTime = String(proposal.proposedTime || '12:00').slice(0, 5);
  const nextDate = new Date(`${proposal.proposedDate}T${proposedTime}`);
  return Number.isNaN(nextDate.getTime()) ? null : nextDate;
};

export const getDateSafetyShareTarget = ({
  acceptedProposal = null,
  outgoingPendingProposal = null,
  incomingPendingProposal = null,
} = {}) => {
  const candidates = [
    { type: 'accepted', proposal: acceptedProposal },
    { type: 'outgoing', proposal: outgoingPendingProposal },
    { type: 'incoming', proposal: incomingPendingProposal },
  ];

  return candidates.find((candidate) => candidate.proposal) || null;
};

export const formatDateSafetyCopy = (proposal, partnerName = 'your match', shareType = 'date') => {
  if (!proposal) {
    return '';
  }

  const proposedTime = String(proposal.proposedTime || '12:00').slice(0, 5);
  const dateValue = getProposalDateValue(proposal);
  const timeLabel = dateValue
    ? dateValue.toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : `${proposal.proposedDate || 'TBD'} ${proposedTime}`;

  const parts = [
    `${shareType === 'date' ? 'Date plan' : 'Date idea'} with ${partnerName}`,
    `${proposal.suggestedActivity || 'Meet-up'} at ${timeLabel}`,
  ];

  if (proposal.notes) {
    parts.push(`Notes: ${proposal.notes}`);
  }

  return parts.join('\n');
};

export const buildDateSafetyReminderPayload = ({
  proposal,
  partnerName = 'your match',
  shareType = 'date',
  note = '',
}) => {
  if (!proposal?.proposedDate) {
    return null;
  }

  const summary = formatDateSafetyCopy(proposal, partnerName, shareType);
  const extraNote = String(note || '').trim();
  const description = [summary, extraNote ? `Safety note: ${extraNote}` : null]
    .filter(Boolean)
    .join('\n\n');

  return {
    title:
      shareType === 'date'
        ? `Date plan with ${partnerName}`
        : `Tentative plan with ${partnerName}`,
    description,
    dueDate: proposal.proposedDate,
    dueTime: String(proposal.proposedTime || '12:00').slice(0, 5),
    category: 'Personal',
    reminders: ['In-app'],
    completed: false,
  };
};

export const extractReminderId = (response) =>
  response?.data?._id ||
  response?.data?.id ||
  response?._id ||
  response?.id ||
  null;

export const getShareTypeLabel = (targetType) =>
  PROPOSAL_PRIORITY.includes(targetType) && targetType === 'accepted' ? 'date' : 'tentative plan';

export const normalizeTrustedContacts = (payload) => {
  const rawContacts = Array.isArray(payload?.contacts)
    ? payload.contacts
    : Array.isArray(payload?.trustedContacts)
      ? payload.trustedContacts
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  return rawContacts
    .map((contact) => ({
      id: String(contact.contactId || contact.id || contact._id || ''),
      name:
        contact.firstName ||
        contact.fullName ||
        contact.name ||
        contact.displayName ||
        contact.email ||
        'Trusted contact',
      relationship: contact.relationship || contact.relationshipLabel || 'trusted contact',
      note:
        contact.message ||
        contact.phone ||
        contact.email ||
        '',
    }))
    .filter((contact) => contact.id);
};
