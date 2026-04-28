# 📱 Tier 3: Mobile Experience Implementation Guide

## Overview

Tier 3 introduces two critical mobile features:
1. **Quick View Mode** - Rapid-fire profile discovery with 3-second auto-advance
2. **Push Notification Intelligence** - Smart, personalized, batched notifications

## Features

### 1. Quick View Mode

#### What It Does
- Shows profiles at extreme speed: Name, Age, Photo only
- 3-second timer auto-advances to next profile
- Swipe left/right or use keyboard (← →) to pass/like
- Click to see full profile
- Dramatically increases discovery volume

#### User Experience
```
┌─────────────────────────────────┐
│  [Exit]  [1/50]         [4]     │ ← Timer
├─────────────────────────────────┤
│                                 │
│        📸 Sarah, 28             │
│        📍 NYC                   │
│                                 │
│     [👎 PASS] [VIEW] [❤️ LIKE] │
├─────────────────────────────────┤
│   Press → to like • ← to pass   │
└─────────────────────────────────┘
```

#### Key Benefits
- **Volume**: See 50 profiles in ~2.5 minutes (vs 10 in detail mode)
- **Momentum**: Rapid swiping creates flow state
- **Mobile-First**: Optimized for vertical scrolling
- **Accessibility**: Keyboard shortcuts, swipe gestures

### 2. Push Notification Intelligence

#### Smart Timing
- Analyzes user's historical behavior per hour
- Learns when user opens notifications
- Sends at optimal times (e.g., 7 PM if user opens 80% of notifications then)
- Can be disabled for real-time notifications

#### Batching
- Maximum 1 notification per 6 hours (default)
- Maximum 5 notifications per day (default)
- Respects quiet hours (default 10 PM - 8 AM)
- Prevents notification fatigue

#### Personalization
```
Generic:  "You have a new like"

Smart:    "Sarah liked you! (She's 96% compatible)"
          - Shows name if available
          - Shows compatibility % if enabled
          - Includes photo preview if enabled
```

#### Opt-In by Type
Users can enable/disable individually:
- ❤️ New Likes
- 💘 New Matches
- 💬 New Messages
- ✨ Superlikes
- 🏆 Achievements
- 📅 Dating Events
- 🔔 Reminders

## Implementation Structure

### Backend Models (3 new models)

#### 1. NotificationPreference.js (120 lines)
```javascript
{
  user_id: INTEGER,
  // Type preferences
  notify_new_likes: BOOLEAN (default: true),
  notify_new_matches: BOOLEAN (default: true),
  notify_messages: BOOLEAN (default: true),
  // Frequency controls
  max_notifications_per_day: INTEGER (default: 5),
  min_hours_between_notifications: INTEGER (default: 6),
  // Quiet hours
  quiet_hours_enabled: BOOLEAN (default: true),
  quiet_hours_start: INTEGER (default: 22),
  quiet_hours_end: INTEGER (default: 8),
  // Personalization
  include_compatibility_score: BOOLEAN (default: true),
  include_photo_preview: BOOLEAN (default: true),
  use_smart_timing: BOOLEAN (default: true)
}
```

#### 2. NotificationLog.js (140 lines)
```javascript
{
  user_id: INTEGER,
  notification_type: ENUM('new_like', 'new_match', 'new_message', ...),
  title: STRING,
  message: TEXT,
  related_user_id: INTEGER,
  // Delivery tracking
  sent_at: TIMESTAMP,
  delivered_at: TIMESTAMP,
  opened_at: TIMESTAMP,
  clicked_action: STRING,
  delivery_status: ENUM('pending', 'sent', 'delivered', 'failed'),
  // Personalization tracking
  compatibility_score: INTEGER,
  personalization_used: JSONB,
  // Smart timing data
  optimal_send_time: TIMESTAMP,
  was_smart_timed: BOOLEAN,
  was_batched: BOOLEAN
}
```

#### 3. UserActivityPattern.js (200 lines)
```javascript
{
  user_id: INTEGER,
  // Per-hour activity & open rates
  hour_0_activity: INTEGER,
  hour_0_open_rate: FLOAT,
  ... (for all 24 hours)
  // Analytics
  best_hours: INTEGER[] (e.g., [19, 20, 21]),
  worst_hours: INTEGER[] (e.g., [2, 3, 4]),
  average_open_rate: FLOAT,
  total_notifications_sent: INTEGER,
  total_notifications_opened: INTEGER
}
```

### Backend Services (1 service)

