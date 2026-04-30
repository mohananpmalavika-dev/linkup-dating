/**
 * VideoVerificationCall Component
 * Captures video from user and performs face verification
 */
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from '../router';
import '../styles/VideoVerificationCall.css';
import videoVerificationService from '../services/videoVerificationService';

const VideoVerificationCall = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [status, setStatus] = useState('ready'); // ready, recording, processing, complete, error
  const [error, setError] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef(null);

  const RECORDING_DURATION = 5000; // 5 seconds for verification

  useEffect(() => {
    console.log('VideoVerificationCall component mounted', {
      pathname: location.pathname,
      state: location.state
    });
  }, [location]);

  // Start camera stream
  const startCamera = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setStatus('ready');
      setIsLoading(false);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions and try again.');
      setStatus('error');
      setIsLoading(false);
    }
  };

  // Start recording video
  const startRecording = async () => {
    try {
      if (!streamRef.current) {
        setError('Camera stream not available');
        return;
      }

      const chunks = [];
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        setRecordedChunks(chunks);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      setIsRecording(true);
      setStatus('recording');
      setRecordingTime(0);

      // Auto stop after RECORDING_DURATION
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording();
        }
      }, RECORDING_DURATION);

      // Update recording time
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 100);
      }, 100);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Unable to start recording');
      setStatus('error');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }

    setIsRecording(false);
  };

  // Submit video for verification
  const submitForVerification = async () => {
    try {
      if (recordedChunks.length === 0) {
        setError('No video recording found. Please record a video first.');
        return;
      }

      setIsLoading(true);
      setStatus('processing');

      // Create blob from recorded chunks
      const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });

      // Create FormData
      const formData = new FormData();
      formData.append('video', videoBlob, 'verification-video.webm');

      // Send to backend
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/video-verification/verify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error('Verification failed');
      }

      const result = await response.json();
      setVerificationResult(result);
      setStatus('complete');
      setIsLoading(false);
    } catch (err) {
      console.error('Error submitting video:', err);
      setError(err.message || 'Failed to process verification');
      setStatus('error');
      setIsLoading(false);
    }
  };

  // Stop camera and cleanup
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  };

  // Return to verification prompt
  const handleGoBack = () => {
    stopCamera();
    stopRecording();
    navigate(-1);
  };

  // Initialize camera on mount
  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  const returnPath = location.state?.returnPath || '/video-verification';

  return (
    <div className="video-verification-call">
      <div className="verification-container">
        <button className="back-button" onClick={handleGoBack} title="Go back">
          ← Back
        </button>

        <h2>Video Verification</h2>
        <p className="instruction">
          {status === 'ready' && 'Click Start to begin recording. Look directly at the camera for 5 seconds.'}
          {status === 'recording' && `Recording... ${Math.round(recordingTime / 1000)}s`}
          {status === 'processing' && 'Processing your video for verification...'}
          {status === 'error' && 'An error occurred. Please try again.'}
          {status === 'complete' && verificationResult?.verified ? '✅ Verification successful!' : '❌ Verification failed'}
        </p>

        <div className="video-container">
          <video
            ref={videoRef}
            className="video-stream"
            autoPlay
            playsInline
            muted
          />
          {status === 'recording' && <div className="recording-indicator">● REC</div>}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="controls">
          {status === 'ready' && (
            <button
              className="btn btn-primary"
              onClick={startRecording}
              disabled={isLoading}
            >
              Start Recording
            </button>
          )}

          {status === 'recording' && (
            <button
              className="btn btn-danger"
              onClick={stopRecording}
            >
              Stop Recording
            </button>
          )}

          {(status === 'ready' && recordedChunks.length > 0) || status === 'error' ? (
            <>
              <button
                className="btn btn-primary"
                onClick={submitForVerification}
                disabled={isLoading || recordedChunks.length === 0}
              >
                {isLoading ? 'Processing...' : 'Submit for Verification'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setRecordedChunks([]);
                  setStatus('ready');
                  setError(null);
                }}
              >
                Clear Recording
              </button>
            </>
          ) : null}
        </div>

        {status === 'complete' && verificationResult && (
          <div className={`result-message ${verificationResult.verified ? 'success' : 'failure'}`}>
            <h3>{verificationResult.verified ? '✅ Verified!' : '❌ Not Verified'}</h3>
            <p>{verificationResult.message}</p>

            {verificationResult.scores && (
              <div className="scores">
                <div className="score-item">
                  <span className="score-label">Facial Match:</span>
                  <span className="score-value">
                    {Math.round(verificationResult.scores.facialMatch * 100)}%
                  </span>
                </div>
                {verificationResult.scores.liveness && (
                  <div className="score-item">
                    <span className="score-label">Liveness:</span>
                    <span className="score-value">
                      {Math.round(verificationResult.scores.liveness * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )}

            <button className="btn btn-primary" onClick={handleGoBack}>
              {verificationResult.verified ? 'View Badge' : 'Try Again'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoVerificationCall;
