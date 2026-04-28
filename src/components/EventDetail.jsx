/**
 * EventDetail Component
 * View full event details and RSVP to events
 */

import React, { useState, useEffect } from 'react';
import useEvent from '../../hooks/useEvent';
import './EventDetail.css';

const EventDetail = ({ eventId, onClose, onRsvpComplete }) => {
  const {
    eventDetail,
    eventAttendees,
    loading,
    error,
    getEventDetail,
    getAttendees,
    rsvpEvent,
    rateEvent
  } = useEvent();

  const [rsvpStatus, setRsvpStatus] = useState(null);
  const [showAttendees, setShowAttendees] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [rsvpLoading, setRsvpLoading] = useState(false);

  useEffect(() => {
    if (eventId) {
      getEventDetail(eventId);
      getAttendees(eventId);
    }
  }, [eventId]);

  if (!eventDetail) {
    return (
      <div className="event-detail-modal event-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  const handleRsvp = async (status) => {
    setRsvpLoading(true);
    const result = await rsvpEvent(eventId, status);
    if (result.success) {
      setRsvpStatus(status);
      onRsvpComplete?.(result);
    }
    setRsvpLoading(false);
  };

  const handleRate = async () => {
    if (rating === 0) return;
    const result = await rateEvent(eventId, rating, review);
    if (result.success) {
      setShowRating(false);
      setRating(0);
      setReview('');
    }
  };

  const isPast = new Date(eventDetail.event_date) < new Date();

  return (
    <div className="event-detail-modal">
      <button className="close-btn" onClick={onClose}>✕</button>

      {/* Event Image */}
      {eventDetail.event_photo_url && (
        <img src={eventDetail.event_photo_url} alt={eventDetail.event_name} className="event-hero" />
      )}

      {/* Event Info */}
      <div className="event-info">
        <div className="event-header-section">
          <h1>{eventDetail.event_name}</h1>
          <p className="interest-tag">
            📍 {eventDetail.interest?.name || 'General Interest'}
          </p>
        </div>

        {/* Key Details */}
        <div className="event-details-grid">
          <div className="detail-item">
            <span className="icon">📅</span>
            <div>
              <p className="label">Date</p>
              <p className="value">
                {new Date(eventDetail.event_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>

          <div className="detail-item">
            <span className="icon">🕐</span>
            <div>
              <p className="label">Time</p>
              <p className="value">
                {eventDetail.event_time_start} - {eventDetail.event_time_end || 'TBD'}
              </p>
            </div>
          </div>

          <div className="detail-item">
            <span className="icon">📍</span>
            <div>
              <p className="label">Location</p>
              <p className="value">{eventDetail.location_address}</p>
              <p className="privacy-note">
                Privacy buffer: {eventDetail.privacy_buffer_meters}m
              </p>
            </div>
          </div>

          <div className="detail-item">
            <span className="icon">👥</span>
            <div>
              <p className="label">Attendees</p>
              <p className="value">
                {eventDetail.attendeeCount || 0} attending
              </p>
              <p className="interested-text">
                +{eventDetail.interestedCount || 0} interested
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {eventDetail.event_description && (
          <div className="description-section">
            <h3>About This Event</h3>
            <p>{eventDetail.event_description}</p>
          </div>
        )}

        {/* Rating */}
        {eventDetail.avg_rating && (
          <div className="rating-section">
            <span className="rating-value">⭐ {eventDetail.avg_rating}</span>
            <span className="rating-count">({eventDetail.total_ratings} ratings)</span>
          </div>
        )}

        {/* Attendees Preview */}
        {eventAttendees.length > 0 && (
          <div className="attendees-section">
            <h3>
              Attendees
              <span className="count">({eventAttendees.length})</span>
            </h3>
            <p className="attendees-note">Meet single people attending this event</p>

            <div className="attendees-preview">
              {eventAttendees.slice(0, 6).map(attendee => (
                <div key={attendee.user_id} className="attendee-card">
                  <img
                    src={attendee.avatar || 'https://via.placeholder.com/60'}
                    alt={attendee.name}
                    className="attendee-avatar"
                  />
                  <p className="attendee-name">{attendee.name.split(' ')[0]}</p>
                  <p className="attendee-age">{attendee.age}</p>
                </div>
              ))}
              {eventAttendees.length > 6 && (
                <div className="attendee-card more">
                  <p className="more-count">+{eventAttendees.length - 6}</p>
                </div>
              )}
            </div>

            <button
              className="btn-view-all"
              onClick={() => setShowAttendees(!showAttendees)}
            >
              {showAttendees ? 'Hide All' : 'View All Attendees'}
            </button>
          </div>
        )}

        {/* Full Attendees List */}
        {showAttendees && (
          <div className="full-attendees-list">
            {eventAttendees.map(attendee => (
              <div key={attendee.user_id} className="full-attendee-item">
                <img
                  src={attendee.avatar || 'https://via.placeholder.com/40'}
                  alt={attendee.name}
                  className="attendee-avatar-small"
                />
                <div className="attendee-info">
                  <p className="name">{attendee.name}</p>
                  <p className="age-status">{attendee.age} • {attendee.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Event Info */}
        <div className="event-meta-info">
          {eventDetail.free_event ? (
            <div className="meta-badge">🎉 Free Event</div>
          ) : (
            <div className="meta-badge">💵 ${eventDetail.entry_fee || 'TBD'}</div>
          )}

          {eventDetail.outdoor && (
            <div className="meta-badge">🌳 Outdoor</div>
          )}

          {eventDetail.age_restriction_min && (
            <div className="meta-badge">
              🔞 {eventDetail.age_restriction_min}-{eventDetail.age_restriction_max || '∞'}
            </div>
          )}
        </div>

        {/* Creator Info */}
        {eventDetail.creator && (
          <div className="creator-section">
            <p className="label">Organized by</p>
            <div className="creator-info">
              <p className="creator-name">
                {eventDetail.creator.first_name} {eventDetail.creator.last_name}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* RSVP Section */}
      <div className="rsvp-section">
        {!isPast ? (
          <>
            <p className="rsvp-label">Non-binding interest - Let organizers know!</p>
            <div className="rsvp-buttons">
              <button
                className={`btn btn-rsvp ${rsvpStatus === 'interested' ? 'active' : ''}`}
                onClick={() => handleRsvp('interested')}
                disabled={rsvpLoading}
              >
                ❓ Interested
              </button>
              <button
                className={`btn btn-attend ${rsvpStatus === 'attending' ? 'active' : ''}`}
                onClick={() => handleRsvp('attending')}
                disabled={rsvpLoading}
              >
                ✅ I'll Be There
              </button>
              <button
                className={`btn btn-decline ${rsvpStatus === 'declined' ? 'active' : ''}`}
                onClick={() => handleRsvp('declined')}
                disabled={rsvpLoading}
              >
                ❌ Not Going
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="past-event-label">This event has passed</p>
            {!showRating && (
              <button className="btn btn-rate" onClick={() => setShowRating(true)}>
                ⭐ Rate This Event
              </button>
            )}
          </>
        )}
      </div>

      {/* Rating Form */}
      {showRating && (
        <div className="rating-form">
          <h3>Rate This Event</h3>

          <div className="star-rating">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                className={`star ${rating >= star ? 'active' : ''}`}
                onClick={() => setRating(star)}
              >
                ⭐
              </button>
            ))}
          </div>

          <textarea
            placeholder="Share your experience (optional)..."
            value={review}
            onChange={(e) => setReview(e.target.value)}
            className="review-input"
            rows={3}
          />

          <div className="form-buttons">
            <button
              className="btn btn-submit"
              onClick={handleRate}
              disabled={rating === 0}
            >
              Submit Rating
            </button>
            <button
              className="btn btn-cancel"
              onClick={() => setShowRating(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetail;
