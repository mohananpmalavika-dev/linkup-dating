import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../contexts/AppContext';
import './CallWindow.css';
import { getAvatarLabel, getEntityId } from './utils';

const rtcConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const CallWindow = ({ call, socket, onEndCall, onAcceptCall, onDeclineCall }) => {
  const { currentUser } = useApp();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(call.callType === 'video');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState(call.status || 'initiating');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const screenVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const remotePeerReadyRef = useRef(false);
  const readySignalSentRef = useRef(false);
  const offerSentRef = useRef(false);

  const currentUserId = getEntityId(call.currentUserId || currentUser);
  const callId = getEntityId(call._id || call.callId);
  const initiatorId = getEntityId(call.initiatorId);
  const recipientId = getEntityId(call.recipientId);
  const caller = call.caller || call.initiatorId || {};
  const recipient = call.recipient || call.recipientId || {};
  const isIncomingCall = recipientId === currentUserId;
  const isCaller = initiatorId === currentUserId;
  const otherParticipant = isCaller ? recipient : caller;
  const otherParticipantId = isCaller ? recipientId : initiatorId;

  useEffect(() => {
    setCallStatus(call.status || 'initiating');
  }, [call.status]);

  useEffect(() => {
    setCallDuration(0);
    setIsMuted(false);
    setIsVideoEnabled(call.callType === 'video');
    setIsScreenSharing(false);
    pendingIceCandidatesRef.current = [];
    remotePeerReadyRef.current = false;
    readySignalSentRef.current = false;
    offerSentRef.current = false;
  }, [call.callType, callId]);

  const serializeDescription = (description) => {
    if (!description) {
      return null;
    }

    if (typeof description.toJSON === 'function') {
      return description.toJSON();
    }

    return {
      type: description.type,
      sdp: description.sdp,
    };
  };

  const startDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      window.clearInterval(durationIntervalRef.current);
    }

    if (call.startedAt) {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000)
      );
      setCallDuration(elapsedSeconds);
    } else {
      setCallDuration(0);
    }

    durationIntervalRef.current = window.setInterval(() => {
      setCallDuration((currentDuration) => currentDuration + 1);
    }, 1000);
  }, [call.startedAt]);

  const attachStreamToMediaElement = useCallback(async (element, stream, { muted = false } = {}) => {
    if (!element || !stream) {
      return;
    }

    element.srcObject = stream;
    element.muted = muted;

    if (typeof element.play === 'function') {
      try {
        await element.play();
      } catch (error) {
        console.warn('Unable to autoplay call media:', error);
      }
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
  }, []);

  const stopRemoteStream = useCallback(() => {
    remoteStreamRef.current = null;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  const stopScreenShareStream = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
  }, []);

  const cleanupCall = useCallback(() => {
    if (durationIntervalRef.current) {
      window.clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    pendingIceCandidatesRef.current = [];
    remotePeerReadyRef.current = false;
    readySignalSentRef.current = false;
    offerSentRef.current = false;

    stopScreenShareStream();
    stopLocalStream();
    stopRemoteStream();

    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  }, [stopLocalStream, stopRemoteStream, stopScreenShareStream]);

  const emitReadySignal = useCallback(() => {
    if (!socket || !callId || !otherParticipantId || readySignalSentRef.current) {
      return;
    }

    readySignalSentRef.current = true;
    socket.emit('call:ready', {
      callId,
      targetUserId: otherParticipantId,
    });
  }, [callId, otherParticipantId, socket]);

  const emitSignal = useCallback(
    (payload = {}) => {
      if (!socket || !callId || !otherParticipantId) {
        return;
      }

      socket.emit('call:signal', {
        callId,
        targetUserId: otherParticipantId,
        ...payload,
      });
    },
    [callId, otherParticipantId, socket]
  );

  const flushPendingIceCandidates = useCallback(async (peerConnection) => {
    while (pendingIceCandidatesRef.current.length > 0 && peerConnection?.remoteDescription?.type) {
      const nextCandidate = pendingIceCandidatesRef.current.shift();

      try {
        await peerConnection.addIceCandidate(nextCandidate);
      } catch (error) {
        console.error('Failed to apply queued ICE candidate:', error);
      }
    }
  }, []);

  const ensureLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const constraints = {
      audio: true,
      video:
        call.callType === 'video'
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;

    if (localVideoRef.current) {
      await attachStreamToMediaElement(localVideoRef.current, stream, { muted: true });
    }

    const localVideoTrack = stream.getVideoTracks()[0];
    setIsVideoEnabled(Boolean(localVideoTrack?.enabled));

    return stream;
  }, [attachStreamToMediaElement, call.callType]);

  const ensurePeerConnection = useCallback(async () => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const stream = await ensureLocalStream();
    const peerConnection = new RTCPeerConnection(rtcConfiguration);
    peerConnectionRef.current = peerConnection;

    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

    peerConnection.ontrack = (event) => {
      const syncRemoteStream = (stream) => {
        remoteStreamRef.current = stream;

        if (remoteVideoRef.current) {
          void attachStreamToMediaElement(remoteVideoRef.current, stream);
        }

        if (remoteAudioRef.current) {
          void attachStreamToMediaElement(remoteAudioRef.current, stream);
        }
      };

      const remoteStream = event.streams?.[0];

      if (remoteStream) {
        syncRemoteStream(remoteStream);
        return;
      }

      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }

      remoteStreamRef.current.addTrack(event.track);
      syncRemoteStream(remoteStreamRef.current);
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        emitSignal({
          candidate:
            typeof event.candidate.toJSON === 'function'
              ? event.candidate.toJSON()
              : event.candidate,
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      switch (peerConnection.connectionState) {
        case 'connected':
          setCallStatus('accepted');
          break;
        case 'connecting':
          setCallStatus('connecting');
          break;
        case 'failed':
        case 'disconnected':
          setCallStatus('failed');
          break;
        default:
          break;
      }
    };

    return peerConnection;
  }, [attachStreamToMediaElement, emitSignal, ensureLocalStream]);

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
        description: serializeDescription(peerConnection.localDescription || offer),
      });
      setCallStatus('connecting');
    } catch (error) {
      offerSentRef.current = false;
      throw error;
    }
  }, [emitSignal, ensurePeerConnection, isCaller]);

  useEffect(() => {
    if (!socket || !callId) {
      return undefined;
    }

    const handlePeerReady = async (payload = {}) => {
      if (getEntityId(payload.callId) !== callId) {
        return;
      }

      if (getEntityId(payload.fromUserId) !== otherParticipantId) {
        return;
      }

      remotePeerReadyRef.current = true;

      if (isCaller) {
        try {
          await startOutgoingOffer();
        } catch (error) {
          console.error('Failed to create call offer:', error);
        }
      }
    };

    const handleSignal = async (payload = {}) => {
      if (getEntityId(payload.callId) !== callId) {
        return;
      }

      if (payload.fromUserId && getEntityId(payload.fromUserId) !== otherParticipantId) {
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
              description: serializeDescription(peerConnection.localDescription || answer),
            });
            setCallStatus('connecting');
          }

          if (payload.description.type === 'answer') {
            setCallStatus('connecting');
          }
        }

        if (payload.candidate) {
          const iceCandidate = new RTCIceCandidate(payload.candidate);

          if (peerConnection.remoteDescription?.type) {
            await peerConnection.addIceCandidate(iceCandidate);
          } else {
            pendingIceCandidatesRef.current.push(iceCandidate);
          }
        }
      } catch (error) {
        console.error('Failed to process call signal:', error);
      }
    };

    socket.on('call:ready', handlePeerReady);
    socket.on('call:signal', handleSignal);

    return () => {
      socket.off('call:ready', handlePeerReady);
      socket.off('call:signal', handleSignal);
    };
  }, [
    callId,
    emitSignal,
    ensurePeerConnection,
    flushPendingIceCandidates,
    isCaller,
    otherParticipantId,
    socket,
    startOutgoingOffer,
  ]);

  useEffect(() => {
    if (call.status !== 'accepted') {
      return undefined;
    }

    let isCancelled = false;

    const initializeAcceptedCall = async () => {
      try {
        await ensurePeerConnection();

        if (isCancelled) {
          return;
        }

        emitReadySignal();
        startDurationTimer();

        if (isCaller && remotePeerReadyRef.current) {
          await startOutgoingOffer();
        } else {
          setCallStatus('connecting');
        }
      } catch (error) {
        console.error('Failed to initialize call:', error);
        onEndCall();
      }
    };

    initializeAcceptedCall();

    return () => {
      isCancelled = true;
      cleanupCall();
    };
  }, [
    call.status,
    cleanupCall,
    emitReadySignal,
    ensurePeerConnection,
    isCaller,
    onEndCall,
    startDurationTimer,
    startOutgoingOffer,
  ]);

  const toggleMute = () => {
    if (!localStreamRef.current) {
      return;
    }

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) {
      return;
    }

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
    }
  };

  const restoreCameraTrack = useCallback(async () => {
    const cameraTrack = localStreamRef.current?.getVideoTracks()?.[0];
    const videoSender = peerConnectionRef.current?.getSenders().find(
      (candidate) => candidate.track?.kind === 'video'
    );

    if (videoSender && cameraTrack) {
      await videoSender.replaceTrack(cameraTrack);
    }

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, []);

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await restoreCameraTrack();
        stopScreenShareStream();
        setIsScreenSharing(false);
        return;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = displayStream;

      if (screenVideoRef.current) {
        await attachStreamToMediaElement(screenVideoRef.current, displayStream, { muted: true });
      }

      const screenTrack = displayStream.getVideoTracks()[0];
      const videoSender = peerConnectionRef.current?.getSenders().find(
        (candidate) => candidate.track?.kind === 'video'
      );

      if (videoSender && screenTrack) {
        await videoSender.replaceTrack(screenTrack);
      }

      screenTrack.onended = async () => {
        await restoreCameraTrack();
        stopScreenShareStream();
        setIsScreenSharing(false);
      };

      setIsScreenSharing(true);
    } catch (error) {
      console.error('Screen sharing failed:', error);
    }
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  };

  const getCallStatusText = () => {
    switch (callStatus) {
      case 'initiating':
        return 'Starting call...';
      case 'ringing':
        return isIncomingCall ? 'Incoming call...' : 'Ringing...';
      case 'connecting':
        return 'Connecting media...';
      case 'accepted':
        return formatDuration(callDuration);
      case 'declined':
        return 'Call declined';
      case 'ended':
        return 'Call ended';
      case 'failed':
        return 'Connection failed';
      default:
        return 'Connecting...';
    }
  };

  const showIncomingRingControls = callStatus === 'ringing' && isIncomingCall;
  const showActiveCallControls = ['accepted', 'connecting'].includes(callStatus);

  return (
    <div className="call-window-overlay">
      <div className="call-window">
        <div className="call-header">
          <div className="call-info">
            <h3>{otherParticipant?.name || 'Unknown'}</h3>
            <p className="call-status">{getCallStatusText()}</p>
          </div>
          <button className="btn-close-call" onClick={onEndCall} type="button">
            X
          </button>
        </div>

        <div className="call-content">
          {call.callType === 'video' && (
            <div className="video-container">
              <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
              <video ref={localVideoRef} className="local-video" autoPlay playsInline muted />
              {isScreenSharing && (
                <video ref={screenVideoRef} className="screen-video" autoPlay playsInline muted />
              )}
            </div>
          )}

          {call.callType === 'audio' && (
            <div className="audio-call-container">
              <audio
                ref={remoteAudioRef}
                className="call-hidden-audio"
                autoPlay
                playsInline
              />
              <div className="audio-avatar">
                <span className="avatar-icon">
                  {getAvatarLabel(
                    otherParticipant?.name,
                    otherParticipant?.username,
                    otherParticipant?.avatar,
                    'U'
                  )}
                </span>
              </div>
              <p className="audio-call-name">{otherParticipant?.name || 'Unknown caller'}</p>
              {showActiveCallControls && (
                <div className="audio-waves" aria-hidden="true">
                  <span className="wave"></span>
                  <span className="wave"></span>
                  <span className="wave"></span>
                  <span className="wave"></span>
                  <span className="wave"></span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="call-controls">
          {showIncomingRingControls ? (
            <>
              <button className="btn-call-control decline" onClick={onDeclineCall} type="button">
                Decline
              </button>
              <button className="btn-call-control accept" onClick={onAcceptCall} type="button">
                Accept
              </button>
            </>
          ) : showActiveCallControls ? (
            <>
              <button
                className={`btn-call-control ${isMuted ? 'active' : ''}`}
                onClick={toggleMute}
                type="button"
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>

              {call.callType === 'video' && (
                <>
                  <button
                    className={`btn-call-control ${!isVideoEnabled ? 'active' : ''}`}
                    onClick={toggleVideo}
                    type="button"
                  >
                    {!isVideoEnabled ? 'Turn On' : 'Turn Off'}
                  </button>

                  <button
                    className={`btn-call-control ${isScreenSharing ? 'active' : ''}`}
                    onClick={toggleScreenShare}
                    type="button"
                  >
                    {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                  </button>
                </>
              )}

              <button className="btn-call-control end" onClick={onEndCall} type="button">
                End Call
              </button>
            </>
          ) : (
            <button className="btn-call-control end" onClick={onEndCall} type="button">
              End Call
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallWindow;
