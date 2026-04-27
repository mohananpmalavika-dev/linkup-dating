import React, { useEffect, useState } from 'react';
import '../styles/LocationShare.css';

/**
 * LocationShare Component
 * Share and display locations in messages
 */
const LocationShare = ({ onLocationSelect, onClose }) => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualLocation, setManualLocation] = useState({
    name: '',
    lat: '',
    lng: ''
  });
  const [searchResults, setSearchResults] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    setLoading(true);
    setError('');

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({
          lat: latitude,
          lng: longitude,
          name: 'Your current location'
        });
        setLoading(false);
      },
      () => {
        setError('Unable to get your location. Please enter it manually.');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleSearchLocation = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`
      );
      const results = await response.json();
      setSearchResults(
        results.map((result) => ({
          name: result.display_name,
          lat: Number.parseFloat(result.lat),
          lng: Number.parseFloat(result.lon)
        }))
      );
      setLoading(false);
    } catch (searchError) {
      setError('Failed to search locations');
      setLoading(false);
    }
  };

  const handleManualSubmit = (event) => {
    event.preventDefault();

    if (!manualLocation.name.trim() || !manualLocation.lat || !manualLocation.lng) {
      setError('Please fill in all fields');
      return;
    }

    const lat = Number.parseFloat(manualLocation.lat);
    const lng = Number.parseFloat(manualLocation.lng);

    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError('Invalid coordinates');
      return;
    }

    setLocation({
      name: manualLocation.name,
      lat,
      lng
    });
    setManualLocation({ name: '', lat: '', lng: '' });
    setShowForm(false);
  };

  const handleShareLocation = () => {
    if (!location) {
      setError('No location selected');
      return;
    }

    onLocationSelect(location);
    onClose();
  };

  return (
    <div className="location-share">
      <div className="location-header">
        <h3>Share Location</h3>
        <button type="button" className="close-btn" onClick={onClose}>x</button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="location-controls">
        <button
          type="button"
          className="get-location-btn"
          onClick={getCurrentLocation}
          disabled={loading}
        >
          {loading ? 'Getting location...' : 'Use current location'}
        </button>
        <button
          type="button"
          className="manual-location-btn"
          onClick={() => setShowForm((currentState) => !currentState)}
        >
          {showForm ? 'Cancel' : 'Enter manually'}
        </button>
      </div>

      {showForm && (
        <form className="location-form" onSubmit={handleManualSubmit}>
          <input
            type="text"
            placeholder="Location name"
            value={manualLocation.name}
            onChange={(event) => (
              setManualLocation({ ...manualLocation, name: event.target.value })
            )}
            className="form-input"
          />
          <div className="form-row">
            <input
              type="number"
              placeholder="Latitude (-90 to 90)"
              step="0.000001"
              value={manualLocation.lat}
              onChange={(event) => (
                setManualLocation({ ...manualLocation, lat: event.target.value })
              )}
              className="form-input"
            />
            <input
              type="number"
              placeholder="Longitude (-180 to 180)"
              step="0.000001"
              value={manualLocation.lng}
              onChange={(event) => (
                setManualLocation({ ...manualLocation, lng: event.target.value })
              )}
              className="form-input"
            />
          </div>
          <button type="submit" className="submit-btn">
            Set Location
          </button>
        </form>
      )}

      {location && (
        <div className="location-preview">
          <div className="location-info">
            <h4>Selected Location</h4>
            <p className="location-name">{location.name}</p>
            <p className="location-coords">
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </p>
          </div>
          <a
            href={`https://maps.google.com/?q=${location.lat},${location.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="map-link"
          >
            View on map
          </a>
        </div>
      )}

      <div className="location-search">
        <input
          type="text"
          placeholder="Search locations..."
          onChange={(event) => handleSearchLocation(event.target.value)}
          className="search-input"
        />
        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map((result, index) => (
              <div
                key={`${result.name}-${index}`}
                className="search-result"
                onClick={() => {
                  setLocation(result);
                  setSearchResults([]);
                }}
              >
                <div className="result-name">{result.name}</div>
                <div className="result-coords">
                  {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="location-actions">
        <button
          type="button"
          className="share-btn"
          onClick={handleShareLocation}
          disabled={!location}
        >
          Share location
        </button>
      </div>

      <div className="location-info-box">
        <h4>Location Privacy</h4>
        <ul>
          <li>Your precise location is shared with the recipient</li>
          <li>Only share locations with people you trust</li>
          <li>This is sent into chat as a normal map link</li>
          <li>Accuracy depends on your device or the manual coordinates you enter</li>
        </ul>
      </div>
    </div>
  );
};

export default LocationShare;
