# Real-Time Features Implementation Guide

## Overview

Comprehensive real-time features for the LinkUp dating app with socket.io integration. Includes:

- **Typing Indicators** - See who's typing across multiple matches
- **Online/Offline Status** - Real-time presence with last active timestamps
- **User Activity Status** - Track viewing profiles, voice/video calls
- **Profile Change Notifications** - Instant notifications for profile updates
- **Real-Time Match Notifications** - New matches, likes, requests

---

## Architecture

### Backend Components

```
backend/
├── services/
│   └── realTimeService.js          # Real-time state management
├── sockets/
│   └── realTimeEventHandlers.js    # Socket.io event handlers
├── models/
│   └── UserActivity.js             # Activity tracking model
```

### Frontend Components

```
src/
├── services/
│   └── realTimeService.js          # Socket.io client wrapper
├── hooks/
│   └── useRealTime.js              # Custom React hooks
├── components/
│   ├── UserStatusIndicator.js      # Online/offline status display
│   ├── TypingIndicator.js          # Typing indicator display
│   ├── MatchActivity.js            # Match activity overview
│   ├── ActivityStatus.js           # User activity tracker
│   ├── RealTimeNotifications.js    # Notification display
│   └── ConnectionStatus.js         # Connection health monitor
└── styles/
    ├── UserStatusIndicator.css
    ├── TypingIndicator.css
    ├── MatchActivity.css
    ├── ActivityStatus.css
    ├── RealTimeNotifications.css
    └── ConnectionStatus.css
```

---

## Backend Setup

### 1. Register Real-Time Service in Socket.io

**File:** `backend/server.js`

```javascript
const SocketEventHandlers = require('./sockets/realTimeEventHandlers');
const http = require('http');
const socketIo = require('socket.io');

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize Socket.io
const io = socketIo(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Register event handlers
SocketEventHandlers.registerHandlers(io);

// Listen with http server instead of express
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 2. Add UserActivity Model to Database Config

**File:** `backend/config/database.js`

```javascript
const db = {
  User: sequelize.import('./models/User'),
  Message: sequelize.import('./models/Message'),
  UserActivity: sequelize.import('./models/UserActivity'),
  // ... other models
};

// Set up associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});
```

### 3. Create Database Migration

**File:** `backend/migrations/create-user-activities.sql`

```sql
CREATE TABLE IF NOT EXISTS "UserActivities" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
  "activityType" VARCHAR(50) NOT NULL DEFAULT 'idle',
  "matchId" INTEGER REFERENCES "Matches"(id) ON DELETE SET NULL,
  "targetUserId" INTEGER REFERENCES "Users"(id) ON DELETE SET NULL,
  "startTime" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endTime" TIMESTAMP,
  duration INTEGER,
  "deviceType" VARCHAR(20),
  platform VARCHAR(255),
  metadata JSON DEFAULT '{}',
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_activities_userId ON "UserActivities"("userId");
CREATE INDEX idx_user_activities_matchId ON "UserActivities"("matchId");
CREATE INDEX idx_user_activities_isActive ON "UserActivities"("isActive");
```

---

## Frontend Setup

### 1. Initialize Real-Time Connection in App

**File:** `src/App.js`

```javascript
import React, { useEffect } from 'react';
import RealTimeNotifications from './components/RealTimeNotifications';
import ConnectionStatus from './components/ConnectionStatus';
import { useRealTimeConnection } from './hooks/useRealTime';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { user } = useAuth();
  const { connected, connecting, error } = useRealTimeConnection(user?.id);

  useEffect(() => {
    if (error) {
      console.error('Real-time connection error:', error);
    }
  }, [error]);

  return (
    <div className="app">
      {/* Show connection status in header */}
      <ConnectionStatus compact={true} showLatency={true} />

      {/* Global notifications */}
      <RealTimeNotifications position="top-right" />

      {/* Rest of app */}
      {/* ... */}
    </div>
  );
}

export default App;
```

### 2. Display Status in Chat

**File:** `src/components/DatingMessaging.js`

```javascript
import React from 'react';
import UserStatusIndicator from './UserStatusIndicator';
import TypingIndicator from './TypingIndicator';
import MatchActivity from './MatchActivity';

function DatingMessaging({ matchId, userId }) {
  return (
    <div className="dating-messaging">
      {/* Header with status */}
      <div className="messaging-header">
        <h2>Match Name</h2>
        <UserStatusIndicator
          userId={userId}
          showLastActive={true}
          size="medium"
        />
      </div>

      {/* Match activity panel */}
      <MatchActivity matchId={matchId} />

      {/* Messages */}
      <div className="messages-list">
        {/* ... messages ... */}
      </div>

      {/* Typing indicator */}
      <TypingIndicator matchId={matchId} />

      {/* Input area */}
      <div className="input-area">
        {/* ... input ... */}
      </div>
    </div>
  );
}
```

### 3. Display Activity Indicators

**File:** `src/pages/ChatPage.js`

```javascript
import React, { useState } from 'react';
import ActivityStatus from '../components/ActivityStatus';
import UserStatusIndicator from '../components/UserStatusIndicator';

