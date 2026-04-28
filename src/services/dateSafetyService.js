import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const client = axios.create({
  baseURL: `${API_BASE_URL}/api/date-safety`,
  timeout: 10000,
});

// Add authorization header
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const dateSafetyService = {
  /**
   * Start a new safety session
   */
  async startSession(trustedFriendId, matchId = null, durationMinutes = 180) {
    try {
      const response = await client.post('/start-session', {
        trustedFriendId,
        matchId,
        durationMinutes,
      });
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  },

  /**
   * Update live location
   */
  async updateLocation(sessionId, latitude, longitude) {
    try {
      const response = await client.post('/update-location', {
        sessionId,
        latitude,
        longitude,
      });
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  },

  /**
   * Send check-in message
   */
  async sendCheckIn(sessionId, status, message = '') {
    try {
      const response = await client.post('/check-in', {
        sessionId,
        status,
        message,
      });
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  },

  /**
   * Activate SOS
   */
  async activateSOS(sessionId, latitude, longitude) {
    try {
      const response = await client.post('/sos', {
        sessionId,
        latitude,
        longitude,
      });
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  },

  /**
   * End safety session
   */
  async endSession(sessionId, notes = '') {
    try {
      const response = await client.post('/end-session', {
        sessionId,
        notes,
      });
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  },

  /**
   * Get session details
   */
  async getSessionDetails(sessionId) {
    try {
      const response = await client.get(`/session/${sessionId}`);
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  },

  /**
   * Get shared location (for trusted friend)
   */
  async getSharedLocation(sessionId) {
    try {
      const response = await client.get(`/shared-location/${sessionId}`);
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  },

  /**
   * Get safety tips
   */
  async getSafetyTips() {
    try {
      const response = await client.get('/safety-tips');
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  },

  /**
   * Acknowledge safety tips
   */
  async acknowledgeSafetyTips(sessionId) {
    try {
      const response = await client.post('/acknowledge-tips', {
        sessionId,
      });
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  },

  /**
   * Get session history
   */
  async getSessionHistory(limit = 10) {
    try {
      const response = await client.get('/history', {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      throw this._handleError(error);
    }
  },

  /**
   * Request user's location (browser geolocation API)
   */
  async getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        }
      );
    });
  },

  /**
   * Watch user location changes (for continuous updates)
   */
  watchUserLocation(callback, onError) {
    if (!navigator.geolocation) {
      onError(new Error('Geolocation not supported'));
      return null;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        callback({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        onError(new Error(`Geolocation error: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
    );

    return watchId;
  },

  /**
   * Stop watching location
   */
  stopWatchingLocation(watchId) {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
  },

  /**
   * Reverse geocode coordinates (using Google Maps API)
   */
  async reverseGeocode(latitude, longitude) {
    try {
      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      }

      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
      );

      if (response.data.results && response.data.results.length > 0) {
        return response.data.results[0].formatted_address;
      }

      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
  },

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  },

  /**
   * Error handler
   */
  _handleError(error) {
    if (error.response) {
      return new Error(error.response.data?.error || 'Request failed');
    }
    return error;
  },
};

export default dateSafetyService;
