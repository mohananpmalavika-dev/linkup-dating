# EventDetail Component Integration Guide

## Overview
The EventDetail component provides a complete UI for viewing event details, RSVPing to events, and rating past events. It integrates with the DatingHub backend to provide comprehensive event management functionality.

## Features

### 1. Event Information Display
- **Hero Image**: Event photo at the top
- **Basic Info**: Event name, category, and interest tag
- **Details Grid**: 
  - Date and time
  - Location (with privacy notice)
  - Event type (indoor/outdoor)
  - Attendee count
  - Event duration
  - Max capacity

### 2. Interactive Sections
- **Description**: Full event description
- **Rating**: Current event rating with review count
- **Attendees Preview**: Grid of first 6 attendees with "View All" option
- **Full Attendees List**: Scrollable modal of all attendees with name and age

### 3. RSVP Management
- **Three Status Options**:
  - Interested (blue)
  - Attending (green)
  - Decline (red)
- **Dynamic UI**: Buttons reflect current RSVP status
- **Real-time Updates**: Counts update immediately

### 4. Event Rating
- **Post-Event Rating**: Only available after event date passes
- **5-Star Rating System**: Visual star selector
- **Written Review**: Optional text review
- **Submit/Cancel**: Actions to finalize or discard rating

## Component Props

```jsx
<EventDetail 
  eventId={123}                    // Required: Event ID
  isOpen={boolean}                 // Required: Modal visibility
  onClose={function}               // Required: Close handler
  onRsvpChange={function}          // Optional: RSVP callback
  onRateSubmit={function}          // Optional: Rating callback
  userId={123}                     // Required: Current user ID
  userName={string}                // Optional: Current user name
  userProfilePhoto={string}        // Optional: Current user photo URL
/>
```

## API Integration

### Endpoints Used

#### GET /api/events/:eventId
Fetch event details
```javascript
Response: {
  success: true,
  event: {
    id, 
    event_name,
    event_description,
    event_category,
    event_date,
    event_time_start,
    event_time_end,
    location_address,
    location_latitude,
    location_longitude,
    event_photo_url,
    max_attendees,
    current_attendee_count,
    interested_count,
    avg_rating,
    total_ratings,
    creator: { id, firstName, lastName, profile_photo_url, age },
    interest: { id, name, emoji },
    attendees: [...],
    userRsvpStatus: 'attending' | 'interested' | 'declined' | null,
    recentRatings: [...]
  }
}
```

#### POST /api/events/:eventId/rsvp
Update RSVP status
```javascript
Body: {
  status: 'attending' | 'interested' | 'declined'
}

Response: {
  success: true,
  message: 'RSVP status updated to attending',
  rsvpStatus: 'attending'
}
```

#### GET /api/events/:eventId/attendees
Get full attendee list
```javascript
Query Params:
  - status: Filter by 'attending', 'interested', or 'declined'
  - limit: Max results (default: 50)
  - offset: Pagination offset

Response: {
  success: true,
  attendees: [
    {
      id,
      event_id,
      user_id,
      status: 'attending',
      user: { id, firstName, lastName, profile_photo_url, age, city }
    }
  ]
}
```

#### POST /api/events/:eventId/rate
Submit event rating
```javascript
Body: {
  rating: 1-5,
  review: 'Optional review text'
}

Response: {
  success: true,
  message: 'Event rated successfully',
  rating: { ... },
  eventAvgRating: 4.5
}
```

#### GET /api/events/:eventId/ratings
Get event ratings and reviews
```javascript
Query Params:
  - limit: Max results (default: 10)
  - offset: Pagination offset

Response: {
  success: true,
  ratings: [
    {
      rating: 5,
      review: 'Great event!',
      user: { id, firstName, lastName, profile_photo_url }
    }
  ]
}
```

## Usage Examples

### Basic Implementation
```jsx
import EventDetail from './components/EventDetail';
import { useState } from 'react';

function App() {
  const [showEvent, setShowEvent] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const handleOpenEvent = (eventId) => {
    setSelectedEventId(eventId);
    setShowEvent(true);
  };

  const handleCloseEvent = () => {
    setShowEvent(false);
    setSelectedEventId(null);
  };

  return (
    <>
      <button onClick={() => handleOpenEvent(123)}>
        View Event Details
      </button>

      <EventDetail
        eventId={selectedEventId}
        isOpen={showEvent}
        onClose={handleCloseEvent}
        userId={currentUser.id}
        userName={currentUser.firstName}
      />
    </>
  );
}
```

### With Callbacks
```jsx
<EventDetail
  eventId={eventId}
  isOpen={isOpen}
  onClose={handleClose}
  userId={userId}
  onRsvpChange={(status) => {
    console.log(`User RSVP status: ${status}`);
    // Refresh event list or update UI
  }}
  onRateSubmit={(rating, review) => {
    console.log(`Event rated: ${rating} stars`);
    // Show success message or update stats
  }}
/>
```

## Database Schema

