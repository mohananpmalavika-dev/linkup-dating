# Achievement & Badge System Implementation Guide

## Overview

The Achievement & Badge System is a comprehensive gamification feature that rewards user engagement with profile badges and community-based leaderboards. Users earn badges through various interactions, and can be ranked on community leaderboards.

## Features

### 1. Profile Badges

Users can earn the following badges:

- **🎯 Conversation Master** - 50+ message exchanges
- **📸 Photo Verified** - Complete ID verification
- **🎬 Video Confident** - 5+ video calls scheduled
- **🔥 Hot Profile** - Top 10% liked profiles
- **💬 Communicator** - Reply within 1 hour average
- **👑 Interaction King** - 100+ message reactions received
- **💘 First Match** - Make your first match
- **🦋 Social Butterfly** - 10+ different matches
- **📅 Date Setter** - Schedule 3+ dates
- **💑 Relationship Ready** - Complete profile with relationship goal

### 2. Leaderboards

#### Monthly Most Active (per City/Interest)
- Ranks users by monthly activity score
- Filters by city and/or interest
- Resets monthly with previous scores archived
- Encourages consistent engagement

#### Best Conversation Starters (Voted)
- Users can vote for conversation starters they think are great
- Votes are transparent and shareable
- Monthly rankings visible to community
- Builds social recognition

## Implementation Structure

### Backend Services

#### `achievementService.js` (365 lines)
- **Methods:**
  - `checkConversationMaster(userId)` - Check 50+ messages
  - `checkPhotoVerified(userId)` - Verify ID verification status
  - `checkVideoConfident(userId)` - Count video calls
  - `checkHotProfile(userId)` - Top 10% like analysis
  - `checkCommunicator(userId)` - Average reply time check
  - `checkInteractionKing(userId)` - Reaction count analysis
  - `checkAndUnlockAchievements(userId)` - Auto-unlock all eligible
  - `getUserAchievements(userId)` - Get user's earned badges
  - `featureAchievement(userId, achievementId)` - Feature a badge on profile
  - `getProfileBadges(userId)` - Get display-ready badges
  - `calculateEngagementMetrics(userId)` - Get achievement progress

#### `leaderboardService.js` (420 lines)
- **Methods:**
  - `updateMonthlyLeaderboards()` - Refresh rankings monthly
  - `getCityLeaderboard(city, limit)` - Get city rankings
  - `getInterestLeaderboard(interest, limit)` - Get interest rankings
  - `getConversationStartersLeaderboard(limit)` - Top voted starters
  - `voteConversationStarter(voterId, targetUserId)` - Record vote
  - `unvoteConversationStarter(voterId, targetUserId)` - Remove vote
  - `getUserLeaderboardPositions(userId)` - Get user's ranks
  - `archiveLeaderboard()` - Archive previous month

### Backend Routes

**File:** `backend/routes/achievements.js`

- `GET /api/achievements/check` - Check and unlock achievements
- `GET /api/achievements/user/:userId` - Get user's achievements
- `POST /api/achievements/feature/:achievementId` - Feature a badge
- `GET /api/achievements/definitions` - List all achievements
- `GET /api/leaderboards/city/:city` - Get city leaderboard
- `GET /api/leaderboards/interest/:interest` - Get interest leaderboard
- `GET /api/leaderboards/conversation-starters` - Get conversation starters leaderboard
- `POST /api/leaderboards/vote-conversation-starter` - Vote for starter
- `GET /api/leaderboards/user/:userId/positions` - Get user's ranks

### Socket.io Handlers

**File:** `backend/sockets/achievementSocketHandlers.js`

**Events Emitted:**
- `achievement:unlocked` - New badge earned
- `leaderboard:rank-updated` - Rank changed
- `leaderboard:new-vote` - Conversation starter voted
- `achievement:milestone` - Progress toward badge
- `achievement:featured` - Badge featured on profile
- `leaderboard:refreshed` - Rankings updated

### Frontend Components

#### BadgeDisplay.jsx
```jsx
import BadgeDisplay from './components/BadgeDisplay';

<BadgeDisplay userId={userId} maxBadges={6} compact={false} />
```

Displays user's badges with rarity colors and featured indicator.

#### LeaderboardDisplay.jsx
```jsx
import LeaderboardDisplay from './components/LeaderboardDisplay';

<LeaderboardDisplay type="most_active" city="NYC" />
<LeaderboardDisplay type="conversation_starters" />
```

Shows ranked leaderboards with filtering options.