#### notificationService.js (400 lines)
**Key Methods:**
- `shouldSendNotification(userId, type)` - Validates preferences, quiet hours, frequency
- `calculateOptimalSendTime(userId)` - ML-based timing using activity patterns
- `personalizeNotification(userId, message, data)` - Adds name, compatibility %
- `sendSmartNotification(userId, data)` - Full pipeline: validate → personalize → send
- `recordNotificationOpened(notificationId, action)` - Track engagement
- `updateActivityPattern(userId, hour, wasOpened)` - Update ML model
- `getPreferences(userId)` - Retrieve user settings
- `updatePreferences(userId, updates)` - Update settings
- `getNotificationStats(userId, days)` - Analytics dashboard

### Backend Routes

**File:** `backend/routes/notifications.js` (100 lines)

```javascript
GET  /api/notifications/preferences           // Get user's settings
POST /api/notifications/preferences           // Update settings
POST /api/notifications/send                  // Send smart notification
POST /api/notifications/:id/open              // Record open
GET  /api/notifications/stats                 // Get analytics
POST /api/notifications/optimal-time          // Calculate optimal send time
```

### Frontend Components (2 major components)

#### QuickViewMode.jsx (200 lines)
```jsx
<QuickViewMode
  profiles={[...]}
  onLike={handleLike}
  onPass={handlePass}
  onViewProfile={handleViewProfile}
  onExit={handleExit}
/>
```

**Features:**
- 3-second timer with progress bar
- Swipe detection (left/right)
- Keyboard shortcuts (→ like, ← pass, ESC exit)
- Touch-friendly buttons
- Responsive design (mobile-first)
- Profile counter (1/50)
- Auto-advance on timer

#### NotificationSettingsModal.jsx (250 lines)
```jsx
<NotificationSettingsModal
  isOpen={true}
  onClose={handleClose}
  onSave={handleSave}
/>
```

**Features:**
- 7 notification type toggles
- Frequency controls (notifications/day, hours between)
- Quiet hours time picker
- Personalization options
- Smart timing toggle
- Real-time save with confirmation

### Frontend Hooks (2 hooks)

#### useQuickViewMode.js (80 lines)
```jsx
const {
  isActive,
  profiles,
  currentIndex,
  stats: { totalViewed, totalLiked, totalPassed },
  startQuickView,
  exitQuickView,
  handleLike,
  handlePass
} = useQuickViewMode();
```

#### useNotifications.js (120 lines)
```jsx
const {
  preferences,
  stats,
  shouldSendNotification,
  updatePreferences,
  sendSmartNotification,
  recordNotificationOpened,
  getOptimalSendTime
} = useNotifications(userId);
```

### Database Tables

**notification_preferences**
- Stores 14 preference fields per user
- 1:1 relationship with users
- Automatically created for all users via migration

**notification_logs**
- Stores every notification sent
- Tracks delivery status, open time, actions
- Includes personalization metadata
- Retention: Keep for 90 days then archive

**user_activity_patterns**
- 24-hour activity & open rate tracking
- Updated after each notification opened
- Stores peak hours and statistics
- Used to calculate optimal send times

## Integration Steps

### 1. Run Migration
```bash
psql -U postgres -d linkup < backend/migrations/20260428_tier3_mobile_notifications.sql
```

### 2. Add Notification Preferences Creation
In `backend/models/User.js` or hooks, ensure preferences are created:
```javascript
// Auto-create preferences when user signs up
await NotificationPreference.findOrCreate({
  where: { user_id: userId }
});
```

### 3. Register Models & Routes
In `backend/models/index.js`:
```javascript
db.NotificationPreference = require('./NotificationPreference')(sequelize, DataTypes);
db.NotificationLog = require('./NotificationLog')(sequelize, DataTypes);
db.UserActivityPattern = require('./UserActivityPattern')(sequelize, DataTypes);
```

In main `server.js`:
```javascript
app.use('/api/notifications', notificationRoutes);
```

### 4. Add Quick View to Discovery Component
```jsx
import QuickViewMode from './components/QuickViewMode';
import useQuickViewMode from './hooks/useQuickViewMode';

function Discovery() {
  const { isActive, profiles, startQuickView, ...quickViewProps } = useQuickViewMode();

  return (
    <>
      <button onClick={() => startQuickView()}>⚡ Quick View Mode</button>
      {isActive && <QuickViewMode {...quickViewProps} />}
    </>
  );
}
```

### 5. Add Notification Settings
```jsx
import NotificationSettingsModal from './components/NotificationSettingsModal';

function Settings() {
  const [showNotifSettings, setShowNotifSettings] = useState(false);

  return (
    <>
      <button onClick={() => setShowNotifSettings(true)}>
        🔔 Notification Settings
      </button>
      <NotificationSettingsModal
        isOpen={showNotifSettings}
        onClose={() => setShowNotifSettings(false)}
      />
    </>
  );
}
```

