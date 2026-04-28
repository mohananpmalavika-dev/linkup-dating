# Daily Challenges Implementation Guide

## Overview
The Daily Challenges system allows users to complete assigned tasks on specific days of the week to earn "Discovery Boost Points" which can be redeemed for premium features.

## Features

### 🎯 Core Challenges (3 per week)
- **Monday**: Update 1 new photo → +50 points
- **Wednesday**: Answer 5 profile prompts → +25 points  
- **Friday**: Schedule a video call → +100 points

### 💰 Points System
- Earn points by completing daily challenges
- Total availability per week: 175 points
- No spending required - earn premium features
- Weekly points reset tracked for leaderboard
- Monthly streak calculation for engagement

### 🏆 Redemption Options
Users can redeem points for:
- 1 Week Premium: 100 points
- 1 Month Premium: 300 points
- 5 Super Likes: 50 points
- 1 Profile Boost: 75 points
- 1 Rewind: 60 points
- 1 Spotlight: 150 points

### 📊 Leaderboard
- Weekly rankings based on points earned
- Top 20 users displayed
- Resets every Monday
- Mini-leaderboard in widget shows top 3

## Backend Architecture

### Models

#### DailyChallenge
Defines available challenges with schedule:
```javascript
{
  id: integer,
  challengeCode: "UPDATE_PHOTO_MON",
  name: "Update 1 new photo",
  type: "update_photo",
  dayOfWeek: "monday",
  targetCount: 1,
  rewardPoints: 50,
  icon: "📸",
  isActive: true,
  order: 1
}
```

#### UserDailyChallenge
Tracks user progress on challenges:
```javascript
{
  id: integer,
  userId: integer,
  dailyChallengeId: integer,
  challengeDate: "2026-04-28",
  progressCount: 0-5,
  isCompleted: boolean,
  completedAt: timestamp,
  pointsEarned: integer,
  claimedRewardAt: timestamp
}
```

#### DiscoveryBoostPoints
Tracks user's point balance:
```javascript
{
  id: integer,
  userId: integer (unique),
  totalPoints: integer,
  pointsUsed: integer,
  availablePoints: virtual (totalPoints - pointsUsed),
  weeklyPoints: integer,
  monthlyStreak: integer,
  lastChallengeDate: date
}
```

#### ChallengeRedemption
Records point redemptions:
```javascript
{
  id: integer,
  userId: integer,
  pointsRedeemed: integer,
  rewardType: enum[premium_week, premium_month, super_likes, boost, rewind, spotlight],
  rewardValue: string,
  status: enum[pending, approved, applied, expired],
  appliedAt: timestamp,
  expiresAt: timestamp
}
```

### Services

#### challengeService.js

**getTodayChallenges(userId)**
- Gets all active challenges for today
- Includes user's progress on each
- Returns with completion status

**getWeeklyChallenges(userId)**
- Gets all challenges grouped by day
- Shows progress for current week
- Returns organized by day_of_week

**updateChallengeProgress(userId, dailyChallengeId, increment)**
- Increments progress counter
- Auto-completes when target reached
- Awards points immediately on completion
- Returns updated progress object

**awardPoints(userId, points, dailyChallengeId)**
- Adds points to total balance
- Updates weekly points
- Resets weekly points if new week detected
- Increments monthly streak

**redeemPoints(userId, pointsToRedeem, rewardType, rewardValue)**
- Validates sufficient balance
- Creates ChallengeRedemption record
- Marks points as "used"
- Returns redemption object

**applyRedemption(redemptionId)**
- Approves pending redemption
- Grants reward to user account
- Updates UserRewardBalance with premium days/credits
- Changes status to "applied"

**getWeeklyLeaderboard(limit)**
- Returns top N users by weekly_points
- Includes user profile info
- Used for rankings display

### API Routes (`/backend/routes/challenges.js`)

#### GET /api/challenges/today
Get today's challenges for authenticated user
```javascript
Response: {
  success: boolean,
  challenges: [
    {
      id: 1,
      name: "Update 1 new photo",
      icon: "📸",
      targetCount: 1,
      rewardPoints: 50,
      progressCount: 0,
      isCompleted: false,
      progress: { ... }
    }
  ]
}
```

#### GET /api/challenges/weekly
Get all weekly challenges grouped by day
```javascript
Response: {
  success: boolean,
  challenges: {
    monday: [ ... ],
    tuesday: [ ... ],
    ...
  }
}
```

