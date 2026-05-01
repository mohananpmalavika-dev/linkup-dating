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

const TRUSTED_NUMBER_STORAGE_KEY = 'linkup_sos_trusted_number';
const DEFAULT_SESSION_DURATION_MINUTES = 180;

const KERALA_HELP_PATHS = [
  {
    id: 'erss',
    title: 'Kerala Police ERSS',
    number: '112',
    description: 'Urgent police, fire, medical, and emergency dispatch support.',
    badge: 'Emergency',
    officialLabel: 'Kerala Police ERSS',
    officialUrl: 'https://keralapolice.gov.in/page/emergency-response-support-system',
  },
  {
    id: 'mitra-181',
    title: 'Mitra Women Helpline',
    number: '181',
    description: '24x7 women safety support, crisis help, and referrals.',
    badge: 'Women support',
    officialLabel: 'Mitra 181 details',
    officialUrl: 'https://kerala.gov.in/forwoman/MzEzNjE5MTY4LjI4/100',
  },
  {
    id: 'women-1091',
    title: 'Kerala Police Women Helpline',
    number: '1091',
    description: 'Police helpline for women safety concerns.',
    badge: 'Police',
    officialLabel: 'Police contacts',
    officialUrl: 'https://keralapolice.gov.in/page/contacts',
  },
  {
    id: 'cybercrime',
    title: 'Cybercrime Helpline',
    number: '1930',
    description: 'Fraud, impersonation, harassment, sextortion, or payment scams.',
    badge: 'Cybercrime',
    officialLabel: 'Cybercrime portal',
    officialUrl: 'https://cybercrime.gov.in/',
  },
];

const formatDateTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'Not shared yet';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const buildMapsUrl = (location) => {
  if (!Number.isFinite(Number(location?.latitude)) || !Number.isFinite(Number(location?.longitude))) {
    return '';
  }

  return `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
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

const cleanPhoneNumber = (value) => {
  const cleaned = String(value || '')
    .replace(/[^\d+]/g, '')
    .replace(/(?!^)\+/g, '');

  return cleaned.startsWith('00') ? `+${cleaned.slice(2)}` : cleaned;
};

const isValidPhoneNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
};

const formatPhoneHref = (value) => `tel:${cleanPhoneNumber(value)}`;

const formatSmsHref = (number, body) =>
  `sms:${cleanPhoneNumber(number)}?body=${encodeURIComponent(body)}`;

const loadSavedTrustedNumber = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(TRUSTED_NUMBER_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    const phone = cleanPhoneNumber(parsedValue?.phone);
    if (!isValidPhoneNumber(phone)) {
      return null;
    }

    return {
      name: String(parsedValue?.name || 'Trusted contact').trim() || 'Trusted contact',
      phone,
    };
  } catch (error) {
    return null;
  }
};

const SOSAlert = ({ currentUser = null }) => {
  const [trustedContacts, setTrustedContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [savedTrustedNumber, setSavedTrustedNumber] = useState(null);
  const [trustedName, setTrustedName] = useState('');
  const [trustedPhone, setTrustedPhone] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessionStartedAt, setSessionStartedAt] = useState('');
  const [sessionStatus, setSessionStatus] = useState('idle');
  const [locationSnapshot, setLocationSnapshot] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const watchIdRef = useRef(null);

  const keralaContextLabel = useMemo(() => resolveKeralaContextLabel(currentUser), [currentUser]);
  const currentContact = trustedContacts.find((contact) => contact.id === selectedContactId) || null;
  const mapsUrl = buildMapsUrl(locationSnapshot);
  const isSessionLive = sessionStatus === 'active' || sessionStatus === 'emergency';

  useEffect(() => {
    const savedNumber = loadSavedTrustedNumber();
    if (savedNumber) {
      setSavedTrustedNumber(savedNumber);
      setTrustedName(savedNumber.name);
      setTrustedPhone(savedNumber.phone);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadTrustedContacts = async () => {
      setLoadingContacts(true);

      try {
        const response = await getAcceptedTrustedContacts();
        if (!cancelled) {
          setTrustedContacts(normalizeTrustedContacts(response));
        }
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

    void loadTrustedContacts();

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
      lastUpdated: timestamp,
    };

    setLocationSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      ...nextLocation,
      address: currentSnapshot?.address || '',
    }));

    try {
      const address = await dateSafetyService.reverseGeocode(position.latitude, position.longitude);
      setLocationSnapshot((currentSnapshot) => (
        currentSnapshot
          ? { ...currentSnapshot, address }
          : { ...nextLocation, address }
      ));
    } catch (error) {
      // Coordinates are still useful if the address lookup fails.
    }

    if (!activeSessionId) {
      return;
    }

    try {
      await dateSafetyService.updateLocation(activeSessionId, position.latitude, position.longitude);
    } catch (error) {
      setErrorMessage(error.message || 'Location was captured, but LinkUp could not update it.');
    }
  };

  const captureLocation = async (activeSessionId = sessionId) => {
    const location = await dateSafetyService.getUserLocation();
    await updateLocationSnapshot(location, activeSessionId);
    return location;
  };

  const ensureSession = async () => {
    if (sessionId && isSessionLive) {
      return sessionId;
    }

    if (!selectedContactId) {
      throw new Error('In-app SOS needs a LinkUp trusted contact. You can still call or text your saved trusted number.');
    }

    const response = await dateSafetyService.startSession(
      selectedContactId,
      null,
      DEFAULT_SESSION_DURATION_MINUTES
    );

    if (!response?.success) {
      throw new Error(response?.error || 'Unable to start a LinkUp safety session.');
    }

    const nextSessionId = getSessionIdFromResponse(response);
    if (!nextSessionId) {
      throw new Error('LinkUp did not return a session ID.');
    }

    setSessionId(nextSessionId);
    setSessionStartedAt(getSessionStartFromResponse(response));
    setSessionStatus('active');
    return nextSessionId;
  };

  const handleSaveTrustedNumber = (event) => {
    event.preventDefault();

    const phone = cleanPhoneNumber(trustedPhone);
    if (!isValidPhoneNumber(phone)) {
      setErrorMessage('Enter a valid trusted phone number.');
      setStatusMessage('');
      return;
    }

    const nextTrustedNumber = {
      name: trustedName.trim() || 'Trusted contact',
      phone,
    };

    setSavedTrustedNumber(nextTrustedNumber);
    setTrustedName(nextTrustedNumber.name);
    setTrustedPhone(nextTrustedNumber.phone);
    setErrorMessage('');
    setStatusMessage(`${nextTrustedNumber.name} is saved as your trusted number.`);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TRUSTED_NUMBER_STORAGE_KEY, JSON.stringify(nextTrustedNumber));
    }
  };

  const handleRemoveTrustedNumber = () => {
    setSavedTrustedNumber(null);
    setTrustedName('');
    setTrustedPhone('');
    setErrorMessage('');
    setStatusMessage('Trusted number removed.');

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TRUSTED_NUMBER_STORAGE_KEY);
    }
  };

  const handleShareLocation = async () => {
    setActionLoading('share-location');
    setErrorMessage('');
    setStatusMessage('');

    try {
      const location = locationSnapshot || await captureLocation(sessionId || null);
      const nextMapsUrl = buildMapsUrl(locationSnapshot || location);
      const shareText = [
        'LinkUp safety update',
        `Area: ${keralaContextLabel}`,
        nextMapsUrl ? `Location: ${nextMapsUrl}` : 'Location could not be attached.',
      ].filter(Boolean).join('\n');

      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'LinkUp safety update',
          text: shareText,
          url: nextMapsUrl || undefined,
        });
        setStatusMessage('Location shared from your device.');
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setStatusMessage('Location copied. Paste it into SMS or WhatsApp.');
      } else {
        throw new Error('Sharing is not available on this device.');
      }
    } catch (error) {
      setErrorMessage(error.message || 'Unable to share your location right now.');
    } finally {
      setActionLoading('');
    }
  };

  const handleTextTrustedNumber = async () => {
    if (!savedTrustedNumber?.phone) {
      setErrorMessage('Add one trusted phone number first.');
      setStatusMessage('');
      return;
    }

    setActionLoading('text-trusted');
    setErrorMessage('');
    setStatusMessage('');

    try {
      let nextMapsUrl = buildMapsUrl(locationSnapshot);
      let locationAttached = Boolean(nextMapsUrl);

      if (!nextMapsUrl) {
        try {
          const location = await captureLocation(sessionId || null);
          nextMapsUrl = buildMapsUrl(location);
          locationAttached = Boolean(nextMapsUrl);
        } catch (error) {
          locationAttached = false;
        }
      }

      const message = [
        'I need help. Please call or check on me now.',
        `Area: ${keralaContextLabel}`,
        nextMapsUrl ? `My location: ${nextMapsUrl}` : null,
      ].filter(Boolean).join('\n');

      if (typeof window !== 'undefined') {
        window.location.href = formatSmsHref(savedTrustedNumber.phone, message);
      }

      setStatusMessage(
        locationAttached
          ? `Message with location ready for ${savedTrustedNumber.name}.`
          : `Message ready for ${savedTrustedNumber.name}. Location was not attached.`
      );
    } catch (error) {
      setErrorMessage(error.message || 'Unable to prepare a trusted contact message.');
    } finally {
      setActionLoading('');
    }
  };

  const handleActivateSos = async () => {
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm('Activate LinkUp SOS now? Your location will be shared with your LinkUp trusted contact.');

    if (!confirmed) {
      return;
    }

    setActionLoading('activate-sos');
    setErrorMessage('');
    setStatusMessage('');

    try {
      const activeSessionId = await ensureSession();
      const location = await captureLocation(activeSessionId);
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
    } catch (error) {
      setErrorMessage(error.message || 'LinkUp could not activate SOS.');
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
            Call emergency help, text one trusted number, or share your current location from one simple screen.
          </p>
        </div>

        <button
          type="button"
          className="sos-emergency-call"
          onClick={() => handleDialNumber('112')}
        >
          <span>Emergency</span>
          Call Kerala Emergency 112
        </button>
      </section>

      {errorMessage ? (
        <div className="sos-status-banner error" role="alert">
          <strong>Issue</strong>
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {!errorMessage && statusMessage ? (
        <div className="sos-status-banner" role="status">
          <strong>Update</strong>
          <span>{statusMessage}</span>
        </div>
      ) : null}

      <section className="sos-layout">
        <section className="sos-panel sos-priority-panel">
          <div className="sos-panel-heading">
            <p>Need Help Now</p>
            <h2>Quick Actions</h2>
          </div>

          <div className="sos-big-actions">
            <button
              type="button"
              className="sos-primary-action danger"
              onClick={() => handleDialNumber('112')}
            >
              Call 112 Now
            </button>
            <button
              type="button"
              className="sos-primary-action"
              onClick={handleTextTrustedNumber}
              disabled={actionLoading === 'text-trusted'}
            >
              {actionLoading === 'text-trusted' ? 'Preparing Message...' : 'Text Trusted Number'}
            </button>
            <button
              type="button"
              className="sos-secondary-action"
              onClick={handleShareLocation}
              disabled={actionLoading === 'share-location'}
            >
              {actionLoading === 'share-location' ? 'Getting Location...' : 'Share My Location'}
            </button>
            <button
              type="button"
              className="sos-secondary-action"
              onClick={handleActivateSos}
              disabled={actionLoading === 'activate-sos'}
            >
              {actionLoading === 'activate-sos' ? 'Activating...' : 'Activate LinkUp SOS'}
            </button>
          </div>

          <div className="sos-current-state">
            <div>
              <span>Trusted number</span>
              <strong>{savedTrustedNumber ? `${savedTrustedNumber.name} (${savedTrustedNumber.phone})` : 'Not added yet'}</strong>
            </div>
            <div>
              <span>LinkUp contact</span>
              <strong>
                {loadingContacts
                  ? 'Loading...'
                  : currentContact
                    ? currentContact.name
                    : 'Not selected'}
              </strong>
            </div>
            <div>
              <span>Last location</span>
              <strong>{locationSnapshot?.address || (mapsUrl ? 'Map link ready' : 'Not shared yet')}</strong>
            </div>
            <div>
              <span>SOS status</span>
              <strong>{sessionStatus === 'emergency' ? 'Active' : isSessionLive ? 'Session ready' : 'Idle'}</strong>
            </div>
          </div>

          {mapsUrl ? (
            <p className="sos-map-link">
              Latest map link: {mapsUrl}
            </p>
          ) : null}
        </section>

        <section className="sos-panel">
          <div className="sos-panel-heading">
            <p>One Trusted Number</p>
            <h2>Trusted Contact</h2>
          </div>

          <form className="sos-trusted-form" onSubmit={handleSaveTrustedNumber}>
            <label className="sos-field">
              <span>Name</span>
              <input
                type="text"
                value={trustedName}
                onChange={(event) => setTrustedName(event.target.value)}
                placeholder="Trusted person"
                maxLength={40}
              />
            </label>

            <label className="sos-field">
              <span>Phone number</span>
              <input
                type="tel"
                value={trustedPhone}
                onChange={(event) => setTrustedPhone(event.target.value)}
                placeholder="+91 98765 43210"
                inputMode="tel"
              />
            </label>

            <div className="sos-action-row">
              <button type="submit" className="sos-primary-action">
                Save Trusted Number
              </button>
              {savedTrustedNumber ? (
                <button
                  type="button"
                  className="sos-text-action danger"
                  onClick={handleRemoveTrustedNumber}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </form>

          {savedTrustedNumber ? (
            <div className="sos-trusted-card">
              <div>
                <span>Saved</span>
                <strong>{savedTrustedNumber.name}</strong>
                <p>{savedTrustedNumber.phone}</p>
              </div>
              <div className="sos-contact-actions">
                <button
                  type="button"
                  className="sos-secondary-action compact"
                  onClick={() => handleDialNumber(savedTrustedNumber.phone)}
                >
                  Call Trusted Number
                </button>
                <button
                  type="button"
                  className="sos-text-action"
                  onClick={handleTextTrustedNumber}
                  disabled={actionLoading === 'text-trusted'}
                >
                  Text Location
                </button>
              </div>
            </div>
          ) : (
            <div className="sos-empty-state">
              Add one phone number you trust. It stays on this device and is used for quick call or SMS actions.
            </div>
          )}
        </section>

        <section className="sos-panel">
          <div className="sos-panel-heading">
            <p>LinkUp SOS</p>
            <h2>In-App Trusted Contact</h2>
          </div>

          {loadingContacts ? (
            <div className="sos-empty-state">Loading LinkUp trusted contacts...</div>
          ) : trustedContacts.length > 0 ? (
            <label className="sos-field">
              <span>Choose contact for LinkUp SOS</span>
              <select
                value={selectedContactId}
                onChange={(event) => setSelectedContactId(event.target.value)}
              >
                {trustedContacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} - {contact.relationship}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="sos-empty-state">
              No LinkUp trusted contact is connected yet. Your saved phone number and emergency calls still work here.
            </div>
          )}

          <div className="sos-session-note">
            <span>{sessionStatus === 'emergency' ? 'SOS active' : isSessionLive ? 'Session ready' : 'No active session'}</span>
            <p>
              {sessionId
                ? `Started ${formatDateTime(sessionStartedAt)}.`
                : 'LinkUp SOS starts a safety session automatically when you activate it.'}
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
                <div>
                  <span className="sos-priority-badge">{resource.badge}</span>
                  <h3>{resource.title}</h3>
                  <p>{resource.description}</p>
                </div>

                <div className="sos-contact-actions">
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
      </section>
    </div>
  );
};

export default SOSAlert;
