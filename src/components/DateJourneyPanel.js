import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import datingProfileService from '../services/datingProfileService';
import {
  createReminder,
  getAcceptedTrustedContacts,
  shareReminderWithContacts,
} from '../services/remindersService';
import videoCallService from '../services/videoCallService';
import {
  buildDateCheckInReminderPayload,
  buildDateSafetyReminderPayload,
  extractReminderId,
  formatDateSafetyCopy,
  getDateSafetyShareTarget,
  getShareTypeLabel,
  normalizeTrustedContacts,
} from '../utils/dateSafety';
import {
  buildLocalIdentityPack,
  buildVideoDateExperience,
} from '../utils/datingPhaseTwo';
import '../styles/DateJourneyPanel.css';

const DATE_TYPE_LABELS = {
  coffee: 'Coffee',
  walk: 'Walk',
  dinner: 'Dinner',
  video_date: 'Video Date'
};

const FALLBACK_DATE_TYPES = [
  {
    value: 'coffee',
    label: 'Coffee',
    reason: 'Easy first-date energy with plenty of room to talk.',
    isRecommended: true
  },
  {
    value: 'walk',
    label: 'Walk',
    reason: 'Low-pressure movement can make conversation feel natural.',
    isRecommended: false
  },
  {
    value: 'dinner',
    label: 'Dinner',
    reason: 'A longer plan works well once the conversation has momentum.',
    isRecommended: false
  },
  {
    value: 'video_date',
    label: 'Video Date',
    reason: 'A comfortable option when you want a quick vibe check first.',
    isRecommended: false
  }
];

const CHECK_IN_OFFSET_OPTIONS = [
  { value: 90, label: '90 minutes after start' },
  { value: 150, label: '2.5 hours after start' },
  { value: 210, label: '3.5 hours after start' }
];

const toLocalDateTimeInputValue = (value) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const createSlotSuggestions = () => {
  const templates = [
    { days: 1, hour: 18, minute: 30 },
    { days: 1, hour: 20, minute: 0 },
    { days: 2, hour: 12, minute: 30 },
    { days: 2, hour: 19, minute: 0 },
    { days: 3, hour: 18, minute: 0 },
    { days: 4, hour: 11, minute: 0 }
  ];
  const now = Date.now();

  return templates
    .map((template) => {
      const nextDate = new Date();
      nextDate.setSeconds(0, 0);
      nextDate.setDate(nextDate.getDate() + template.days);
      nextDate.setHours(template.hour, template.minute, 0, 0);

      const sameDay = template.days === 0;
      const dayLabel = sameDay
        ? 'Today'
        : template.days === 1
          ? 'Tomorrow'
          : nextDate.toLocaleDateString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            });

      return {
        label: `${dayLabel} at ${nextDate.toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit'
        })}`,
        value: toLocalDateTimeInputValue(nextDate)
      };
    })
    .filter((slot) => new Date(slot.value).getTime() > now + 60 * 60 * 1000);
};

const formatProposalDateTime = (proposal) => {
  if (!proposal?.proposedDate) {
    return '';
  }

  const normalizedTime = String(proposal.proposedTime || '12:00').slice(0, 5);
  const date = new Date(`${proposal.proposedDate}T${normalizedTime}`);

  if (Number.isNaN(date.getTime())) {
    return `${proposal.proposedDate} ${normalizedTime}`;
  }

  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const inferDateTypeFromProposal = (proposal) => {
  const normalizedActivity = String(proposal?.suggestedActivity || '').trim().toLowerCase();

  if (normalizedActivity.includes('video')) {
    return 'video_date';
  }

  if (normalizedActivity.includes('walk')) {
    return 'walk';
  }

  if (normalizedActivity.includes('dinner')) {
    return 'dinner';
  }

  return 'coffee';
};

const buildProposalPayloadDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { proposedDate: '', proposedTime: '' };
  }

  const proposedDate = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
  const proposedTime = [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0')
  ].join(':');

  return {
    proposedDate,
    proposedTime
  };
};

