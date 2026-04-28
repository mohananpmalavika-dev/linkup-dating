# EventDetail Component - Quick Reference

## 30-Second Overview
The **EventDetail** component is a full-featured event modal that displays event information, manages RSVP responses, and handles post-event ratings. It's production-ready, responsive, and supports dark mode.

## Quick Start

### Installation
```bash
# Component already in: src/components/EventDetail.jsx
# Styles already in: src/components/EventDetail.css
# No additional dependencies needed (uses React hooks only)
```

### Basic Usage
```jsx
import EventDetail from './components/EventDetail';
import { useState } from 'react';

export default function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [eventId, setEventId] = useState(null);

  return (
    <>
      <button onClick={() => {
        setEventId(123);
        setIsOpen(true);
      }}>
        View Event
      </button>

      <EventDetail
        eventId={eventId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        userId={currentUser.id}
      />
    </>
  );
}
```

## Component Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `eventId` | number | Yes | Event to display |
| `isOpen` | boolean | Yes | Show/hide modal |
| `onClose` | function | Yes | Close handler |
| `userId` | number | Yes | Current user ID |
| `userName` | string | No | User's first name |
| `userProfilePhoto` | string | No | User's photo URL |
| `onRsvpChange` | function | No | Callback when RSVP changes |
| `onRateSubmit` | function | No | Callback when event rated |

## Key Features

### 1. Event Display
- Event name, category, and interest tag
- Hero image
- Date, time, location details
- Duration and capacity info
- Creator information
- Description and rating

### 2. RSVP System
```jsx
<button>Interested</button>  // I'm interested in this
<button>Attending</button>   // I'm going
<button>Decline</button>     // I can't make it
```

### 3. Attendee Management
- **Preview**: First 6 attendees shown in grid
- **Full List**: Click "View All" for scrollable modal
- **Info**: Name, age, and status for each attendee

### 4. Event Rating (Post-Event Only)
- 5-star rating selector
- Optional written review (280 char max)
- Submit or cancel

## API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/events/:eventId` | Fetch event details |
| POST | `/api/events/:eventId/rsvp` | Update RSVP status |
| GET | `/api/events/:eventId/attendees` | Get attendee list |
| POST | `/api/events/:eventId/rate` | Submit rating |
| GET | `/api/events/:eventId/ratings` | Get reviews |

## Styling & Customization

### Change Primary Color
```css
/* In your global styles or component CSS */
.event-detail-modal {
  --primary-color: #YOUR_COLOR;
}
```

### Override Button Styles
```css
.btn-rsvp {
  background-color: #YOUR_COLOR !important;
  border-radius: 12px !important;
}
```

### Responsive Breakpoints
- Desktop: Default styling
- Tablet (< 768px): Adjusted spacing
- Mobile (< 600px): Full-width modal, stacked buttons

## State Management

The component manages:
- Event data loading and caching
- RSVP status changes
- Attendee list pagination
- Rating form state
- Error messages
- Loading indicators

## Error Handling

The component handles:
- ❌ Event not found (shows error message)
- ❌ Network errors (shows retry button)
- ❌ Authentication errors (shows login prompt)
- ❌ Invalid RSVP (shows validation error)
- ❌ Rating submission errors (shows error message)

## Common Use Cases

### 1. Event Discovery Flow
```jsx
// User discovers events
const [eventId, setEventId] = useState(null);
const [showDetail, setShowDetail] = useState(false);

const handleEventClick = (id) => {
  setEventId(id);
  setShowDetail(true);
};

return (
  <>
    <EventCard onClick={() => handleEventClick(event.id)} />
    <EventDetail eventId={eventId} isOpen={showDetail} onClose={() => setShowDetail(false)} />
  </>
);
```

### 2. RSVP Management
```jsx
const handleRsvpChange = (status) => {
  // Update local state
  console.log(`RSVP Status: ${status}`);
  
  // Refresh event list if needed
  fetchMyEvents();
};

<EventDetail
  {...props}
  onRsvpChange={handleRsvpChange}
/>
```

