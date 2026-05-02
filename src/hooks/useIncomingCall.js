/**
 * Incoming Call Hook
 * Manages incoming call notifications and requests
 */
import { useEffect, useState, useCallback } from 'react';
import realTimeService from '../services/realTimeService';

export const useIncomingCall = (userId, enabled = true) => {
  const [incomingCall, setIncomingCall] = useState(null);
  const [loading, setLoading] = useState(false);

  // Handle incoming call request
  const handleIncomingCall = useCallback((callData) => {
    setIncomingCall({
      ...callData,
      receivedAt: new Date(callData.receivedAt)
    });
  }, []);

  // Dismiss/reject incoming call
  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  useEffect(() => {
    if (!userId || !enabled) return;

    // Subscribe to incoming call events
    const unsubscribe = realTimeService.on('incoming_call_request', handleIncomingCall);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userId, enabled, handleIncomingCall]);

  return {
    incomingCall,
    loading,
    dismissIncomingCall
  };
};

export default useIncomingCall;
