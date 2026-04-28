# 🎁 Referral Program - Quick Reference Guide

## What Was Built

### ✅ Completed Components (8 Total)

**Backend Infrastructure:**
1. ✅ Referral.js - Model for referral relationships
2. ✅ ReferralReward.js - Model for individual rewards
3. ✅ Migration files - Database tables and indexes
4. ✅ referralService.js - 8 core business logic methods
5. ✅ referrals.js routes - 7 API endpoints
6. ✅ server.js - Route registration

**Frontend Components:**
7. ✅ ReferralDashboard.js - Main dashboard (stats, leaderboard, history)
8. ✅ ReferralShareModal.js - Social sharing modal
9. ✅ ReferralRedeemModal.js - Code entry/redemption
10. ✅ ReferralInviteModal.js - Friend invitation interface
11. ✅ ReferralLeaderboard.js - Dedicated leaderboard view
12. ✅ ReferralRewardsCenter.js - Rewards management
13. ✅ referralService.js - Frontend API wrapper

**Styling (5 CSS Files):**
14. ✅ ReferralDashboard.css
15. ✅ ReferralRedeemModal.css
16. ✅ ReferralLeaderboard.css
17. ✅ ReferralInviteModal.css
18. ✅ ReferralRewardsCenter.css

**Documentation:**
19. ✅ SOCIAL_REFERRAL_PROGRAM_GUIDE.md - Complete implementation guide
20. ✅ REFERRAL_PROGRAM_QUICK_REF.md - This file

---

## Quick Implementation Map

### File Locations

**Models:**
- `backend/models/Referral.js`
- `backend/models/ReferralReward.js`

**Services:**
- `backend/services/referralService.js`
- `src/services/referralService.js`

**Routes:**
- `backend/routes/referrals.js`

**Components:**
- `src/components/ReferralDashboard.js`
- `src/components/ReferralShareModal.js`
- `src/components/ReferralRedeemModal.js`
- `src/components/ReferralInviteModal.js`
- `src/components/ReferralLeaderboard.js`
- `src/components/ReferralRewardsCenter.js`

**Styles:**
- `src/styles/ReferralDashboard.css`
- `src/styles/ReferralRedeemModal.css`
- `src/styles/ReferralLeaderboard.css`
- `src/styles/ReferralInviteModal.css`
- `src/styles/ReferralRewardsCenter.css`
- `src/styles/ReferralShareModal.css` (existing)

---

## API Endpoints Quick Reference

### Authentication Required ✓

```
GET  /api/referrals/code              → Get/create referral code
GET  /api/referrals/stats             → Get referral statistics
POST /api/referrals/redeem            → Redeem referral code
GET  /api/referrals/history           → Get referral history
GET  /api/referrals/leaderboard       → Get leaderboard
GET  /api/referrals/rewards           → Get all rewards
```

### No Authentication ✗

```
GET  /api/referrals/validate/:code    → Validate code (no auth)
```

---

## Component Usage Examples

### ReferralDashboard
```jsx
import ReferralDashboard from './components/ReferralDashboard';

<ReferralDashboard 
  onOpenShareModal={() => setShareModalOpen(true)}
  onOpenRedeemModal={() => setRedeemModalOpen(true)}
/>
```

### ReferralRedeemModal
```jsx
import ReferralRedeemModal from './components/ReferralRedeemModal';

<ReferralRedeemModal
  isOpen={isRedeemOpen}
  onClose={() => setRedeemOpen(false)}
  onSuccess={() => alert('Code redeemed!')}
/>
```

### ReferralInviteModal
```jsx
import ReferralInviteModal from './components/ReferralInviteModal';

<ReferralInviteModal
  isOpen={isInviteOpen}
  onClose={() => setInviteOpen(false)}
  onSuccess={() => loadStats()}
/>
```

### ReferralLeaderboard
```jsx
import ReferralLeaderboard from './components/ReferralLeaderboard';

<ReferralLeaderboard
  limit={10}
  onClose={() => setLeaderboardOpen(false)}
/>
```

### ReferralRewardsCenter
```jsx
import ReferralRewardsCenter from './components/ReferralRewardsCenter';

<ReferralRewardsCenter
  onClose={() => setRewardsCenterOpen(false)}
/>
```

---

## Service Methods Quick Reference

### Backend Service (referralService)

```javascript
const ReferralService = require('./services/referralService');

// Generate code
const code = ReferralService.generateReferralCode(userId);

// Get/create code
const result = await ReferralService.getOrCreateReferralCode(userId);
// { success, code, link, expiresAt }

// Submit referral code
const result = await ReferralService.submitReferralCode(userId, code);
// { success, message }

// Award bonuses
const result = await ReferralService.awardReferralBonuses(referrerId, referredId);
// { success, rewards }

// Get stats
const stats = await ReferralService.getReferralStats(userId);
// { totalFriendsInvited, friendsCompleted, totalRewardsEarned, ... }

// Get leaderboard
const lb = await ReferralService.getLeaderboard(10, 'all-time');
// { success, data: [...], userRank: {...} }

// Get history
const history = await ReferralService.getReferralHistory(userId, 20, 0);
// { success, data: [...], total: 42 }

// Validate code
const valid = await ReferralService.validateReferralCode(code);
// { success, valid, referrerName, rewardOffer, ... }
```

