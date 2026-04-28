import React, { useRef, useState, useEffect } from 'react';
import '../styles/IcebreakerVideos.css';

/**
 * IcebreakerVideoRecorder
 * Record a 5-second video intro explaining "Why I'm looking for someone"
 * Premium feature
 */
function IcebreakerVideoRecorder({ onUploadSuccess, onCancel }) {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [timeLeft, setTimeLeft] = useState(5);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const RECORDING_TIME_LIMIT = 5000; // 5 seconds in milliseconds

  // Initialize camera on mount
  useEffect(() => {
    initializeCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Timer effect for recording countdown
  useEffect(() => {
    if (isRecording && recordingStartTime) {
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - recordingStartTime;
        const remaining = Math.max(0, 5 - Math.floor(elapsed / 1000));
        setTimeLeft(remaining);

        if (remaining === 0) {
          stopRecording();
        }
      }, 100);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, recordingStartTime]);

  /**
   * Initialize camera
   */
  const initializeCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: true,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp9,opus',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      };

      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      setError('Camera access denied. Please enable camera permissions.');
      console.error('Camera initialization error:', err);
    }
  };

  /**
   * Stop camera stream
   */
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  /**
   * Start recording
   */
  const startRecording = () => {
    if (mediaRecorderRef.current && stream) {
      setRecordedChunks([]);
      setPreviewUrl(null);
      setError(null);
      setTimeLeft(5);

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingStartTime(Date.now());
    }
  };

  /**
   * Stop recording
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  /**
   * Reset recording
   */
  const resetRecording = () => {
    setPreviewUrl(null);
    setRecordedChunks([]);
    setError(null);
    setTimeLeft(5);
    setIsRecording(false);

    if (timerRef.current) clearInterval(timerRef.current);
  };

  /**
   * Upload video
   */
  const handleUpload = async () => {
    if (!previewUrl || recordedChunks.length === 0) {
      setError('No video to upload');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create blob from recorded chunks
      const blob = new Blob(recordedChunks, { type: 'video/webm' });

      // TODO: Upload to S3 and get URL
      // For now, use the preview URL (in production, upload to S3)
      const videoUrl = previewUrl;
      const videoKey = `icebreaker-videos/${Date.now()}.webm`;

      // Call parent's upload handler
      await onUploadSuccess({
        videoUrl,
        videoKey,
        durationSeconds: 5,
        thumbnailUrl: previewUrl, // Generate proper thumbnail
      });

      resetRecording();
    } catch (err) {
      setError('Upload failed. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (error && !previewUrl) {
    return (
      <div className="recorder-container">
        <div className="recorder-error">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <button onClick={onCancel} className="btn-cancel">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="recorder-container">
      <div className="recorder-header">
        <h2>📹 Record Your Intro</h2>
        <button onClick={onCancel} className="btn-close">
          ✕
        </button>
      </div>

      <div className="recorder-content">
        {!previewUrl ? (
          <>
            {/* Live preview */}
            <div className="video-preview-live">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="video-feed"
              />

              {isRecording && (
                <div className="recording-overlay">
                  <div className="recording-indicator">
                    <span className="pulse"></span>
                    Recording
                  </div>
                  <div className="timer">{timeLeft}s</div>
                </div>
              )}
            </div>

            {/* Prompt */}
            <div className="recorder-prompt">
              <h3>🎬 "Why I'm looking for someone"</h3>
              <p>Tell us in 5 seconds or less what you're looking for in a match.</p>
              <ul className="tips">
                <li>Be authentic and genuine</li>
                <li>Look at the camera</li>
                <li>Speak clearly and smile</li>
                <li>Keep it natural and casual</li>
              </ul>
            </div>

            {/* Controls */}
            <div className="recorder-controls">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="btn-record"
                  disabled={!stream || isLoading}
                >
                  🔴 Start Recording
                </button>
              ) : (
                <button onClick={stopRecording} className="btn-stop">
                  ⏹ Stop Recording
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Preview */}
            <div className="video-preview">
              <video
                src={previewUrl}
                controls
                className="recorded-video"
              />
            </div>

            {/* Preview actions */}
            <div className="preview-actions">
              <button
                onClick={resetRecording}
                className="btn-retake"
                disabled={isLoading}
              >
                🔄 Retake
              </button>
              <button
                onClick={handleUpload}
                className="btn-upload"
                disabled={isLoading}
              >
                {isLoading ? 'Uploading...' : '✓ Upload'}
              </button>
            </div>

            {/* Premium badge */}
            <div className="premium-badge">
              <span className="badge-text">✨ Premium Feature</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default IcebreakerVideoRecorder;
