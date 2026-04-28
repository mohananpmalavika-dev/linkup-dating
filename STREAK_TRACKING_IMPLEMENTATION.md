# Streak Tracking System - Complete Documentation

## Overview

The **Streak Tracking System** gamifies messaging engagement by tracking consecutive days of communication between matched users. It combines psychology-driven notifications, milestone achievements, and social competition to create a FOMO-inducing engagement system.

**Key Features:**
- 🔥 Flame counter progression (3+ to 100+ days)
- 🏆 Milestone badges at 3, 7, 30, and 100 days
- ⏰ Streak-at-risk notifications (FOMO trigger)
- 📊 Real-time leaderboard with top streaks
- 📱 Compact and full-view display modes
- ✨ Milestone achievement alerts
- 💯 Engagement scoring algorithm

---

## Architecture

### Backend Components

```
backend/
├── services/
│   └── streakService.js              # Core streak logic
├── routes/
│   └── streaks.js                    # API endpoints
├── migrations/
│   └── 20260428_create_streak_tracking.js  # Database schema
└── models/
    └── MessageStreakTracker.js       # Already exists
```

### Frontend Components

```
src/
├── components/
│   ├── StreakBadge.jsx              # Main badge component
│   └── StreakLeaderboard.jsx        # Leaderboard view
├── hooks/
│   └── useStreaks.js                # Data management hook
└── styles/
    ├── StreakBadge.css
    └── StreakLeaderboard.css
```

---

## Database Schema

### message_streak_trackers Table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id_1 | INTEGER | First user (normalized) |
| user_id_2 | INTEGER | Second user (normalized) |
| match_id | INTEGER | Reference to match |
| streak_days | INTEGER | Current consecutive days |
| is_active | BOOLEAN | Streak status |
| streak_start_date | TIMESTAMP | When streak began |
| last_message_date | TIMESTAMP | Last message timestamp |
| streak_broken_date | TIMESTAMP | When streak ended (if broken) |
| milestone_3_days | BOOLEAN | 3-day badge achieved |
| milestone_7_days | BOOLEAN | 7-day badge achieved |
| milestone_30_days | BOOLEAN | 30-day badge achieved |
| total_messages | INTEGER | Messages during streak |
| total_reactions | INTEGER | Reactions during streak |
| engagement_score | FLOAT | Psychology metric |
| notification_sent | BOOLEAN | Notification flag |
| last_notification_date | TIMESTAMP | Last notification time |

**Indexes:**
- `idx_mst_user_id_1`, `idx_mst_user_id_2` - User lookups
- `idx_mst_match_id` - Match lookups
- `idx_mst_is_active` - Active streak queries
- `idx_mst_streak_days` - Leaderboard sorting
- `idx_mst_last_message_date` - Streak-at-risk detection

---

## API Endpoints

### Get Match Streak
```http
GET /api/streaks/match/:matchId
Authorization: Bearer {token}

Response:
{
  "success": true,
  "streak": {
    "id": 123,
    "streakDays": 7,
    "flameEmoji": "🔥🔥",
    "flameLevel": 2,
    "isBadgeEarned": true,
    "daysSinceMessage": 0,
    "daysUntilBroken": 1,
    "otherUser": { "id": 456, "firstName": "Alice" },
    "milestone3Days": true,
    "milestone7Days": false
  }
}
```

### Get User Streaks
```http
GET /api/streaks/user/active?limit=50
Authorization: Bearer {token}

Response:
{
  "success": true,
  "streaks": [
    {
      "id": 123,
      "streakDays": 15,
      "flameEmoji": "🔥🔥🔥",
      "otherUser": { ... },
      "isBadgeEarned": true,
      "daysUntilBroken": 1
    }
  ]
}
```

### Get Leaderboard
```http
GET /api/streaks/leaderboard?limit=20

Response:
{
  "success": true,
  "leaderboard": [
    {
      "rank": 1,
      "streakDays": 245,
      "flameEmoji": "🔥🔥🔥🔥🔥",
      "matchNames": "Alice & Bob",
      "totalMessages": 2456,
      "engagementScore": 4523
    }
  ]
}
```

### Get User Statistics
```http
GET /api/streaks/user/stats
Authorization: Bearer {token}

Response:
{
  "success": true,
  "stats": {
    "activeStreakCount": 5,
    "longestStreak": 45,
    "totalStreaks": 12,
    "totalEngagementScore": 15234,
    "milestoneCount": {
      "badge3Day": 8,
      "milestone7Day": 5,
      "milestone30Day": 2
    },
    "averageStreakLength": 18
  }
}
```

### Get Milestones
```http
GET /api/streaks/milestones/:days

Response:
{
  "success": true,
  "streakDays": 15,
  "milestones": [
    {
      "level": "3_day",
      "name": "🔥 First Flame",
      "description": "Messaged 3 days in a row",
      "achieved": true
    },
    {
      "level": "7_day",
      "name": "🔥🔥 Week Warrior",
      "description": "Message 1 more day(s)",
      "achieved": false
    }
  ]
}
```