### Frontend Service (referralService)

```javascript
import { referralService } from '../services/referralService';

// Get/create code
const data = await referralService.getReferralCode();
// { success, code, link }

// Get stats
const stats = await referralService.getReferralStats();
// { success, stats: {...} }

// Accept/redeem code
const result = await referralService.acceptReferralCode(code);
// { success, rewards: {...} }

// Get history
const history = await referralService.getReferralHistory();
// { success, data: [...] }

// Get leaderboard
const lb = await referralService.getLeaderboard(10, 'all-time');
// { success, data: [...], userRank: {...} }

// Validate code
const valid = await referralService.validateCode(code);
// { success, valid, ... }

// Get all rewards
const rewards = await referralService.getAllRewards();
// { success, data: { pending: [...], claimed: [...], expired: [...] } }

// Get pending rewards
const pending = await referralService.getPendingRewards();
// { success, rewards: [...] }

// Claim reward
const result = await referralService.claimReward(rewardId);
// { success }

// Claim all rewards
const result = await referralService.claimAllRewards();
// { success, count: 5 }

// Send invites
const result = await referralService.sendInvites(friends, 'sms', code);
// { success, sent: 3 }
```

---

## Database Schema Quick Reference

### referrals Table
```sql
id                  BIGINT PRIMARY KEY
referrer_user_id    BIGINT NOT NULL (FK)
referral_code       VARCHAR(20) UNIQUE NOT NULL
referral_link       VARCHAR(500)
referred_user_id    BIGINT (FK, nullable)
status              ENUM('pending', 'completed', 'expired')
reward              JSONB { type, amount }
expires_at          TIMESTAMP
completed_at        TIMESTAMP
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

### referral_rewards Table
```sql
id                  BIGINT PRIMARY KEY
user_id             BIGINT NOT NULL (FK)
referral_id         BIGINT NOT NULL (FK)
reward_type         ENUM('premium_days', 'super_likes', 'coins', 'boost_token')
reward_value        INT NOT NULL
status              ENUM('pending', 'awarded', 'expired', 'redeemed')
awarded_at          TIMESTAMP
expires_at          TIMESTAMP
redeemed_at         TIMESTAMP
notes               TEXT
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

### referral_stats Table
```sql
id                          BIGINT PRIMARY KEY
user_id                     BIGINT NOT NULL (FK, UNIQUE)
total_invited               INT
total_completed             INT
total_rewards_earned        INT
total_premium_days          INT
total_super_likes           INT
last_referral_at            TIMESTAMP
updated_at                  TIMESTAMP
```

---

## Code Generation Examples

### Referral Code Format

```
LINK{userId}{8-hex-chars}

Example:
LINK123a1b2c3d4e5f6g7h
LINK456x8y9z0a1b2c3d4e5f

Breakdown:
- LINK (4 chars)   - Brand identifier
- 123 (3 chars)    - User ID (padded)
- a1b2c3d (8 chars) - Random hex
```

### Referral Link Format

```
https://linkup.dating/?referral=LINK123a1b2c3d4e5f6g7h

Query params:
- referral: The unique code
- utm_source: linkup_referral (optional)
- utm_campaign: referral_bonus (optional)
```

---

## Reward Mechanics

### Reward Distribution

**When User A Invites User B:**

1. User A gets: LINK code
2. User B enters code during signup
3. System validates code
4. **Both receive immediately:**
   - +7 days premium (added to account)
   - +5 superlikes (added to profile)

**Tracking:**

```
Referral Record:
- referrer_user_id: User A's ID
- referred_user_id: User B's ID
- status: completed
- reward: { premiumDays: 7, superLikes: 5 }

ReferralReward Records (2 created):
1. For User A:
   - user_id: User A's ID
   - reward_type: premium_days
   - reward_value: 7
   - status: awarded
   
2. For User B:
   - user_id: User B's ID
   - reward_type: premium_days
   - reward_value: 7
   - status: awarded

Same pattern for superlikes...
```

---

## Status Flow Diagram

```
Referral Status:
pending → completed
   ↓
  expired (after 365 days)

Reward Status:
pending → awarded → redeemed
   ↓              ↓
expired (after 30 days from award)
```

---

## Error Handling

### Common Error Responses

```javascript
// Invalid code format
{ success: false, message: 'Invalid referral code format' }

// Code expired
{ success: false, message: 'This referral code has expired' }

// Code already used
{ success: false, message: 'This code has already been redeemed' }

// Self-referral
{ success: false, message: 'You cannot use your own referral code' }

// Duplicate referral
{ success: false, message: 'You already have an active referral from this user' }

// No authorization
{ success: false, message: 'Unauthorized', status: 401 }

// Not found
{ success: false, message: 'Referral code not found', status: 404 }

// Conflict
{ success: false, message: 'Referral already completed', status: 409 }
```

