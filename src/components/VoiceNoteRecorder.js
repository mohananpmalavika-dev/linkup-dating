import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext';

const MIME_TYPE_CANDIDATES = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  return MIME_TYPE_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
};

const getFileExtension = (mimeType = '') => {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
    return 'm4a';
  }

  if (mimeType.includes('ogg')) {
    return 'ogg';
  }

  return 'webm';
};

const VoiceNoteRecorder = ({ module, contextId, recipientId, onSend }) => {
  const { apiCall } = useApp();
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const previewUrlRef = useRef('');

  const clearPreviewUrl = () => {
    if (!previewUrlRef.current) {
      return;
    }

    URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
  };

  const stopStreamTracks = () => {
    if (!streamRef.current) {
      return;
    }

    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearPreviewUrl();
      stopStreamTracks();
    };
  }, []);

  const uploadVoiceNote = async (blob, mimeType) => {
    if (!onSend) {
      return;
    }

    const extension = getFileExtension(mimeType);
    const fileName = `voice-note.${extension}`;
    const formData = new FormData();

    formData.append('audio', blob, fileName);
    formData.append('module', module || 'general');
    formData.append('contextId', contextId || 'new');
    if (recipientId) {
      formData.append('recipientId', recipientId);
    }

    setUploading(true);
    setUploadError('');

    try {
      const response = await apiCall('/voice/voicenote', 'POST', formData);
      const uploadedVoiceNote = response?.voiceNote || response?.data || response;
      const uploadedUrl = uploadedVoiceNote?.s3Url || uploadedVoiceNote?.url || '';

      onSend({
        blob,
        previewUrl: previewUrlRef.current,
        mimeType,
        fileName,
        url: uploadedUrl,
        s3Url: uploadedUrl,
        voiceNote: uploadedVoiceNote,
      });
    } catch (error) {
      console.error('Voice note send failed:', error);
      setUploadError(error?.response?.data?.message || error?.message || 'Unable to upload voice note.');
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      setUploadError('');
      clearPreviewUrl();
      setAudioBlob(null);
      setAudioPreviewUrl('');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = getSupportedMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blobMimeType = recorder.mimeType || preferredMimeType || 'audio/webm';
        const nextAudioBlob = new Blob(audioChunksRef.current, { type: blobMimeType });

        stopStreamTracks();

        if (!nextAudioBlob.size) {
          setUploadError('No audio was captured. Please try again.');
          return;
        }

        clearPreviewUrl();
        const nextPreviewUrl = URL.createObjectURL(nextAudioBlob);
        previewUrlRef.current = nextPreviewUrl;
        setAudioBlob(nextAudioBlob);
        setAudioPreviewUrl(nextPreviewUrl);

        await uploadVoiceNote(nextAudioBlob, blobMimeType);
      };

      recorder.start();
      setRecording(true);
    } catch (error) {
      console.error('Recording failed:', error);
      setUploadError('Microphone access failed. Please allow microphone permission and try again.');
      stopStreamTracks();
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  return (
    <div className="voice-note-recorder">
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        className="voice-recorder-btn"
        disabled={uploading}
      >
        {recording ? 'Stop recording' : 'Record voice'}
      </button>
      {audioPreviewUrl ? (
        <audio controls preload="metadata" src={audioPreviewUrl}>
          Your browser could not play this recording.
        </audio>
      ) : null}
      {uploading ? <span className="reminderalert-inline-meta">Uploading voice note...</span> : null}
      {uploadError ? <span className="reminderalert-inline-meta">{uploadError}</span> : null}
      {audioBlob && !uploading && !uploadError ? (
        <span className="reminderalert-inline-meta">Voice note ready to use.</span>
      ) : null}
    </div>
  );
};

export default VoiceNoteRecorder;
