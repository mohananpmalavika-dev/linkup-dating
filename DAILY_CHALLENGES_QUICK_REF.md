# Daily Challenges Quick Reference

## 🎯 Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| Backend Models | ✅ Complete | `backend/models/` |
| Backend Service | ✅ Complete | `backend/services/challengeService.js` |
| API Routes | ✅ Complete | `backend/routes/challenges.js` |
| Database Migration | ✅ Complete | `backend/migrations/20260428_daily_challenges.sql` |
| Frontend Hook | ✅ Complete | `src/hooks/useDailyChallenges.js` |
| Widget Component | ✅ Complete | `src/components/DailyChallengesWidget.jsx` |
| Modal Component | ✅ Complete | `src/components/DailyChallengesModal.jsx` |
| Styles (Widget) | ✅ Complete | `src/styles/DailyChallengesWidget.css` |
| Styles (Modal) | ✅ Complete | `src/styles/DailyChallengesModal.css` |
| Documentation | ✅ Complete | `DAILY_CHALLENGES_GUIDE.md` |

## 📋 Files Created

### Backend
```
backend/models/DailyChallenge.js                    (96 lines)
backend/models/UserDailyChallenge.js                (84 lines)
backend/models/DiscoveryBoostPoints.js              (78 lines)
backend/models/ChallengeRedemption.js               (95 lines)
backend/services/challengeService.js                (400 lines)
backend/routes/challenges.js                        (180 lines)
backend/migrations/20260428_daily_challenges.sql    (180 lines)
```

### Frontend
```
src/hooks/useDailyChallenges.js                     (240 lines)
src/components/DailyChallengesWidget.jsx            (180 lines)
src/components/DailyChallengesModal.jsx             (420 lines)
src/styles/DailyChallengesWidget.css                (390 lines)
src/styles/DailyChallengesModal.css                 (550 lines)
```

### Documentation
```
DAILY_CHALLENGES_GUIDE.md                           (850+ lines)
DAILY_CHALLENGES_QUICK_REF.md                       (This file)
```

## 🚀 Quick Setup

### 1. Run Database Migration
```bash
psql -U postgres -d linkup < backend/migrations/20260428_daily_challenges.sql
```

### 2. Register Routes in Backend
In `backend/server.js`, add after other route registrations:
```javascript
const challengeRoutes = require('./routes/challenges');
app.use('/api/challenges', authenticateToken, challengeRoutes);
```

### 3. Add Widget to Frontend
In your main dashboard component:
```javascript
import DailyChallengesWidget from '../components/DailyChallengesWidget';

// Add to render:
<DailyChallengesWidget onClose={() => setShowWidget(false)} />
```

## 💡 Key Features

### Daily Challenges Schedule
```
MONDAY:     "Update 1 new photo"           → 50 points
WEDNESDAY:  "Answer 5 profile prompts"     → 25 points  
FRIDAY:     "Schedule a video call"        → 100 points
─────────────────────────────────────────────────────
Weekly Total:                                175 points
```

### Reward Redemption Rates
```
Premium Access:
  • 1 Week   → 100 points
  • 1 Month  → 300 points

Premium Features:
  • 5 Super Likes → 50 points
  • 1 Boost       → 75 points
  • 1 Rewind      → 60 points
  • 1 Spotlight   → 150 points
```

### Earning Rate
```
Dedicated User (All Challenges):  175 pts/week = ~25 pts/day
Regular User (2 of 3):            125 pts/week = ~18 pts/day
Casual User (1 of 3):              50 pts/week = ~7 pts/day

To Earn 1 Month Premium (300 pts):
  • Dedicated: ~2 weeks
  • Regular: ~2.4 weeks
  • Casual: ~6 weeks
```

## 🔌 API Endpoints

### Public Endpoints
- `GET /api/challenges/leaderboard/weekly` - Get weekly leaderboard

