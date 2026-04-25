import React, { useState, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import VoiceNoteRecorder from './VoiceNoteRecorder';

const VoiceInput = ({ 
  onVoiceResult, 
  placeholder = 'Speak to fill...', 
  fieldType = 'text',
  module = 'general', 
  context = {},
  className = '' 
}) => {
  const { apiCall } = useApp();
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState('');

  const handleVoiceResult = async (voicePayload) => {
    const audioBlob = voicePayload instanceof Blob ? voicePayload : voicePayload?.blob;
    if (!audioBlob) {
      return;
    }

    setListening(true);
    
    const formData = new FormData();
    formData.append('audio', audioBlob, voicePayload?.fileName || 'voice.m4a');
    
    try {
      // Transcribe
      const transcription = await apiCall('/voice-input/transcribe', 'POST', formData);
      
      // Process for field
      const processed = await apiCall('/voice-input/process', 'POST', {
        audio: transcription.text,
        fieldType,
        context,
        module
      });

      setResult(processed.value);
      onVoiceResult(processed);
    } catch (error) {
      console.error('Voice input error:', error);
    }
    
    setListening(false);
  };

  return (
    <div className={`voice-input ${className}`}>
      <VoiceNoteRecorder 
        onSend={handleVoiceResult}
        module={module}
        contextId={context.id}
        recipientId={context.recipientId}
      />
      {listening && <div className="voice-listening">🎤 Listening...</div>}
      {result && (
        <input 
          value={result} 
          readOnly 
          placeholder={placeholder}
          className="voice-result"
        />
      )}
    </div>
  );
};

export default VoiceInput;

