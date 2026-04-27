# Live Activity Status Enhancements - Implementation Guide

## Overview

This document describes the complete implementation of Live Activity Status Enhancements for LinkUp, including:
- "Currently browsing" → "Last active 2 minutes ago" display
- "On a video call" → "Video dating" badge
- Opt-in/out of detailed status sharing per match (privacy controls)
- Real-time feature visibility with privacy filtering

## Architecture

### Backend Components

#### 1. Database Model: `MatchStatusPreference`
**File**: `backend/models/MatchStatusPreference.js`

Stores per-match privacy preferences for each user.

**Key Fields**:
- `userId`: User owning the preferences
- `matchId`: Target match
- `showOnlineStatus`: Show if currently online (boolean)
- `showLastActive`: Show "last active 2 minutes ago" (boolean)
- `showActivityStatus`: Show current activity (video call, viewing profile, etc.)
- `privacyLevel`: Quick preset level (full, basic, minimal, hidden)

**Privacy Levels**:
- `full`: Share all activity information
- `basic`: Only show online/offline status
- `minimal`: Only show last active time
- `hidden`: Don't share any status

#### 2. Service: `ActivityStatusFormatterService`
**File**: `backend/services/activityStatusFormatterService.js`

Handles formatting and privacy filtering of activity status.

**Key Methods**:
```javascript
// Format time differences
formatLastActive(timestamp) 
// Returns: "just now", "2 minutes ago", "1 hour ago", etc.

// Get user's current activity
getUserCurrentActivity(userId)
// Returns: { currentActivity, inCall, callType, isOnline, lastActive }

// Build privacy-filtered status for a match
buildStatusForMatch(userId, matchId, includePrivacy = true)
// Returns: Complete status object with privacy filtering applied

// Format status for UI display
formatStatusForDisplay(statusObj)
// Returns: { text, badge, emoji, priority }
// Example: { text: "🎥 Video dating", badge: "video-dating", emoji: "🎥", priority: 1 }
```

#### 3. Socket.io Privacy-Aware Handlers
**File**: `backend/sockets/privacyAwareActivityHandlers.js`

Handles real-time activity updates while respecting privacy preferences.

**Key Handlers**:
```javascript
handleUserActivityUpdate() // Broadcast activity with privacy filtering
handleActivityEnded() // Handle activity completion
handleLastActiveUpdate() // Update last active time
handleTypingIndicator() // Handle typing indicator with privacy
handleOnlineStatusUpdate() // Handle online/offline status
canViewStatus() // Check if viewer can see status
```

#### 4. API Routes
**File**: `backend/routes/dating.js` (added at end before module.exports)

**Endpoints**:
```
GET    /dating/status-preferences              # Get all preferences
GET    /dating/status-preferences/:matchId     # Get preference for match
POST   /dating/status-preferences              # Create/update preference
PUT    /dating/status-preferences/:matchId     # Update preference
POST   /dating/status-preferences/:matchId/quick-set  # Set privacy level preset
GET    /dating/activity-status/:matchId/:userId  # Get formatted status
DELETE /dating/status-preferences/:matchId     # Delete preference
```

#### 5. Database Migration
**File**: `backend/migrations/20260428_create_match_status_preferences.sql`

Creates `match_status_preferences` table with indexes and auto-update triggers.

### Frontend Components

#### 1. Enhanced User Status Indicator
**Files**: 
- `src/components/EnhancedUserStatusIndicator.jsx`
- `src/components/EnhancedUserStatusIndicator.css`

Displays real-time activity status with privacy-aware formatting.

**Features**:
- Shows "Last active X minutes ago"
- Displays current activity with emoji
- Video dating badge in prominent position
- Privacy mode indicator
- Real-time updates via Socket.io

**Props**:
```javascript
<EnhancedUserStatusIndicator
  userId={123}
  matchId={456}
  showDetail={true}
  compactMode={false}
  enablePrivacy={true}
  onClick={handleClick}
/>
```

**Display Examples**:
- Online: "🟢 Online now"
- Video Dating: "🎥 Video dating" (with badge)
- In Voice Call: "☎️ On a voice call"
- Browsing: "Last active 2 minutes ago"
- Offline: "⚪ Offline"

#### 2. Video Dating Badge
**Files**:
- `src/components/VideoDatingBadge.jsx`
- `src/components/VideoDatingBadge.css`

Prominent badge showing when user is on a video call.

**Features**:
- Eye-catching red gradient animation
- Pulse indicator for live call
- Pop-in animation when call starts
- Size variations (small, medium, large)

**Props**:
```javascript
<VideoDatingBadge
  userId={123}
  matchId={456}
  showCallerInfo={true}
  size="medium"
  onClick={handleClick}
/>
```

#### 3. Status Preference Manager
**Files**:
- `src/components/StatusPreferenceManager.jsx`
- `src/components/StatusPreferenceManager.css`

Modal for managing privacy settings per match.