### Authenticated Endpoints
- `GET /api/challenges/today` - Get today's challenges
- `GET /api/challenges/weekly` - Get all weekly challenges
- `POST /api/challenges/:id/progress` - Update challenge progress
- `GET /api/challenges/points/balance` - Get points balance
- `POST /api/challenges/points/redeem` - Redeem points
- `POST /api/challenges/redemptions/:id/apply` - Apply reward
- `GET /api/challenges/redemptions/history` - Get redemption history

## 🎨 Component Usage

### Widget (Compact View)
```jsx
import DailyChallengesWidget from './components/DailyChallengesWidget';

<DailyChallengesWidget onClose={() => setShowWidget(false)} />
```

**Displays:**
- 3 daily challenges with progress
- Completion percentage
- Points balance
- Mini leaderboard (top 3)
- "View All" button to open full modal

### Modal (Full View)
```jsx
import DailyChallengesModal from './components/DailyChallengesModal';

const [showModal, setShowModal] = useState(false);

<DailyChallengesModal 
  isOpen={showModal}
  onClose={() => setShowModal(false)}
/>
```

**Tabs:**
1. **Today** - Today's 3 challenges with progress bars
2. **Weekly** - All 7-day challenges organized by day
3. **Rewards** - Redemption options with balance display
4. **History** - Past redemptions with status

### Hook (State Management)
```jsx
import useDailyChallenges from '../hooks/useDailyChallenges';

const {
  todayChallenges,        // Today's 3 challenges
  weeklyChallenges,       // All 7 challenges by day
  pointsBalance,          // { totalPoints, availablePoints, weeklyPoints, monthlyStreak }
  leaderboard,            // Top 20 earners
  redemptionHistory,      // Past redemptions
  loading,                // Loading state
  updateProgress,         // Function: (challengeId, increment) -> Promise
  redeemPoints,           // Function: (points, type, value) -> Promise
  applyRedemption,        // Function: (redemptionId) -> Promise
  fetchPointsBalance,     // Function: () -> Promise
  refetch                 // Function: () -> Promise (refresh all)
} = useDailyChallenges();
```

## 🔄 Challenge Flow

### User Completes Challenge
```
1. User takes action (upload photo, answer prompt, schedule call)
2. Frontend calls updateProgress(challengeId, 1)
3. Backend increments progressCount
4. If progressCount >= targetCount:
   a. Mark isCompleted = true
   b. Set completedAt = now
   c. Call awardPoints(userId, rewardPoints)
5. Points added to totalPoints
6. Frontend shows celebration animation
7. "View All & Redeem" button appears
```

### User Redeems Points
```
1. Opens Rewards tab in modal
2. Selects reward (e.g., 1 Week Premium, 100 points)
3. Clicks "Redeem" button
4. Frontend calls redeemPoints(100, 'premium_week', '1 week premium')
5. Backend checks pointsBalance >= 100
6. Creates ChallengeRedemption record with status='pending'
7. Updates pointsUsed += 100
8. Returns redemption with ID
9. Admin/system calls applyRedemption(redemptionId)
10. Premium days added to UserRewardBalance
11. User can now use premium features
```

### Viewing Leaderboard
```
1. Widget shows top 3 earners this week
2. Modal Rewards tab shows mini leaderboard
3. Get full leaderboard from /api/challenges/leaderboard/weekly
4. Endpoint returns top 20 users ranked by weeklyPoints
5. Rankings reset every Monday
```

## 📊 Database Schema

### daily_challenges
```sql
id | challenge_code | name | type | day_of_week | target_count | reward_points | is_active
```

### user_daily_challenges
```sql
id | user_id | daily_challenge_id | challenge_date | progress_count | is_completed | points_earned | completed_at
```

### discovery_boost_points
```sql
id | user_id | total_points | points_used | weekly_points | monthly_streak | last_challenge_date
```

### challenge_redemptions
```sql
id | user_id | points_redeemed | reward_type | reward_value | status | applied_at | expires_at
```

## 🧪 Testing Scenarios

### Scenario 1: Complete Monday Challenge
```
1. Navigate to Daily Challenges
2. See "Update 1 new photo" challenge for Monday
3. Upload a new photo via profile
4. Frontend calls updateProgress(challengeId, 1)
5. Challenge shows as completed ✓
6. +50 points added to balance
7. Celebration animation shows
```