### 3. Rating After Event
```jsx
const handleRateSubmit = (rating, review) => {
  // Show success toast
  showToast(`Rated event ${rating}/5 stars`);
  
  // Update user's rating stats
  updateUserStats();
};

<EventDetail
  {...props}
  onRateSubmit={handleRateSubmit}
/>
```

## Accessibility Features

✅ Keyboard navigation (Tab, Enter, Escape)
✅ Screen reader friendly (semantic HTML)
✅ Color contrast WCAG AA compliant
✅ Mobile touch-friendly (44px minimum touch targets)
✅ Focus indicators visible
✅ ARIA labels on interactive elements

## Performance Tips

1. **Memoize in Parent Component**
   ```jsx
   const EventDetailMemo = React.memo(EventDetail);
   ```

2. **Lazy Load When Needed**
   ```jsx
   const [isOpen, setIsOpen] = useState(false);
   // Only render when opening
   return isOpen && <EventDetail ... />;
   ```

3. **Pagination for Large Attendee Lists**
   - Component automatically paginates
   - First load: 6 attendees
   - Full list: 50 per page

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Event won't load | Check event ID and auth token |
| RSVP button not working | Verify user is authenticated |
| Rating form not showing | Confirm event date has passed |
| Attendee list empty | Check if event is published |
| Styling looks broken | Ensure EventDetail.css is imported |

## Database Schema Reference

**DatingEvents**: Event master data
- `id`, `event_name`, `event_date`, `location_address`, `avg_rating`, etc.

**EventAttendees**: RSVP records
- `event_id`, `user_id`, `status` ('attending'|'interested'|'declined')

**EventRatings**: Reviews
- `event_id`, `user_id`, `rating` (1-5), `review` (text)

## Real-World Example

```jsx
import EventDetail from './components/EventDetail';
import { useAuth } from './contexts/AuthContext';
import { useState, useCallback } from 'react';

export function EventCard({ event }) {
  const { user } = useAuth();
  const [showDetail, setShowDetail] = useState(false);

  const handleRsvpChange = useCallback((status) => {
    // Update local event cache
    console.log(`User RSVP: ${status}`);
  }, []);

  const handleRateSubmit = useCallback((rating, review) => {
    // Show success notification
    console.log(`Event rated: ${rating}/5`);
  }, []);

  return (
    <>
      <div 
        className="event-card"
        onClick={() => setShowDetail(true)}
      >
        <img src={event.event_photo_url} alt={event.event_name} />
        <h3>{event.event_name}</h3>
        <p>{event.event_date}</p>
      </div>

      {showDetail && (
        <EventDetail
          eventId={event.id}
          isOpen={showDetail}
          onClose={() => setShowDetail(false)}
          userId={user.id}
          userName={user.firstName}
          userProfilePhoto={user.profile_photo_url}
          onRsvpChange={handleRsvpChange}
          onRateSubmit={handleRateSubmit}
        />
      )}
    </>
  );
}
```

## API Response Format

### Event Details Response
```json
{
  "success": true,
  "event": {
    "id": 1,
    "event_name": "Wine Tasting Night",
    "event_description": "Join us...",
    "event_category": "food",
    "interest": {
      "id": 5,
      "name": "Wine Lovers",
      "emoji": "🍷"
    },
    "event_date": "2026-05-15",
    "event_time_start": "19:00",
    "event_time_end": "21:00",
    "location_address": "Downtown Wine Bar",
    "current_attendee_count": 12,
    "max_attendees": 30,
    "avg_rating": 4.5,
    "total_ratings": 8,
    "creator": {
      "id": 10,
      "firstName": "John",
      "profile_photo_url": "...",
      "age": 28
    },
    "attendees": [...],
    "userRsvpStatus": "attending",
    "recentRatings": [...]
  }
}
```

## Version History

- **v1.0** (2026-04-28): Initial release
  - Event details display
  - RSVP system
  - Event rating
  - Attendee management
  - Dark mode support
  - Mobile responsive

## Support

For bugs or feature requests, check:
- Event_detail_integration_guide.md (full docs)
- Backend logs: `/api/events/:eventId`
- Browser console for client-side errors

---

**Last Updated**: 2026-04-28
**Status**: ✅ Production Ready
**Tested**: Chrome, Firefox, Safari, Mobile