#### POST /api/challenges/:challengeId/progress
Update progress on a challenge
```javascript
Request: {
  increment: 1 // default
}

Response: {
  success: boolean,
  progress: { ... },
  completed: boolean,
  pointsEarned: integer
}
```

#### GET /api/challenges/points/balance
Get user's current points balance
```javascript
Response: {
  success: boolean,
  totalPoints: 175,
  availablePoints: 150,
  weeklyPoints: 75,
  monthlyStreak: 4
}
```

#### POST /api/challenges/points/redeem
Redeem points for premium feature
```javascript
Request: {
  pointsToRedeem: 100,
  rewardType: "premium_week",
  rewardValue: "1 week premium"
}

Response: {
  success: boolean,
  redemption: { id, status: "pending", ... }
}
```

#### GET /api/challenges/redemptions/history
Get user's redemption history
```javascript
Response: {
  success: boolean,
  history: [
    {
      id: 1,
      pointsRedeemed: 100,
      rewardType: "premium_week",
      rewardValue: "1 week premium",
      status: "applied",
      appliedAt: timestamp,
      createdAt: timestamp
    }
  ]
}
```

#### GET /api/challenges/leaderboard/weekly
Get weekly point leaderboard
```javascript
Response: {
  success: boolean,
  leaderboard: [
    {
      rank: 1,
      weeklyPoints: 175,
      User: { id, firstName, profilePhotoUrl }
    }
  ]
}
```

## Frontend Components

### DailyChallengesWidget.jsx
Compact widget showing:
- Today's challenges (3)
- Completion progress bar
- Quick action buttons
- Points balance
- Mini leaderboard (top 3)

**Props:**
- `onClose` (optional): Callback when widget closes

**Features:**
- Real-time progress updates
- Inline celebration animation
- Quick actions for challenge progression
- Link to full modal view

### DailyChallengesModal.jsx
Full-screen modal with tabs:

**Tab 1: Today** - Today's 3 challenges with detailed views

**Tab 2: This Week** - All 7 daily challenges organized by day

**Tab 3: Rewards** - Point balance and redemption options with grid of 6 reward types

**Tab 4: History** - Redemption history with status tracking

**Features:**
- Real-time progress updates
- One-click redemption
- Animated success messages
- Responsive grid layout
- Status indicators

### useDailyChallenges Hook
State management hook providing:
- `todayChallenges` - Array of today's challenges
- `weeklyChallenges` - Object organized by day
- `pointsBalance` - Current point balance object
- `leaderboard` - Array of top earners
- `redemptionHistory` - User's past redemptions
- `loading` - Loading state
- `error` - Error messages

**Methods:**
- `updateProgress(challengeId, increment)` - Increment challenge progress
- `redeemPoints(points, type, value)` - Redeem points for reward
- `applyRedemption(redemptionId)` - Apply pending redemption
- `fetchPointsBalance()` - Refresh points
- `fetchRedemptionHistory()` - Refresh history
- `fetchLeaderboard()` - Refresh leaderboard
- `refetch()` - Refresh all data

## Integration Steps

### 1. Database Setup
```bash
psql -U postgres -d linkup < backend/migrations/20260428_daily_challenges.sql
```

This creates:
- `daily_challenges` table
- `user_daily_challenges` table
- `discovery_boost_points` table
- `challenge_redemptions` table
- Indexes and views
- Initial seed data for 3 challenges

### 2. Model Registration
Add to `backend/models/index.js`:
```javascript
const DailyChallenge = require('./DailyChallenge')(sequelize, DataTypes);
const UserDailyChallenge = require('./UserDailyChallenge')(sequelize, DataTypes);
const DiscoveryBoostPoints = require('./DiscoveryBoostPoints')(sequelize, DataTypes);
const ChallengeRedemption = require('./ChallengeRedemption')(sequelize, DataTypes);
```

### 3. Service Registration
Add to `backend/server.js`:
```javascript
const challengeRoutes = require('./routes/challenges');
app.use('/api/challenges', authenticateToken, challengeRoutes);
```

### 4. Frontend Integration
Add widget to main dashboard:
```javascript
import DailyChallengesWidget from './components/DailyChallengesWidget';

// In component render:
<DailyChallengesWidget onClose={handleClose} />
```

Or add modal to navigation:
```javascript
const [showChallenges, setShowChallenges] = useState(false);

<button onClick={() => setShowChallenges(true)}>
  🎯 Challenges
</button>

{showChallenges && (
  <DailyChallengesModal 
    isOpen={true}
    onClose={() => setShowChallenges(false)}
  />
)}
```

## Usage Examples

### For Users