### Scenario 2: Complete All Challenges
```
1. Complete Monday challenge (+50)
2. Complete Wednesday challenge (+25)
3. Complete Friday challenge (+100)
4. Total: 175 points earned for week
5. See "175 points" in points balance
6. Can now redeem for 1 Week Premium (100 pts)
7. After redemption: Available = 75 pts
```

### Scenario 3: Redeem for Premium
```
1. Have 150+ available points
2. Open Rewards tab
3. Click "Redeem" on "1 Week Premium" (100 pts)
4. Request sent to backend
5. ChallengeRedemption created with status='pending'
6. Points deducted from available balance
7. Admin approves redemption (applyRedemption)
8. Premium access granted for 7 days
9. Show in Redemption History tab
```

### Scenario 4: Check Leaderboard
```
1. Open modal
2. Go to Rewards tab
3. See top 3 earners:
   - User A: 175 pts
   - User B: 150 pts
   - User C: 125 pts
4. Click "View All" to see full leaderboard
5. See your rank in full leaderboard
```

## ⚙️ Configuration

### Available Challenge Types
```javascript
'update_photo'           // Upload new photo
'answer_prompts'        // Answer profile prompts
'schedule_video_call'   // Schedule video date
'send_message'          // Send message (future)
'complete_profile'      // Complete profile sections (future)
'verify_identity'       // Verify ID (future)
```

### Available Reward Types
```javascript
'premium_week'          // 1 week premium access
'premium_month'         // 1 month premium access
'super_likes'           // 5 super likes
'boost'                 // 1 profile boost
'rewind'                // 1 rewind
'spotlight'             // 1 spotlight listing
'custom'                // Custom reward (admin)
```

### Redemption Statuses
```javascript
'pending'    // Created, awaiting approval
'approved'   // Admin approved
'applied'    // Granted to user
'expired'    // Reward expired
'cancelled'  // Cancelled by admin
```

## 🔐 Security Considerations

1. **Authentication**: All routes require authenticateToken middleware
2. **Authorization**: Users can only access their own challenges/points
3. **Validation**: Server-side validation of point balances before redemption
4. **Rate Limiting**: Apply rate limiting to progress updates (prevent cheating)
5. **Audit Trail**: All redemptions logged in challenge_redemptions table
6. **Admin Review**: Redemptions require admin approval before granting access

## 🚨 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Challenge not completing | Frontend didn't call updateProgress | Add click handler to challenge buttons |
| Points not appearing | Service not called or model issue | Check network tab, verify models loaded |
| Modal blank on open | Hook data not loaded | Check API endpoints, verify token |
| Widget not visible | Component not imported | Add import & render to dashboard |
| Leaderboard empty | No completed challenges this week | Seed test data or wait for users |
| Redemption stuck pending | applyRedemption not called | Admin needs to approve redemptions |

## 📈 Performance Notes

- Widget loads challenges once on mount, then polls
- Modal lazy-loads tab content when selected
- Leaderboard cached for 1 hour server-side
- useEffect dependencies properly configured
- No unnecessary re-renders with useCallback

## 🔄 Integration Checklist

- [ ] Database migration executed
- [ ] Models auto-loaded (verify in db connection log)
- [ ] Routes registered in server.js
- [ ] Widget imported in dashboard
- [ ] Modal imported in navigation
- [ ] Hook available in components
- [ ] API endpoints accessible (test with Postman)
- [ ] Styles loading correctly (check DevTools)
- [ ] Build passes without errors
- [ ] Navigation button added to open challenges
- [ ] Test complete challenge flow end-to-end
- [ ] Test redemption workflow
- [ ] Verify leaderboard updates
- [ ] Check mobile responsiveness

## 📞 Support

For issues or questions:
1. Check DAILY_CHALLENGES_GUIDE.md for detailed info
2. Review API response formats in routes file
3. Check browser console for client-side errors
4. Check server logs for API errors
5. Verify database connection and tables exist
