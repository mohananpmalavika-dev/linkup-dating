import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/PhotoABTestUpload.css';

const PhotoABTestUpload = ({ onTestCreated, userPhotos = [] }) => {
  const [selectedPhotoA, setSelectedPhotoA] = useState('');
  const [selectedPhotoB, setSelectedPhotoB] = useState('');
  const [testName, setTestName] = useState('');
  const [durationHours, setDurationHours] = useState(48);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewA, setPreviewA] = useState(null);
  const [previewB, setPreviewB] = useState(null);

  useEffect(() => {
    if (selectedPhotoA && userPhotos.length > 0) {
      const photo = userPhotos.find(p => p.id === parseInt(selectedPhotoA));
      setPreviewA(photo?.url || null);
    }
  }, [selectedPhotoA, userPhotos]);

  useEffect(() => {
    if (selectedPhotoB && userPhotos.length > 0) {
      const photo = userPhotos.find(p => p.id === parseInt(selectedPhotoB));
      setPreviewB(photo?.url || null);
    }
  }, [selectedPhotoB, userPhotos]);

  const handleCreateTest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!selectedPhotoA || !selectedPhotoB) {
      setError('Please select both photos');
      return;
    }

    if (selectedPhotoA === selectedPhotoB) {
      setError('Please select different photos');
      return;
    }

    if (durationHours < 1 || durationHours > 720) {
      setError('Duration must be between 1 and 720 hours');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/photo-ab-testing`,
        {
          photoAId: parseInt(selectedPhotoA),
          photoBId: parseInt(selectedPhotoB),
          testName: testName || `Test ${new Date().toLocaleDateString()}`,
          durationHours: parseInt(durationHours)
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setSuccess(`Test created successfully! Testing for ${durationHours} hours.`);
      setSelectedPhotoA('');
      setSelectedPhotoB('');
      setTestName('');
      setDurationHours(48);
      setPreviewA(null);
      setPreviewB(null);

      if (onTestCreated) {
        onTestCreated(response.data.test);
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="photo-ab-test-upload">
      <h2>Create New A/B Test</h2>
      <p className="subtitle">Compare 2 photos and see which gets more likes</p>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={handleCreateTest} className="test-form">
        {/* Photo Selection Grid */}
        <div className="photo-selection-grid">
          {/* Photo A */}
          <div className="photo-select-box">
            <label>Photo A</label>
            <select
              value={selectedPhotoA}
              onChange={(e) => setSelectedPhotoA(e.target.value)}
              className="photo-select"
            >
              <option value="">Select Photo A</option>
              {userPhotos.map((photo) => (
                <option key={photo.id} value={photo.id}>
                  Photo {photo.displayOrder || photo.id}
                </option>
              ))}
            </select>
            {previewA && (
              <div className="photo-preview">
                <img src={previewA} alt="Photo A Preview" />
                <span className="preview-label">A</span>
              </div>
            )}
          </div>

          {/* VS Label */}
          <div className="vs-label">
            <span>vs</span>
          </div>

          {/* Photo B */}
          <div className="photo-select-box">
            <label>Photo B</label>
            <select
              value={selectedPhotoB}
              onChange={(e) => setSelectedPhotoB(e.target.value)}
              className="photo-select"
            >
              <option value="">Select Photo B</option>
              {userPhotos.map((photo) => (
                <option key={photo.id} value={photo.id}>
                  Photo {photo.displayOrder || photo.id}
                </option>
              ))}
            </select>
            {previewB && (
              <div className="photo-preview">
                <img src={previewB} alt="Photo B Preview" />
                <span className="preview-label">B</span>
              </div>
            )}
          </div>
        </div>

        {/* Test Configuration */}
        <div className="test-config">
          <div className="config-field">
            <label htmlFor="testName">Test Name (Optional)</label>
            <input
              id="testName"
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="e.g., Outdoor vs Indoor"
              className="input-field"
            />
          </div>

          <div className="config-field">
            <label htmlFor="duration">Test Duration</label>
            <div className="duration-selector">
              <select
                id="duration"
                value={durationHours}
                onChange={(e) => setDurationHours(parseInt(e.target.value))}
                className="duration-select"
              >
                <option value={12}>12 hours</option>
                <option value={24}>24 hours (1 day)</option>
                <option value={48}>48 hours (2 days) - Recommended</option>
                <option value={72}>72 hours (3 days)</option>
                <option value={168}>168 hours (1 week)</option>
                <option value={336}>336 hours (2 weeks)</option>
              </select>
              <p className="duration-note">
                Longer tests provide more reliable data
              </p>
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="benefits-section">
          <h3>Why A/B Test?</h3>
          <ul>
            <li>📊 See which photo gets more likes</li>
            <li>📈 Track engagement rates in real-time</li>
            <li>🎯 Auto-promote winning photo to position 1</li>
            <li>🔄 Make data-driven profile improvements</li>
          </ul>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !selectedPhotoA || !selectedPhotoB}
          className="submit-button"
        >
          {loading ? (
            <>
              <span className="spinner"></span> Creating Test...
            </>
          ) : (
            '🚀 Start A/B Test'
          )}
        </button>
      </form>
    </div>
  );
};

export default PhotoABTestUpload;
