import React, { useRef, useState } from 'react';
import momentService from '../services/momentService';
import './Moments.css';

const MomentsUpload = ({ onUploadSuccess, onClose }) => {
  const fileInputRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB');
      return;
    }

    // Read file and create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage({
        file,
        preview: event.target.result,
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedImage) {
      setError('Please select an image');
      return;
    }

    if (caption.length > 200) {
      setError('Caption must be 200 characters or less');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // In a real app, you'd upload to S3 or similar
      // For now, using data URL as placeholder
      const result = await momentService.uploadMoment(
        selectedImage.preview,
        selectedImage.file.name,
        caption
      );

      if (result.success) {
        setSuccess(true);
        if (onUploadSuccess) {
          onUploadSuccess(result.moment);
        }

        // Auto close after success
        setTimeout(() => {
          onClose && onClose();
        }, 1500);
      } else {
        setError(result.error || 'Failed to upload moment');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <div className="moment-upload-container success">
        <div className="success-message">
          <span className="success-icon">✓</span>
          <h2>Moment Shared!</h2>
          <p>Your moment is visible to your matches for 24 hours</p>
          <p className="fomo-text">⏰ Disappears in 24 hours</p>
        </div>
      </div>
    );
  }

  return (
    <div className="moment-upload-overlay" onClick={onClose}>
      <div className="moment-upload-container" onClick={(e) => e.stopPropagation()}>
        <div className="upload-header">
          <h2>Share a Moment 📸</h2>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="upload-content">
          {error && (
            <div className="error-message">
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {selectedImage ? (
            <div className="image-preview-section">
              <div className="preview-image">
                <img src={selectedImage.preview} alt="Preview" />
                <div className="preview-overlay">
                  <button
                    className="btn-change-image"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change Image
                  </button>
                </div>
              </div>

              <div className="caption-section">
                <label>Add Caption (Optional)</label>
                <textarea
                  placeholder="Say something about your moment... (max 200 chars)"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 200))}
                  maxLength={200}
                  rows={3}
                />
                <small>{caption.length}/200</small>
              </div>

              <div className="moment-info">
                <div className="info-item">
                  <span className="icon">👁️</span>
                  <div>
                    <span className="label">Visible To</span>
                    <span className="value">Your Matches</span>
                  </div>
                </div>
                <div className="info-item">
                  <span className="icon">⏱️</span>
                  <div>
                    <span className="label">Duration</span>
                    <span className="value">24 Hours</span>
                  </div>
                </div>
                <div className="info-item">
                  <span className="icon">🗑️</span>
                  <div>
                    <span className="label">Status</span>
                    <span className="value">Auto-Delete</span>
                  </div>
                </div>
              </div>

              <div className="fomo-badge">
                <span className="badge-icon">⚡</span>
                <span>Builds FOMO - Share your daily moments!</span>
              </div>
            </div>
          ) : (
            <div className="image-select-section">
              <div className="upload-icon">📸</div>
              <h3>Upload a Photo</h3>
              <p>Share what you're up to!</p>
              <button
                className="btn-select-image"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Image
              </button>
              <p className="upload-hint">
                JPG, PNG • Max 10MB<br />
                Your matches will only see it for 24 hours
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageSelect}
          />
        </div>

        {selectedImage && (
          <div className="upload-actions">
            <button className="btn-cancel" onClick={() => setSelectedImage(null)}>
              Clear
            </button>
            <button
              className="btn-upload"
              onClick={handleUpload}
              disabled={uploading || !selectedImage}
            >
              {uploading ? 'Uploading...' : '📤 Share Moment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MomentsUpload;
