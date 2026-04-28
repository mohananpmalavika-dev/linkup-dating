/**
 * EventsList Component
 * Discover and browse interest-based group events
 */

import React, { useState, useEffect } from 'react';
import useEvent from '../../hooks/useEvent';
import './EventsList.css';

const EventsList = ({ latitude, longitude, onEventSelect }) => {
  const {
    nearbyEvents,
    recommendedEvents,
    loading,
    error,
    filters,
    discoverNearby,
    getRecommended,
    updateFilters
  } = useEvent();

  const [activeTab, setActiveTab] = useState('nearby'); // nearby, recommended, my-events
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchRadius, setSearchRadius] = useState(50);

  // Load events on mount
  useEffect(() => {
    if (latitude && longitude) {
      discoverNearby(latitude, longitude, {
        radius_km: searchRadius,
        category: selectedCategory,
        available_only: true
      });
      getRecommended();
    }
  }, []);

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category === selectedCategory ? null : category);
    if (latitude && longitude) {
      discoverNearby(latitude, longitude, {
        radius_km: searchRadius,
        category: category === selectedCategory ? null : category,
        available_only: true
      });
    }
  };

  const handleRadiusChange = (newRadius) => {
    setSearchRadius(newRadius);
    if (latitude && longitude) {
      discoverNearby(latitude, longitude, {
        radius_km: newRadius,
        category: selectedCategory,
        available_only: true
      });
    }
  };

  const categories = [
    { id: 'sports', label: '⚽ Sports', icon: '⚽' },
    { id: 'outdoor', label: '🥾 Outdoor', icon: '🥾' },
    { id: 'arts', label: '🎨 Arts', icon: '🎨' },
    { id: 'food', label: '🍽️ Food', icon: '🍽️' },
    { id: 'nightlife', label: '🍻 Nightlife', icon: '🍻' },
    { id: 'wellness', label: '🧘 Wellness', icon: '🧘' },
    { id: 'culture', label: '🎭 Culture', icon: '🎭' }
  ];

  const EventCard = ({ event, onSelect }) => (
    <div className="event-card" onClick={() => onSelect(event)}>
      {event.event_photo_url && (
        <img src={event.event_photo_url} alt={event.event_name} className="event-image" />
      )}

      <div className="event-content">
        <div className="event-header">
          <h3 className="event-name">{event.event_name}</h3>
          {event.spotsAvailable && (
            <span className="spots-badge">
              {event.spotsAvailable} spot{event.spotsAvailable !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <p className="event-description">{event.event_description}</p>

        <div className="event-meta">
          <div className="meta-item">
            <span className="icon">📅</span>
            <span>{new Date(event.event_date).toLocaleDateString()}</span>
          </div>

          <div className="meta-item">
            <span className="icon">🕐</span>
            <span>{event.event_time_start}</span>
          </div>

          <div className="meta-item">
            <span className="icon">📍</span>
            <span>{event.distance_km} km away</span>
          </div>
        </div>

        <div className="event-footer">
          <div className="attendee-info">
            <span className="attending">
              {event.current_attendee_count} attending
            </span>
            <span className="interested">
              +{event.interested_count} interested
            </span>
          </div>

          {event.avg_rating && (
            <div className="rating">
              <span className="stars">⭐ {event.avg_rating}</span>
              <span className="reviews">({event.total_ratings})</span>
            </div>
          )}
        </div>

        <button className="btn-view-event">View Event</button>
      </div>
    </div>
  );

  return (
    <div className="events-list-container">
      {/* Header */}
      <div className="events-header">
        <h2>Interest-Based Events</h2>
        <p className="subtitle">Meet single people with shared interests</p>
      </div>

      {/* Filters */}
      <div className="events-filters">
        <div className="radius-filter">
          <label>Search Radius:</label>
          <div className="radius-slider">
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={searchRadius}
              onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
              className="slider"
            />
            <span className="radius-value">{searchRadius} km</span>
          </div>
        </div>

        <div className="category-filter">
          <label>Category:</label>
          <div className="category-buttons">
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => handleCategoryFilter(cat.id)}
                title={cat.label}
              >
                {cat.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="events-tabs">
        <button
          className={`tab-btn ${activeTab === 'nearby' ? 'active' : ''}`}
          onClick={() => setActiveTab('nearby')}
        >
          Nearby Events ({nearbyEvents.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'recommended' ? 'active' : ''}`}
          onClick={() => setActiveTab('recommended')}
        >
          Recommended ({recommendedEvents.length})
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading events...</p>
        </div>
      )}

      {/* Events Grid */}
      {!loading && (
        <div className="events-grid">
          {activeTab === 'nearby' && nearbyEvents.length > 0 ? (
            nearbyEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onSelect={onEventSelect}
              />
            ))
          ) : activeTab === 'recommended' && recommendedEvents.length > 0 ? (
            recommendedEvents.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onSelect={onEventSelect}
              />
            ))
          ) : (
            <div className="no-events">
              <p>🎉 No events found</p>
              <p className="subtitle">Try adjusting your filters or radius</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventsList;