---

## Testing Scenarios

### Test Case 1: Complete Referral Flow
```
1. User A generates code
2. User A shares code with User B
3. User B signs up with code
4. User B completes profile
5. Both receive rewards
6. Rewards appear in ReferralRewardsCenter
7. User A's stats update
8. Both appear in leaderboard
9. Rewards can be claimed
```

### Test Case 2: Code Validation
```
1. Generate code
2. Validate code immediately (should be valid)
3. Wait 365+ days
4. Validate code (should be expired)
5. Try to redeem expired code (should fail)
```

### Test Case 3: Fraud Prevention
```
1. User A tries to use own code (should fail)
2. User B tries to enter duplicate (should fail)
3. User C enters invalid format (should fail)
4. User D enters non-existent code (should fail)
```

### Test Case 4: Leaderboard
```
1. User A invites 5 friends (all complete)
2. User B invites 3 friends (all complete)
3. User C invites 8 friends (5 complete, 3 pending)
4. User A should rank #2 (5 completed)
5. User C should rank #1 (5 completed, but more total)
6. Verify badges: User C should have "Top Referrer" badge
```

---

## Performance Tips

### Queries to Optimize

1. **Leaderboard Query**
   - Use ReferralStat table (cached)
   - Add index: `(total_completed DESC, user_id)`

2. **User Rewards Query**
   - Use composite index: `(user_id, status, expires_at)`
   - Paginate large result sets

3. **Referral History Query**
   - Use: `(referrer_user_id, created_at DESC)`
   - Paginate: 20-50 records per page

4. **Validation Query**
   - Use: `(referral_code)` UNIQUE index
   - Cache valid codes in Redis (optional)

### Caching Strategy

```javascript
// Cache referral code for 1 hour
redis.setex(`referral:${code}`, 3600, JSON.stringify(validation));

// Cache user stats for 5 minutes
redis.setex(`stats:${userId}`, 300, JSON.stringify(stats));

// Cache leaderboard for 10 minutes
redis.setex(`leaderboard:top10`, 600, JSON.stringify(leaderboard));
```

---

## Mobile Responsiveness

All components are fully responsive:
- **Desktop**: Full layout with all features
- **Tablet**: Adjusted grid layouts, readable text
- **Mobile**: Single column, larger touch targets, optimized for thumb navigation

### Breakpoints Used
- `max-width: 1200px` - Large desktop
- `max-width: 768px` - Tablet
- `max-width: 480px` - Mobile

---

## Next Steps / Optional Enhancements

### High Priority
- [ ] Add email notifications
- [ ] Implement rate limiting
- [ ] Add analytics tracking
- [ ] Create admin dashboard for referral management

### Medium Priority
- [ ] Social account friend import
- [ ] Custom referral messages
- [ ] Referral link analytics
- [ ] QR code generation

### Low Priority
- [ ] Tiered reward system
- [ ] Referral affiliate program
- [ ] A/B testing different messages
- [ ] Advanced segmentation

---

## Troubleshooting

### Build Errors
```
Error: Module not found 'referralService'
Solution: Check imports are using correct path
Example: import { referralService } from '../services/referralService';
```

### API Errors
```
Error: 401 Unauthorized
Solution: Ensure Bearer token is included in request header
```

```
Error: 404 Not Found
Solution: Check route is registered in server.js
Verify: app.use('/api/referrals', authenticateToken, referralsRoutes);
```

### Database Errors
```
Error: Table doesn't exist
Solution: Run migration files
Command: npx sequelize-cli db:migrate
```

### Component Not Rendering
```
Solution 1: Check isOpen prop for modals
Solution 2: Verify CSS file is imported
Solution 3: Check for console errors (F12)
```

---

## Key Metrics to Monitor

After Launch:

1. **Adoption**
   - % of users with referral code
   - # of referral codes generated per day

2. **Engagement**
   - # of codes shared
   - # of times code viewed/clicked
   - Share channel breakdown

3. **Conversion**
   - % of code redemptions
   - % of referrals that complete signup
   - % that complete profile
   - Days to completion

4. **Virality**
   - Viral coefficient (invites per new user)
   - K-factor calculation
   - Referral chain depth

5. **Retention**
   - Referred users retention rate
   - Referrer retention rate
   - Cohort analysis

6. **Revenue**
   - Premium days from referrals
   - LTV of referred users
   - CAC comparison (referrals vs acquisition)

---

## Support Contact

For issues or questions about the Referral Program implementation, refer to `SOCIAL_REFERRAL_PROGRAM_GUIDE.md` for comprehensive documentation.

**Document Version**: 1.0  
**Last Updated**: April 28, 2026  
**Status**: ✅ Production Ready
