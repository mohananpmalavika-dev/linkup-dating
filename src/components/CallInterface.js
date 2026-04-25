import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import io from 'socket.io-client';

const CallInterface = ({ callId, onEndCall }) => {
  const { currentUser, apiCall } = useApp();
  const [status, setStatus] = useState('connecting');
  const [remoteStream, setRemoteStream] = useState(null);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pcRef = useRef();
  const socket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000');

  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pcRef.current = pc;

    // Local stream
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      });

    // Socket events
    socket.emit('join-call', callId);
    
    socket.on('call-accepted', async (data) => {
      setStatus('connected');
      const remoteStream = new MediaStream();
      pc.ontrack = event => {
        remoteStream.addTrack(event.track);
        remoteVideoRef.current.srcObject = remoteStream;
      };
    });

    socket.on('call-ended', () => {
      endCall();
    });

    return () => {
      pc.close();
      socket.off('call-accepted');
      socket.off('call-ended');
    };
  }, [callId]);

  const endCall = async () => {
    await apiCall(`/voice/end/${callId}`, 'POST');
    onEndCall();
  };

  return (
    <div className="call-interface">
      <video ref={localVideoRef} autoPlay muted className="local-video" />
      <video ref={remoteVideoRef} autoPlay className="remote-video" />
      <div className="call-status">{status.toUpperCase()}</div>
      <button onClick={endCall} className="end-call-btn">End Call</button>
    </div>
  );
};

export default CallInterface;

