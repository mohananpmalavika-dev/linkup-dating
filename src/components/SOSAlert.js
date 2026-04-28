import React, { useEffect, useMemo, useRef, useState } from 'react';
import dateSafetyService from '../services/dateSafetyService';
import { getAcceptedTrustedContacts } from '../services/remindersService';
import { normalizeTrustedContacts } from '../utils/dateSafety';
import {
  getDistrictRecord,
  getKeralaRegionLabel,
  resolveKeralaLocation,
} from '../utils/keralaLocation';
import '../styles/SOSAlert.css';

const SESSION_DURATION_OPTIONS = [
  { value: 90, label: '90 minutes' },
  { value: 180, label: '3 hours' },
  { value: 240, label: '4 hours' },
  { value: 360, label: '6 hours' },
];

const CHECK_IN_OPTIONS = [
  {
    id: 'good',
    label: 'I am safe',
    description: 'Send a calm check-in to your trusted contact.',
  },
  {
    id: 'ok',
    label: 'Running late',
    description: 'Let your contact know the date is still in progress.',
  },
  {
    id: 'help',
    label: 'Need help',
    description: 'Escalate the session and tell your contact to check in now.',
  },
];

const FALLBACK_TIPS = [
  {
    id: 'public-place',
    title: 'Choose a public first meet',
    description: 'Start with a busy cafe, mall, or other public venue where leaving is easy.',
  },
  {
    id: 'own-ride',
    title: 'Keep your own travel plan',
    description: 'Avoid depending on a date for pickup or the ride home, especially on the first meet.',
  },
  {
    id: 'trusted-contact',
    title: 'Share the plan with one trusted person',
    description: 'Let someone know where you expect to be, when you plan to leave, and who you are meeting.',
  },
  {
    id: 'charged-phone',
    title: 'Keep your phone charged and unlocked',
    description: 'Save emergency numbers and keep location access available before you leave.',
  },
];

const KERALA_HELP_PATHS = [
  {
    id: 'erss',
    title: 'Kerala Police ERSS',
    number: '112',
    description: 'Statewide emergency response for urgent police help and rapid dispatch in Kerala.',
    badge: 'Primary line',
    officialLabel: 'Open Kerala Police ERSS',
    officialUrl: 'https://keralapolice.gov.in/page/emergency-response-support-system',
  },
  {
    id: 'mitra-181',
    title: 'Mitra Women Helpline',
    number: '181',
    description: 'Kerala women information and assistance helpline with 24x7 crisis support and referrals.',
    badge: 'Women support',
    officialLabel: 'Open Mitra 181 details',
    officialUrl: 'https://kerala.gov.in/forwoman/MzEzNjE5MTY4LjI4/100',
  },
  {
    id: 'women-1091',
    title: 'Kerala Police Women Helpline',
    number: '1091',
    description: 'Police helpline listed on the official Kerala Police emergency contacts page.',
    badge: 'Police support',
    officialLabel: 'Open Kerala Police contacts',
    officialUrl: 'https://keralapolice.gov.in/page/contacts',
  },
  {
    id: 'pink-patrol',
    title: 'Pink Patrol',
    number: '1515',
    description: 'Kerala Police safety support for women and children in public spaces and transit corridors.',
    badge: 'Public safety',
    officialLabel: 'Open Pink Patrol details',
    officialUrl: 'https://keralapolice.gov.in/page/pink-police-patrol',
  },
  {
    id: 'cybercrime',
    title: 'Cybercrime Helpline',
    number: '1930',
    description: 'Use this for fraud, impersonation, harassment, sextortion, or payment scams connected to a date.',
    badge: 'Fraud response',
    officialLabel: 'Open cybercrime portal',
    officialUrl: 'https://cybercrime.gov.in/',
  },
];

const formatDateTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'Not yet recorded';
  }

  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatElapsedTime = (startValue) => {
  const startTime = startValue ? new Date(startValue) : null;
  if (!(startTime instanceof Date) || Number.isNaN(startTime.getTime())) {
    return '0m';
  }

  const elapsedMs = Date.now() - startTime.getTime();
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
};

