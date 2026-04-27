import React, { useState, useRef } from 'react';
import { datingProfileService } from '../services/datingProfileService';
import './VideoIntroUploader.css';

/**
 * VideoIntroUploader Component
 * Handles video recording/selection and uploads video intro with fraud detection
 */
export const VideoIntroUploader = ({ 
  onUploadSuccess, 
  onClose, 
  isPremium = false,
  currentVideoUrl = null,
  currentDuration = null 
}) => {
  const [mode, setMode] = useState('select'); // 'select' | 'preview' | 'uploading'
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoDuration, setVideoDuration] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const videoInputRef = useRef(null);
  const videoPreviewRef = useRef(null);

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Please choose a video file.');
      return;
    }

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('Video is too large. Maximum size is 50MB.');
      return;
    }

    try {
      setError('');
      const duration = await datingProfileService.getVideoDurationSeconds(file);

      if (duration < 15 || duration > 60) {
        setSelectedFile(null);
        setVideoDuration(null);
        setError('Video must be between 15 and 60 seconds long.');
        return;
      }

      setSelectedFile(file);
      setVideoDuration(duration);
      setMode('preview');
    } catch (err) {
      setSelectedFile(null);
      setVideoDuration(null);
      setError('Failed to read video. Please try another file.');
    }
  };

  const handleUploadVideo = async () => {
    if (!selectedFile || !videoDuration) {
      setError('Select a valid video first.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      // Upload video
      const uploadResult = await datingProfileService.uploadVideoIntro(
        selectedFile,
        videoDuration
      );

      setMode('uploading');
      setUploadProgress(50);

      // Wait a moment for fraud detection to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get updated details
      const videoDetails = await datingProfileService.getVideoIntroDetails();
      setUploadProgress(100);

      // Success!
      setTimeout(() => {
        onUploadSuccess?.(uploadResult, videoDetails);
      }, 500);
    } catch (err) {
      setError(err || 'Upload failed. Please try again.');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setVideoDuration(null);
    setMode('select');
    setError('');
    setUploadProgress(0);
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  return (
    <div className="video-intro-uploader">
      <div className="video-uploader-header">
        <h3>Add Video Intro</h3>
        <button 
          type="button" 
          className="close-btn" 
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {mode === 'select' && (
        <div className="video-uploader-select">
          <div className="video-upload-hint">
            <div className="hint-icon">🎥</div>
            <p className="hint-title">Record or upload a video intro</p>
            <p className="hint-text">
              Show your personality with a 15-60 second video. Our AI will verify it's really you!
            </p>
          </div>

          <div className="video-upload-specs">
            <div className="spec-item">
              <span className="spec-label">Duration</span>
              <span className="spec-value">15-60 seconds</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Formats</span>
              <span className="spec-value">MP4, WebM, MOV</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Max size</span>
              <span className="spec-value">50MB</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Feature</span>
              <span className="spec-value">Premium ⭐</span>
            </div>
          </div>

          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="video-input-hidden"
            aria-label="Select video file"
          />

          <button
            type="button"
            className="btn-upload-video"
            onClick={() => videoInputRef.current?.click()}
          >
            📁 Choose video
          </button>

          {currentVideoUrl && (
            <div className="current-video-card">
              <strong>Current video on profile</strong>
              <p>{currentDuration}s</p>
            </div>
          )}

          {isPremium && (
            <div className="premium-badge">
              Premium feature unlock ⭐
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}
        </div>
      )}

      {mode === 'preview' && (
        <div className="video-uploader-preview">
          <video
            ref={videoPreviewRef}
            src={URL.createObjectURL(selectedFile)}
            controls
            preload="metadata"
            className="video-preview-player"
          />

          <div className="video-info">
            <p>
              <strong>{selectedFile.name}</strong>
            </p>
            <p className="video-duration">
              {videoDuration} seconds
            </p>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="preview-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleReset}
              disabled={uploading}
            >
              Choose different
            </button>
            <button
              type="button"
              className="btn-upload"
              onClick={handleUploadVideo}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload video'}
            </button>
          </div>
        </div>
      )}

      {mode === 'uploading' && (
        <div className="video-uploader-uploading">
          <div className="upload-spinner">
            <div className="spinner-animation">🎬</div>
          </div>

          <h4>Processing your video...</h4>
          <p className="upload-status">
            {uploadProgress < 50 && 'Uploading video...'}
            {uploadProgress >= 50 && uploadProgress < 100 && 'Verifying authenticity...'}
            {uploadProgress === 100 && 'Complete!'}
          </p>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>

          <p className="upload-note">
            Our AI checks your video to ensure it's really you. This usually takes 1-2 minutes.
          </p>
        </div>
      )}
    </div>
  );
};

export default VideoIntroUploader;