const DateJourneyPanel = ({
  matchId,
  match: initialMatch = null,
  onMatchUpdated,
  onScheduleVideoCall
}) => {
  const [match, setMatch] = useState(initialMatch);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [panelStatus, setPanelStatus] = useState('');
  const [selectedDateType, setSelectedDateType] = useState('coffee');
  const [plannerDateTime, setPlannerDateTime] = useState('');
  const [plannerNotes, setPlannerNotes] = useState('');
  const [locationIdea, setLocationIdea] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [dateFeedback, setDateFeedback] = useState({
    rating: 4,
    feedbackText: '',
    wouldDateAgain: true,
    matchQualityRating: 4,
    locationRating: 4
  });
  const [videoFeedback, setVideoFeedback] = useState({
    rating: 4,
    summary: '',
    wouldMeetInPerson: true
  });
  const [trustedContacts, setTrustedContacts] = useState([]);
  const [loadingTrustedContacts, setLoadingTrustedContacts] = useState(false);
  const [selectedTrustedContactIds, setSelectedTrustedContactIds] = useState([]);
  const [safetyNote, setSafetyNote] = useState('');
  const [checkInEnabled, setCheckInEnabled] = useState(true);
  const [checkInOffsetMinutes, setCheckInOffsetMinutes] = useState(150);
  const plannerTrackedRef = useRef(false);

  const slotSuggestions = useMemo(() => createSlotSuggestions(), []);
  const activeMatch = match || initialMatch || null;
  const identityPack = useMemo(() => buildLocalIdentityPack(activeMatch || {}), [activeMatch]);
  const dateTypes = activeMatch?.journey?.suggestedDateTypes?.length
    ? activeMatch.journey.suggestedDateTypes
    : FALLBACK_DATE_TYPES;
  const partnerName = activeMatch?.firstName || 'your match';
  const incomingPendingProposal = proposals.find(
    (proposal) => proposal.status === 'pending' && proposal.isReceived
  ) || null;
  const outgoingPendingProposal = proposals.find(
    (proposal) => proposal.status === 'pending' && proposal.isSent
  ) || null;
  const acceptedProposal = activeMatch?.journey?.latestAcceptedProposal || null;
  const latestCompletedVideoSession = activeMatch?.journey?.latestCompletedVideoSession || null;
  const needsDateFeedback = Boolean(
    acceptedProposal &&
    !acceptedProposal.hasFeedback &&
    new Date(`${acceptedProposal.proposedDate}T${String(acceptedProposal.proposedTime || '12:00').slice(0, 5)}`).getTime() <= Date.now()
  );
  const needsVideoFeedback = Boolean(
    latestCompletedVideoSession &&
    !latestCompletedVideoSession.currentUserFeedbackSubmitted
  );
  const safetyShareTarget = useMemo(
    () => getDateSafetyShareTarget({
      acceptedProposal,
      outgoingPendingProposal,
      incomingPendingProposal
    }),
    [acceptedProposal, outgoingPendingProposal, incomingPendingProposal]
  );
  const safetyShareTypeLabel = getShareTypeLabel(safetyShareTarget?.type);
  const safetyShareSummary = safetyShareTarget?.proposal
    ? formatDateSafetyCopy(safetyShareTarget.proposal, partnerName, safetyShareTypeLabel)
    : '';
  const videoDateExperience = useMemo(
    () =>
      buildVideoDateExperience({
        match: activeMatch || {},
        identityPack,
        feedback: videoFeedback,
        latestSession: latestCompletedVideoSession || {}
      }),
    [activeMatch, identityPack, latestCompletedVideoSession, videoFeedback]
  );

  const refreshPanel = useCallback(async (showLoader = true) => {
    if (!matchId) {
      return;
    }

    if (showLoader) {
      setLoading(true);
    }

    setPanelError('');

    try {
      const [nextMatch, proposalData] = await Promise.all([
        datingProfileService.getMatchById(matchId),
        datingProfileService.getDateProposals('all')
      ]);

      const filteredProposals = (proposalData?.proposals || [])
        .filter((proposal) => String(proposal.matchId) === String(matchId))
        .sort((leftProposal, rightProposal) => (
          new Date(rightProposal.createdAt).getTime() - new Date(leftProposal.createdAt).getTime()
        ));

      setMatch(nextMatch);
      setProposals(filteredProposals);
      onMatchUpdated?.(nextMatch);
    } catch (error) {
      setPanelError(typeof error === 'string' ? error : 'Failed to load date journey');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [matchId, onMatchUpdated]);

  useEffect(() => {
    setMatch(initialMatch || null);
  }, [initialMatch]);

  useEffect(() => {
    if (!matchId) {
      return;
    }

    void refreshPanel();
  }, [matchId, refreshPanel]);

  useEffect(() => {
    let cancelled = false;

    const loadTrustedContacts = async () => {
      setLoadingTrustedContacts(true);

      try {
        const payload = await getAcceptedTrustedContacts();
        if (cancelled) {
          return;
        }

        setTrustedContacts(normalizeTrustedContacts(payload));
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load trusted contacts:', error);
        }
      } finally {
        if (!cancelled) {
          setLoadingTrustedContacts(false);
        }
      }
    };

    loadTrustedContacts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const recommendedDateType = dateTypes[0]?.value || 'coffee';
    const defaultSlot = slotSuggestions[0]?.value || toLocalDateTimeInputValue(new Date(Date.now() + 48 * 60 * 60 * 1000));

    if (!rescheduleTarget) {
      setSelectedDateType(recommendedDateType);
      setPlannerDateTime(defaultSlot);
      setPlannerNotes('');
      setLocationIdea('');
    }
  }, [activeMatch?.matchId, dateTypes, rescheduleTarget, slotSuggestions]);

  useEffect(() => {
    if (!matchId || plannerTrackedRef.current) {
      return;
    }

    plannerTrackedRef.current = true;
    datingProfileService.trackFunnelEvent('dating_date_planner_opened', {
      matchId,
      context: {
        hasAcceptedProposal: Boolean(acceptedProposal),
        hasPendingProposal: Boolean(incomingPendingProposal || outgoingPendingProposal)
      }
    }).catch(() => {});
  }, [acceptedProposal, incomingPendingProposal, matchId, outgoingPendingProposal]);

  if (!matchId) {
    return null;
  }

  const handleResetPlanner = () => {
    setRescheduleTarget(null);
    setSelectedDateType(dateTypes[0]?.value || 'coffee');
    setPlannerDateTime(
      slotSuggestions[0]?.value || toLocalDateTimeInputValue(new Date(Date.now() + 48 * 60 * 60 * 1000))
    );
    setPlannerNotes('');
    setLocationIdea('');
  };

  const handleToggleTrustedContact = (contactId) => {
    setSelectedTrustedContactIds((currentIds) => (
      currentIds.includes(contactId)
        ? currentIds.filter((id) => id !== contactId)
        : [...currentIds, contactId]
    ));
  };

  const handleCopySafetyPlan = async () => {
    if (!safetyShareSummary) {
      return;
    }

    try {
      await navigator.clipboard.writeText(safetyShareSummary);
      setPanelStatus('Date details copied. You can send them manually if needed.');
      setPanelError('');
    } catch (error) {
      setPanelError('Unable to copy the date details right now.');
    }
  };

  const handleShareWithTrustedContacts = async () => {
    if (!safetyShareTarget?.proposal) {
      setPanelError('Share a date plan first, then you can send it to trusted contacts.');
      return;
    }

    if (selectedTrustedContactIds.length === 0) {
      setPanelError('Choose at least one trusted contact first.');
      return;
    }

    const reminderPayload = buildDateSafetyReminderPayload({
      proposal: safetyShareTarget.proposal,
      partnerName,
      shareType: safetyShareTypeLabel,
      note: safetyNote
    });

    if (!reminderPayload) {
      setPanelError('We could not prepare this plan for sharing.');
      return;
    }

    setActionLoading('share-safety');
    setPanelError('');
    setPanelStatus('');

    try {
      const reminderResponse = await createReminder(reminderPayload);
      const reminderId = extractReminderId(reminderResponse);

      if (!reminderId) {
        throw new Error('The safety reminder was created, but we could not find its ID to share.');
      }

      await shareReminderWithContacts(reminderId, selectedTrustedContactIds);
      const statusMessages = [
        `Shared this ${safetyShareTypeLabel} with ${selectedTrustedContactIds.length} trusted contact${selectedTrustedContactIds.length === 1 ? '' : 's'}.`
      ];

      datingProfileService.trackFunnelEvent('dating_safety_plan_shared', {
        matchId,
        context: {
          shareType: safetyShareTypeLabel,
          contactCount: selectedTrustedContactIds.length
        }
      }).catch(() => {});

      if (checkInEnabled) {
        const checkInPayload = buildDateCheckInReminderPayload({
          proposal: safetyShareTarget.proposal,
          partnerName,
          minutesAfterStart: checkInOffsetMinutes,
          note: safetyNote
        });

        if (checkInPayload) {
          const checkInResponse = await createReminder(checkInPayload);
          const checkInReminderId = extractReminderId(checkInResponse);

          if (checkInReminderId) {
            await shareReminderWithContacts(checkInReminderId, selectedTrustedContactIds);
            datingProfileService.trackFunnelEvent('dating_check_in_reminder_created', {
              matchId,
              context: {
                contactCount: selectedTrustedContactIds.length,
                minutesAfterStart: checkInOffsetMinutes
              }
            }).catch(() => {});

            const checkInAt = new Date(`${checkInPayload.dueDate}T${checkInPayload.dueTime}`);
            const checkInLabel = Number.isNaN(checkInAt.getTime())
              ? `${checkInPayload.dueDate} ${checkInPayload.dueTime}`
              : checkInAt.toLocaleString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                });

            statusMessages.push(`Trusted-contact check-in set for ${checkInLabel}.`);
          }
        }
      }

      setPanelStatus(statusMessages.join(' '));
      setSafetyNote('');
    } catch (error) {
      setPanelError(typeof error === 'string' ? error : error.message || 'Failed to share the safety plan');
    } finally {
      setActionLoading('');
    }
  };

  const handleSubmitPlanner = async () => {
    if (!activeMatch?.userId) {
      return;
    }

    if (selectedDateType === 'video_date' && typeof onScheduleVideoCall === 'function') {
      onScheduleVideoCall(activeMatch);
      return;
    }

    const { proposedDate, proposedTime } = buildProposalPayloadDate(plannerDateTime);

    if (!proposedDate || !proposedTime) {
      setPanelError('Choose a valid date and time for the plan.');
      return;
    }

    const activityLabel = DATE_TYPE_LABELS[selectedDateType] || selectedDateType;
    const combinedNotes = [plannerNotes.trim(), locationIdea.trim() ? `Location idea: ${locationIdea.trim()}` : null]
      .filter(Boolean)
      .join('\n');

    setActionLoading(rescheduleTarget ? 'reschedule' : 'create');
    setPanelError('');
    setPanelStatus('');

    try {
      if (rescheduleTarget) {
        await datingProfileService.rescheduleDateProposal(rescheduleTarget.id, {
          proposedDate,
          proposedTime,
          suggestedActivity: activityLabel,
          notes: combinedNotes
        });
        setPanelStatus('Updated plan sent.');
      } else {
        await datingProfileService.createDateProposal({
          recipientId: activeMatch.userId,
          proposedDate,
          proposedTime,
          suggestedActivity: activityLabel,
          notes: combinedNotes
        });
        setPanelStatus('Date plan sent.');
      }

      handleResetPlanner();
      await refreshPanel(false);
    } catch (error) {
      setPanelError(typeof error === 'string' ? error : 'Failed to send the date plan');
    } finally {
      setActionLoading('');
    }
  };

  const handleAcceptProposal = async (proposalId) => {
    setActionLoading(`accept-${proposalId}`);
    setPanelError('');
    setPanelStatus('');

    try {
      await datingProfileService.acceptDateProposal(proposalId);
      setPanelStatus('Date plan accepted.');
      await refreshPanel(false);
    } catch (error) {
      setPanelError(typeof error === 'string' ? error : 'Failed to accept the plan');
    } finally {
      setActionLoading('');
    }
  };

  const handleDeclineProposal = async (proposalId) => {
    setActionLoading(`decline-${proposalId}`);
    setPanelError('');
    setPanelStatus('');

    try {
      await datingProfileService.declineDateProposal(proposalId, 'Not the right fit for now');
      setPanelStatus('Date plan declined.');
      await refreshPanel(false);
    } catch (error) {
      setPanelError(typeof error === 'string' ? error : 'Failed to decline the plan');
    } finally {
      setActionLoading('');
    }
  };

  const handleCancelProposal = async (proposalId) => {
    if (!window.confirm('Cancel this date proposal?')) {
      return;
    }

    setActionLoading(`cancel-${proposalId}`);
    setPanelError('');
    setPanelStatus('');

    try {
      await datingProfileService.cancelDateProposal(proposalId);
      setPanelStatus('Date plan cancelled.');
      await refreshPanel(false);
    } catch (error) {
      setPanelError(typeof error === 'string' ? error : 'Failed to cancel the plan');
    } finally {
      setActionLoading('');
    }
  };

  const handleStartReschedule = (proposal) => {
    setRescheduleTarget(proposal);
    setSelectedDateType(inferDateTypeFromProposal(proposal));
    setPlannerDateTime(
      toLocalDateTimeInputValue(`${proposal.proposedDate}T${String(proposal.proposedTime || '12:00').slice(0, 5)}`)
    );
    setPlannerNotes(proposal.notes || '');
    setLocationIdea('');
    setPanelStatus('');
    setPanelError('');
  };

  const handleSubmitDateFeedback = async () => {
    if (!acceptedProposal) {
      return;
    }

    setActionLoading(`date-feedback-${acceptedProposal.id}`);
    setPanelError('');
    setPanelStatus('');

    try {
      await datingProfileService.submitDateFeedback(acceptedProposal.id, dateFeedback);
      setPanelStatus('Private date reflection saved.');
      await refreshPanel(false);
    } catch (error) {
      setPanelError(typeof error === 'string' ? error : 'Failed to save date feedback');
    } finally {
      setActionLoading('');
    }
  };

  const handleSubmitVideoFeedback = async () => {
    if (!latestCompletedVideoSession) {
      return;
    }

    setActionLoading(`video-feedback-${latestCompletedVideoSession.id}`);
    setPanelError('');
    setPanelStatus('');

    try {
      await videoCallService.submitFeedback(latestCompletedVideoSession.id, videoFeedback);
      setPanelStatus('Private video date reflection saved.');
      await refreshPanel(false);
    } catch (error) {
      setPanelError(typeof error === 'string' ? error : 'Failed to save video date feedback');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <section className="date-journey-panel">
      <div className="date-journey-header">
        <div>
          <h3>Plan a Date</h3>
          <p>Turn the match into a real plan with low-pressure ideas, responses, and follow-up reflections.</p>
        </div>
        <span className="date-journey-progress">
          {activeMatch?.journey?.progressCount || 0}/{activeMatch?.journey?.milestones?.length || 5} milestones
        </span>
      </div>

      {loading ? (
        <div className="date-journey-empty">
          <p>Loading date journey...</p>
        </div>
      ) : null}

      {panelError ? (
        <div className="date-journey-banner error" role="alert">
          {panelError}
        </div>
      ) : null}

      {panelStatus ? (
        <div className="date-journey-banner success" role="status">
          {panelStatus}
        </div>
      ) : null}

      {activeMatch?.journey?.nudge ? (
        <div className="date-journey-nudge-card">
          <strong>{activeMatch.journey.nudge.title}</strong>
          <p>{activeMatch.journey.nudge.message}</p>
          {activeMatch.journey.nudge.suggestions?.length > 0 ? (
            <div className="date-journey-suggestions">
              {activeMatch.journey.nudge.suggestions.map((suggestion) => (
                <span key={suggestion} className="date-journey-suggestion">
                  {suggestion}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {activeMatch?.journey?.milestones?.length > 0 ? (
        <div className="date-journey-milestones">
          {activeMatch.journey.milestones.map((milestone) => (
            <span
              key={milestone.key}
              className={`date-journey-milestone ${milestone.achieved ? 'achieved' : ''}`}
            >
              {milestone.label}
            </span>
          ))}
        </div>
      ) : null}

      {incomingPendingProposal ? (
        <article className="date-proposal-card waiting">
          <div className="date-proposal-card-header">
            <h4>{partnerName} suggested {incomingPendingProposal.suggestedActivity}</h4>
            <span className="date-proposal-status">Pending your reply</span>
          </div>
          <p className="date-proposal-time">{formatProposalDateTime(incomingPendingProposal)}</p>
          {incomingPendingProposal.notes ? (
            <p className="date-proposal-notes">{incomingPendingProposal.notes}</p>
          ) : null}
          <div className="date-proposal-actions">
            <button
              type="button"
              className="date-proposal-primary"
              onClick={() => handleAcceptProposal(incomingPendingProposal.id)}
              disabled={actionLoading === `accept-${incomingPendingProposal.id}`}
            >
              {actionLoading === `accept-${incomingPendingProposal.id}` ? 'Accepting...' : 'Accept'}
            </button>
            <button
              type="button"
              className="date-proposal-secondary"
              onClick={() => handleStartReschedule(incomingPendingProposal)}
            >
              Reschedule
            </button>
            <button
              type="button"
              className="date-proposal-ghost"
              onClick={() => handleDeclineProposal(incomingPendingProposal.id)}
              disabled={actionLoading === `decline-${incomingPendingProposal.id}`}
            >
              {actionLoading === `decline-${incomingPendingProposal.id}` ? 'Declining...' : 'Decline'}
            </button>
          </div>
        </article>
      ) : null}

      {outgoingPendingProposal ? (
        <article className="date-proposal-card outgoing">
          <div className="date-proposal-card-header">
            <h4>You suggested {outgoingPendingProposal.suggestedActivity}</h4>
            <span className="date-proposal-status">Waiting on {partnerName}</span>
          </div>
          <p className="date-proposal-time">{formatProposalDateTime(outgoingPendingProposal)}</p>
          {outgoingPendingProposal.notes ? (
            <p className="date-proposal-notes">{outgoingPendingProposal.notes}</p>
          ) : null}
          <div className="date-proposal-actions">
            <button
              type="button"
              className="date-proposal-secondary"
              onClick={() => handleStartReschedule(outgoingPendingProposal)}
            >
              Update Plan
            </button>
            <button
              type="button"
              className="date-proposal-ghost"
              onClick={() => handleCancelProposal(outgoingPendingProposal.id)}
              disabled={actionLoading === `cancel-${outgoingPendingProposal.id}`}
            >
              {actionLoading === `cancel-${outgoingPendingProposal.id}` ? 'Cancelling...' : 'Cancel'}
            </button>
          </div>
        </article>
      ) : null}

      {acceptedProposal ? (
        <article className="date-proposal-card accepted">
          <div className="date-proposal-card-header">
            <h4>{acceptedProposal.suggestedActivity} is on the calendar</h4>
            <span className="date-proposal-status">Accepted</span>
          </div>
          <p className="date-proposal-time">{formatProposalDateTime(acceptedProposal)}</p>
          {acceptedProposal.notes ? (
            <p className="date-proposal-notes">{acceptedProposal.notes}</p>
          ) : null}
        </article>
      ) : null}

      {safetyShareTarget?.proposal ? (
        <section className="date-safety-card">
          <div className="date-safety-header">
            <div>
              <h4>Date Safety</h4>
              <p>
                Share this {safetyShareTypeLabel} with trusted contacts so someone you trust knows where you expect to be.
              </p>
            </div>
            <button
              type="button"
              className="date-proposal-ghost"
              onClick={handleCopySafetyPlan}
            >
              Copy Details
            </button>
          </div>

          <div className="date-safety-summary">
            {safetyShareSummary.split('\n').map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>

          {loadingTrustedContacts ? (
            <div className="date-safety-empty">
              <p>Loading trusted contacts...</p>
            </div>
          ) : trustedContacts.length > 0 ? (
            <>
              <div className="date-safety-contact-list">
                {trustedContacts.map((contact) => (
                  <label key={contact.id} className="date-safety-contact">
                    <input
                      type="checkbox"
                      checked={selectedTrustedContactIds.includes(contact.id)}
                      onChange={() => handleToggleTrustedContact(contact.id)}
                    />
                    <div>
                      <strong>{contact.name}</strong>
                      <span>{contact.relationship}</span>
                      {contact.note ? <small>{contact.note}</small> : null}
                    </div>
                  </label>
                ))}
              </div>

              <label className="date-planner-field">
                <span>Optional safety note</span>
                <textarea
                  value={safetyNote}
                  onChange={(event) => setSafetyNote(event.target.value)}
                  placeholder="Example: Please check in with me if I have not messaged by 10:30 PM."
                  rows={2}
                  maxLength={240}
                />
              </label>

              <div className="date-safety-checkin-card">
                <label className="date-feedback-toggle">
                  <input
                    type="checkbox"
                    checked={checkInEnabled}
                    onChange={(event) => setCheckInEnabled(event.target.checked)}
                  />
                  <span>Also schedule a trusted-contact check-in</span>
                </label>

                <p className="date-safety-checkin-copy">
                  DatingHub can create a second reminder so your trusted contacts know when to expect your
                  "I'm okay" message after the plan starts.
                </p>

                {checkInEnabled ? (
                  <label className="date-planner-field">
                    <span>Check-in timing</span>
                    <select
                      value={checkInOffsetMinutes}
                      onChange={(event) => setCheckInOffsetMinutes(Number.parseInt(event.target.value, 10) || 150)}
                    >
                      {CHECK_IN_OFFSET_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <div className="date-safety-actions">
                <button
                  type="button"
                  className="date-planner-submit"
                  onClick={handleShareWithTrustedContacts}
                  disabled={actionLoading === 'share-safety'}
                >
                  {actionLoading === 'share-safety' ? 'Sharing...' : 'Share With Trusted Contacts'}
                </button>
                <button
                  type="button"
                  className="date-proposal-secondary"
                  onClick={() => setSelectedTrustedContactIds(trustedContacts.map((contact) => contact.id))}
                >
                  Select All
                </button>
              </div>
            </>
          ) : (
            <div className="date-safety-empty">
              <p>No trusted contacts yet. Add them in ReminderAlert first, then you can share date plans here.</p>
            </div>
          )}
        </section>
      ) : null}

      {identityPack.localDateSuggestions?.length > 0 ? (
        <div className="date-journey-nudge-card">
          <strong>Local ideas that fit this match</strong>
          <p>{partnerName} can probably say yes faster when the plan feels simple, familiar, and easy to picture.</p>
          <div className="date-journey-suggestions">
            {identityPack.localDateSuggestions.slice(0, 2).map((idea) => (
              <span key={`${idea.type}-${idea.title}`} className="date-journey-suggestion">
                {idea.title}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="date-planner-form">
        <div className="date-planner-header">
          <h4>{rescheduleTarget ? 'Reschedule the plan' : `Suggest something with ${partnerName}`}</h4>
          {rescheduleTarget ? (
            <button type="button" className="date-planner-reset" onClick={handleResetPlanner}>
              Clear
            </button>
          ) : null}
        </div>

        <div className="date-type-grid">
          {dateTypes.map((dateType) => (
            <button
              key={dateType.value}
              type="button"
              className={`date-type-chip ${selectedDateType === dateType.value ? 'active' : ''}`}
              onClick={() => setSelectedDateType(dateType.value)}
            >
              <strong>{dateType.label}</strong>
              <span>{dateType.reason}</span>
            </button>
          ))}
        </div>

        <div className="date-slot-list">
          {slotSuggestions.map((slot) => (
            <button
              key={slot.value}
              type="button"
              className={`date-slot-chip ${plannerDateTime === slot.value ? 'active' : ''}`}
              onClick={() => setPlannerDateTime(slot.value)}
            >
              {slot.label}
            </button>
          ))}
        </div>

        <label className="date-planner-field">
          <span>Date and time</span>
          <input
            type="datetime-local"
            value={plannerDateTime}
            onChange={(event) => setPlannerDateTime(event.target.value)}
          />
        </label>

        <label className="date-planner-field">
          <span>Location idea</span>
          <input
            type="text"
            value={locationIdea}
            onChange={(event) => setLocationIdea(event.target.value)}
            placeholder="Cozy cafe, riverside walk, favorite ramen spot..."
            maxLength={120}
          />
        </label>

        <label className="date-planner-field">
          <span>Note</span>
          <textarea
            value={plannerNotes}
            onChange={(event) => setPlannerNotes(event.target.value)}
            placeholder="Keep it easy, low-pressure, and specific."
            rows={3}
            maxLength={400}
          />
        </label>

        <button
          type="button"
          className="date-planner-submit"
          onClick={handleSubmitPlanner}
          disabled={actionLoading === 'create' || actionLoading === 'reschedule'}
        >
          {selectedDateType === 'video_date' && typeof onScheduleVideoCall === 'function'
            ? 'Open Video Scheduler'
            : actionLoading === 'create'
              ? 'Sending...'
              : actionLoading === 'reschedule'
                ? 'Updating...'
                : rescheduleTarget
                  ? 'Send Updated Plan'
                  : 'Send Date Plan'}
        </button>
      </div>

      {needsDateFeedback ? (
        <div className="date-feedback-card">
          <div className="date-feedback-header">
            <h4>Private reflection after the date</h4>
            <p>Only you should see this. Capture the details while they are still clear.</p>
          </div>

          <div className="date-feedback-grid">
            <label>
              <span>Overall rating</span>
              <select
                value={dateFeedback.rating}
                onChange={(event) => setDateFeedback((current) => ({
                  ...current,
                  rating: Number.parseInt(event.target.value, 10) || 4
                }))}
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <option key={rating} value={rating}>{rating}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Match quality</span>
              <select
                value={dateFeedback.matchQualityRating}
                onChange={(event) => setDateFeedback((current) => ({
                  ...current,
                  matchQualityRating: Number.parseInt(event.target.value, 10) || 4
                }))}
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <option key={rating} value={rating}>{rating}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Location fit</span>
              <select
                value={dateFeedback.locationRating}
                onChange={(event) => setDateFeedback((current) => ({
                  ...current,
                  locationRating: Number.parseInt(event.target.value, 10) || 4
                }))}
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <option key={rating} value={rating}>{rating}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="date-planner-field">
            <span>Private note</span>
            <textarea
              value={dateFeedback.feedbackText}
              onChange={(event) => setDateFeedback((current) => ({
                ...current,
                feedbackText: event.target.value
              }))}
              rows={3}
              placeholder="How did it actually feel?"
              maxLength={400}
            />
          </label>

          <label className="date-feedback-toggle">
            <input
              type="checkbox"
              checked={dateFeedback.wouldDateAgain}
              onChange={(event) => setDateFeedback((current) => ({
                ...current,
                wouldDateAgain: event.target.checked
              }))}
            />
            <span>I would want another date with {partnerName}</span>
          </label>

          <button
            type="button"
            className="date-planner-submit"
            onClick={handleSubmitDateFeedback}
            disabled={actionLoading === `date-feedback-${acceptedProposal?.id}`}
          >
            {actionLoading === `date-feedback-${acceptedProposal?.id}` ? 'Saving...' : 'Save Private Reflection'}
          </button>
        </div>
      ) : null}

      {needsVideoFeedback ? (
        <div className="date-feedback-card">
          <div className="date-feedback-header">
            <h4>Private reflection after the video date</h4>
            <p>Keep a quick note on the vibe before you decide what the next step should be.</p>
          </div>

          <div className="date-feedback-grid">
            <label>
              <span>Overall rating</span>
              <select
                value={videoFeedback.rating}
                onChange={(event) => setVideoFeedback((current) => ({
                  ...current,
                  rating: Number.parseInt(event.target.value, 10) || 4
                }))}
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <option key={rating} value={rating}>{rating}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="date-planner-field">
            <span>Private note</span>
            <textarea
              value={videoFeedback.summary}
              onChange={(event) => setVideoFeedback((current) => ({
                ...current,
                summary: event.target.value
              }))}
              rows={3}
              placeholder="Did the conversation feel easy, curious, awkward, warm?"
              maxLength={400}
            />
          </label>

          <label className="date-feedback-toggle">
            <input
              type="checkbox"
              checked={videoFeedback.wouldMeetInPerson}
              onChange={(event) => setVideoFeedback((current) => ({
                ...current,
                wouldMeetInPerson: event.target.checked
              }))}
            />
            <span>I would be open to meeting {partnerName} in person</span>
          </label>

          <button
            type="button"
            className="date-planner-submit"
            onClick={handleSubmitVideoFeedback}
            disabled={actionLoading === `video-feedback-${latestCompletedVideoSession?.id}`}
          >
            {actionLoading === `video-feedback-${latestCompletedVideoSession?.id}` ? 'Saving...' : 'Save Video Reflection'}
          </button>
        </div>
      ) : null}

      {latestCompletedVideoSession ? (
        <div className="date-feedback-card video-follow-up-card">
          <div className="date-feedback-header">
            <h4>Video-date follow-up</h4>
            <p>Use the call to decide the next low-pressure step instead of leaving the momentum hanging.</p>
          </div>

          {videoDateExperience.postCallSuggestions?.length > 0 ? (
            <div className="date-journey-suggestions">
              {videoDateExperience.postCallSuggestions.map((suggestion) => (
                <span key={suggestion} className="date-journey-suggestion">
                  {suggestion}
                </span>
              ))}
            </div>
          ) : null}

          {videoDateExperience.showBookAnotherDateCta ? (
            <button
              type="button"
              className="date-planner-submit"
              onClick={() => {
                setSelectedDateType(dateTypes[0]?.value || 'coffee');
                setPanelStatus('A real-world plan is ready to send below while the call is still fresh.');
                setPanelError('');
              }}
            >
              Turn This Into a Real Date
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default DateJourneyPanel;
