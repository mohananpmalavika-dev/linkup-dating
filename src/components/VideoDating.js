import React, { useCallback, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import datingProfileService from '../services/datingProfileService';
import videoCallService from '../services/videoCallService';
import { getStoredUserData } from '../utils/auth';
import { BACKEND_BASE_URL } from '../utils/api';
import {
  BACKGROUND_OPTIONS,
  CALL_QUALITY_OPTIONS,
  REMINDER_MINUTE_OPTIONS,
  formatDuration,
  formatScheduleTime,
  getBackgroundOption,
  getEndedReasonLabel,
  getNoShowLabel,
  getQualityOption,
  getSessionStatusLabel,
  getTimelineLabel,
  getMaxBitrateForQuality,
  getVideoConstraintsForQuality,
  toLocalDateTimeInputValue
} from './videoDatingUtils';
import '../styles/VideoDating.css';

const RTC_CONFIGURATION = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const OUTGOING_CALL_TIMEOUT_MS = 45 * 1000;
const SCHEDULED_NO_SHOW_TIMEOUT_MS = 2 * 60 * 1000;
const LIVE_NOTICE_TIMEOUT_MS = 4500;
const RECORDING_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm'
];

const normalizeMatch = (match) => {
  if (!match) {
    return null;
  }

  return {
    ...match,
    firstName: match.firstName || match.otherUserName || match.name || 'Your match',
    userId: match.userId ?? match.user_id ?? match.otherUserId ?? null,
    matchId: match.matchId ?? match.match_id ?? match.id ?? null,
    photos: Array.isArray(match.photos)
      ? match.photos
      : match.otherUserPhoto
        ? [match.otherUserPhoto]
        : []
  };
};

const serializeDescription = (description) => {
  if (!description) {
    return null;
  }

  if (typeof description.toJSON === 'function') {
    return description.toJSON();
  }

  return {
    type: description.type,
    sdp: description.sdp
  };
};

const downloadBlob = (blob, filename) => {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(objectUrl);
  }, 500);
};

const getRecordingMimeType = () => {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  if (typeof MediaRecorder.isTypeSupported !== 'function') {
    return RECORDING_MIME_TYPES[RECORDING_MIME_TYPES.length - 1];
  }

  return (
    RECORDING_MIME_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || ''
  );
};