**Features**:
- 4 preset privacy levels (Full, Basic, Minimal, Hidden)
- Individual toggle controls
- Real-time preview
- Visual feedback
- Responsive design

**Usage**:
```javascript
const [isOpen, setIsOpen] = useState(false);

<StatusPreferenceManager
  matchId={456}
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onSave={handleSave}
/>
```

#### 4. Custom React Hooks
**File**: `src/hooks/useActivityStatus.js`

**Hooks Provided**:

1. `useActivityStatus(userId, matchId)`
   - Fetches activity status with privacy filtering
   - Real-time updates via Socket.io
   - Fallback polling (30 seconds)
   - Returns: `{ status, privacy, formatted, loading, error, isVideoDating, isOnline, ... }`

2. `useStatusPreference(matchId)`
   - Manage privacy preferences for a match
   - Methods: `updatePreference()`, `setPrivacyLevel()`, `deletePreference()`
   - Returns: `{ preference, loading, saving, error, ... }`

3. `useAllStatusPreferences()`
   - Get all preferences for current user
   - Returns: `{ preferences, loading, error, getPreferenceForMatch() }`

**Example Usage**:
```javascript
const { status, formatted, isVideoDating } = useActivityStatus(userId, matchId);
const { preference, setPrivacyLevel } = useStatusPreference(matchId);

return (
  <div>
    <EnhancedUserStatusIndicator userId={userId} matchId={matchId} />
    {isVideoDating && <VideoDatingBadge userId={userId} matchId={matchId} />}
    <button onClick={() => setPrivacyLevel('basic')}>
      Set Privacy to Basic
    </button>
  </div>
);
```

## Integration Examples

### Example 1: Discovery Card
```javascript
import EnhancedUserStatusIndicator from '../components/EnhancedUserStatusIndicator';
import VideoDatingBadge from '../components/VideoDatingBadge';
import { useActivityStatus } from '../hooks/useActivityStatus';

function DiscoveryCard({ profile, matchId }) {
  const { isVideoDating } = useActivityStatus(profile.userId, matchId);

  return (
    <div className="discovery-card">
      <img src={profile.photo} alt={profile.name} />
      <h3>{profile.name}</h3>
      
      {/* Live activity status indicator */}
      <EnhancedUserStatusIndicator 
        userId={profile.userId} 
        matchId={matchId}
        showDetail={true}
      />
      
      {/* Video dating badge */}
      {isVideoDating && (
        <VideoDatingBadge 
          userId={profile.userId} 
          matchId={matchId}
          size="medium"
        />
      )}
    </div>
  );
}
```

### Example 2: Match View with Privacy Controls
```javascript
import EnhancedUserStatusIndicator from '../components/EnhancedUserStatusIndicator';
import StatusPreferenceManager from '../components/StatusPreferenceManager';
import { useStatusPreference } from '../hooks/useActivityStatus';

function MatchView({ matchId, userId }) {
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const { preference } = useStatusPreference(matchId);

  return (
    <div className="match-view">
      <div className="match-header">
        <div className="status-container">
          <EnhancedUserStatusIndicator 
            userId={userId} 
            matchId={matchId}
          />
        </div>
        
        <button 
          className="privacy-btn"
          onClick={() => setPreferencesOpen(true)}
        >
          Privacy Level: {preference?.privacy_level || 'full'}
        </button>
      </div>

      {/* Chat or other content */}
      
      {/* Privacy settings modal */}
      <StatusPreferenceManager
        matchId={matchId}
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
      />
    </div>
  );
}
```

### Example 3: Privacy Dashboard
```javascript
import { useAllStatusPreferences } from '../hooks/useActivityStatus';

function PrivacyDashboard() {
  const { preferences, getPreferenceForMatch } = useAllStatusPreferences();

  return (
    <div className="privacy-dashboard">
      <h2>Privacy Settings for Matches</h2>
      
      <div className="preferences-list">
        {preferences.map(pref => (
          <div key={pref.match_id} className="preference-item">
            <div className="match-info">
              <img src={pref.matchPhoto} alt={pref.matchName} />
              <span>{pref.matchName}</span>
            </div>
            
            <div className="privacy-level">
              <span className="level-badge">
                {pref.privacy_level.toUpperCase()}
              </span>
            </div>
            
            <div className="settings-summary">
              {pref.show_online_status && '🟢 Online'}
              {pref.show_activity_status && '📍 Activity'}
              {pref.show_last_active && '🕐 Last Active'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Real-Time Updates Flow

### Activity Status Update Flow
```
1. User starts video call
   ↓
2. Frontend emits: socket.emit('user_activity', { activity: 'video_calling' })
   ↓
3. Backend receives event
   ↓
4. Check MatchStatusPreference for user
   ↓
5. If show_activity_status = true:
   - Format status as "🎥 Video dating"
   - Emit to match room: 'user_activity_update_with_privacy'
   - Emit special event: 'video_dating_started'
   ↓
6. Else (hidden/minimal/basic):
   - Don't broadcast activity details
   - Only broadcast generic status (if allowed)
   ↓