---

## Service Methods

### streakService.js

#### updateStreakOnMessage(matchId, userId1, userId2)
Updates streak when a new message is sent. Handles:
- Creating new streaks
- Incrementing existing streaks
- Detecting broken streaks
- Triggering milestone notifications

**Returns:**
```javascript
{
  isNew: boolean,
  streak: StreakObject,
  milestoneTrigger: {
    milestone: string,
    days: number,
    description: string
  }
}
```

#### getUserStreaks(userId, limit = 50)
Fetches all active streaks for a user with flame emoji and badge status.

#### getStreakLeaderboard(limit = 20)
Retrieves top streaks globally for leaderboard display.

#### getUserStreakStats(userId)
Aggregates streak statistics including longest streak, total engagement, and milestone counts.

#### getMilestones(streakDays)
Returns milestone progression data for UI display.

#### getFlameEmoji(streakDays)
Returns flame emoji string based on streak level:
- 🔥 = 3-6 days
- 🔥🔥 = 7-29 days
- 🔥🔥🔥 = 30-99 days
- 🔥🔥🔥🔥🔥 = 100+ days

---

## Component Usage

### StreakBadge Component

#### Compact Mode (for match lists)
```jsx
<StreakBadge 
  matchId={123}
  matchName="Alice"
  compact={true}
/>
```

Displays: `🔥 7` with inline styling

#### Full Mode (for detailed view)
```jsx
<StreakBadge 
  matchId={123}
  matchName="Alice"
  compact={false}
/>
```

Displays:
- Flame emoji animation
- Streak duration
- Milestone progress
- Days until broken (urgency indicator)
- Milestone achievement badges

#### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| matchId | number | required | Match ID |
| matchName | string | "Match" | Name for display |
| compact | boolean | false | Compact mode |
| onClick | function | null | Click handler |

### StreakLeaderboard Component

```jsx
<StreakLeaderboard limit={10} />
```

Displays:
- Top 10 global streaks with medal emojis
- Modal with detailed stats
- Achievement badges
- Engagement scoring

---

## Hook Usage

### useStreaks Hook

```javascript
const {
  currentStreak,      // Active streak for current match
  userStreaks,        // Array of user's active streaks
  streakStats,        // Aggregated streak statistics
  leaderboard,        // Global leaderboard data
  loading,            // Loading state
  error,              // Error message
  fetchMatchStreak,   // Fetch specific match streak
  fetchUserStreaks,   // Fetch user's streaks
  fetchStreakStats,   // Fetch statistics
  fetchLeaderboard,   // Fetch leaderboard
  refetch             // Refresh all data
} = useStreaks(matchId);
```

### Example Usage
```jsx
function MatchDetail({ matchId }) {
  const { currentStreak, loading } = useStreaks(matchId);

  if (loading) return <div>Loading streak...</div>;
  
  return (
    <div>
      <StreakBadge 
        matchId={matchId}
        matchName="Match"
      />
      {currentStreak && (
        <div>
          Streak: {currentStreak.streakDays} days
          {currentStreak.isBadgeEarned && "🏆"}
        </div>
      )}
    </div>
  );
}
```

---

## Streak Psychology

### Motivation Mechanics

**1. Visual Progression (Flame Emoji)**
- Growing flame emoji indicates increasing achievement
- 🔥 → 🔥🔥 → 🔥🔥🔥 progression creates visual reward

**2. Milestone Milestones**
- 3-day: "First Flame" - initial engagement reward
- 7-day: "Week Warrior" - sustained effort recognition
- 30-day: "Month Crusher" - major achievement
- 100-day: "Century Legend" - extreme dedication

**3. FOMO Triggers**
- Daily tracking creates pressure to maintain
- Notifications warn when streak at risk
- Urgency indicators show time remaining
- Leaderboard creates social comparison

**4. Engagement Scoring**
- Formula: `(streakDays × 10) + (messageCount × 0.5)`
- Rewards both duration and intensity
- Visible in leaderboard for social proof

---

## Integration with Messaging

### Step 1: Register Routes (server.js)
```javascript
const streakRoutes = require('./routes/streaks');
app.use('/api/streaks', authenticateToken, streakRoutes);
```

### Step 2: Update Message Handler
```javascript
// In message creation route:
const streakResult = await streakService.updateStreakOnMessage(
  matchId,
  userId,
  otherUserId
);

// Emit real-time update
req.io.to(`match_${matchId}`).emit('streak:updated', streakResult);
```

### Step 3: Display in Match List
```jsx
import StreakBadge from './StreakBadge';

const MatchListItem = ({ match }) => (
  <div className="match-item">
    <StreakBadge 
      matchId={match.id}
      matchName={match.name}
      compact={true}
    />
    {/* ... other match info ... */}
  </div>
);
```