#### AchievementNotification.jsx
```jsx
import AchievementNotification from './components/AchievementNotification';
import useAchievements from './hooks/useAchievements';

const { achievementNotification, rankNotification } = useAchievements(userId);

<AchievementNotification notification={achievementNotification} type="achievement" />
<AchievementNotification notification={rankNotification} type="rank" />
```

Toast notifications for achievement unlocks and rank changes.

### Custom Hook

#### useAchievements.js
```jsx
import useAchievements from './hooks/useAchievements';

const {
  unlockedAchievements,
  leaderboardRanks,
  achievementNotification,
  checkAndUnlockAchievements,
  featureAchievement,
  getUserRank,
  voteForConversationStarter,
  getAchievementProgress
} = useAchievements(userId);
```

## Database Schema

### Tables Created

1. **achievements** - Master list of all badge definitions
2. **user_achievements** - Join table for user's earned badges
3. **leaderboards** - Monthly rankings by city/interest
4. **conversation_starter_votes** - Vote tracking

### Indexes
- Full indexing on user_id, achievement_id, leaderboard type, city, interest, month
- Composite indexes for common queries
- B-tree indexes for ranking performance

## Integration Steps

### 1. Run Migration
```bash
psql -U postgres -d linkup < backend/migrations/20260428_create_achievements_and_leaderboards.sql
```

### 2. Add to App.js
```jsx
import AchievementNotification from './components/AchievementNotification';
import useAchievements from './hooks/useAchievements';

function App() {
  const user = getStoredUserData();
  const { achievementNotification, rankNotification } = useAchievements(user?.id);

  return (
    <div className="App">
      {/* ... existing content ... */}
      <AchievementNotification notification={achievementNotification} type="achievement" />
      <AchievementNotification notification={rankNotification} type="rank" />
    </div>
  );
}
```

### 3. Add to User Profile
```jsx
import BadgeDisplay from './components/BadgeDisplay';

function UserProfile({ userId }) {
  return (
    <div className="profile">
      {/* ... existing profile content ... */}
      <BadgeDisplay userId={userId} maxBadges={9} />
    </div>
  );
}
```

### 4. Add Leaderboard Page
```jsx
import LeaderboardDisplay from './components/LeaderboardDisplay';

function LeaderboardPage() {
  return (
    <div className="page-content">
      <LeaderboardDisplay type="most_active" />
      <LeaderboardDisplay type="conversation_starters" />
    </div>
  );
}
```

### 5. Setup Socket Handlers
```javascript
// In socket connection setup
const handleAchievementSocketEvents = require('../sockets/achievementSocketHandlers');

io.on('connection', (socket) => {
  const socketHandlers = handleAchievementSocketEvents(socket, socket.user.id);
  
  socket.on('achievement:check', () => {
    socketHandlers.checkAchievements();
  });

  socket.on('leaderboard:fetch', (data) => {
    socketHandlers.fetchLeaderboard(data.type, data.filters);
  });
});
```

## Real-Time Flow

1. **User sends message** → Message saved to database
2. **Achievement check triggered** → Service evaluates badge criteria
3. **Badge unlocked** → UserAchievement record created
4. **Socket event emitted** → All connected clients notified
5. **Frontend notification** → Toast shows achievement
6. **Browser notification** → Optional system notification
7. **Leaderboard update** → Monthly rankings recalculated

## Engagement Metrics

The system tracks:
- Message count & frequency
- Video call participation
- Profile completion
- Verification status
- Like percentile
- Reply time average
- Reaction engagement
- Date count

## Future Enhancements

1. **Achievement Streaks** - Bonus for consecutive daily activity
2. **Badge Collections** - Special rewards for earning multiple related badges
3. **Seasonal Badges** - Time-limited achievements
4. **Team Achievements** - Group-based badges
5. **Achievement Trading** - Allow badge customization
6. **Community Challenges** - Collaborative achievement goals

## Performance Notes

- Leaderboard updates are monthly (batch processed)
- Achievement checks run on message/interaction events
- Materialized view pattern used for current leaderboards
- Indexes optimized for rank queries
- Socket events throttled to prevent abuse

## Troubleshooting

### Achievement not unlocking
- Check `achievementService.checkAndUnlockAchievements()` logs
- Verify requirement values match badge criteria
- Ensure achievement is marked `is_active = true`

### Leaderboard not updating
- Verify monthly update job is running
- Check `leaderboardService.updateMonthlyLeaderboards()` execution
- Ensure sufficient data exists for rankings

### Socket events not firing
- Verify socket connection established
- Check `achievementSocketHandlers.js` is registered
- Ensure user has permission for events

## Security Considerations

- All achievements verified server-side
- Votes tracked per user to prevent fraud
- Leaderboard rankings use aggregated data
- Socket events require authentication
- Rate limiting on achievement checks