function ChatPage({ matchId, userId }) {
  const [currentActivity, setCurrentActivity] = useState(null);

  return (
    <div className="chat-page">
      {/* Activity controls */}
      <div className="activity-bar">
        <ActivityStatus
          activityType="voice_calling"
          matchId={matchId}
          targetUserId={userId}
          onActivityChange={(type, active) => {
            setCurrentActivity(active ? type : null);
          }}
        />

        <ActivityStatus
          activityType="video_calling"
          matchId={matchId}
          targetUserId={userId}
        />

        <ActivityStatus
          activityType="in_chat"
          matchId={matchId}
        />
      </div>

      {/* Chat content */}
      {/* ... */}
    </div>
  );
}
```

---

## API Endpoints & Socket Events

### Socket Events (Client → Server)

#### Connection & Presence
```javascript
socket.emit('user_online', userId, deviceInfo)
socket.emit('user_offline', userId)
socket.emit('request_user_status', [userIds], callback)
socket.emit('broadcast_status', userId, callback)
```

#### Typing Indicators
```javascript
socket.emit('user_typing', { userId, matchId })
socket.emit('user_stopped_typing', { userId, matchId })
socket.emit('get_match_activity', matchId, callback)
```

#### Activity Tracking
```javascript
socket.emit('user_activity', {
  userId,
  activityType, // 'viewing_profile', 'voice_calling', 'video_calling', 'in_chat'
  matchId,
  targetUserId
}, callback)

socket.emit('activity_ended', { userId, activityType }, callback)
```

#### Match & Profile
```javascript
socket.emit('new_match', { userId1, userId2, match })
socket.emit('like_received', { toUserId, fromUser })
socket.emit('match_request', { matchId, userId1, userId2 })
socket.emit('profile_changed', { userId, changeType, profileData })
socket.emit('photo_added', { userId, photoUrl })
socket.emit('bio_updated', { userId, bio })
```

#### Utilities
```javascript
socket.emit('subscribe_match', matchId)
socket.emit('unsubscribe_match', matchId)
socket.emit('ping', callback)
socket.emit('get_realtime_stats', callback)
```

### Socket Events (Server → Client)

#### Status Updates
```javascript
socket.on('user_status_changed', (data) => {
  // { userId, status, timestamp, isReconnect }
})

socket.on('user_status_updated', (data) => {
  // { userId, status, lastActive, isOnline, device, activity }
})

socket.on('user_online_confirmed', (data) => {
  // { success, userId, socketId, timestamp }
})
```

#### Typing & Activity
```javascript
socket.on('user_typing_indicator', (data) => {
  // { matchId, userId, isTyping, typingUsers, timestamp }
})

socket.on('activity_*.js', (data) => {
  // { userId, activityType, matchId, targetUserId, timestamp }
})

socket.on('activity_ended', (data) => {
  // { userId, activityType, timestamp }
})

socket.on('profile_viewed', (data) => {
  // { byUserId, timestamp }
})

socket.on('call_started', (data) => {
  // { callerId, callType, matchId, timestamp }
})
```

#### Notifications
```javascript
socket.on('match_notification', (data) => {
  // { type, match/fromUser, timestamp }
})

socket.on('profile_update_notification', (data) => {
  // { userId, changeType, profileData, timestamp }
})
```

---

## Usage Examples

### Example 1: Show Typing Indicator

```javascript
import { useTypingIndicator } from '../hooks/useRealTime';

function MessageInput({ matchId }) {
  const { startTyping, stopTyping } = useTypingIndicator(matchId);

  const handleInputChange = (e) => {
    startTyping(); // Notify others we're typing
  };

  const handleSendMessage = (message) => {
    stopTyping(); // Stop typing indicator
    // Send message...
  };

  return (
    <input
      onChange={handleInputChange}
      onBlur={stopTyping}
      placeholder="Type a message..."
    />
  );
}
```

### Example 2: Track Profile Views

```javascript
import { useProfileViewTracker } from '../hooks/useRealTime';

function ProfilePage({ userId }) {
  const { startViewingProfile, stopViewingProfile } =
    useProfileViewTracker(userId);

  useEffect(() => {
    startViewingProfile();
    return () => stopViewingProfile();
  }, [userId, startViewingProfile, stopViewingProfile]);

  return <div>{/* Profile content */}</div>;
}
```

### Example 3: Listen for Match Notifications

```javascript
import { useRealTimeNotifications } from '../hooks/useRealTime';