### 6. Trigger Smart Notifications
When someone likes, matches, or messages:
```javascript
const result = await NotificationService.sendSmartNotification(userId, {
  type: 'new_like',
  title: 'You have a new like!',
  baseMessage: '{NAME} liked you! {COMPATIBILITY}',
  relatedUserId: likerId,
  compatibilityScore: 96
});

if (result.sent) {
  io.to(`user-${userId}`).emit('notification', {
    id: result.notificationId,
    ...result
  });
}
```

## Notification Flow

```
Event Triggered (Like/Match/Message)
           ↓
Check shouldSendNotification()
           ↓
Validate type preference, quiet hours, frequency limits
           ↓
Get optimal send time from activity pattern
           ↓
Personalize message (add name, compatibility %)
           ↓
Log notification to database
           ↓
Send push notification (or schedule for optimal time)
           ↓
Emit Socket.io event for real-time UI update
           ↓
Track when user opens notification
           ↓
Update activity pattern with engagement data
```

## Quick View Stats

Assuming user browses 6 seconds per profile in detail mode:
- **Detail Mode**: 10 profiles in 1 minute
- **Quick View Mode**: 20 profiles in 1 minute (2x volume)
- **Session**: 50-100 profiles in 5-10 minutes

## Smart Timing Algorithm

1. **Data Collection**: Track when user opens notifications
2. **Per-Hour Analysis**: Calculate open rate for each hour (0-23)
3. **Best Hours**: Identify top 3 hours by open rate
4. **Scheduling**: Send at best hour +/- random 0-30 minutes
5. **Fallback**: Default to 7 PM if insufficient data

**Example Activity Pattern**:
```
Hour   Activity  Open Rate
7 AM      5         20%
12 PM    15         45%
5 PM     20         60%
6 PM     25         70%
7 PM     30         78% ← Best
8 PM     28         75%
10 PM    10         20%
12 AM     2          5%
```

## Performance Optimization

1. **Activity Patterns**: Updated only on notification open
2. **Batch Processing**: Notifications can be queued and sent together
3. **Lazy Loading**: Quick View loads 50 profiles at a time
4. **Indexes**: Database indexes on user_id, sent_at, opened_at
5. **Caching**: Activity patterns cached per user

## Testing Quick View Mode

```javascript
// Simulate quick view actions
const profiles = [
  { id: 1, first_name: 'Sarah', age: 28, photos: [...] },
  { id: 2, first_name: 'Jessica', age: 26, photos: [...] },
  // ... 48 more profiles
];

<QuickViewMode
  profiles={profiles}
  onLike={(profile) => console.log(`Liked ${profile.first_name}`)}
  onPass={(profile) => console.log(`Passed ${profile.first_name}`)}
  onViewProfile={(profile) => console.log(`Viewing ${profile.first_name}`)}
  onExit={() => console.log('Exited Quick View')}
/>
```

## Testing Notifications

```javascript
// Test smart notification sending
const result = await NotificationService.sendSmartNotification(userId, {
  type: 'new_like',
  title: 'New Like',
  baseMessage: '{NAME} liked you! {COMPATIBILITY}',
  relatedUserId: 123,
  compatibilityScore: 92
});

// Test notification open tracking
await NotificationService.recordNotificationOpened(notificationId, 'view_profile');

// Check activity pattern was updated
const pattern = await UserActivityPattern.findOne({ where: { user_id: userId } });
console.log(pattern.best_hours); // Should include current hour if opened
```

## Files Created

**Backend:**
- `backend/models/NotificationPreference.js` (120 lines)
- `backend/models/NotificationLog.js` (140 lines)
- `backend/models/UserActivityPattern.js` (200 lines)
- `backend/services/notificationService.js` (400 lines)
- `backend/routes/notifications.js` (100 lines)
- `backend/migrations/20260428_tier3_mobile_notifications.sql` (200 lines)

**Frontend:**
- `src/components/QuickViewMode.jsx` (200 lines)
- `src/components/QuickViewMode.css` (300 lines)
- `src/components/NotificationSettingsModal.jsx` (250 lines)
- `src/components/NotificationSettingsModal.css` (300 lines)
- `src/hooks/useQuickViewMode.js` (80 lines)
- `src/hooks/useNotifications.js` (120 lines)

## Success Metrics

1. **Engagement**: 2x more profiles viewed per session
2. **Retention**: Users spending 5+ minutes in Quick View
3. **Notification Opt-in**: 85%+ users keep notifications enabled
4. **Open Rate**: 40%+ notification open rate (from optimal timing)
5. **Click-Through**: 30%+ open notifications result in action

## Next Steps

1. ✅ Implement core models and services
2. ✅ Create frontend components with full styling
3. ⏳ Add Socket.io real-time notification delivery
4. ⏳ Create ML job for monthly activity pattern aggregation
5. ⏳ Add notification scheduling job (for delayed optimal times)
6. ⏳ Build notification analytics dashboard
7. ⏳ A/B test smart timing vs. real-time notifications