### DatingEvents Table
```sql
CREATE TABLE dating_events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  creator_id INT REFERENCES users(id),
  interest_id INT REFERENCES interests(id),
  event_name VARCHAR(200) NOT NULL,
  event_description TEXT,
  event_category ENUM('sports', 'outdoor', 'arts', 'food', ...),
  location_address VARCHAR(255),
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  privacy_buffer_meters INT DEFAULT 500,
  event_date DATE NOT NULL,
  event_time_start TIME NOT NULL,
  event_time_end TIME,
  duration_minutes INT,
  max_attendees INT,
  current_attendee_count INT DEFAULT 0,
  interested_count INT DEFAULT 0,
  status ENUM('draft', 'published', 'cancelled', 'completed', 'archived'),
  views_count INT DEFAULT 0,
  avg_rating DECIMAL(3, 2),
  total_ratings INT DEFAULT 0,
  event_photo_url VARCHAR(500),
  age_restriction_min INT,
  age_restriction_max INT,
  gender_preference ENUM('any', 'men', 'women'),
  outdoor BOOLEAN DEFAULT false,
  free_event BOOLEAN DEFAULT true,
  entry_fee DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX(creator_id),
  INDEX(interest_id),
  INDEX(status),
  INDEX(event_date),
  INDEX(location_latitude, location_longitude)
);
```

### EventAttendees Table
```sql
CREATE TABLE event_attendees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  event_id INT REFERENCES dating_events(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  status ENUM('attending', 'interested', 'declined'),
  joined_at TIMESTAMP DEFAULT NOW(),
  attended_at TIMESTAMP,
  UNIQUE KEY unique_attendee (event_id, user_id),
  INDEX(event_id),
  INDEX(user_id)
);
```

### EventRatings Table
```sql
CREATE TABLE event_ratings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  event_id INT REFERENCES dating_events(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE KEY unique_rating (event_id, user_id),
  INDEX(event_id),
  INDEX(user_id)
);
```

## Styling & Customization

### CSS Classes

#### Main Container
- `.event-detail-modal` - Full-screen modal overlay
- `.event-info` - Event details section
- `.rsvp-section` - RSVP buttons area
- `.rating-form` - Rating form section

#### Sections
- `.event-header-section` - Title and category
- `.event-details-grid` - Details in 2-column grid
- `.description-section` - Event description
- `.rating-section` - Current rating display
- `.attendees-section` - Attendees preview
- `.creator-section` - Event creator info

#### Buttons
- `.btn-rsvp` - RSVP button (blue)
- `.btn-attend` - Attend button (green)
- `.btn-decline` - Decline button (red)
- `.btn-rate` - Rate button (orange)
- `.btn-submit` - Submit form button
- `.btn-cancel` - Cancel button

#### Customization Example
```css
/* Change primary color */
:root {
  --primary-color: #64c8ff;
  --success-color: #4caf50;
  --danger-color: #ff6b6b;
  --warning-color: #ffa500;
}

/* Override button styling */
.btn-rsvp {
  background-color: var(--primary-color) !important;
  border-radius: 12px !important;
}
```

## Error Handling

The component handles common errors gracefully:

- **Invalid Event ID**: Shows "Event not found" message
- **Network Errors**: Displays error banner with retry option
- **RSVP Conflicts**: Shows user's current status
- **Rating Validation**: Prevents submission with empty fields
- **Past Events**: Automatically disables RSVP, enables rating

## Performance Considerations

1. **Lazy Loading**: Event details loaded on demand
2. **Pagination**: Attendees and ratings use pagination
3. **Memoization**: Components memoized to prevent unnecessary re-renders
4. **Image Optimization**: Event photos are cached
5. **API Efficiency**: Batch requests for related data

## Security

- **Authentication**: All endpoints require authentication token
- **Authorization**: Only event creators can edit events
- **Privacy**: Location data truncated if privacy buffer enabled
- **Rate Limiting**: RSVP and rating requests rate-limited
- **Input Validation**: All user inputs validated on backend

## Accessibility

- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Semantic HTML and ARIA labels
- **Color Contrast**: WCAG AA compliant colors
- **Mobile Friendly**: Responsive design for all devices

## Future Enhancements

1. **Event Notifications**: Remind users of upcoming events
2. **Attendee Messaging**: Direct messaging between attendees
3. **Event Cancellation**: Allow creators to cancel with notification
4. **Attendee Filtering**: Filter by age, gender, interests
5. **Photo Gallery**: Multiple photos per event
6. **Weather Integration**: Show weather forecast
7. **Travel Time**: Calculate travel time to event location
8. **Waitlist**: Queue for full events
9. **Check-in**: QR code based check-in system
10. **Social Sharing**: Share events on social media

## Troubleshooting

### Event Not Loading
- Verify event ID is correct
- Check authentication token validity
- Ensure backend API is running

### RSVP Not Updating
- Refresh the page to sync state
- Check browser console for errors
- Verify user is not blocked by event creator

### Rating Form Not Appearing
- Confirm event date has passed
- Check user actually attended the event
- Verify user hasn't already rated

### Attendees Not Loading
- Check if event is published
- Verify attendee data exists
- Try paginating results

## Support & Contribution

For issues or feature requests, please refer to the DatingHub development guide.
