import React, { useState, useEffect } from 'react';
import dateSafetyService from '../services/dateSafetyService';
import './LiveLocationSharing.css';

const LiveLocationSharing = ({ sessionId, friendName = 'Your Friend', onLocationUpdate }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [locationHistory, setLocationHistory] = useState([]);
  const [accuracy, setAccuracy] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [error, setError] = useState(null);
  const [address, setAddress] = useState(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  useEffect(() => {
    if (isSharing) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }

    return () => {
      if (watchId !== null) {
        dateSafetyService.stopWatchingLocation(watchId);
      }
    };
  }, [isSharing]);

  const startLocationTracking = async () => {
    try {
      setError(null);

      // Get initial location
      const location = await dateSafetyService.getUserLocation();
      updateLocationData(location);

      // Watch for location changes
      const id = dateSafetyService.watchUserLocation(
        (location) => {
          updateLocationData(location);
        },
        (err) => {
          setError(err.message);
          console.error('Location tracking error:', err);
        }
      );

      setWatchId(id);
    } catch (error) {
      setError(error.message);
      console.error('Failed to start location tracking:', error);
    }
  };

  const updateLocationData = async (location) => {
    try {
      const { latitude, longitude, accuracy } = location;

      setCurrentLocation({ latitude, longitude });
      setAccuracy(accuracy);
      setLastUpdate(new Date());
      setUpdateCount((prev) => prev + 1);

      // Add to history
      setLocationHistory((prev) => {
        const newHistory = [
          ...prev,
          {
            latitude,
            longitude,
            timestamp: new Date(),
          },
        ];
        return newHistory.slice(-50); // Keep last 50 points
      });

      // Get address
      setIsLoadingAddress(true);
      try {
        const addr = await dateSafetyService.reverseGeocode(latitude, longitude);
        setAddress(addr);
      } catch (err) {
        console.error('Reverse geocoding failed:', err);
      } finally {
        setIsLoadingAddress(false);
      }

      // Update server
      try {
        await dateSafetyService.updateLocation(sessionId, latitude, longitude);
      } catch (err) {
        console.error('Failed to update server location:', err);
      }

      if (onLocationUpdate) {
        onLocationUpdate(location);
      }
    } catch (error) {
      console.error('Error updating location data:', error);
    }
  };

  const stopLocationTracking = () => {
    if (watchId !== null) {
      dateSafetyService.stopWatchingLocation(watchId);
      setWatchId(null);
    }
  };

  const toggleSharing = () => {
    setIsSharing(!isSharing);
  };

  const openInMaps = () => {
    if (!currentLocation) return;

    const { latitude, longitude } = currentLocation;
    const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
    window.open(mapsUrl, '_blank');
  };

  const getAccuracyLevel = () => {
    if (!accuracy) return 'Unknown';
    if (accuracy < 10) return 'Excellent (< 10m)';
    if (accuracy < 30) return 'Good (< 30m)';
    if (accuracy < 100) return 'Fair (< 100m)';
    return 'Poor (> 100m)';
  };

  return (
    <div className="live-location-sharing">
      <div className="location-header">
        <h3>📍 Live Location Sharing</h3>
        <p>Sharing with {friendName}</p>
      </div>

      <div className="location-status">
        <div className={`status-indicator ${isSharing ? 'active' : 'inactive'}`}>
          <span className="status-dot"></span>
          <span className="status-text">
            {isSharing ? 'Sharing Active' : 'Sharing Inactive'}
          </span>
        </div>

        <button
          className={`toggle-sharing-btn ${isSharing ? 'stop' : 'start'}`}
          onClick={toggleSharing}
        >
          {isSharing ? '⏸ Stop Sharing' : '▶ Start Sharing'}
        </button>
      </div>

      {error && (
        <div className="location-error">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <small>Make sure location permissions are enabled</small>
        </div>
      )}

      {isSharing && currentLocation && (
        <div className="location-details">
          <div className="location-info-card">
            <div className="info-row">
              <span className="info-label">📍 Coordinates</span>
              <span className="info-value">
                {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">🎯 Accuracy</span>
              <span className="info-value accuracy-badge">
                {getAccuracyLevel()}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">📍 Address</span>
              <span className="info-value address-value">
                {isLoadingAddress ? 'Loading...' : address || 'Fetching...'}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">🕐 Last Update</span>
              <span className="info-value">
                {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Waiting...'}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">📊 Updates</span>
              <span className="info-value">{updateCount}</span>
            </div>
          </div>

          <button className="btn-open-maps" onClick={openInMaps}>
            🗺️ View on Map
          </button>

          <div className="location-history">
            <p className="history-title">📍 Location Trail ({locationHistory.length})</p>
            <div className="history-preview">
              {locationHistory.slice(-5).reverse().map((loc, idx) => (
                <div key={idx} className="history-point">
                  <span className="point-index">{locationHistory.length - idx}</span>
                  <span className="point-time">
                    {loc.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isSharing && (
        <div className="location-inactive-state">
          <p className="inactive-icon">📵</p>
          <p>Location sharing is off</p>
          <p className="inactive-note">
            Click "Start Sharing" to share your live location with {friendName}
          </p>
        </div>
      )}

      <div className="location-permissions-note">
        <small>
          ℹ️ We need location access to share your real-time position. Your friend will see
          your location while you're on your date.
        </small>
      </div>
    </div>
  );
};

export default LiveLocationSharing;
