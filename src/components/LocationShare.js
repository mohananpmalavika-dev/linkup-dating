import React, { useState, useEffect } from 'react';
import '../../styles/LocationShare.css';

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
    // Try to get current location on mount
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
          name: 'Your Current Location'
        });
        setLoading(false);
      },
      (err) => {
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
      // Using Nominatim (OpenStreetMap) API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`
      );
      const results = await response.json();
      setSearchResults(
        results.map((r) => ({
          name: r.display_name,
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon)
        }))
      );
      setLoading(false);
    } catch (err) {
      setError('Failed to search locations');
      setLoading(false);
    }
  };

  const handleSelectSearchResult = (result) => {
    setLocation(result);
    setSearchResults([]);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();

    if (!manualLocation.name.trim() || !manualLocation.lat || !manualLocation.lng) {
      setError('Please fill in all fields');
      return;
    }

    const lat = parseFloat(manualLocation.lat);
    const lng = parseFloat(manualLocation.lng);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
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
        <h3>📍 Share Location</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="location-controls">
        <button
          className="get-location-btn"
          onClick={getCurrentLocation}
          disabled={loading}
        >
          {loading ? '⟳ Getting location...' : '📍 Use Current Location'}
        </button>
        <button
          className="manual-location-btn"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '✏️ Enter Manually'}
        </button>
      </div>

      {showForm && (
        <form className="location-form" onSubmit={handleManualSubmit}>
          <input
            type="text"
            placeholder="Location name"
            value={manualLocation.name}
            onChange={(e) =>
              setManualLocation({ ...manualLocation, name: e.target.value })
            }
            className="form-input"
          />
          <div className="form-row">
            <input
              type="number"
              placeholder="Latitude (-90 to 90)"
              step="0.000001"
              value={manualLocation.lat}
              onChange={(e) =>
                setManualLocation({ ...manualLocation, lat: e.target.value })
              }
              className="form-input"
            />
            <input
              type="number"
              placeholder="Longitude (-180 to 180)"
              step="0.000001"
              value={manualLocation.lng}
              onChange={(e) =>
                setManualLocation({ ...manualLocation, lng: e.target.value })
              }
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
            View on Map
          </a>
        </div>
      )}

      <div className="location-search">
        <input
          type="text"
          placeholder="Search locations..."
          onChange={(e) => handleSearchLocation(e.target.value)}
          className="search-input"
        />
        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map((result, index) => (
              <div
                key={index}
                className="search-result"
                onClick={() => handleSelectSearchResult(result)}
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
          className="share-btn"
          onClick={handleShareLocation}
          disabled={!location}
        >
          ✓ Share Location
        </button>
      </div>

      <div className="location-info-box">
        <h4>Location Privacy</h4>
        <ul>
          <li>Your precise location is shared with the recipient</li>
          <li>Only share locations with people you trust</li>
          <li>Locations are encrypted end-to-end</li>
          <li>You can set an expiration time for shared locations</li>
        </ul>
      </div>
    </div>
  );
};

export default LocationShare;