7. Frontend receives update and displays:
   - EnhancedUserStatusIndicator updates
   - VideoDatingBadge shows
   - Real-time without page refresh
```

### Privacy Level Change Flow
```
1. User selects "Basic" privacy level in StatusPreferenceManager
   ↓
2. POST to /dating/status-preferences/:matchId/quick-set
   ↓
3. Database updates match_status_preferences
   ↓
4. Backend emits: 'user_privacy_level_changed' event
   ↓
5. Future activity broadcasts respect new privacy level
   ↓
6. Existing activity may be hidden/shown based on new settings
```

## Deployment Checklist

- [ ] Run database migration: `psql -f backend/migrations/20260428_create_match_status_preferences.sql`
- [ ] Verify MatchStatusPreference model is loaded in `backend/models/index.js`
- [ ] Test API endpoints with Postman/curl
- [ ] Verify Socket.io privacy-aware handlers are active
- [ ] Test frontend components in development
- [ ] Test real-time updates with multiple browser windows
- [ ] Verify privacy filtering works correctly
- [ ] Load test with multiple concurrent users
- [ ] Check mobile responsiveness
- [ ] Monitor backend logs for errors

## Privacy Considerations

1. **Server-Side Enforcement**: Privacy filtering happens on backend before broadcasting
2. **Privacy Presets**: Users choose from predefined levels for simplicity
3. **Per-Match Control**: Different privacy levels for different matches
4. **No Third-Party Access**: Only match partner receives status information
5. **Default to Full**: New matches default to sharing all status information
6. **User Transparency**: Users see what information they're sharing
7. **No History**: Status preferences don't expose historical data

## Performance Optimizations

1. **Database Indexes**: Indexed on user_id, match_id, privacy_level for fast queries
2. **Caching**: Consider Redis caching for frequently accessed preferences
3. **Real-Time Polling**: 30-second fallback for Socket.io failures
4. **Batch Updates**: Combine multiple preference updates into single request
5. **Lazy Loading**: Preferences loaded only when needed

## Troubleshooting

### Status Not Updating
- Check browser DevTools → Network for API calls
- Verify Socket.io connection is active
- Check backend logs for errors
- Ensure MatchStatusPreference table exists

### Privacy Settings Not Applied
- Verify database migration ran successfully
- Check privacy_level value in database
- Verify Socket.io handlers are loaded
- Test with fresh browser session

### Slow Status Updates
- Check database query performance
- Monitor Socket.io latency
- Consider caching preferences
- Profile backend with slow query logs

## Future Enhancements

- [ ] Activity status history (analytics)
- [ ] Custom privacy schedule (e.g., hide after 10 PM)
- [ ] Granular activity type filtering
- [ ] Privacy notifications (when status shared)
- [ ] Group privacy presets
- [ ] Privacy status indicators for match partner
- [ ] Export privacy settings

## Files Created/Modified

### Created Files
- `backend/models/MatchStatusPreference.js`
- `backend/services/activityStatusFormatterService.js`
- `backend/sockets/privacyAwareActivityHandlers.js`
- `backend/migrations/20260428_create_match_status_preferences.sql`
- `src/components/EnhancedUserStatusIndicator.jsx`
- `src/components/EnhancedUserStatusIndicator.css`
- `src/components/VideoDatingBadge.jsx`
- `src/components/VideoDatingBadge.css`
- `src/components/StatusPreferenceManager.jsx`
- `src/components/StatusPreferenceManager.css`
- `src/hooks/useActivityStatus.js`

### Modified Files
- `backend/routes/dating.js` (added status preferences endpoints)

### Auto-Loaded Components
- Models auto-loaded via `backend/models/index.js`
- Routes included in main server file via dating.js

## Testing

### Unit Tests
```javascript
// Test ActivityStatusFormatterService
describe('ActivityStatusFormatterService', () => {
  test('formatLastActive should format timestamps correctly', () => {
    const now = new Date();
    const twoMinutesAgo = new Date(now - 2 * 60000);
    expect(ActivityStatusFormatterService.formatLastActive(twoMinutesAgo))
      .toBe('2 minutes ago');
  });

  test('privacy filtering should respect privacy_level', () => {
    // Test with privacy_level = 'hidden'
    // Verify showOnlineStatus, showLastActive, etc. are false
  });
});
```

### Integration Tests
```javascript
// Test API endpoints
describe('Status Preferences API', () => {
  test('POST /dating/status-preferences should create preference', async () => {
    // Create test match and user
    // POST preference
    // Verify database record
  });

  test('privacy filtering should work in real-time', async () => {
    // Create two users in match
    // Set privacy to 'minimal'
    // Emit activity
    // Verify only last_active visible
  });
});
```

## Support

For questions or issues:
1. Check logs: `tail -f backend/logs/*.log`
2. Review Socket.io connections: Check browser DevTools → Network
3. Test API: Use Postman collection (TODO: create)
4. Check database: `SELECT * FROM match_status_preferences WHERE user_id = ?`
