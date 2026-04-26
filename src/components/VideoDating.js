import React, { useCallback, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import datingProfileService from '../services/datingProfileService';
import { getStoredUserData } from '../utils/auth';
import { BACKEND_BASE_URL } from '../utils/api';
import '../styles/VideoDating.css';

const RTC_CONFIGURATION = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const normalizeMatch = (match) => {
  if (!match) {
    return null;
  }

  return {
    ...match,
    userId: match.userId ?? match.user_id ?? null,
    matchId: match.matchId ?? match.match_id ?? null
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

const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const VideoDating = ({
  matchedProfile,
  matchId,
  callMode = 'outgoing',
  autoAccepted = false,
  callerName = '',
  onBack,
  onOpenMessages
}) => {
  const currentUser = getStoredUserData();
  const currentUserId = currentUser?.id;
  const currentUserName = currentUser?.firstName || currentUser?.username || currentUser?.email || 'Someone';
  const [conversationMatch, setConversationMatch] = useState(normalizeMatch(matchedProfile));
  const [loadingMatch, setLoadingMatch] = useState(Boolean(matchId) && !matchedProfile);
  const [callStatus, setCallStatus] = useState(
    callMode === 'incoming' && autoAccepted ? 'accepted' : callMode === 'incoming' ? 'incoming' : 'ringing'
  );
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [remoteStreamAvailable, setRemoteStreamAvailable] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const inviteSentRef = useRef(false);
  const localReadyRef = useRef(false);
  const remoteReadyRef = useRef(false);
  const readySignalSentRef = useRef(false);
  const offerSentRef = useRef(false);
  const callEndedRef = useRef(false);
  const activeMatch = conversationMatch || normalizeMatch(matchedProfile) || null;
  const activeMatchId = activeMatch?.matchId || matchId || null;
  const activeMatchUserId = activeMatch?.userId || null;
  const callId = activeMatchId ? `dating-match-${activeMatchId}` : null;

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
      setError('');

      try {
        const resolvedMatch = await datingProfileService.getMatchById(matchId);
        if (!cancelled) {
          setConversationMatch(normalizeMatch(resolvedMatch));
        }
      } catch (matchError) {
        if (!cancelled) {
          setError(typeof matchError === 'string' ? matchError : 'Failed to load call details');
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
  }, [activeMatchId]);

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

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      window.clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const startDurationTimer = useCallback(() => {
    stopDurationTimer();
    setCallDuration(0);
    durationIntervalRef.current = window.setInterval(() => {
      setCallDuration((currentDuration) => currentDuration + 1);
    }, 1000);
  }, [stopDurationTimer]);

  const resetCallNegotiation = useCallback(() => {
    pendingIceCandidatesRef.current = [];
    localReadyRef.current = false;
    remoteReadyRef.current = false;
    readySignalSentRef.current = false;
    offerSentRef.current = false;
    inviteSentRef.current = callMode === 'outgoing' ? inviteSentRef.current : false;
  }, [callMode]);

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
    remoteStreamRef.current = null;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setRemoteStreamAvailable(false);
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

  const cleanupCall = useCallback(() => {
    stopDurationTimer();
    cleanupPeerConnection();
    stopLocalStream();
    stopRemoteStream();
    resetCallNegotiation();
  }, [cleanupPeerConnection, resetCallNegotiation, stopDurationTimer, stopLocalStream, stopRemoteStream]);

  const emitToPeer = useCallback((eventName, payload = {}) => {
    if (!socketRef.current || !callId || !activeMatchUserId) {
      return;
    }

    socketRef.current.emit(eventName, {
      callId,
      matchId: activeMatchId,
      targetUserId: activeMatchUserId,
      ...payload
    });
  }, [activeMatchId, activeMatchUserId, callId]);

  const flushPendingIceCandidates = useCallback(async (peerConnection) => {
    while (pendingIceCandidatesRef.current.length > 0 && peerConnection?.remoteDescription?.type) {
      const candidate = pendingIceCandidatesRef.current.shift();

      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (candidateError) {
        console.error('Failed to apply queued ICE candidate:', candidateError);
      }
    }
  }, []);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    localStreamRef.current = stream;
    await attachStreamToElement(localVideoRef.current, stream, { muted: true });
    setMediaReady(true);
    setIsMuted(false);
    setIsVideoOn(Boolean(stream.getVideoTracks()[0]?.enabled));
    return stream;
  }, [attachStreamToElement]);

  const ensurePeerConnection = useCallback(async () => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const stream = await ensureLocalStream();
    const peerConnection = new RTCPeerConnection(RTC_CONFIGURATION);

    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams?.[0] || remoteStreamRef.current || new MediaStream();

      if (!event.streams?.[0]) {
        remoteStream.addTrack(event.track);
      }

      remoteStreamRef.current = remoteStream;
      setRemoteStreamAvailable(true);
      void attachStreamToElement(remoteVideoRef.current, remoteStream);
    };

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      emitToPeer('call:signal', {
        candidate: typeof event.candidate.toJSON === 'function'
          ? event.candidate.toJSON()
          : event.candidate
      });
    };

    peerConnection.onconnectionstatechange = () => {
      switch (peerConnection.connectionState) {
        case 'connected':
          setCallStatus('connected');
          startDurationTimer();
          break;
        case 'connecting':
          setCallStatus('connecting');
          break;
        case 'failed':
          setCallStatus('failed');
          setError('The video connection failed. Please try again.');
          break;
        case 'disconnected':
          if (!callEndedRef.current) {
            setCallStatus('connecting');
          }
          break;
        default:
          break;
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }, [attachStreamToElement, emitToPeer, ensureLocalStream, startDurationTimer]);

  const startOutgoingOffer = useCallback(async () => {
    if (callMode !== 'outgoing' || offerSentRef.current) {
      return;
    }

    offerSentRef.current = true;

    try {
      const peerConnection = await ensurePeerConnection();
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      emitToPeer('call:signal', {
        description: serializeDescription(peerConnection.localDescription || offer)
      });
      setCallStatus('connecting');
    } catch (offerError) {
      offerSentRef.current = false;
      throw offerError;
    }
  }, [callMode, emitToPeer, ensurePeerConnection]);

  const prepareMediaAndSignalReady = useCallback(async () => {
    try {
      setError('');
      await ensurePeerConnection();
      localReadyRef.current = true;

      if (!readySignalSentRef.current) {
        readySignalSentRef.current = true;
        emitToPeer('call:ready');
      }

      if (callMode === 'outgoing' && remoteReadyRef.current) {
        await startOutgoingOffer();
      }
    } catch (mediaError) {
      console.error('Failed to initialize local media:', mediaError);
      setCallStatus('failed');
      setError('Camera and microphone access are required for video calls.');
    }
  }, [callMode, emitToPeer, ensurePeerConnection, startOutgoingOffer]);

  const handleEndCall = useCallback((reason = 'ended') => {
    callEndedRef.current = true;
    emitToPeer('call:end', { reason });
    cleanupCall();
    setCallStatus('ended');
  }, [cleanupCall, emitToPeer]);

  const handleOpenMessages = () => {
    if (!activeMatch) {
      return;
    }

    if (!callEndedRef.current) {
      handleEndCall('switched_to_messages');
    }

    onOpenMessages?.(activeMatch);
  };

  useEffect(() => {
    if (!currentUserId || !activeMatchUserId || !callId) {
      return undefined;
    }

    callEndedRef.current = false;
    const socket = io(BACKEND_BASE_URL, {
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    const handleCallAccepted = (payload = {}) => {
      if (String(payload.callId) !== String(callId) || String(payload.fromUserId) !== String(activeMatchUserId)) {
        return;
      }

      setCallStatus('accepted');
      void prepareMediaAndSignalReady();
    };

    const handleCallDeclined = (payload = {}) => {
      if (String(payload.callId) !== String(callId) || String(payload.fromUserId) !== String(activeMatchUserId)) {
        return;
      }

      callEndedRef.current = true;
      cleanupCall();
      setCallStatus('declined');
      setError(`${activeMatch?.firstName || callerName || 'Your match'} declined the call.`);
    };

    const handleCallEnded = (payload = {}) => {
      if (String(payload.callId) !== String(callId) || String(payload.fromUserId) !== String(activeMatchUserId)) {
        return;
      }

      callEndedRef.current = true;
      cleanupCall();
      setCallStatus('ended');
    };

    const handleCallReady = async (payload = {}) => {
      if (String(payload.callId) !== String(callId) || String(payload.fromUserId) !== String(activeMatchUserId)) {
        return;
      }

      remoteReadyRef.current = true;

      if (callMode === 'outgoing' && localReadyRef.current) {
        try {
          await startOutgoingOffer();
        } catch (offerError) {
          console.error('Failed to create outgoing offer:', offerError);
          setCallStatus('failed');
          setError('Unable to start the video connection.');
        }
      }
    };

    const handleCallSignal = async (payload = {}) => {
      if (String(payload.callId) !== String(callId) || String(payload.fromUserId) !== String(activeMatchUserId)) {
        return;
      }

      try {
        const peerConnection = await ensurePeerConnection();

        if (payload.description) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.description));
          await flushPendingIceCandidates(peerConnection);

          if (payload.description.type === 'offer') {
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            emitToPeer('call:signal', {
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
        setCallStatus('failed');
        setError('Unable to continue the video call connection.');
      }
    };

    socket.on('connect', () => {
      socket.emit('user_online', currentUserId);

      if (callMode === 'outgoing' && !inviteSentRef.current) {
        inviteSentRef.current = true;
        socket.emit('call:invite', {
          callId,
          callType: 'video',
          matchId: activeMatchId,
          targetUserId: activeMatchUserId,
          fromUserName: currentUserName
        });
      }

      if (callMode === 'incoming' && autoAccepted) {
        setCallStatus('accepted');
        void prepareMediaAndSignalReady();
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

    return () => {
      socket.off('call:accepted', handleCallAccepted);
      socket.off('call:declined', handleCallDeclined);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:ready', handleCallReady);
      socket.off('call:signal', handleCallSignal);

      if (!callEndedRef.current && activeMatchUserId && callId) {
        socket.emit('call:end', {
          callId,
          matchId: activeMatchId,
          targetUserId: activeMatchUserId,
          reason: 'left_call_screen'
        });
      }

      socket.disconnect();
      socketRef.current = null;
      cleanupCall();
    };
  }, [
    activeMatch?.firstName,
    activeMatchId,
    activeMatchUserId,
    autoAccepted,
    callId,
    callMode,
    callerName,
    cleanupCall,
    currentUserId,
    currentUserName,
    emitToPeer,
    ensurePeerConnection,
    flushPendingIceCandidates,
    prepareMediaAndSignalReady,
    startOutgoingOffer
  ]);

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()?.[0];

    if (!audioTrack) {
      return;
    }

    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  };

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()?.[0];

    if (!videoTrack) {
      return;
    }

    videoTrack.enabled = !videoTrack.enabled;
    setIsVideoOn(videoTrack.enabled);
  };

  const statusLabel = (() => {
    switch (callStatus) {
      case 'incoming':
        return 'Incoming call';
      case 'accepted':
        return 'Preparing camera and microphone';
      case 'connecting':
        return 'Connecting video';
      case 'connected':
        return otherUserOnline ? 'Live now' : 'Connected';
      case 'declined':
        return 'Call declined';
      case 'ended':
        return 'Call ended';
      case 'failed':
        return 'Unable to connect';
      case 'ringing':
      default:
        return otherUserOnline ? 'Ringing now' : 'Waiting for them to come online';
    }
  })();

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
      <div className="video-dating-container">
        <div className="video-loading-state">
          <div className="spinner"></div>
          <p>Loading your video date...</p>
        </div>
      </div>
    );
  }

  if (!activeMatch) {
    return (
      <div className="call-ended">
        <div className="call-end-content">
          <h2>Call unavailable</h2>
          <p>{error || 'We could not load this match.'}</p>
          <button type="button" onClick={onBack} className="btn-back">
            Back
          </button>
        </div>
      </div>
    );
  }

  if (callStatus === 'ended' || callStatus === 'declined' || callStatus === 'failed') {
    return (
      <div className="call-ended">
        <div className="call-end-content">
          <h2>{callStatus === 'declined' ? 'Call Declined' : callStatus === 'failed' ? 'Call Failed' : 'Call Ended'}</h2>
          <p>{error || `Duration: ${formatDuration(callDuration)}`}</p>
          <div className="call-end-actions">
            <button type="button" onClick={onBack} className="btn-back">
              Back
            </button>
            <button type="button" onClick={handleOpenMessages} className="btn-secondary">
              Open Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="video-dating-container">
      <div className="call-header">
        <button type="button" className="call-header-back" onClick={() => handleEndCall('back_navigation')}>
          Leave
        </button>
        <div className="call-header-meta">
          <h2>{activeMatch.firstName}</h2>
          <p>{statusLabel}</p>
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

      <div className="video-main">
        <div className="remote-video">
          <video ref={remoteVideoRef} className={`remote-video-element ${remoteStreamAvailable ? 'visible' : ''}`} playsInline />

          {!remoteStreamAvailable ? (
            <div className="video-placeholder video-placeholder-remote">
              {activeMatch.photos?.[0] ? (
                <img src={activeMatch.photos[0]} alt={activeMatch.firstName} />
              ) : (
                <div className="placeholder-avatar">
                  {activeMatch.firstName?.charAt(0) || '?'}
                </div>
              )}
              <div className="remote-waiting-card">
                <h3>{activeMatch.firstName}</h3>
                <p>{statusLabel}</p>
                <span className={`presence-pill ${otherUserOnline ? 'online' : 'offline'}`}>
                  {otherUserOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="local-video">
          <video ref={localVideoRef} className={`local-video-element ${mediaReady && isVideoOn ? 'visible' : ''}`} playsInline muted />
          {(!mediaReady || !isVideoOn) ? (
            <div className="video-placeholder video-placeholder-local">
              <div className="placeholder-avatar">
                {currentUserName.charAt(0).toUpperCase()}
              </div>
              <p>{mediaReady ? 'Camera off' : 'Starting camera'}</p>
            </div>
          ) : null}
          <p className="local-video-label">You</p>
        </div>
      </div>

      <div className="call-controls">
        <button
          type="button"
          className={`control-btn ${isMuted ? 'muted' : ''}`}
          onClick={toggleMute}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>

        <button
          type="button"
          className={`control-btn ${!isVideoOn ? 'off' : ''}`}
          onClick={toggleVideo}
          title={isVideoOn ? 'Turn camera off' : 'Turn camera on'}
        >
          {isVideoOn ? 'Camera On' : 'Camera Off'}
        </button>

        <button
          type="button"
          className="control-btn chat"
          onClick={handleOpenMessages}
          title="Open chat"
        >
          Chat
        </button>

        <button
          type="button"
          className="control-btn end-call"
          onClick={() => handleEndCall('ended')}
          title="End call"
        >
          End
        </button>
      </div>
    </div>
  );
};

export default VideoDating;
