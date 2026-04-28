/**
 * useEvent Hook
 * State management for interest-based group events
 */

import { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

const useEvent = () => {
  // Event Discovery State
  const [nearbyEvents, setNearbyEvents] = useState([]);
  const [recommendedEvents, setRecommendedEvents] = useState([]);
  const [userEvents, setUserEvents] = useState([]);
  const [eventDetail, setEventDetail] = useState(null);
  const [eventAttendees, setEventAttendees] = useState([]);

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    radius_km: 50,
    category: null,
    interest_id: null,
    available_only: false
  });

  /**
   * Discover nearby events
   */
  const discoverNearby = async (latitude, longitude, filterOptions = {}) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = {
        latitude,
        longitude,
        ...filterOptions
      };

      const response = await apiClient.get('/api/events/discover/nearby', {
        params: queryParams
      });

      if (response.data.success) {
        setNearbyEvents(response.data.events);
        setFilters(prev => ({ ...prev, ...filterOptions }));
      } else {
        setError(response.data.message);
      }

      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to discover events';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get recommended events based on user interests
   */
  const getRecommended = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get('/api/events/discover/recommended');

      if (response.data.success) {
        setRecommendedEvents(response.data.events);
      } else {
        setError(response.data.message);
      }

      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to get recommendations';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get event details
   */
  const getEventDetail = async (eventId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/api/events/${eventId}`);

      if (response.data.success) {
        setEventDetail(response.data.event);
      } else {
        setError(response.data.message);
      }

      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to get event details';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * RSVP to event
   */
  const rsvpEvent = async (eventId, status = 'interested') => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post(`/api/events/${eventId}/rsvp`, {
        status
      });

      if (response.data.success) {
        // Update event detail
        if (eventDetail && eventDetail.id === eventId) {
          setEventDetail(prev => ({
            ...prev,
            userRsvpStatus: status,
            attendeeCount: response.data.attendeeCount,
            interestedCount: response.data.interestedCount
          }));
        }
      } else {
        setError(response.data.message);
      }

      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to RSVP';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get event attendees
   */
  const getAttendees = async (eventId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/api/events/${eventId}/attendees`);

      if (response.data.success) {
        setEventAttendees(response.data.attendees);
      } else {
        setError(response.data.message);
      }

      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to get attendees';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get user's events
   */
  const getUserEvents = async (status = null) => {
    setLoading(true);
    setError(null);

    try {
      const params = {};
      if (status) params.status = status;

      const response = await apiClient.get('/api/events/my/list', {
        params
      });

      if (response.data.success) {
        setUserEvents(response.data.events);
      } else {
        setError(response.data.message);
      }

      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to get your events';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create new event
   */
  const createEvent = async (eventData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/api/events', eventData);

      if (response.data.success) {
        return response.data;
      } else {
        setError(response.data.message);
      }

      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create event';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Rate event
   */
  const rateEvent = async (eventId, rating, review = '') => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post(`/api/events/${eventId}/rate`, {
        rating,
        review
      });

      if (response.data.success) {
        // Update event detail
        if (eventDetail && eventDetail.id === eventId) {
          setEventDetail(prev => ({
            ...prev,
            avg_rating: response.data.avgRating,
            total_ratings: response.data.totalRatings
          }));
        }
      } else {
        setError(response.data.message);
      }

      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to rate event';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get event analytics (for creator)
   */
  const getAnalytics = async (eventId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/api/events/${eventId}/analytics`);

      if (response.data.success) {
        return response.data;
      } else {
        setError(response.data.message);
      }

      return response.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to get analytics';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update filters
   */
  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  /**
   * Clear error
   */
  const clearError = () => {
    setError(null);
  };

  return {
    // State
    nearbyEvents,
    recommendedEvents,
    userEvents,
    eventDetail,
    eventAttendees,
    loading,
    error,
    filters,

    // Methods
    discoverNearby,
    getRecommended,
    getEventDetail,
    rsvpEvent,
    getAttendees,
    getUserEvents,
    createEvent,
    rateEvent,
    getAnalytics,
    updateFilters,
    clearError
  };
};

export default useEvent;