---

## Notifications

### Milestone Achievement
```
🎉 7-Day Messaging Streak! 🔥🔥
You've messaged [User] for 7 days in a row!
Keep it going! 💬
```

### Streak At Risk
```
🚨 Streak at Risk!
Your 12-day streak with [User] ends at midnight!
Send a message to save it!
```

### Streak Broken
```
📉 Streak Broken
Your 12-day streak with [User] has ended.
Start a new one! Send a message today! 💪
```

---

## Daily Tasks

### 1. Check At-Risk Streaks (11 PM daily)
```javascript
// Identifies streaks where last message was 23-24 hours ago
// Sends FOMO notifications to both users
```

### 2. Detect Broken Streaks (12:01 AM daily)
```javascript
// Marks streaks as inactive if no message in 24+ hours
// Records broken streak date
```

---

## Performance Considerations

### Query Optimization
- Indexed on `is_active`, `streak_days`, `last_message_date`
- Composite index on user pairs for deduplication
- Leaderboard query limited to top 20 by default

### Caching Strategy
- Cache leaderboard (updates every hour)
- Cache user stats (updates on message send)
- Real-time streak via Socket.io

### Database Indexes
```sql
CREATE INDEX idx_mst_streak_days ON message_streak_trackers(streak_days DESC);
CREATE INDEX idx_mst_is_active ON message_streak_trackers(is_active);
CREATE INDEX idx_mst_last_message_date ON message_streak_trackers(last_message_date DESC);
```

---

## Testing

### Manual Testing

1. **Create a streak:**
   - Send messages on consecutive days
   - Verify streak_days increments

2. **Test milestone:**
   - Reach 3, 7, 30 days
   - Verify notification triggers
   - Check leaderboard update

3. **Test break:**
   - Skip a day
   - Verify is_active becomes false
   - Verify streak_broken_date set

4. **Test API:**
   ```bash
   # Get user streaks
   curl -H "Authorization: Bearer TOKEN" \
     http://localhost:5000/api/streaks/user/active

   # Get leaderboard
   curl http://localhost:5000/api/streaks/leaderboard
   ```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Streak not updating | Verify streakService.updateStreakOnMessage() called after message save |
| Notifications not sent | Check notification service integration and queue |
| Leaderboard empty | Verify at least 3-day streaks exist in database |
| Flame emoji not showing | Check streakDays >= 3 requirement |
| Real-time updates lag | Verify Socket.io events emitted correctly |

---

## Future Enhancements

1. **Streak Restore**
   - Pay points to restore broken streaks
   - Limited restores per month

2. **Streak Multipliers**
   - 7-day multiplier (1.5x engagement)
   - Weekend vs weekday bonuses

3. **Team Streaks**
   - Group chat streaks
   - Team challenges

4. **Streak History**
   - Archive completed streaks
   - All-time statistics

5. **Gamification Events**
   - "Streak Week" special challenges
   - Seasonal leaderboards

---

## Configuration

Edit `backend/services/streakService.js` to customize:

```javascript
const MILESTONES = {
  FIRST_BADGE: 3,      // Minimum for badge display
  SEVEN_DAY: 7,        // First major milestone
  THIRTY_DAY: 30,      // Extended milestone
  HUNDRED_DAY: 100     // Extreme milestone
};

const FLAME_LEVELS = {
  0: '🔥',              // 1-2 days
  1: '🔥🔥',            // 3-6 days
  2: '🔥🔥🔥',          // 7-29 days
  3: '🔥🔥🔥🔥',        // 30-99 days
  4: '🔥🔥🔥🔥🔥'      // 100+ days
};
```

---

## Files Checklist

- ✅ `backend/services/streakService.js` - Core logic (500+ lines)
- ✅ `backend/routes/streaks.js` - API endpoints (200+ lines)
- ✅ `src/hooks/useStreaks.js` - Frontend hook (250+ lines)
- ✅ `src/components/StreakBadge.jsx` - Badge component (300+ lines)
- ✅ `src/components/StreakLeaderboard.jsx` - Leaderboard (250+ lines)
- ✅ `src/styles/StreakBadge.css` - Badge styling (400+ lines)
- ✅ `src/styles/StreakLeaderboard.css` - Leaderboard styling (400+ lines)
- ✅ `backend/migrations/20260428_create_streak_tracking.js` - Database migration
- ✅ `STREAK_TRACKING_INTEGRATION.md` - Integration guide

---

## Support

For issues or questions, check:
1. Console logs for error messages
2. Network tab for API responses
3. Database records in `message_streak_trackers`
4. Socket.io events in browser console

---

**Last Updated:** April 28, 2026
**Version:** 1.0.0
**Status:** Production Ready ✅