const VideoDating = ({
  matchedProfile,
  matchId,
  callMode = 'outgoing',
  autoAccepted = false,
  callerName = '',
  incomingCall = null,
  onBack,
  onOpenMessages,
  startImmediately = true,
  focusSchedule = false,
  scheduledVideoDateId = null
}) => {
  const currentUser = getStoredUserData();
  const currentUserId = currentUser?.id;
  const currentUserName =
    currentUser?.firstName || currentUser?.username || currentUser?.email || 'Someone';
  const [conversationMatch, setConversationMatch] = useState(normalizeMatch(matchedProfile));
  const [loadingMatch, setLoadingMatch] = useState(Boolean(matchId) && !matchedProfile);
  const [matchError, setMatchError] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionSummary, setSessionSummary] = useState({
    match: null,
    activeSession: null,
    upcomingSessions: [],
    history: []
  });
  const [screenMode, setScreenMode] = useState(
    autoAccepted || startImmediately ? 'call' : 'hub'
  );
  const [callStatus, setCallStatus] = useState(
    callMode === 'incoming' && autoAccepted ? 'accepted' : startImmediately ? 'initiating' : 'idle'
  );
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [liveNotice, setLiveNotice] = useState('');
  const [callActionPending, setCallActionPending] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [completedSession, setCompletedSession] = useState(null);
  const [qualityPreset, setQualityPreset] = useState('balanced');
  const [virtualBackground, setVirtualBackground] = useState('none');
  const [recordingRequested, setRecordingRequested] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [scheduleInput, setScheduleInput] = useState(() => toLocalDateTimeInputValue());
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleNote, setScheduleNote] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [mediaReady, setMediaReady] = useState(false);
  const [remoteStreamAvailable, setRemoteStreamAvailable] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMessage, setRecordingMessage] = useState('');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const screenStreamRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const liveNoticeTimeoutRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const remotePeerReadyRef = useRef(false);
  const localPeerReadyRef = useRef(false);
  const readySignalSentRef = useRef(false);
  const offerSentRef = useRef(false);
  const pendingInviteRef = useRef(null);
  const callEndedRef = useRef(false);
  const finalizedSessionIdRef = useRef(null);
  const autoStartAttemptedRef = useRef(false);
  const defaultsHydratedRef = useRef(false);
  const isMountedRef = useRef(false);
  const activeSessionRef = useRef(null);
  const callRoomIdRef = useRef(incomingCall?.callId || null);
  const currentVideoDateIdRef = useRef(incomingCall?.videoDateId || scheduledVideoDateId || null);
  const callStatusRef = useRef(callStatus);
  const callDurationRef = useRef(callDuration);
  const qualityPresetRef = useRef(qualityPreset);
  const virtualBackgroundRef = useRef(virtualBackground);
  const recordingRequestedRef = useRef(recordingRequested);
  const recordingConsentRef = useRef(recordingConsent);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingCleanupRef = useRef(null);
  const recordingShouldDownloadRef = useRef(true);

  const activeMatch = conversationMatch || normalizeMatch(matchedProfile) || null;
  const activeMatchId = activeMatch?.matchId || matchId || null;
  const activeMatchUserId = activeMatch?.userId || sessionSummary.match?.otherUserId || null;
  const partnerName =
    activeMatch?.firstName ||
    sessionSummary.match?.otherUserName ||
    incomingCall?.fromUserName ||
    callerName ||
    'Your match';
  const partnerPhoto =
    activeMatch?.photos?.[0] || sessionSummary.match?.otherUserPhoto || null;
  const isCaller = callMode !== 'incoming';
  const hubBusy = callActionPending !== '';
  const endedSession = completedSession || activeSession;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    activeSessionRef.current = activeSession;
    callRoomIdRef.current = activeSession?.roomId || callRoomIdRef.current;
    currentVideoDateIdRef.current = activeSession?.id || currentVideoDateIdRef.current;
  }, [activeSession]);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    callDurationRef.current = callDuration;
  }, [callDuration]);

  useEffect(() => {
    qualityPresetRef.current = qualityPreset;
  }, [qualityPreset]);

  useEffect(() => {
    virtualBackgroundRef.current = virtualBackground;
  }, [virtualBackground]);

  useEffect(() => {
    recordingRequestedRef.current = recordingRequested;
  }, [recordingRequested]);

  useEffect(() => {
    recordingConsentRef.current = recordingConsent;
  }, [recordingConsent]);

  const clearLiveNoticeTimer = useCallback(() => {
    if (liveNoticeTimeoutRef.current) {
      window.clearTimeout(liveNoticeTimeoutRef.current);
      liveNoticeTimeoutRef.current = null;
    }
  }, []);

  const pushLiveNotice = useCallback(
    (message) => {
      if (!message) {
        return;
      }

      clearLiveNoticeTimer();
      setLiveNotice(message);
      liveNoticeTimeoutRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          setLiveNotice('');
        }
      }, LIVE_NOTICE_TIMEOUT_MS);
    },
    [clearLiveNoticeTimer]
  );

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      window.clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      window.clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  const startDurationTimer = useCallback(
    (startedAt = null) => {
      stopDurationTimer();

      if (startedAt) {
        const startedDate = new Date(startedAt);
        const elapsedSeconds = Number.isNaN(startedDate.getTime())
          ? 0
          : Math.max(0, Math.floor((Date.now() - startedDate.getTime()) / 1000));
        setCallDuration(elapsedSeconds);
      } else {
        setCallDuration(0);
      }

      durationIntervalRef.current = window.setInterval(() => {
        setCallDuration((currentDuration) => currentDuration + 1);
      }, 1000);
    },
    [stopDurationTimer]
  );

  const attachStreamToElement = useCallback(async (element, stream, { muted = false } = {}) => {
    if (!element || !stream) {
      return;
    }

    element.srcObject = stream;
    element.muted = muted;

    if (typeof element.play === 'function') {
      try {
        await element.play();
      } catch (playError) {
        console.warn('Unable to autoplay call media:', playError);
      }
    }
  }, []);

  const mergeActiveSession = useCallback((updater) => {
    setActiveSession((currentSession) => {
      const nextSession =
        typeof updater === 'function' ? updater(currentSession) : updater;
      activeSessionRef.current = nextSession;
      if (nextSession?.roomId) {
        callRoomIdRef.current = nextSession.roomId;
      }
      if (nextSession?.id) {
        currentVideoDateIdRef.current = nextSession.id;
      }
      return nextSession;
    });
  }, []);

  const applySessionToState = useCallback(
    (session) => {
      if (!session) {
        return null;
      }

      mergeActiveSession(session);
      setQualityPreset(session.liveSettings?.qualityPreset || 'balanced');
      setVirtualBackground(session.liveSettings?.currentUserBackground || 'none');
      setRecordingRequested(Boolean(session.recording?.requested));
      setRecordingConsent(Boolean(session.recording?.currentUserConsented));
      setReminderMinutes(Number.parseInt(session.reminderMinutes, 10) || 15);
      setScheduleTitle(session.title || '');
      setScheduleNote(session.note || '');
      return session;
    },
    [mergeActiveSession]
  );

  const resetNegotiationState = useCallback(() => {
    pendingIceCandidatesRef.current = [];
    remotePeerReadyRef.current = false;
    localPeerReadyRef.current = false;
    readySignalSentRef.current = false;
    offerSentRef.current = false;
    pendingInviteRef.current = null;
    callEndedRef.current = false;
    finalizedSessionIdRef.current = null;
    clearCallTimeout();
  }, [clearCallTimeout]);

  const cleanupRecordingResources = useCallback(() => {
    if (recordingCleanupRef.current) {
      recordingCleanupRef.current();
      recordingCleanupRef.current = null;
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setMediaReady(false);
  }, []);

  const stopRemoteStream = useCallback(() => {
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setRemoteStreamAvailable(false);
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    setIsScreenSharing(false);
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  }, []);

  const cleanupMediaOnly = useCallback(() => {
    clearCallTimeout();
    stopDurationTimer();
    stopScreenShare();
    cleanupRecordingResources();
    cleanupPeerConnection();
    stopLocalStream();
    stopRemoteStream();
    pendingIceCandidatesRef.current = [];
  }, [
    clearCallTimeout,
    cleanupPeerConnection,
    cleanupRecordingResources,
    stopDurationTimer,
    stopLocalStream,
    stopRemoteStream,
    stopScreenShare
  ]);

  const emitInviteIfPossible = useCallback(() => {
    const socket = socketRef.current;
    const pendingInvite = pendingInviteRef.current;

    if (!socket?.connected || !pendingInvite || !activeMatchUserId) {
      return false;
    }

    socket.emit('call:invite', {
      callId: pendingInvite.callId,
      callType: 'video',
      matchId: activeMatchId,
      targetUserId: activeMatchUserId,
      fromUserName: currentUserName,
      videoDateId: pendingInvite.videoDateId
    });

    pendingInviteRef.current = null;
    return true;
  }, [activeMatchId, activeMatchUserId, currentUserName]);

  const emitReadySignal = useCallback(() => {
    const socket = socketRef.current;

    if (
      !socket?.connected ||
      !callRoomIdRef.current ||
      !activeMatchUserId ||
      readySignalSentRef.current
    ) {
      return false;
    }

    readySignalSentRef.current = true;
    socket.emit('call:ready', {
      callId: callRoomIdRef.current,
      matchId: activeMatchId,
      targetUserId: activeMatchUserId
    });

    return true;
  }, [activeMatchId, activeMatchUserId]);

  const emitSignal = useCallback(
    (payload = {}) => {
      const socket = socketRef.current;

      if (!socket?.connected || !callRoomIdRef.current || !activeMatchUserId) {
        return;
      }

      socket.emit('call:signal', {
        callId: callRoomIdRef.current,
        matchId: activeMatchId,
        targetUserId: activeMatchUserId,
        videoDateId: currentVideoDateIdRef.current || undefined,
        ...payload
      });
    },
    [activeMatchId, activeMatchUserId]
  );

  const emitSettings = useCallback(
    (payload = {}) => {
      const socket = socketRef.current;

      if (!socket?.connected || !callRoomIdRef.current || !activeMatchUserId) {
        return;
      }

      socket.emit('call:settings', {
        callId: callRoomIdRef.current,
        matchId: activeMatchId,
        targetUserId: activeMatchUserId,
        videoDateId: currentVideoDateIdRef.current || undefined,
        ...payload
      });
    },
    [activeMatchId, activeMatchUserId]
  );

  const flushPendingIceCandidates = useCallback(async (peerConnection) => {
    while (
      pendingIceCandidatesRef.current.length > 0 &&
      peerConnection?.remoteDescription?.type
    ) {
      const nextCandidate = pendingIceCandidatesRef.current.shift();

      try {
        await peerConnection.addIceCandidate(nextCandidate);
      } catch (candidateError) {
        console.error('Failed to apply queued ICE candidate:', candidateError);
      }
    }
  }, []);

  const applyQualityPresetToLiveTrack = useCallback(async (preset) => {
    const cameraTrack = localStreamRef.current?.getVideoTracks?.()[0];
    const videoSender = peerConnectionRef.current?.getSenders?.().find(
      (candidate) => candidate.track?.kind === 'video'
    );

    if (cameraTrack && !isScreenSharing && typeof cameraTrack.applyConstraints === 'function') {
      try {
        await cameraTrack.applyConstraints(getVideoConstraintsForQuality(preset));
      } catch (constraintError) {
        console.warn('Unable to apply camera quality preset:', constraintError);
      }
    }

    if (
      videoSender &&
      typeof videoSender.getParameters === 'function' &&
      typeof videoSender.setParameters === 'function'
    ) {
      try {
        const currentParameters = videoSender.getParameters();
        const nextParameters = {
          ...currentParameters,
          encodings:
            currentParameters.encodings && currentParameters.encodings.length > 0
              ? currentParameters.encodings
              : [{}]
        };

        nextParameters.encodings[0].maxBitrate = getMaxBitrateForQuality(preset);
        await videoSender.setParameters(nextParameters);
      } catch (parameterError) {
        console.warn('Unable to update WebRTC sender quality preset:', parameterError);
      }
    }
  }, [isScreenSharing]);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: getVideoConstraintsForQuality(qualityPresetRef.current)
    });

    localStreamRef.current = stream;
    await attachStreamToElement(localVideoRef.current, stream, { muted: true });
    setMediaReady(true);
    setIsMuted(false);
    setIsVideoOn(Boolean(stream.getVideoTracks()[0]?.enabled));
    return stream;
  }, [attachStreamToElement]);

  const completeSessionOnServer = useCallback(async ({ sessionId, reason, connected }) => {
    const resolvedSessionId = sessionId || activeSessionRef.current?.id;

    if (!resolvedSessionId || finalizedSessionIdRef.current === resolvedSessionId) {
      return activeSessionRef.current;
    }

    finalizedSessionIdRef.current = resolvedSessionId;

    try {
      const response = await videoCallService.completeSession(resolvedSessionId, {
        reason,
        connected,
        durationSeconds: callDurationRef.current
      });
      return response?.session || activeSessionRef.current;
    } catch (completeError) {
      console.error('Failed to finalize video call session:', completeError);
      return activeSessionRef.current;
    }
  }, []);

  const stopLocalRecording = useCallback(
    (shouldDownload = true) => {
      recordingShouldDownloadRef.current = shouldDownload;
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder) {
        cleanupRecordingResources();
        return;
      }

      mediaRecorderRef.current = null;

      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      } else {
        cleanupRecordingResources();
      }

      setIsRecording(false);
    },
    [cleanupRecordingResources]
  );

  const finalizeCall = useCallback(
    async ({ reason = 'ended', connected = callStatusRef.current === 'connected', emitEnd = false } = {}) => {
      if (callEndedRef.current && reason !== 'connection_timeout') {
        return activeSessionRef.current;
      }

      callEndedRef.current = true;

      if (emitEnd && callRoomIdRef.current && activeMatchUserId && socketRef.current?.connected) {
        socketRef.current.emit('call:end', {
          callId: callRoomIdRef.current,
          matchId: activeMatchId,
          targetUserId: activeMatchUserId,
          reason
        });
      }

      if (isRecording) {
        stopLocalRecording(true);
      }

      cleanupMediaOnly();

      const updatedSession = await completeSessionOnServer({
        reason,
        connected
      });

      if (updatedSession) {
        applySessionToState(updatedSession);
      }

      if (isMountedRef.current) {
        setCompletedSession(updatedSession || activeSessionRef.current);
        setCallStatus(
          updatedSession?.status === 'missed'
            ? 'missed'
            : updatedSession?.status === 'declined'
              ? 'declined'
              : updatedSession?.status === 'cancelled'
                ? 'ended'
                : updatedSession?.status || 'ended'
        );
        setScreenMode('ended');
      }

      if (activeMatchId) {
        try {
          const refreshedSummary = await videoCallService.getMatchSessions(activeMatchId);
          if (isMountedRef.current) {
            setSessionSummary({
              match: refreshedSummary.match || null,
              activeSession: refreshedSummary.activeSession || null,
              upcomingSessions: Array.isArray(refreshedSummary.upcomingSessions)
                ? refreshedSummary.upcomingSessions
                : [],
              history: Array.isArray(refreshedSummary.history) ? refreshedSummary.history : []
            });
          }
        } catch (summaryError) {
          console.error('Failed to refresh video call summary after finalizing:', summaryError);
        }
      }

      return updatedSession;
    },
    [
      activeMatchId,
      activeMatchUserId,
      applySessionToState,
      cleanupMediaOnly,
      completeSessionOnServer,
      isRecording,
      stopLocalRecording
    ]
  );

  const handleConnectionFailure = useCallback(
    (message) => {
      if (callEndedRef.current) {
        return;
      }

      setError(message || 'The video connection failed.');
      void finalizeCall({
        reason: 'connection_timeout',
        connected: false,
        emitEnd: true
      });
    },
    [finalizeCall]
  );

  const ensurePeerConnection = useCallback(async () => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const stream = await ensureLocalStream();
    const peerConnection = new RTCPeerConnection(RTC_CONFIGURATION);
    peerConnectionRef.current = peerConnection;

    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

    peerConnection.ontrack = (event) => {
      const nextRemoteStream = event.streams?.[0] || remoteStreamRef.current || new MediaStream();

      if (!event.streams?.[0]) {
        nextRemoteStream.addTrack(event.track);
      }

      remoteStreamRef.current = nextRemoteStream;
      setRemoteStreamAvailable(true);
      void attachStreamToElement(remoteVideoRef.current, nextRemoteStream);
    };

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      emitSignal({
        candidate:
          typeof event.candidate.toJSON === 'function'
            ? event.candidate.toJSON()
            : event.candidate
      });
    };

    peerConnection.onconnectionstatechange = () => {
      switch (peerConnection.connectionState) {
        case 'connected':
          clearCallTimeout();
          setCallStatus('connected');
          startDurationTimer(activeSessionRef.current?.startedAt);
          pushLiveNotice('You are live now.');
          break;
        case 'connecting':
          setCallStatus('connecting');
          break;
        case 'failed':
          handleConnectionFailure('The video connection failed.');
          break;
        case 'disconnected':
          if (!callEndedRef.current) {
            setCallStatus('connecting');
            pushLiveNotice('Connection looks unstable. Trying to recover.');
          }
          break;
        default:
          break;
      }
    };

    return peerConnection;
  }, [
    attachStreamToElement,
    clearCallTimeout,
    emitSignal,
    ensureLocalStream,
    handleConnectionFailure,
    pushLiveNotice,
    startDurationTimer
  ]);

  const startOutgoingOffer = useCallback(async () => {
    if (!isCaller || offerSentRef.current) {
      return;
    }

    offerSentRef.current = true;

    try {
      const peerConnection = await ensurePeerConnection();
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      emitSignal({
        description: serializeDescription(peerConnection.localDescription || offer)
      });
      setCallStatus('connecting');
    } catch (offerError) {
      offerSentRef.current = false;
      throw offerError;
    }
  }, [emitSignal, ensurePeerConnection, isCaller]);

  const prepareLocalMedia = useCallback(async () => {
    await ensurePeerConnection();
    localPeerReadyRef.current = true;
  }, [ensurePeerConnection]);

  const persistLiveSettings = useCallback(
    async (patch = {}) => {
      const videoDateId = currentVideoDateIdRef.current;
      const nextQualityPreset = patch.qualityPreset ?? qualityPresetRef.current;
      const nextBackground = patch.virtualBackground ?? virtualBackgroundRef.current;
      const nextScreenShareEnabled =
        patch.screenShareEnabled === undefined ? isScreenSharing : patch.screenShareEnabled;

      if (!videoDateId) {
        emitSettings({
          qualityPreset: nextQualityPreset,
          virtualBackground: nextBackground,
          screenShareEnabled: nextScreenShareEnabled,
          recordingRequested: patch.recordingRequested,
          recordingEnabled: patch.recordingEnabled,
          recordingConsent: patch.recordingConsent
        });
        return null;
      }

      try {
        const response = await videoCallService.updateSettings(videoDateId, {
          qualityPreset: nextQualityPreset,
          virtualBackground: nextBackground,
          screenShareEnabled: nextScreenShareEnabled
        });

        if (response?.session) {
          applySessionToState(response.session);
        }

        emitSettings({
          qualityPreset: nextQualityPreset,
          virtualBackground: nextBackground,
          screenShareEnabled: nextScreenShareEnabled,
          recordingRequested: patch.recordingRequested,
          recordingEnabled:
            patch.recordingEnabled ?? response?.session?.recording?.enabled ?? undefined,
          recordingConsent: patch.recordingConsent
        });

        return response?.session || null;
      } catch (settingsError) {
        console.error('Failed to persist call settings:', settingsError);
        setError(
          typeof settingsError === 'string'
            ? settingsError
            : 'Unable to update the live call settings.'
        );
        return null;
      }
    },
    [applySessionToState, emitSettings, isScreenSharing]
  );

  const updateRecordingState = useCallback(
    async (nextValues = {}) => {
      const videoDateId = currentVideoDateIdRef.current;
      const nextRequested =
        nextValues.requested === undefined
          ? recordingRequestedRef.current
          : Boolean(nextValues.requested);
      const nextConsent =
        nextValues.consent === undefined
          ? recordingConsentRef.current
          : Boolean(nextValues.consent);

      setRecordingRequested(nextRequested);
      setRecordingConsent(nextConsent);

      if (!videoDateId) {
        emitSettings({
          recordingRequested: nextRequested,
          recordingConsent: nextConsent,
          recordingEnabled: false
        });
        return null;
      }

      try {
        const response = await videoCallService.updateRecordingConsent(videoDateId, {
          requested: nextRequested,
          consent: nextConsent
        });

        if (response?.session) {
          applySessionToState(response.session);
        }

        emitSettings({
          recordingRequested: response?.session?.recording?.requested ?? nextRequested,
          recordingConsent: response?.session?.recording?.currentUserConsented ?? nextConsent,
          recordingEnabled: response?.session?.recording?.enabled ?? false
        });

        if (response?.session?.recording?.enabled) {
          pushLiveNotice('Recording is now allowed for both people.');
        } else if (nextRequested) {
          pushLiveNotice('Recording consent updated. Waiting for both people to agree.');
        }

        return response?.session || null;
      } catch (recordingError) {
        console.error('Failed to update recording consent:', recordingError);
        setError(
          typeof recordingError === 'string'
            ? recordingError
            : 'Unable to update recording consent right now.'
        );
        return null;
      }
    },
    [applySessionToState, emitSettings, pushLiveNotice]
  );

  const restoreCameraTrack = useCallback(async () => {
    const cameraTrack = localStreamRef.current?.getVideoTracks?.()[0];
    const videoSender = peerConnectionRef.current?.getSenders?.().find(
      (candidate) => candidate.track?.kind === 'video'
    );

    if (videoSender && cameraTrack) {
      await videoSender.replaceTrack(cameraTrack);
    }

    if (localVideoRef.current && localStreamRef.current) {
      await attachStreamToElement(localVideoRef.current, localStreamRef.current, { muted: true });
    }
  }, [attachStreamToElement]);

  const toggleScreenShare = useCallback(async () => {
    if (!peerConnectionRef.current) {
      return;
    }

    try {
      if (isScreenSharing) {
        await restoreCameraTrack();
        stopScreenShare();
        await persistLiveSettings({ screenShareEnabled: false });
        pushLiveNotice('Screen sharing stopped.');
        return;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      const screenTrack = displayStream.getVideoTracks()[0];
      const videoSender = peerConnectionRef.current.getSenders().find(
        (candidate) => candidate.track?.kind === 'video'
      );

      if (videoSender && screenTrack) {
        await videoSender.replaceTrack(screenTrack);
      }

      screenStreamRef.current = displayStream;
      setIsScreenSharing(true);
      await attachStreamToElement(localVideoRef.current, displayStream, { muted: true });
      await persistLiveSettings({ screenShareEnabled: true });
      pushLiveNotice('Screen sharing started.');

      screenTrack.onended = async () => {
        try {
          await restoreCameraTrack();
          stopScreenShare();
          await persistLiveSettings({ screenShareEnabled: false });
        } catch (shareStopError) {
          console.error('Failed to restore camera after screen share:', shareStopError);
        }
      };
    } catch (shareError) {
      console.error('Screen sharing failed:', shareError);
      setError('Unable to start screen sharing in this browser.');
    }
  }, [
    attachStreamToElement,
    isScreenSharing,
    persistLiveSettings,
    pushLiveNotice,
    restoreCameraTrack,
    stopScreenShare
  ]);

  const buildRecordingStream = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas recording is unavailable.');
    }

    let animationFrameId = null;
    const localVideoElement = localVideoRef.current;
    const remoteVideoElement = remoteVideoRef.current;
    const localLabel = currentUserName || 'You';
    const remoteLabel = partnerName || 'Your match';

    const drawPlaceholder = (x, y, width, height, label, accent) => {
      context.fillStyle = accent;
      context.fillRect(x, y, width, height);
      context.fillStyle = 'rgba(5, 7, 13, 0.72)';
      context.fillRect(x, y, width, height);
      context.fillStyle = '#ffffff';
      context.font = '700 28px sans-serif';
      context.fillText(label, x + 24, y + height - 28);
    };

    const drawFrame = () => {
      context.fillStyle = '#05070d';
      context.fillRect(0, 0, canvas.width, canvas.height);

      if (remoteVideoElement?.videoWidth && remoteVideoElement?.videoHeight && remoteStreamAvailable) {
        context.drawImage(remoteVideoElement, 0, 0, canvas.width, canvas.height);
      } else {
        drawPlaceholder(0, 0, canvas.width, canvas.height, remoteLabel, '#d06030');
      }

      const pipWidth = 300;
      const pipHeight = 190;
      const pipX = canvas.width - pipWidth - 32;
      const pipY = canvas.height - pipHeight - 32;

      context.save();
      context.fillStyle = 'rgba(15, 23, 42, 0.92)';
      context.fillRect(pipX - 6, pipY - 6, pipWidth + 12, pipHeight + 12);
      if (localVideoElement?.videoWidth && localVideoElement?.videoHeight && mediaReady) {
        context.drawImage(localVideoElement, pipX, pipY, pipWidth, pipHeight);
      } else {
        drawPlaceholder(pipX, pipY, pipWidth, pipHeight, localLabel, '#f1a06f');
      }
      context.fillStyle = 'rgba(3, 7, 18, 0.78)';
      context.fillRect(pipX + 14, pipY + pipHeight - 42, 130, 28);
      context.fillStyle = '#ffffff';
      context.font = '600 18px sans-serif';
      context.fillText(localLabel, pipX + 24, pipY + pipHeight - 22);
      context.restore();

      animationFrameId = window.requestAnimationFrame(drawFrame);
    };

    drawFrame();

    const canvasStream = canvas.captureStream(24);
    const audioContextClass = window.AudioContext || window.webkitAudioContext;
    let mixedAudioTracks = [];
    let audioContext = null;

    if (audioContextClass) {
      audioContext = new audioContextClass();
      const destination = audioContext.createMediaStreamDestination();
      const sourceStreams = [localStreamRef.current, remoteStreamRef.current].filter(Boolean);

      sourceStreams.forEach((stream) => {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          return;
        }

        const sourceNode = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
        sourceNode.connect(destination);
      });

      mixedAudioTracks = destination.stream.getAudioTracks();
    }

    const recordingStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...mixedAudioTracks
    ]);

    const cleanup = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      canvasStream.getTracks().forEach((track) => track.stop());
      if (audioContext) {
        audioContext.close().catch(() => {});
      }
    };

    return {
      stream: recordingStream,
      cleanup
    };
  }, [currentUserName, mediaReady, partnerName, remoteStreamAvailable]);

  const startLocalRecording = useCallback(async () => {
    const activeRecording = activeSessionRef.current?.recording;
    const mimeType = getRecordingMimeType();

    if (!activeRecording?.enabled) {
      setRecordingMessage('Both people need to consent before recording can begin.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setRecordingMessage('This browser does not support local call recording.');
      return;
    }

    try {
      recordedChunksRef.current = [];
      const { stream, cleanup } = buildRecordingStream();
      recordingCleanupRef.current = cleanup;
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      recordingShouldDownloadRef.current = true;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: mimeType || 'video/webm'
        });

        if (recordingShouldDownloadRef.current && blob.size > 0) {
          downloadBlob(
            blob,
            `datinghub-video-call-${currentVideoDateIdRef.current || Date.now()}.webm`
          );
          setRecordingMessage('Recording saved to your device.');
        } else {
          setRecordingMessage('Recording stopped.');
        }

        recordedChunksRef.current = [];
        cleanupRecordingResources();
        setIsRecording(false);
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setRecordingMessage('Recording failed. Please try again.');
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingMessage('Recording started on this device.');
    } catch (recordingError) {
      console.error('Failed to start local recording:', recordingError);
      cleanupRecordingResources();
      setRecordingMessage('Unable to start local recording.');
    }
  }, [buildRecordingStream, cleanupRecordingResources]);

  const refreshSessionSummary = useCallback(async () => {
    if (!activeMatchId) {
      setSessionSummary({
        match: null,
        activeSession: null,
        upcomingSessions: [],
        history: []
      });
      return;
    }

    setLoadingSessions(true);

    try {
      const response = await videoCallService.getMatchSessions(activeMatchId);
      const nextSummary = {
        match: response.match || null,
        activeSession: response.activeSession || null,
        upcomingSessions: Array.isArray(response.upcomingSessions) ? response.upcomingSessions : [],
        history: Array.isArray(response.history) ? response.history : []
      };

      if (!isMountedRef.current) {
        return;
      }

      setSessionSummary(nextSummary);

      if (!defaultsHydratedRef.current) {
        const preferredSession =
          nextSummary.activeSession || nextSummary.upcomingSessions[0] || null;

        if (preferredSession) {
          setQualityPreset(preferredSession.liveSettings?.qualityPreset || 'balanced');
          setVirtualBackground(preferredSession.liveSettings?.currentUserBackground || 'none');
          setRecordingRequested(Boolean(preferredSession.recording?.requested));
          setRecordingConsent(Boolean(preferredSession.recording?.currentUserConsented));
          setReminderMinutes(
            Number.parseInt(preferredSession.reminderMinutes, 10) || 15
          );
          setScheduleTitle(preferredSession.title || '');
          setScheduleNote(preferredSession.note || '');
          setScheduleInput(
            toLocalDateTimeInputValue(
              preferredSession.scheduledAt || new Date(Date.now() + 60 * 60 * 1000)
            )
          );
          defaultsHydratedRef.current = true;
        }
      }

      if (
        nextSummary.activeSession &&
        activeSessionRef.current &&
        Number(nextSummary.activeSession.id) === Number(activeSessionRef.current.id)
      ) {
        applySessionToState(nextSummary.activeSession);
      }
    } catch (summaryError) {
      console.error('Failed to load video call sessions:', summaryError);
      if (isMountedRef.current) {
        setError(
          typeof summaryError === 'string'
            ? summaryError
            : 'Unable to load your video call details right now.'
        );
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingSessions(false);
      }
    }
  }, [activeMatchId, applySessionToState]);

  useEffect(() => {
    let cancelled = false;

    const loadConversationMatch = async () => {
      const normalizedInitialMatch = normalizeMatch(matchedProfile);

      if (normalizedInitialMatch && (!matchId || String(normalizedInitialMatch.matchId) === String(matchId))) {
        setConversationMatch(normalizedInitialMatch);
        setLoadingMatch(false);
        return;
      }

      if (!matchId) {
        setConversationMatch(normalizedInitialMatch || null);
        setLoadingMatch(false);
        return;
      }

      setConversationMatch(null);
      setLoadingMatch(true);
      setMatchError('');

      try {
        const resolvedMatch = await datingProfileService.getMatchById(matchId);
        if (!cancelled) {
          setConversationMatch(normalizeMatch(resolvedMatch));
        }
      } catch (loadError) {
        if (!cancelled) {
          setMatchError(
            typeof loadError === 'string' ? loadError : 'Failed to load call details'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingMatch(false);
        }
      }
    };

    loadConversationMatch();

    return () => {
      cancelled = true;
    };
  }, [matchId, matchedProfile]);

  useEffect(() => {
    setOtherUserOnline(false);
    setLiveNotice('');
    setFeedbackMessage('');
    defaultsHydratedRef.current = false;
    autoStartAttemptedRef.current = false;
    resetNegotiationState();
  }, [activeMatchId, resetNegotiationState]);

  useEffect(() => {
    void refreshSessionSummary();
  }, [refreshSessionSummary]);

  const prepareSessionAndJoin = useCallback(
    async ({
      existingVideoDateId = null,
      sessionType = 'instant',
      incoming = false
    } = {}) => {
      if (!activeMatchId || !activeMatchUserId) {
        return null;
      }

      setError('');
      setCallActionPending(incoming ? 'joining' : 'starting');
      setScreenMode('call');
      setCallStatus(incoming ? 'accepted' : 'initiating');
      setCompletedSession(null);
      setRecordingMessage('');
      resetNegotiationState();

      try {
        await prepareLocalMedia();
        let session = null;

        if (incoming) {
          let incomingSessionId = existingVideoDateId || currentVideoDateIdRef.current;

          if (!incomingSessionId) {
            const liveResponse = await videoCallService.createLiveSession(activeMatchId, {
              sessionType: 'instant',
              qualityPreset: qualityPresetRef.current,
              virtualBackground: virtualBackgroundRef.current,
              recordingRequested: recordingRequestedRef.current
            });
            incomingSessionId = liveResponse?.session?.id || null;
            if (liveResponse?.session?.roomId) {
              callRoomIdRef.current = incomingCall?.callId || liveResponse.session.roomId;
            }
          }

          const joinResponse = await videoCallService.joinSession(incomingSessionId, {
            qualityPreset: qualityPresetRef.current,
            virtualBackground: virtualBackgroundRef.current,
            recordingConsent: recordingConsentRef.current
          });
          session = joinResponse?.session || null;

          if (incomingCall?.callId && session) {
            session = {
              ...session,
              roomId: incomingCall.callId
            };
          }
        } else {
          const liveResponse = await videoCallService.createLiveSession(activeMatchId, {
            scheduledVideoDateId: existingVideoDateId,
            sessionType,
            qualityPreset: qualityPresetRef.current,
            virtualBackground: virtualBackgroundRef.current,
            recordingRequested: recordingRequestedRef.current
          });

          const preparedSession = liveResponse?.session || null;
          const joinResponse = await videoCallService.joinSession(preparedSession.id, {
            qualityPreset: qualityPresetRef.current,
            virtualBackground: virtualBackgroundRef.current,
            recordingConsent: recordingConsentRef.current
          });
          session = joinResponse?.session || preparedSession;
          pendingInviteRef.current = {
            callId: session.roomId,
            videoDateId: session.id
          };
        }

        if (!session) {
          throw new Error('Missing video session details');
        }

        applySessionToState(session);
        await applyQualityPresetToLiveTrack(session.liveSettings?.qualityPreset || qualityPresetRef.current);

        callRoomIdRef.current = session.roomId;
        currentVideoDateIdRef.current = session.id;

        emitInviteIfPossible();
        emitReadySignal();

        if (!incoming && remotePeerReadyRef.current) {
          await startOutgoingOffer();
        }

        setCallStatus(incoming ? 'accepted' : 'ringing');
        pushLiveNotice(
          incoming
            ? 'Joining the call now.'
            : sessionType === 'scheduled'
              ? 'Inviting your match to the scheduled call.'
              : 'Calling your match now.'
        );

        void refreshSessionSummary();
        return session;
      } catch (sessionError) {
        console.error('Failed to prepare video call session:', sessionError);
        cleanupMediaOnly();
        setCallStatus('failed');
        setError(
          typeof sessionError === 'string'
            ? sessionError
            : 'Unable to start the video call right now.'
        );
        setScreenMode('ended');
        return null;
      } finally {
        setCallActionPending('');
      }
    },
    [
      activeMatchId,
      activeMatchUserId,
      applyQualityPresetToLiveTrack,
      applySessionToState,
      cleanupMediaOnly,
      emitInviteIfPossible,
      emitReadySignal,
      incomingCall?.callId,
      prepareLocalMedia,
      pushLiveNotice,
      refreshSessionSummary,
      resetNegotiationState,
      startOutgoingOffer
    ]
  );

  useEffect(() => {
    if (!currentUserId || !activeMatchUserId) {
      return undefined;
    }

    const socket = io(BACKEND_BASE_URL, {
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    const handleCallAccepted = (payload = {}) => {
      if (
        String(payload.callId) !== String(callRoomIdRef.current) ||
        String(payload.fromUserId) !== String(activeMatchUserId)
      ) {
        return;
      }

      setCallStatus('accepted');
      pushLiveNotice(`${partnerName} answered the call.`);
    };

    const handleCallDeclined = (payload = {}) => {
      if (
        String(payload.callId) !== String(callRoomIdRef.current) ||
        String(payload.fromUserId) !== String(activeMatchUserId)
      ) {
        return;
      }

      setError(`${partnerName} declined the call.`);
      void finalizeCall({
        reason: 'declined',
        connected: false,
        emitEnd: false
      });
    };

    const handleCallEnded = (payload = {}) => {
      if (
        String(payload.callId) !== String(callRoomIdRef.current) ||
        String(payload.fromUserId) !== String(activeMatchUserId)
      ) {
        return;
      }

      pushLiveNotice('Your match left the call.');
      void finalizeCall({
        reason: payload.reason || 'ended',
        connected: callStatusRef.current === 'connected',
        emitEnd: false
      });
    };

    const handleCallReady = async (payload = {}) => {
      if (
        String(payload.callId) !== String(callRoomIdRef.current) ||
        String(payload.fromUserId) !== String(activeMatchUserId)
      ) {
        return;
      }

      remotePeerReadyRef.current = true;

      if (isCaller && localPeerReadyRef.current) {
        try {
          await startOutgoingOffer();
        } catch (offerError) {
          console.error('Failed to create outgoing offer:', offerError);
          handleConnectionFailure('Unable to start the video connection.');
        }
      }
    };

    const handleCallSignal = async (payload = {}) => {
      if (
        String(payload.callId) !== String(callRoomIdRef.current) ||
        String(payload.fromUserId) !== String(activeMatchUserId)
      ) {
        return;
      }

      try {
        const peerConnection = await ensurePeerConnection();

        if (payload.description) {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(payload.description)
          );
          await flushPendingIceCandidates(peerConnection);

          if (payload.description.type === 'offer') {
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            emitSignal({
              description: serializeDescription(peerConnection.localDescription || answer)
            });
            setCallStatus('connecting');
          }

          if (payload.description.type === 'answer') {
            setCallStatus('connecting');
          }
        }

        if (payload.candidate) {
          const candidate = new RTCIceCandidate(payload.candidate);

          if (peerConnection.remoteDescription?.type) {
            await peerConnection.addIceCandidate(candidate);
          } else {
            pendingIceCandidatesRef.current.push(candidate);
          }
        }
      } catch (signalError) {
        console.error('Failed to process call signal:', signalError);
        handleConnectionFailure('Unable to continue the video call connection.');
      }
    };

    const handleCallSettings = (payload = {}) => {
      if (
        String(payload.callId) !== String(callRoomIdRef.current) ||
        String(payload.fromUserId) !== String(activeMatchUserId)
      ) {
        return;
      }

      if (payload.recordingRequested !== null && payload.recordingRequested !== undefined) {
        setRecordingRequested(Boolean(payload.recordingRequested));
      }

      if (payload.qualityPreset) {
        pushLiveNotice(
          `${partnerName} switched quality to ${getQualityOption(payload.qualityPreset).label}.`
        );
      }

      if (payload.screenShareEnabled === true) {
        pushLiveNotice(`${partnerName} started sharing their screen.`);
      }

      if (payload.screenShareEnabled === false) {
        pushLiveNotice(`${partnerName} stopped sharing their screen.`);
      }

      if (payload.recordingRequested && payload.recordingConsent !== null) {
        pushLiveNotice('Recording consent was updated in the call.');
      } else if (payload.recordingRequested) {
        pushLiveNotice(`${partnerName} requested recording consent.`);
      }

      mergeActiveSession((currentSession) => {
        if (!currentSession) {
          return currentSession;
        }

        return {
          ...currentSession,
          recording: {
            ...currentSession.recording,
            requested:
              payload.recordingRequested === null || payload.recordingRequested === undefined
                ? currentSession.recording?.requested
                : Boolean(payload.recordingRequested),
            otherUserConsented:
              payload.recordingConsent === null || payload.recordingConsent === undefined
                ? currentSession.recording?.otherUserConsented
                : Boolean(payload.recordingConsent),
            enabled:
              payload.recordingEnabled === null || payload.recordingEnabled === undefined
                ? currentSession.recording?.enabled
                : Boolean(payload.recordingEnabled)
          },
          liveSettings: {
            ...currentSession.liveSettings,
            qualityPreset: payload.qualityPreset || currentSession.liveSettings?.qualityPreset,
            otherUserBackground:
              payload.virtualBackground || currentSession.liveSettings?.otherUserBackground,
            screenShareEnabled:
              payload.screenShareEnabled === null || payload.screenShareEnabled === undefined
                ? currentSession.liveSettings?.screenShareEnabled
                : Boolean(payload.screenShareEnabled),
            screenShareUserId:
              payload.screenShareEnabled === true
                ? payload.fromUserId
                : payload.screenShareEnabled === false &&
                    String(currentSession.liveSettings?.screenShareUserId) ===
                      String(payload.fromUserId)
                  ? null
                  : currentSession.liveSettings?.screenShareUserId
          }
        };
      });
    };

    socket.on('connect', () => {
      socket.emit('user_online', currentUserId);
      emitInviteIfPossible();

      if (localPeerReadyRef.current) {
        emitReadySignal();
      }
    });

    socket.on('user_status', ({ userId, online }) => {
      if (String(userId) === String(activeMatchUserId)) {
        setOtherUserOnline(Boolean(online));
      }
    });

    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:declined', handleCallDeclined);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:ready', handleCallReady);
    socket.on('call:signal', handleCallSignal);
    socket.on('call:settings', handleCallSettings);

    return () => {
      socket.off('call:accepted', handleCallAccepted);
      socket.off('call:declined', handleCallDeclined);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:ready', handleCallReady);
      socket.off('call:signal', handleCallSignal);
      socket.off('call:settings', handleCallSettings);

      if (activeSessionRef.current?.id && !callEndedRef.current) {
        socket.emit('call:end', {
          callId: callRoomIdRef.current,
          matchId: activeMatchId,
          targetUserId: activeMatchUserId,
          reason: 'left_call_screen'
        });
        void videoCallService.completeSession(activeSessionRef.current.id, {
          reason: 'left_call_screen',
          connected: callStatusRef.current === 'connected',
          durationSeconds: callDurationRef.current
        }).catch((unmountError) => {
          console.error('Failed to finalize call during unmount:', unmountError);
        });
      }

      socket.disconnect();
      socketRef.current = null;
      cleanupMediaOnly();
    };
  }, [
    activeMatchId,
    activeMatchUserId,
    cleanupMediaOnly,
    currentUserId,
    emitInviteIfPossible,
    emitReadySignal,
    emitSignal,
    ensurePeerConnection,
    finalizeCall,
    flushPendingIceCandidates,
    handleConnectionFailure,
    isCaller,
    mergeActiveSession,
    partnerName,
    pushLiveNotice,
    startOutgoingOffer
  ]);

  useEffect(() => {
    if (!autoAccepted || !activeMatchId || !activeMatchUserId || loadingMatch || loadingSessions) {
      return;
    }

    if (autoStartAttemptedRef.current) {
      return;
    }

    autoStartAttemptedRef.current = true;
    void prepareSessionAndJoin({
      existingVideoDateId: incomingCall?.videoDateId || scheduledVideoDateId,
      sessionType: scheduledVideoDateId ? 'scheduled' : 'instant',
      incoming: true
    });
  }, [
    activeMatchId,
    activeMatchUserId,
    autoAccepted,
    incomingCall?.videoDateId,
    loadingMatch,
    loadingSessions,
    prepareSessionAndJoin,
    scheduledVideoDateId
  ]);

  useEffect(() => {
    if (
      autoAccepted ||
      !startImmediately ||
      !activeMatchId ||
      !activeMatchUserId ||
      loadingMatch ||
      loadingSessions
    ) {
      return;
    }

    if (autoStartAttemptedRef.current) {
      return;
    }

    autoStartAttemptedRef.current = true;
    void prepareSessionAndJoin({
      existingVideoDateId:
        scheduledVideoDateId || sessionSummary.activeSession?.id || null,
      sessionType:
        scheduledVideoDateId || sessionSummary.activeSession?.sessionType === 'scheduled'
          ? 'scheduled'
          : 'instant',
      incoming: false
    });
  }, [
    activeMatchId,
    activeMatchUserId,
    autoAccepted,
    loadingMatch,
    loadingSessions,
    prepareSessionAndJoin,
    scheduledVideoDateId,
    sessionSummary.activeSession?.id,
    sessionSummary.activeSession?.sessionType,
    startImmediately
  ]);

  useEffect(() => {
    clearCallTimeout();

    if (
      screenMode !== 'call' ||
      !activeSessionRef.current?.id ||
      callEndedRef.current ||
      ['connected', 'ended', 'declined', 'missed', 'failed'].includes(callStatus)
    ) {
      return undefined;
    }

    const timeoutMs =
      activeSessionRef.current?.sessionType === 'scheduled'
        ? SCHEDULED_NO_SHOW_TIMEOUT_MS
        : OUTGOING_CALL_TIMEOUT_MS;
    const reason =
      activeSessionRef.current?.sessionType === 'scheduled' ? 'missed' : 'no_answer_timeout';

    callTimeoutRef.current = window.setTimeout(() => {
      setError(
        reason === 'missed'
          ? 'The scheduled call was marked as a no-show.'
          : 'The call timed out before both people connected.'
      );
      void finalizeCall({
        reason,
        connected: false,
        emitEnd: true
      });
    }, timeoutMs);

    return () => {
      clearCallTimeout();
    };
  }, [callStatus, clearCallTimeout, finalizeCall, screenMode]);

  const handleScheduleCall = async () => {
    if (!activeMatchId) {
      return;
    }

    const scheduledDate = new Date(scheduleInput);

    if (Number.isNaN(scheduledDate.getTime())) {
      setError('Please choose a valid date and time for the scheduled call.');
      return;
    }

    setCallActionPending('scheduling');
    setError('');
    setFeedbackMessage('');

    try {
      const response = await videoCallService.scheduleCall(activeMatchId, {
        scheduledAt: scheduledDate.toISOString(),
        title: scheduleTitle.trim() || undefined,
        note: scheduleNote.trim() || undefined,
        reminderMinutes,
        qualityPreset,
        virtualBackground,
        recordingRequested
      });

      if (response?.session) {
        setFeedbackMessage(`Video call scheduled for ${formatScheduleTime(response.session.scheduledAt)}.`);
        setScheduleInput(
          toLocalDateTimeInputValue(new Date(Date.now() + 2 * 60 * 60 * 1000))
        );
      }

      await refreshSessionSummary();
    } catch (scheduleError) {
      console.error('Failed to schedule video call:', scheduleError);
      setError(
        typeof scheduleError === 'string'
          ? scheduleError
          : 'Unable to schedule the video call right now.'
      );
    } finally {
      setCallActionPending('');
    }
  };

  const handleSendReminder = async (videoDateId) => {
    setCallActionPending(`reminder-${videoDateId}`);
    setError('');
    setFeedbackMessage('');

    try {
      const response = await videoCallService.sendReminder(videoDateId);
      setFeedbackMessage(response?.message || 'Reminder sent.');
      await refreshSessionSummary();
    } catch (reminderError) {
      console.error('Failed to send reminder:', reminderError);
      setError(
        typeof reminderError === 'string'
          ? reminderError
          : 'Unable to send a reminder right now.'
      );
    } finally {
      setCallActionPending('');
    }
  };

  const handleChangeQualityPreset = async (nextPreset) => {
    setQualityPreset(nextPreset);
    setFeedbackMessage('');

    if (screenMode === 'call' && activeSessionRef.current?.id) {
      await applyQualityPresetToLiveTrack(nextPreset);
      await persistLiveSettings({ qualityPreset: nextPreset });
    }
  };

  const handleChangeVirtualBackground = async (nextPreset) => {
    setVirtualBackground(nextPreset);
    setFeedbackMessage('');

    if (screenMode === 'call' && activeSessionRef.current?.id) {
      await persistLiveSettings({ virtualBackground: nextPreset });
      pushLiveNotice(`Background changed to ${getBackgroundOption(nextPreset).label}.`);
    }
  };

  const handleToggleRecordingRequest = async () => {
    await updateRecordingState({
      requested: !recordingRequested,
      consent: recordingConsent
    });
  };

  const handleToggleRecordingConsent = async () => {
    await updateRecordingState({
      requested: recordingRequested,
      consent: !recordingConsent
    });
  };

  const handleStartInstantCall = async () => {
    await prepareSessionAndJoin({
      existingVideoDateId: null,
      sessionType: 'instant',
      incoming: false
    });
  };

  const handleJoinScheduledCall = async (videoDateId) => {
    await prepareSessionAndJoin({
      existingVideoDateId: videoDateId,
      sessionType: 'scheduled',
      incoming: false
    });
  };

  const handleResumeActiveCall = async () => {
    await prepareSessionAndJoin({
      existingVideoDateId: activeSessionRef.current?.id || sessionSummary.activeSession?.id,
      sessionType:
        activeSessionRef.current?.sessionType ||
        sessionSummary.activeSession?.sessionType ||
        'instant',
      incoming: false
    });
  };

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks?.()[0];

    if (!audioTrack) {
      return;
    }

    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  };

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks?.()[0];

    if (!videoTrack) {
      return;
    }

    videoTrack.enabled = !videoTrack.enabled;
    setIsVideoOn(videoTrack.enabled);
  };

  const handleOpenMessages = () => {
    if (!activeMatch) {
      return;
    }

    if (screenMode === 'call' && activeSessionRef.current?.id && !callEndedRef.current) {
      void finalizeCall({
        reason: 'switched_to_messages',
        connected: callStatusRef.current === 'connected',
        emitEnd: true
      }).then(() => {
        onOpenMessages?.(activeMatch);
      });
      return;
    }

    onOpenMessages?.(activeMatch);
  };

  const handleLeaveCall = async (reason = 'ended') => {
    if (screenMode !== 'call') {
      return;
    }

    await finalizeCall({
      reason,
      connected: callStatusRef.current === 'connected',
      emitEnd: true
    });
  };

  const renderHubActionButtons = () => {
    const resumableSession = activeSessionRef.current || sessionSummary.activeSession;

    return (
      <div className="video-hub-actions">
        {resumableSession ? (
          <button
            type="button"
            className="video-primary-action"
            onClick={handleResumeActiveCall}
            disabled={hubBusy}
          >
            {hubBusy ? 'Opening...' : 'Resume Active Call'}
          </button>
        ) : (
          <button
            type="button"
            className="video-primary-action"
            onClick={handleStartInstantCall}
            disabled={hubBusy}
          >
            {hubBusy ? 'Starting...' : 'Start Now'}
          </button>
        )}

        <button
          type="button"
          className="video-secondary-action"
          onClick={handleOpenMessages}
        >
          Open Chat
        </button>
      </div>
    );
  };

  if (!currentUserId) {
    return (
      <div className="call-ended">
        <div className="call-end-content">
          <h2>Sign in required</h2>
          <p>You need to be signed in to start a video call.</p>
          <button type="button" onClick={onBack} className="btn-back">
            Back
          </button>
        </div>
      </div>
    );
  }

  if (loadingMatch && !activeMatch) {
    return (
      <div className="video-loading-state">
        <div className="spinner"></div>
        <p>Loading your video call details...</p>
      </div>
    );
  }

  if (!activeMatch) {
    return (
      <div className="call-ended">
        <div className="call-end-content">
          <h2>Call unavailable</h2>
          <p>{matchError || 'We could not load this match.'}</p>
          <button type="button" onClick={onBack} className="btn-back">
            Back
          </button>
        </div>
      </div>
    );
  }

  if (screenMode === 'ended' || callStatus === 'failed') {
    const summaryLine = [
      endedSession?.durationSeconds
        ? `Duration ${formatDuration(endedSession.durationSeconds)}`
        : callDuration > 0
          ? `Duration ${formatDuration(callDuration)}`
          : null,
      endedSession?.endedReason ? getEndedReasonLabel(endedSession.endedReason) : null,
      endedSession?.noShowStatus ? getNoShowLabel(endedSession.noShowStatus) : null
    ]
      .filter(Boolean)
      .join(' • ');

    return (
      <div className="call-ended">
        <div className="call-end-content">
          <h2>
            {callStatus === 'declined'
              ? 'Call Declined'
              : callStatus === 'missed'
                ? 'Missed Call'
                : callStatus === 'failed'
                  ? 'Call Failed'
                  : 'Call Finished'}
          </h2>
          <p>{error || summaryLine || 'Your call summary is ready.'}</p>
          <div className="call-end-actions">
            <button type="button" onClick={onBack} className="btn-back">
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedbackMessage('The call log has been added to your history below.');
                setScreenMode('hub');
                setCallStatus('idle');
                setError('');
              }}
              className="btn-secondary"
            >
              View Call Hub
            </button>
            <button type="button" onClick={handleOpenMessages} className="btn-secondary">
              Open Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screenMode === 'hub') {
    const currentOrUpcomingSession =
      sessionSummary.activeSession || sessionSummary.upcomingSessions[0] || null;

    return (
      <div className="video-dating-container video-hub-mode">
        <div className="video-hub-topbar">
          <button type="button" className="call-header-back" onClick={onBack}>
            Back
          </button>
          <div className="video-hub-heading">
            <h2>Video Call Hub</h2>
            <p>Plan, review, and launch calls with {partnerName}.</p>
          </div>
          <button type="button" className="hub-chat-button" onClick={handleOpenMessages}>
            Chat
          </button>
        </div>

        {error ? (
          <div className="call-error-banner" role="alert">
            {error}
          </div>
        ) : null}

        {feedbackMessage ? (
          <div className="call-feedback-banner" role="status">
            {feedbackMessage}
          </div>
        ) : null}

        <div className="video-hub-content">
          <section className="video-hero-card">
            <div className="video-hero-media">
              {partnerPhoto ? (
                <img src={partnerPhoto} alt={partnerName} className="video-hero-photo" />
              ) : (
                <div className="video-hero-fallback">{partnerName.charAt(0)}</div>
              )}
            </div>

            <div className="video-hero-copy">
              <div className="video-hero-status-row">
                <span className={`presence-pill ${otherUserOnline ? 'online' : 'offline'}`}>
                  {otherUserOnline ? 'Online' : 'Offline'}
                </span>
                {currentOrUpcomingSession ? (
                  <span className="video-status-chip">
                    {getSessionStatusLabel(currentOrUpcomingSession)}
                  </span>
                ) : null}
              </div>
              <h1>{partnerName}</h1>
              <p>
                Start an instant call, schedule a reminder-backed video date, or review recent
                call activity before you jump in.
              </p>
              {renderHubActionButtons()}
            </div>
          </section>

          <div className="video-hub-grid">
            <section className="video-settings-card">
              <div className="video-card-header">
                <h3>Call Preferences</h3>
                <p>These settings carry into new and scheduled calls.</p>
              </div>

              <label className="video-field">
                <span>Call quality</span>
                <select
                  value={qualityPreset}
                  onChange={(event) => {
                    void handleChangeQualityPreset(event.target.value);
                  }}
                >
                  {CALL_QUALITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="video-field">
                <span>Virtual background</span>
                <select
                  value={virtualBackground}
                  onChange={(event) => {
                    void handleChangeVirtualBackground(event.target.value);
                  }}
                >
                  {BACKGROUND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="video-field">
                <span>Reminder timing</span>
                <select
                  value={reminderMinutes}
                  onChange={(event) => {
                    setReminderMinutes(Number.parseInt(event.target.value, 10) || 15);
                  }}
                >
                  {REMINDER_MINUTE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="video-toggle">
                <input
                  type="checkbox"
                  checked={recordingRequested}
                  onChange={() => {
                    setRecordingRequested((currentValue) => !currentValue);
                  }}
                />
                <div>
                  <strong>Ask for recording consent</strong>
                  <p>Include a recording request in the next live or scheduled call.</p>
                </div>
              </label>

              <label className="video-toggle">
                <input
                  type="checkbox"
                  checked={recordingConsent}
                  onChange={() => {
                    setRecordingConsent((currentValue) => !currentValue);
                  }}
                />
                <div>
                  <strong>Pre-approve your consent</strong>
                  <p>Join ready to consent if both people want the recording option.</p>
                </div>
              </label>
            </section>

            <section className={`video-schedule-card ${focusSchedule ? 'highlighted' : ''}`}>
              <div className="video-card-header">
                <h3>Schedule a Call</h3>
                <p>Book a time with reminders, notes, and a ready-to-join room.</p>
              </div>

              <label className="video-field">
                <span>Date and time</span>
                <input
                  type="datetime-local"
                  value={scheduleInput}
                  onChange={(event) => setScheduleInput(event.target.value)}
                />
              </label>

              <label className="video-field">
                <span>Title</span>
                <input
                  type="text"
                  value={scheduleTitle}
                  onChange={(event) => setScheduleTitle(event.target.value)}
                  placeholder="Coffee date catch-up"
                  maxLength={120}
                />
              </label>

              <label className="video-field">
                <span>Note</span>
                <textarea
                  value={scheduleNote}
                  onChange={(event) => setScheduleNote(event.target.value)}
                  placeholder="Anything you want to remember before the call"
                  rows={4}
                  maxLength={800}
                />
              </label>

              <button
                type="button"
                className="video-primary-action"
                onClick={handleScheduleCall}
                disabled={hubBusy}
              >
                {callActionPending === 'scheduling' ? 'Scheduling...' : 'Schedule Video Date'}
              </button>
            </section>
          </div>

          <section className="video-list-card">
            <div className="video-card-header">
              <h3>Upcoming Calls</h3>
              <p>Join on time, send reminders, and track who already checked in.</p>
            </div>

            {loadingSessions ? (
              <div className="video-empty-state">
                <div className="spinner"></div>
                <p>Loading sessions...</p>
              </div>
            ) : sessionSummary.upcomingSessions.length === 0 ? (
              <div className="video-empty-state">
                <p>No scheduled calls yet. Pick a time above to create one.</p>
              </div>
            ) : (
              <div className="video-session-list">
                {sessionSummary.upcomingSessions.map((session) => (
                  <article key={session.id} className="video-session-card">
                    <div className="video-session-main">
                      <div className="video-session-heading">
                        <h4>{session.title || 'Video date'}</h4>
                        <span className="video-status-chip">{getSessionStatusLabel(session)}</span>
                      </div>
                      <p className="video-session-time">
                        {formatScheduleTime(session.scheduledAt)}
                      </p>
                      {session.note ? (
                        <p className="video-session-note">{session.note}</p>
                      ) : null}
                      <div className="video-session-meta">
                        <span>{getQualityOption(session.liveSettings?.qualityPreset).label}</span>
                        <span>{session.reminderMinutes} min reminder</span>
                        <span>
                          {session.recording?.requested
                            ? 'Recording request on'
                            : 'Recording request off'}
                        </span>
                      </div>
                    </div>

                    <div className="video-session-actions">
                      {session.canJoinNow ? (
                        <button
                          type="button"
                          className="video-primary-action"
                          onClick={() => {
                            void handleJoinScheduledCall(session.id);
                          }}
                          disabled={hubBusy}
                        >
                          {hubBusy ? 'Joining...' : 'Join Now'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="video-secondary-action"
                        onClick={() => {
                          void handleSendReminder(session.id);
                        }}
                        disabled={hubBusy}
                      >
                        {callActionPending === `reminder-${session.id}` ? 'Sending...' : 'Send Reminder'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="video-list-card">
            <div className="video-card-header">
              <h3>Call History</h3>
              <p>Review outcomes, timing, quality, and no-show tracking.</p>
            </div>

            {loadingSessions ? (
              <div className="video-empty-state">
                <div className="spinner"></div>
                <p>Loading history...</p>
              </div>
            ) : sessionSummary.history.length === 0 ? (
              <div className="video-empty-state">
                <p>Your past calls with {partnerName} will appear here.</p>
              </div>
            ) : (
              <div className="video-history-list">
                {sessionSummary.history.map((session) => (
                  <article key={session.id} className="video-history-card">
                    <div className="video-history-top">
                      <div>
                        <h4>{session.title || 'Video date'}</h4>
                        <p>{formatScheduleTime(session.scheduledAt || session.createdAt)}</p>
                      </div>
                      <div className="video-history-badges">
                        <span className="video-status-chip">{getSessionStatusLabel(session)}</span>
                        {session.noShowStatus && getNoShowLabel(session.noShowStatus) ? (
                          <span className="video-status-chip warning">
                            {getNoShowLabel(session.noShowStatus)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="video-history-meta">
                      <span>{formatDuration(session.durationSeconds || 0)}</span>
                      <span>{getQualityOption(session.liveSettings?.qualityPreset).label}</span>
                      <span>{getEndedReasonLabel(session.endedReason)}</span>
                    </div>

                    {session.timeline?.length > 0 ? (
                      <div className="video-timeline">
                        {session.timeline.map((event, index) => (
                          <div key={`${session.id}-${event.type}-${index}`} className="video-timeline-item">
                            <span>{getTimelineLabel(event)}</span>
                            <strong>{formatScheduleTime(event.at)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  const liveStatusLabel = (() => {
    switch (callStatus) {
      case 'accepted':
        return 'Joining the room';
      case 'connecting':
        return 'Connecting media';
      case 'connected':
        return otherUserOnline ? 'Live now' : 'Connected';
      case 'declined':
        return 'Call declined';
      case 'missed':
        return 'Marked as missed';
      case 'ended':
        return 'Call ended';
      case 'ringing':
        return otherUserOnline ? 'Ringing now' : 'Waiting for them to answer';
      case 'initiating':
      default:
        return 'Preparing your setup';
    }
  })();

  return (
    <div className="video-dating-container">
      <div className="call-header">
        <button
          type="button"
          className="call-header-back"
          onClick={() => {
            void handleLeaveCall('back_navigation');
          }}
        >
          Leave
        </button>
        <div className="call-header-meta">
          <h2>{partnerName}</h2>
          <p>{liveStatusLabel}</p>
        </div>
        <span className="call-duration">
          {callStatus === 'connected' ? formatDuration(callDuration) : 'Live'}
        </span>
      </div>

      {error ? (
        <div className="call-error-banner" role="alert">
          {error}
        </div>
      ) : null}

      {feedbackMessage ? (
        <div className="call-feedback-banner" role="status">
          {feedbackMessage}
        </div>
      ) : null}

      {liveNotice ? (
        <div className="call-live-notice" role="status">
          {liveNotice}
        </div>
      ) : null}

      {recordingMessage ? (
        <div className="call-feedback-banner" role="status">
          {recordingMessage}
        </div>
      ) : null}

      <div className="call-info-strip">
        <span className="video-status-chip">{getQualityOption(qualityPreset).label}</span>
        <span className="video-status-chip">
          {getBackgroundOption(virtualBackground).label}
        </span>
        <span className={`video-status-chip ${recordingRequested ? 'accent' : ''}`}>
          {activeSession?.recording?.enabled
            ? 'Recording consented'
            : recordingRequested
              ? 'Recording requested'
              : 'Recording off'}
        </span>
        <span className={`video-status-chip ${otherUserOnline ? 'accent' : ''}`}>
          {otherUserOnline ? 'Match online' : 'Match offline'}
        </span>
        {activeSession?.liveSettings?.screenShareEnabled ? (
          <span className="video-status-chip accent">
            {String(activeSession.liveSettings.screenShareUserId) === String(currentUserId)
              ? 'You are sharing'
              : `${partnerName} is sharing`}
          </span>
        ) : null}
      </div>

      <div className="video-main">
        <div
          className={`remote-video remote-theme-${activeSession?.liveSettings?.otherUserBackground || 'none'}`}
        >
          <video
            ref={remoteVideoRef}
            className={`remote-video-element ${remoteStreamAvailable ? 'visible' : ''}`}
            playsInline
            autoPlay
          />

          {!remoteStreamAvailable ? (
            <div className="video-placeholder video-placeholder-remote">
              {partnerPhoto ? <img src={partnerPhoto} alt={partnerName} /> : null}
              <div className="placeholder-avatar">{partnerName.charAt(0) || '?'}</div>
              <div className="remote-waiting-card">
                <h3>{partnerName}</h3>
                <p>{liveStatusLabel}</p>
                <span className={`presence-pill ${otherUserOnline ? 'online' : 'offline'}`}>
                  {otherUserOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className={`local-video local-theme-${virtualBackground}`}>
          <video
            ref={localVideoRef}
            className={`local-video-element ${mediaReady && (isVideoOn || isScreenSharing) ? 'visible' : ''}`}
            playsInline
            autoPlay
            muted
          />
          {(!mediaReady || (!isVideoOn && !isScreenSharing)) ? (
            <div className="video-placeholder video-placeholder-local">
              <div className="placeholder-avatar">
                {currentUserName.charAt(0).toUpperCase()}
              </div>
              <p>{mediaReady ? 'Camera off' : 'Starting camera'}</p>
            </div>
          ) : null}
          <p className="local-video-label">{isScreenSharing ? 'Sharing screen' : 'You'}</p>
        </div>
      </div>

      <div className="call-toolbar">
        <label className="call-toolbar-field">
          <span>Quality</span>
          <select
            value={qualityPreset}
            onChange={(event) => {
              void handleChangeQualityPreset(event.target.value);
            }}
          >
            {CALL_QUALITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="call-toolbar-field">
          <span>Background</span>
          <select
            value={virtualBackground}
            onChange={(event) => {
              void handleChangeVirtualBackground(event.target.value);
            }}
          >
            {BACKGROUND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="call-controls">
        <button
          type="button"
          className={`control-btn ${isMuted ? 'muted' : ''}`}
          onClick={toggleMute}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>

        <button
          type="button"
          className={`control-btn ${!isVideoOn ? 'off' : ''}`}
          onClick={toggleVideo}
        >
          {isVideoOn ? 'Camera On' : 'Camera Off'}
        </button>

        <button
          type="button"
          className={`control-btn ${isScreenSharing ? 'chat' : ''}`}
          onClick={() => {
            void toggleScreenShare();
          }}
        >
          {isScreenSharing ? 'Stop Share' : 'Share Screen'}
        </button>

        <button
          type="button"
          className={`control-btn ${recordingConsent ? 'chat' : ''}`}
          onClick={() => {
            void handleToggleRecordingConsent();
          }}
        >
          {recordingConsent ? 'Consent On' : 'Consent'}
        </button>

        <button
          type="button"
          className={`control-btn ${recordingRequested ? 'chat' : ''}`}
          onClick={() => {
            void handleToggleRecordingRequest();
          }}
        >
          {recordingRequested ? 'Recording Asked' : 'Ask Record'}
        </button>

        <button
          type="button"
          className={`control-btn ${isRecording ? 'chat' : ''}`}
          onClick={() => {
            if (isRecording) {
              stopLocalRecording(true);
            } else {
              void startLocalRecording();
            }
          }}
        >
          {isRecording ? 'Stop Record' : 'Record'}
        </button>

        <button
          type="button"
          className="control-btn chat"
          onClick={handleOpenMessages}
        >
          Chat
        </button>

        <button
          type="button"
          className="control-btn end-call"
          onClick={() => {
            void handleLeaveCall('ended');
          }}
        >
          End
        </button>
      </div>
    </div>
  );
};

export default VideoDating;