**Earning Points:**
1. Open Daily Challenges widget
2. Click "Start" on any challenge
3. Complete the required action (update photo, answer prompts, etc.)
4. View real-time progress updates
5. Get celebration notification when complete
6. Points added automatically to balance

**Redeeming Points:**
1. Open Challenges Modal
2. Go to "Rewards" tab
3. Select a reward type (Premium, Super Likes, etc.)
4. Click "Redeem"
5. Points deducted, reward granted
6. View in redemption history

**Checking Leaderboard:**
- View mini-leaderboard in widget (top 3)
- View full leaderboard in modal "Rewards" tab
- Weekly rankings reset every Monday

### For Developers

**Tracking Challenge Completion:**
```javascript
import challengeService from '../services/challengeService';

// When user completes action
const result = await challengeService.updateChallengeProgress(
  userId,
  dailyChallengeId,
  1
);

if (result.isCompleted) {
  // Challenge completed!
  console.log(`Earned ${result.pointsEarned} points`);
}
```

**Getting User's Points:**
```javascript
const balance = await challengeService.getUserPointsBalance(userId);
console.log(`Available: ${balance.totalPoints - balance.pointsUsed}`);
```

**Processing Redemption:**
```javascript
// User initiates redemption
const redemption = await challengeService.redeemPoints(
  userId,
  100,
  'premium_week',
  '1 week premium'
);

// Admin/system applies redemption
await challengeService.applyRedemption(redemption.id);
```

## Performance Optimizations

1. **Caching**: Weekly leaderboard cached for 1 hour
2. **Indexes**: Multiple indexes on user_id, challenge_date, status
3. **Virtual Fields**: availablePoints calculated on read, not stored
4. **Lazy Loading**: Modal tabs load data only when selected
5. **Pagination**: History limited to last 20 by default

## Future Enhancements

### Tier 2 Features
- Seasonal challenges (limited time events)
- Challenge multipliers (2x points on weekends)
- Team challenges (group earning)
- Custom challenges (user-created)
- Challenge streaks with bonus multipliers

### Tier 3 Features
- AI-suggested personalized challenges
- Gamification badges/achievements
- Social sharing of achievements
- Challenge notifications
- Push notifications at optimal times

### Tier 4 Features
- Machine learning to predict optimal reward types
- Dynamic challenge difficulty adjustment
- Cross-game integration
- Marketplace for point trading
- Challenge subscription/passes

## Troubleshooting

### Challenge not completing
- Check `progressCount` is incrementing
- Verify `targetCount` matches challenge definition
- Ensure challenge date is today's date

### Points not appearing
- Check `awardPoints` was called after completion
- Verify `DiscoveryBoostPoints` record exists for user
- Check `pointsUsed` is not exceeding total

### Redemption not applying
- Check status is "pending" before applying
- Verify user has sufficient points
- Check `UserRewardBalance` has correct model relationship

### Leaderboard not updating
- Verify `weeklyPoints` is being updated
- Check weekly reset logic (new week detection)
- Ensure leaderboard query includes completed challenges

## Database Queries

### Get all challenges for user in current week:
```sql
SELECT dc.*, udc.progress_count, udc.is_completed
FROM daily_challenges dc
LEFT JOIN user_daily_challenges udc ON udc.daily_challenge_id = dc.id 
  AND udc.user_id = ? 
  AND udc.challenge_date >= DATE_SUB(CURDATE(), INTERVAL DAYOFWEEK(CURDATE())-1 DAY)
WHERE dc.is_active = true
ORDER BY FIELD(dc.day_of_week, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
```

### Get weekly leaderboard:
```sql
SELECT u.id, u.first_name, u.profile_photo_url, dbp.weekly_points
FROM users u
JOIN discovery_boost_points dbp ON dbp.user_id = u.id
WHERE dbp.last_week_reset_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY dbp.weekly_points DESC
LIMIT 20
```

### Reset weekly points:
```sql
UPDATE discovery_boost_points
SET weekly_points = 0, last_week_reset_at = NOW()
WHERE last_week_reset_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
```

## Testing Checklist

- [ ] Challenge progress increments correctly
- [ ] Challenge completion triggers point award
- [ ] Points balance reflects in UI
- [ ] Can redeem points for all reward types
- [ ] Redemption history shows correct entries
- [ ] Weekly leaderboard updates correctly
- [ ] Weekly reset happens at correct time
- [ ] Modal tabs load independently
- [ ] Widget displays in main view
- [ ] Mobile responsive on all screen sizes
- [ ] API endpoints return correct response format
- [ ] Error handling for edge cases
