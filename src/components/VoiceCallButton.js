import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import io from 'socket.io-client';

const VoiceCallButton = ({ recipientId, module, contextId, className = '', label = 'Voice Call' }) => {
  const { currentUser, apiCall } = useApp();
  const [calling, setCalling] = useState(false);
  const socket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000');

  const initiateCall = async () => {
    setCalling(true);
    try {
      const response = await apiCall('/voice/initiate', 'POST', {
        recipientId,
        module,
        contextId,
        callType: 'audio'
      });
      
      if (response.success) {
        // Handle WebRTC signaling here
        console.log('Voice call initiated:', response.callId);
      }
    } catch (error) {
      console.error('Call failed:', error);
    }
    setCalling(false);
  };

  return (
    <button
      onClick={initiateCall}
      disabled={calling || !currentUser || currentUser.id === recipientId}
      className={`voice-call-btn ${className} ${calling ? 'calling' : ''}`}
      title="Voice Call"
    >
      {calling ? '📞 Calling...' : label || '📞 Call'}
    </button>
  );
};

export default VoiceCallButton;