function NotificationCenter() {
  const { notifications, dismissNotification } =
    useRealTimeNotifications();

  return (
    <div className="notifications">
      {notifications.map((notification) => (
        <div key={notification.id}>
          {notification.type === 'new_match' && (
            <p>You have a new match!</p>
          )}
          {notification.type === 'profile_viewed' && (
            <p>Someone viewed your profile</p>
          )}
          <button onClick={() => dismissNotification(notification.id)}>
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Example 4: Request User Status

```javascript
import { useUsersStatus } from '../hooks/useRealTime';

function MatchList({ matchUserIds }) {
  const { statuses, loading } = useUsersStatus(matchUserIds);

  return (
    <ul>
      {statuses.map((status) => (
        <li key={status.userId}>
          <span>{status.isOnline ? '🟢' : '⚫'}</span>
          <span>{status.isOnline ? 'Online' : 'Offline'}</span>
          {!status.isOnline && (
            <span>Last seen: {status.lastActive}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
```

---

## Security Considerations

### 1. Authentication
- Always validate user identity before registering online status
- Socket connection should require valid authentication token

```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const userId = socket.handshake.query.userId;

  // Verify token and userId
  if (!verifyToken(token)) {
    return next(new Error('Unauthorized'));
  }

  socket.userId = userId;
  next();
});
```

### 2. Data Privacy
- Don't expose sensitive user information in real-time events
- Activity data should be encrypted if sensitive
- Profile viewing should be anonymized option

### 3. Rate Limiting
- Limit typing indicator frequency (max 1 per second)
- Limit activity updates (max 1 per 2 seconds)
- Implement per-user message throttling

### 4. Access Control
- Only allow users to broadcast their own activities
- Only send notifications to relevant users
- Validate match membership before allowing communication

---

## Performance Optimization

### 1. Memory Management
- Clean up stale typing indicators (30+ minutes)
- Remove inactive users from memory
- Limit in-memory activity store to recent data

### 2. Network Optimization
- Use socket rooms for targeted broadcasts
- Batch activity updates
- Compress activity payloads

### 3. Database Optimization
- Index UserActivity table by userId, matchId, isActive
- Archive old activities regularly
- Use pagination for activity queries

### 4. Frontend Optimization
- Debounce typing indicators (300ms)
- Throttle activity updates
- Unsubscribe from unused matches
- Clean up listeners on component unmount

---

## Testing Checklist

### Backend Tests
- [ ] User online/offline registration
- [ ] Typing indicator creation and cleanup
- [ ] Activity tracking and updates
- [ ] Match notification delivery
- [ ] Profile change broadcasting
- [ ] Stale data cleanup
- [ ] Connection persistence

### Frontend Tests
- [ ] Real-time connection established
- [ ] Status indicators update correctly
- [ ] Typing indicators appear/disappear
- [ ] Activity buttons work
- [ ] Notifications display
- [ ] Connection health monitoring
- [ ] Error handling

### Integration Tests
- [ ] Multiple users chatting simultaneously
- [ ] Typing indicators across different matches
- [ ] Profile views tracked
- [ ] Match notifications reach both users
- [ ] Reconnection after disconnect
- [ ] Mobile responsiveness

---

## Debugging Guide

### Common Issues

**Typing indicators not showing:**
- Check socket is connected: `realTimeService.isConnected()`
- Verify matchId is correct
- Check typing timeout (3 seconds default)

**Status not updating:**
- Verify user_online event is sent
- Check userId matches authenticated user
- Look for network errors in console

**Notifications not appearing:**
- Check browser notifications permission
- Verify match membership
- Check socket event listeners

**Performance issues:**
- Monitor memory with `realTimeService.getHealthMetrics()`
- Check active users count
- Monitor typing indicators cleanup

### Debug Commands (Browser Console)

```javascript
// Check connection
realTimeService.isConnected()
realTimeService.getSocketId()

// Get health metrics
realTimeService.getRealTimeStats()

// Manual ping
await realTimeService.ping()

// Get user status
await realTimeService.getUserStatus(userId)

// Get match activity
await realTimeService.getMatchActivity(matchId)
```

---

## Database Schema Changes

### New Tables
- `UserActivities` - Track all user activities

### New Fields in Message Model
- `typingIndicators` - Track typing events (optional)

### Indexes
- `UserActivities(userId, activityType)`
- `UserActivities(matchId)`
- `UserActivities(isActive)`

---

## Future Enhancements

1. **Voice/Video Calling**
   - Integrate WebRTC with Socket.io
   - Call history tracking
   - Call quality metrics

2. **Advanced Typing**
   - Multi-user typing with positions
   - Voice typing/voice messages
   - Typing animation variations

3. **Activity Analytics**
   - User activity trends
   - Peak activity times
   - Engagement metrics

4. **Offline Queue**
   - Queue messages during disconnect
   - Deliver when reconnected
   - Offline activity tracking

5. **Presence Awareness**
   - Seen/read receipts
   - Location sharing (optional)
   - Activity history timeline

---

## Troubleshooting

### Connection Issues
1. Check server is running on correct port
2. Verify CORS configuration
3. Check firewall/network settings
4. Monitor browser console for errors

### Socket Event Issues
1. Verify event names match exactly
2. Check payload structure
3. Ensure socket is connected before emitting
4. Look for error handlers firing

### Performance Issues
1. Monitor active connections count
2. Check memory usage
3. Review cleanup interval
4. Profile frontend rendering

---

## Support & Maintenance

### Monitoring
- Track connected users count
- Monitor message latency
- Watch for disconnections
- Alert on performance degradation

### Maintenance
- Regular cleanup of stale data
- Update dependencies
- Monitor security patches
- Archive old activity records

### Scaling
- Use Redis for multi-server deployment
- Implement socket.io adapter
- Load balance connections
- Distribute real-time processing