const buildMapsUrl = (location) => {
  if (!Number.isFinite(Number(location?.latitude)) || !Number.isFinite(Number(location?.longitude))) {
    return '';
  }

  return `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
};

const normalizeHistoryItems = (payload) => {
  const rawItems = Array.isArray(payload?.sessions)
    ? payload.sessions
    : Array.isArray(payload?.history)
      ? payload.history
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  return rawItems.map((item, index) => ({
    id: String(item.id || item.sessionId || item._id || `history-${index}`),
    title: item.sosActivated ? 'SOS recorded' : 'Safety session',
    description: item.trustedFriend
      ? `Trusted contact: ${item.trustedFriend}`
      : 'Trusted contact details were not returned.',
    timestamp: item.date || item.createdAt || item.startTime || item.timestamp || '',
    status: item.status || item.sessionStatus || 'completed',
    meta: [
      `${Number(item.checkInCount || 0)} check-ins`,
      `${Number(item.duration || item.durationMinutes || 0)} min window`,
    ],
  }));
};

const normalizeTips = (payload) => {
  const rawTips = Array.isArray(payload?.tips) ? payload.tips : [];

  if (rawTips.length === 0) {
    return FALLBACK_TIPS;
  }

  return rawTips.map((tip, index) => ({
    id: String(tip.id || index),
    title: String(tip.title || 'Safety tip').replace(/^[^\w]+/, '').trim() || 'Safety tip',
    description: tip.description || 'Review the safety guidance before you head out.',
  }));
};

const resolveKeralaContextLabel = (currentUser) => {
  const location = resolveKeralaLocation({
    ...(currentUser?.location || {}),
    city: currentUser?.location?.city || currentUser?.city || '',
    district: currentUser?.location?.district || currentUser?.district || '',
    keralaRegion: currentUser?.location?.keralaRegion || currentUser?.keralaRegion || '',
    locality: currentUser?.location?.locality || currentUser?.locality || '',
    pincode: currentUser?.location?.pincode || currentUser?.pincode || '',
    state: currentUser?.location?.state || currentUser?.state || '',
    country: currentUser?.location?.country || currentUser?.country || '',
  });

  const districtLabel = getDistrictRecord(location.district)?.label || '';
  const regionLabel = location.keralaRegion ? getKeralaRegionLabel(location.keralaRegion) : '';
  const parts = [location.city, districtLabel, regionLabel].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : 'Kerala, India';
};

const getSessionIdFromResponse = (payload) =>
  payload?.sessionId || payload?.session?.id || payload?.session?._id || '';

const getSessionStartFromResponse = (payload) =>
  payload?.session?.startTime || payload?.session?.sharing_start_time || new Date().toISOString();

const formatPhoneHref = (value) => `tel:${String(value || '').replace(/[^\d+]/g, '')}`;

const SOSAlert = ({ currentUser = null }) => {
  const [trustedContacts, setTrustedContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [tips, setTips] = useState(FALLBACK_TIPS);
  const [loadingTips, setLoadingTips] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [sessionDuration, setSessionDuration] = useState(180);
  const [sessionId, setSessionId] = useState('');
  const [sessionStartedAt, setSessionStartedAt] = useState('');
  const [sessionStatus, setSessionStatus] = useState('idle');
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [locationSnapshot, setLocationSnapshot] = useState(null);
  const [lastCheckIn, setLastCheckIn] = useState(null);
  const [safetyNote, setSafetyNote] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [activityLog, setActivityLog] = useState([]);
  const watchIdRef = useRef(null);

  const currentContact = trustedContacts.find((contact) => contact.id === selectedContactId) || null;
  const keralaContextLabel = useMemo(() => resolveKeralaContextLabel(currentUser), [currentUser]);
  const isSessionLive = sessionStatus === 'active' || sessionStatus === 'emergency';
  const sessionElapsed = isSessionLive ? formatElapsedTime(sessionStartedAt) : '0m';
  const mapsUrl = buildMapsUrl(locationSnapshot);
  const timelineItems = [...activityLog, ...historyItems]
    .sort((leftItem, rightItem) => new Date(rightItem.timestamp).getTime() - new Date(leftItem.timestamp).getTime())
    .slice(0, 6);

  const pushActivity = (title, description = '') => {
    setActivityLog((currentLog) => [
      {
        id: `activity-${Date.now()}-${currentLog.length}`,
        title,
        description,
        timestamp: new Date().toISOString(),
        status: sessionStatus,
        meta: [],
      },
      ...currentLog,
    ]);
  };

  const loadHistory = async () => {
    setLoadingHistory(true);

    try {
      const response = await dateSafetyService.getSessionHistory(6);
      setHistoryItems(normalizeHistoryItems(response));
    } catch (error) {
      setHistoryItems([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadTrustedContacts = async () => {
      setLoadingContacts(true);

      try {
        const response = await getAcceptedTrustedContacts();
        if (cancelled) {
          return;
        }

        setTrustedContacts(normalizeTrustedContacts(response));
      } catch (error) {
        if (!cancelled) {
          setTrustedContacts([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingContacts(false);
        }
      }
    };

    const loadSafetyTips = async () => {
      setLoadingTips(true);

      try {
        const response = await dateSafetyService.getSafetyTips();
        if (!cancelled) {
          setTips(normalizeTips(response));
        }
      } catch (error) {
        if (!cancelled) {
          setTips(FALLBACK_TIPS);
        }
      } finally {
        if (!cancelled) {
          setLoadingTips(false);
        }
      }
    };

    void loadTrustedContacts();
    void loadHistory();
    void loadSafetyTips();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedContactId && trustedContacts.length > 0) {
      setSelectedContactId(trustedContacts[0].id);
    }
  }, [selectedContactId, trustedContacts]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        dateSafetyService.stopWatchingLocation(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  const updateLocationSnapshot = async (position, activeSessionId = sessionId) => {
    const timestamp = new Date().toISOString();
    const nextLocation = {
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
    };

    setLocationSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      ...nextLocation,
      lastUpdated: timestamp,
      updateCount: (currentSnapshot?.updateCount || 0) + 1,
      address: currentSnapshot?.address || '',
    }));

    try {
      const address = await dateSafetyService.reverseGeocode(position.latitude, position.longitude);
      setLocationSnapshot((currentSnapshot) => (
        currentSnapshot
          ? {
              ...currentSnapshot,
              address,
            }
          : {
              ...nextLocation,
              lastUpdated: timestamp,
              updateCount: 1,
              address,
            }
      ));
    } catch (error) {
      // Ignore address lookup failures and keep raw coordinates available.
    }

    if (!activeSessionId) {
      return;
    }

    try {
      await dateSafetyService.updateLocation(activeSessionId, position.latitude, position.longitude);
    } catch (error) {
      setErrorMessage(error.message || 'We could not update your live location right now.');
    }
  };

  const ensureSession = async () => {
    if (sessionId && isSessionLive) {
      return sessionId;
    }

    if (!selectedContactId) {
      throw new Error('Choose a trusted contact to use in-app SOS, or call Kerala emergency support directly below.');
    }

    const response = await dateSafetyService.startSession(selectedContactId, null, sessionDuration);

    if (!response?.success) {
      throw new Error(response?.error || 'Unable to start a LinkUp safety session.');
    }

    const nextSessionId = getSessionIdFromResponse(response);
    if (!nextSessionId) {
      throw new Error('LinkUp did not return a session ID for this safety session.');
    }

    setSessionId(nextSessionId);
    setSessionStartedAt(getSessionStartFromResponse(response));
    setSessionStatus('active');
    pushActivity(
      'Safety session started',
      currentContact ? `Linked to ${currentContact.name}.` : 'Trusted contact linked.'
    );

    return nextSessionId;
  };

  const handleStartSession = async () => {
    setActionLoading('start-session');
    setErrorMessage('');
    setStatusMessage('');

    try {
      await ensureSession();
      setStatusMessage(`Safety session is live${currentContact ? ` with ${currentContact.name}` : ''}.`);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to start your safety session.');
    } finally {
      setActionLoading('');
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) {
      return;
    }

    setActionLoading('end-session');
    setErrorMessage('');
    setStatusMessage('');

    try {
      const response = await dateSafetyService.endSession(sessionId, safetyNote.trim());
      if (!response?.success) {
        throw new Error(response?.error || 'Unable to end the current safety session.');
      }

      if (watchIdRef.current !== null) {
        dateSafetyService.stopWatchingLocation(watchIdRef.current);
        watchIdRef.current = null;
      }

      setIsSharingLocation(false);
      setSessionStatus('completed');
      setSessionId('');
      setSessionStartedAt('');
      setStatusMessage('Safety session ended. Kerala emergency buttons stay available any time you need them.');
      pushActivity('Safety session ended', 'LinkUp closed the active safety window.');
      await loadHistory();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to end the current safety session.');
    } finally {
      setActionLoading('');
    }
  };

  const handleStartLocationSharing = async () => {
    if (isSharingLocation) {
      return;
    }

    setActionLoading('start-sharing');
    setErrorMessage('');
    setStatusMessage('');

    try {
      const activeSessionId = await ensureSession();
      const location = await dateSafetyService.getUserLocation();
      await updateLocationSnapshot(location, activeSessionId);

      watchIdRef.current = dateSafetyService.watchUserLocation(
        (nextLocation) => {
          void updateLocationSnapshot(nextLocation, activeSessionId);
        },
        (error) => {
          setErrorMessage(error.message || 'Live location sharing stopped unexpectedly.');
          setIsSharingLocation(false);
          if (watchIdRef.current !== null) {
            dateSafetyService.stopWatchingLocation(watchIdRef.current);
            watchIdRef.current = null;
          }
        }
      );

      setIsSharingLocation(true);
      setStatusMessage('Live location sharing is running for this safety session.');
      pushActivity('Live location started', 'Location updates are now being shared.');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to start live location sharing.');
    } finally {
      setActionLoading('');
    }
  };

  const handleStopLocationSharing = () => {
    if (watchIdRef.current !== null) {
      dateSafetyService.stopWatchingLocation(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsSharingLocation(false);
    setStatusMessage('Live location sharing has been paused.');
    setErrorMessage('');
    pushActivity('Live location paused', 'Location updates are no longer streaming.');
  };

  const handleSendCheckIn = async (status) => {
    setActionLoading(`check-in-${status}`);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const activeSessionId = await ensureSession();
      const response = await dateSafetyService.sendCheckIn(activeSessionId, status, safetyNote.trim());

      if (!response?.success) {
        throw new Error(response?.error || 'Unable to send the check-in.');
      }

      const nextStatus = status === 'help' ? 'emergency' : 'active';
      setSessionStatus(nextStatus);
      setLastCheckIn({
        status,
        timestamp: response?.checkIn?.timestamp || new Date().toISOString(),
      });
      setStatusMessage(
        status === 'help'
          ? 'Urgent check-in sent. If you are in danger, call 112 now.'
          : 'Check-in sent to your trusted contact.'
      );
      pushActivity(
        status === 'help' ? 'Urgent check-in sent' : 'Check-in sent',
        safetyNote.trim() || `Status: ${status}.`
      );
      await loadHistory();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to send the check-in.');
    } finally {
      setActionLoading('');
    }
  };

  const handleActivateSos = async () => {
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm('Activate SOS now? LinkUp will share your latest location and mark this session as emergency.');

    if (!confirmed) {
      return;
    }

    setActionLoading('activate-sos');
    setErrorMessage('');
    setStatusMessage('');

    try {
      const activeSessionId = await ensureSession();
      const location = await dateSafetyService.getUserLocation();
      await updateLocationSnapshot(location, activeSessionId);

      const response = await dateSafetyService.activateSOS(
        activeSessionId,
        location.latitude,
        location.longitude
      );

      if (!response?.success) {
        throw new Error(response?.error || 'LinkUp could not activate SOS.');
      }

      const emergencyNumber = response?.sos?.emergencyNumber || '112';

      setSessionStatus('emergency');
      setStatusMessage(`SOS activated. Call ${emergencyNumber} if you can stay on the line safely.`);
      pushActivity(
        'SOS activated',
        `Emergency line: ${emergencyNumber}. ${safetyNote.trim() || 'Location shared from LinkUp.'}`
      );
      await loadHistory();
    } catch (error) {
      setErrorMessage(error.message || 'LinkUp could not activate SOS.');
    } finally {
      setActionLoading('');
    }
  };

  const handleShareLocation = async () => {
    setActionLoading('share-location');
    setErrorMessage('');
    setStatusMessage('');

    try {
      const location = locationSnapshot || await dateSafetyService.getUserLocation();
      if (!locationSnapshot) {
        await updateLocationSnapshot(location, sessionId || null);
      }

      const nextMapsUrl = buildMapsUrl(locationSnapshot || location);
      const shareText = [
        'LinkUp safety update',
        `Kerala context: ${keralaContextLabel}`,
        nextMapsUrl,
      ].join('\n');

      if (navigator.share) {
        await navigator.share({
          title: 'LinkUp safety update',
          text: shareText,
          url: nextMapsUrl,
        });
        setStatusMessage('Location shared from your device.');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setStatusMessage('Location copied. Paste it into WhatsApp, SMS, or another trusted channel.');
      } else {
        throw new Error('Sharing is not available on this device.');
      }

      pushActivity('Location prepared for sharing', 'A live maps link is ready for a trusted person.');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to share your location right now.');
    } finally {
      setActionLoading('');
    }
  };

  const handleDialNumber = (number) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.location.href = formatPhoneHref(number);
  };

  const handleOpenOfficialPath = (url) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="sos-page">
      <section className="sos-hero">
        <div className="sos-hero-copy">
          <p className="sos-eyebrow">Kerala Safety</p>
          <h1>Kerala SOS Safety Center</h1>
          <p className="sos-intro">
            LinkUp now exposes a real safety route for dates in Kerala: trusted-contact sessions,
            live location updates, fast check-ins, and official Kerala emergency paths in one place.
          </p>
        </div>

        <div className="sos-hero-card">
          <span className="sos-hero-label">Coverage</span>
          <strong>Prepared for {keralaContextLabel}</strong>
          <p>
            If something feels off, leave first, then use this screen to call Kerala emergency support,
            share your live location, and escalate SOS inside LinkUp.
          </p>
        </div>
      </section>

      <section className="sos-stats-grid" aria-label="Safety summary">
        <article className="sos-stat-card">
          <strong>{trustedContacts.length}</strong>
          <span>Trusted contacts</span>
          <p>{trustedContacts.length > 0 ? 'Accepted contacts are ready for LinkUp SOS.' : 'Manual Kerala help paths still work even without a saved contact.'}</p>
        </article>
        <article className="sos-stat-card">
          <strong>{isSessionLive ? (sessionStatus === 'emergency' ? 'Alert' : 'Live') : 'Idle'}</strong>
          <span>Session state</span>
          <p>{isSessionLive ? `Running for ${sessionElapsed}.` : 'Start a safety session before or during a date.'}</p>
        </article>
        <article className="sos-stat-card">
          <strong>{locationSnapshot?.updateCount || 0}</strong>
          <span>Location updates</span>
          <p>{isSharingLocation ? 'Live location is streaming right now.' : 'Manual location sharing is ready when you need it.'}</p>
        </article>
        <article className="sos-stat-card">
          <strong>{KERALA_HELP_PATHS.length}</strong>
          <span>Official help paths</span>
          <p>Kerala police, women support, and cybercrime channels are linked below.</p>
        </article>
      </section>

      {errorMessage ? (
        <div className="sos-status-banner error" role="alert">
          <span>Issue</span>
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {!errorMessage && statusMessage ? (
        <div className="sos-status-banner" role="status">
          <span>Update</span>
          <span>{statusMessage}</span>
        </div>
      ) : null}

      <section className="sos-layout">
        <div className="sos-main-column">
          <section className="sos-panel">
            <div className="sos-panel-heading">
              <p>Session</p>
              <h2>Live Safety Session</h2>
            </div>

            <div className="sos-controls-grid">
              <label className="sos-field">
                <span>Trusted contact</span>
                <select
                  value={selectedContactId}
                  onChange={(event) => setSelectedContactId(event.target.value)}
                  disabled={loadingContacts}
                >
                  <option value="">
                    {loadingContacts ? 'Loading contacts...' : 'Choose a trusted contact'}
                  </option>
                  {trustedContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} - {contact.relationship}
                    </option>
                  ))}
                </select>
              </label>

              <label className="sos-field">
                <span>Safety window</span>
                <select
                  value={sessionDuration}
                  onChange={(event) => setSessionDuration(Number.parseInt(event.target.value, 10) || 180)}
                >
                  {SESSION_DURATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="sos-action-row">
              <button
                type="button"
                className="sos-primary-action"
                onClick={handleStartSession}
                disabled={actionLoading === 'start-session' || isSessionLive}
              >
                {actionLoading === 'start-session' ? 'Starting...' : 'Start LinkUp Safety Session'}
              </button>
              <button
                type="button"
                className="sos-secondary-action"
                onClick={isSharingLocation ? handleStopLocationSharing : handleStartLocationSharing}
                disabled={actionLoading === 'start-sharing'}
              >
                {actionLoading === 'start-sharing'
                  ? 'Preparing location...'
                  : isSharingLocation
                    ? 'Pause Live Location'
                    : 'Start Live Location'}
              </button>
              <button
                type="button"
                className="sos-secondary-action"
                onClick={handleShareLocation}
                disabled={actionLoading === 'share-location'}
              >
                {actionLoading === 'share-location' ? 'Sharing...' : 'Share Current Location'}
              </button>
              <button
                type="button"
                className="sos-secondary-action"
                onClick={handleEndSession}
                disabled={actionLoading === 'end-session' || !sessionId}
              >
                {actionLoading === 'end-session' ? 'Ending...' : 'End Session'}
              </button>
            </div>

            <article className="sos-incident-card">
              <div className="sos-incident-topline">
                <div>
                  <h3>{sessionStatus === 'emergency' ? 'Emergency mode is active' : 'Current safety session'}</h3>
                  <p>
                    {sessionId
                      ? `Session started ${formatDateTime(sessionStartedAt)}.`
                      : 'No LinkUp session is active yet. Kerala help lines below still work immediately.'}
                  </p>
                </div>
                <span className={`sos-alert-status ${isSessionLive ? 'live' : 'idle'}`}>
                  {sessionStatus === 'emergency' ? 'Emergency' : isSessionLive ? 'Live' : 'Idle'}
                </span>
              </div>

              <div className="sos-summary-grid">
                <div>
                  <span>Trusted contact</span>
                  <strong>{currentContact?.name || 'Not selected'}</strong>
                </div>
                <div>
                  <span>Elapsed</span>
                  <strong>{sessionElapsed}</strong>
                </div>
                <div>
                  <span>Last location</span>
                  <strong>{locationSnapshot?.address || (mapsUrl ? 'Coordinates ready' : 'No location captured yet')}</strong>
                </div>
                <div>
                  <span>Last check-in</span>
                  <strong>
                    {lastCheckIn
                      ? `${lastCheckIn.status} at ${formatDateTime(lastCheckIn.timestamp)}`
                      : 'No check-in sent yet'}
                  </strong>
                </div>
              </div>

              {mapsUrl ? (
                <p className="sos-inline-helper">
                  Latest map link: {mapsUrl}
                </p>
              ) : null}
            </article>
          </section>

          <section className="sos-panel">
            <div className="sos-panel-heading">
              <p>Check-in</p>
              <h2>Check-ins and SOS</h2>
            </div>

            <div className="sos-toggle-stack">
              {CHECK_IN_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`sos-toggle ${lastCheckIn?.status === option.id ? 'active' : ''}`}
                  onClick={() => handleSendCheckIn(option.id)}
                  disabled={actionLoading === `check-in-${option.id}`}
                >
                  <strong>{option.label}</strong>
                  <div>{actionLoading === `check-in-${option.id}` ? 'Sending update...' : option.description}</div>
                </button>
              ))}
            </div>

            <label className="sos-field">
              <span>Optional note</span>
              <textarea
                value={safetyNote}
                onChange={(event) => setSafetyNote(event.target.value)}
                placeholder="Example: Meeting at Lulu Mall and leaving by 9:30 PM."
                rows={3}
                maxLength={240}
              />
            </label>

            <div className="sos-action-row">
              <button
                type="button"
                className="sos-primary-action"
                onClick={handleActivateSos}
                disabled={actionLoading === 'activate-sos'}
              >
                {actionLoading === 'activate-sos' ? 'Activating...' : 'Activate In-App SOS'}
              </button>
              <button
                type="button"
                className="sos-secondary-action"
                onClick={() => handleDialNumber('112')}
              >
                Call Kerala Emergency 112
              </button>
            </div>

            <div className="sos-callout">
              <strong>If you do not have a saved trusted contact yet</strong>
              <p>
                You can still call 112, 181, 1091, 1515, or 1930 directly from this screen and share your
                live maps link manually.
              </p>
            </div>
          </section>

          <section className="sos-panel">
            <div className="sos-panel-heading">
              <p>Kerala Help</p>
              <h2>Official Kerala Help Paths</h2>
            </div>

            <div className="sos-contact-list">
              {KERALA_HELP_PATHS.map((resource) => (
                <article key={resource.id} className="sos-contact-card">
                  <div className="sos-contact-stack">
                    <div>
                      <h3>{resource.title}</h3>
                      <p>{resource.description}</p>
                    </div>
                    <div className="sos-channel-row">
                      <span>Call {resource.number}</span>
                      <span>Official Kerala path</span>
                    </div>
                  </div>

                  <div className="sos-contact-actions">
                    <span className="sos-priority-badge">{resource.badge}</span>
                    <button
                      type="button"
                      className="sos-secondary-action compact"
                      onClick={() => handleDialNumber(resource.number)}
                    >
                      Call {resource.number}
                    </button>
                    <button
                      type="button"
                      className="sos-text-action"
                      onClick={() => handleOpenOfficialPath(resource.officialUrl)}
                    >
                      {resource.officialLabel}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="sos-side-column">
          <section className="sos-panel">
            <div className="sos-panel-heading">
              <p>Contacts</p>
              <h2>Trusted Contacts</h2>
            </div>

            {loadingContacts ? (
              <div className="sos-empty-state">Loading trusted contacts...</div>
            ) : trustedContacts.length > 0 ? (
              <div className="sos-contact-list">
                {trustedContacts.map((contact) => (
                  <article key={contact.id} className="sos-contact-card">
                    <div>
                      <h3>{contact.name}</h3>
                      <p>{contact.relationship}</p>
                    </div>
                    <div className="sos-contact-actions">
                      <span className="sos-priority-badge">
                        {selectedContactId === contact.id ? 'Selected' : 'Ready'}
                      </span>
                      <button
                        type="button"
                        className="sos-text-action"
                        onClick={() => setSelectedContactId(contact.id)}
                      >
                        Use for SOS
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="sos-empty-state">
                No accepted trusted contacts were found on this account yet. Kerala emergency buttons still work
                immediately, and manual location sharing is available above.
              </div>
            )}
          </section>

          <section className="sos-panel">
            <div className="sos-panel-heading">
              <p>History</p>
              <h2>Recent Safety History</h2>
            </div>

            {loadingHistory ? (
              <div className="sos-empty-state">Loading your recent safety history...</div>
            ) : timelineItems.length > 0 ? (
              <div className="sos-history-list">
                {timelineItems.map((item) => (
                  <article key={item.id} className="sos-history-card">
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                    <span className="sos-history-outcome">
                      {item.status === 'emergency' ? 'Emergency' : item.status || 'Recorded'}
                    </span>
                    <div className="sos-history-meta">
                      <span>{formatDateTime(item.timestamp)}</span>
                      {(item.meta || []).filter(Boolean).map((entry) => (
                        <span key={`${item.id}-${entry}`}>{entry}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="sos-empty-state">
                No recent safety sessions yet. Your first session will appear here after you start or escalate one.
              </div>
            )}
          </section>

          <section className="sos-panel">
            <div className="sos-panel-heading">
              <p>Before You Go</p>
              <h2>Kerala Date Safety Basics</h2>
            </div>

            {loadingTips ? (
              <div className="sos-empty-state">Loading safety guidance...</div>
            ) : (
              <ul className="sos-list">
                {tips.map((tip) => (
                  <li key={tip.id}>
                    <strong>{tip.title}:</strong> {tip.description}
                  </li>
                ))}
              </ul>
            )}

            <div className="sos-callout">
              <strong>Safe-dating fallback</strong>
              <p>
                If the app flow fails at any point, treat this screen like a fast emergency board: call the right
                Kerala line first, then leave the location and share your maps link manually.
              </p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};

export default SOSAlert;
