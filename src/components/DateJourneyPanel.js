import React, { useCallback, useEffect, useMemo, useState } from 'react';
import datingProfileService from '../services/datingProfileService';
import videoCallService from '../services/videoCallService';
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

  const slotSuggestions = useMemo(() => createSlotSuggestions(), []);
  const activeMatch = match || initialMatch || null;
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
    const recommendedDateType = dateTypes[0]?.value || 'coffee';
    const defaultSlot = slotSuggestions[0]?.value || toLocalDateTimeInputValue(new Date(Date.now() + 48 * 60 * 60 * 1000));

    if (!rescheduleTarget) {
      setSelectedDateType(recommendedDateType);
      setPlannerDateTime(defaultSlot);
      setPlannerNotes('');
      setLocationIdea('');
    }
  }, [activeMatch?.matchId, dateTypes, rescheduleTarget, slotSuggestions]);

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
    </section>
  );
};

export default DateJourneyPanel;
