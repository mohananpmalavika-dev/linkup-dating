# 🎁 Social Referral Program - Complete Implementation Guide

## Overview

The Social Referral Program enables users to invite friends to DatingHub and earn premium rewards for both the referrer and referred user. This creates a viral growth mechanism with leaderboards, social sharing, and comprehensive tracking.

**Key Benefits:**
- 💎 Both parties receive: +7 days premium, +5 superlikes
- 📊 Real-time tracking of referral stats and earnings
- 🏆 Leaderboard system for viral growth
- 📱 Multi-channel sharing (WhatsApp, SMS, Email, Instagram, LinkedIn, Facebook)
- 🎁 Comprehensive rewards management system
- 💰 Atomic reward distribution for consistency

---

## System Architecture

### Database Layer (Backend/Models)

#### 1. **Referral Model** (`backend/models/Referral.js`)
- **Purpose**: Represents the referral relationship between two users
- **Key Fields**:
  - `referrer_user_id` - User initiating the referral
  - `referral_code` - Unique code (format: LINK{userId}{8hexChars})
  - `referral_link` - Full shareable link with code
  - `referred_user_id` - User who used the code
  - `status` - Enum: pending, completed, expired
  - `reward` - JSONB object with reward details
  - `expires_at` - 365 days from creation

**Indexes:**
```
- referrer_user_id (for user's referrals)
- referral_code (unique, for code lookup)
- referred_user_id (for reverse lookup)
- status (for filtering)
```

#### 2. **ReferralReward Model** (`backend/models/ReferralReward.js`)
- **Purpose**: Tracks individual rewards distributed from referrals
- **Key Fields**:
  - `user_id` - User receiving the reward
  - `referral_id` - Which referral this reward comes from
  - `reward_type` - Enum: premium_days, super_likes, coins, boost_token
  - `reward_value` - Integer amount (7 for premium days, 5 for superlikes)
  - `status` - Enum: pending, awarded, expired, redeemed
  - `awarded_at` - When the reward was given
  - `expires_at` - 30 days from award
  - `redeemed_at` - When user claimed it

**Indexes:**
```
- user_id (for user's rewards)
- referral_id (for referral's rewards)
- status, expires_at (for queries)
```

#### 3. **ReferralStat Model** (Migration File)
- **Purpose**: Caches referral stats for dashboard performance
- **Key Fields**:
  - `user_id` - User being tracked
  - `total_invited` - Total referrals sent
  - `total_completed` - Referrals that converted
  - `total_rewards_earned` - Sum of all rewards
  - `total_premium_days` - Cumulative premium days
  - `total_super_likes` - Cumulative superlikes
  - `last_referral_at` - Most recent referral date

---

## Service Layer (Backend/Services)

### ReferralService Methods

#### 1. **getOrCreateReferralCode(userId)**
```javascript
// Generates unique code for user or retrieves existing
Result: { success, code, link, expiresAt }

Code Format: LINK{userId}{8-hex-random}
Example: LINK123abc4d5e6f7g8h
Link Format: https://datinghub.app/?referral=LINK123abc4d5e6f7g8h
```

#### 2. **submitReferralCode(userId, referralCode)**
```javascript
// User enters referral code during signup or later
// Validates code exists, not expired
// Creates referral relationship
// Triggers reward distribution
Result: { success, rewards }

Validations:
- Code exists in database
- Code not expired
- User not self-referring
- No duplicate referrals between pair
```

#### 3. **awardReferralBonuses(referrerId, referredId)**
```javascript
// Distributes rewards atomically
// Uses database transaction
// Updates both users

Referrer receives:
- 7 premium days
- 5 superlikes

Referred receives:
- 7 premium days
- 5 superlikes

Creates ReferralReward records for tracking
Updates ReferralStat cache
Updates Referral status to 'completed'
```

#### 4. **getReferralStats(userId)**
```javascript
Result: {
  totalFriendsInvited: 10,        // pending + completed
  friendsCompleted: 7,             // converted friends
  totalRewardsEarned: {
    premiumDays: 49,               // 7 * 7 referrals
    superlikes: 35                 // 5 * 7 referrals
  },
  leaderboardRank: 23,             // if in top 100
  nextMilestone: 10               // invites to next badge
}
```

#### 5. **getLeaderboard(limit, timeframe)**
```javascript
// Top referrers by conversion count
// Supports timeframe filters: all-time, month, week

Result: {
  data: [
    {
      id: userId,
      name, email, profilePicture, location,
      totalInvited: 50,
      totalCompleted: 45,
      totalRewardsEarned: 315,        // points
      badge: { emoji, name, description },
      rank: 1
    },
    // ... more users
  ],
  userRank: { rank: 23, totalInvited: 15, totalCompleted: 12 }
}
```

#### 6. **getReferralHistory(userId, limit, offset)**
```javascript
// List all referrals for a user with pagination

Result: {
  data: [
    {
      id: referralId,
      friendName, friendEmail,
      friendProfilePicture,
      status: 'completed' | 'pending' | 'expired',
      rewards: { premiumDays: 7, superlikes: 5 },
      dateReferred: '2026-04-28',
      dateCompleted: '2026-04-29'
    }
  ],
  total: 42,
  page: 1,
  limit: 20
}
```

#### 7. **validateReferralCode(referralCode)**
```javascript
// Check if code is valid before redemption
// No authentication required

Result: {
  valid: true,
  referrerName: 'John Doe',
  referrerProfilePicture: 'url...',
  rewardOffer: {
    premiumDays: 7,
    superlikes: 5
  },
  daysRemaining: 300
}
```

#### 8. **getAllRewards(userId)**
```javascript
// Get rewards grouped by status

Result: {
  pending: [ ReferralReward objects ],
  claimed: [ ReferralReward objects ],
  expired: [ ReferralReward objects ]
}
```

---

## API Routes (Backend/Routes)

### Endpoints

#### 1. **GET /api/referrals/code**
```
Authentication: Required (Bearer token)
Description: Get or generate referral code

Response: {
  success: true,
  code: 'LINK123abc4d5e6f7g8h',
  link: 'https://datinghub.app/?referral=...',
  createdAt: '2026-04-28T10:00:00Z'
}
```

#### 2. **GET /api/referrals/stats**
```
Authentication: Required
Description: Get user's referral statistics

Response: {
  success: true,
  stats: {
    totalFriendsInvited: 10,
    friendsCompleted: 7,
    totalRewardsEarned: { premiumDays: 49, superlikes: 35 },
    leaderboardRank: 23
  }
}
```

#### 3. **POST /api/referrals/redeem**
```
Authentication: Required
Body: { referralCode: 'LINK123abc4d5e6f7g8h' }
Description: User redeems a referral code

Response: {
  success: true,
  message: 'Referral accepted!',
  rewards: {
    premiumDays: 7,
    superlikes: 5
  }
}
```

#### 4. **GET /api/referrals/history**
```
Authentication: Required
Query: ?page=1&limit=20
Description: Get paginated referral history

Response: {
  success: true,
  data: [ ReferralHistory objects ],
  pagination: { total: 42, page: 1, limit: 20 }
}
```

#### 5. **GET /api/referrals/leaderboard**
```
Authentication: Required
Query: ?limit=10&page=1&timeframe=all-time
Description: Get top referrers with user's rank

Response: {
  success: true,
  data: [ LeaderboardEntry objects ],
  userRank: { rank: 23, ... }
}
```

#### 6. **GET /api/referrals/validate/:code**
```
Authentication: NOT Required
Description: Validate code before signup

Response: {
  success: true,
  valid: true,
  referrerName: 'John Doe',
  rewardOffer: { premiumDays: 7, superlikes: 5 }
}
```

#### 7. **GET /api/referrals/rewards**
```
Authentication: Required
Description: Get all rewards by status

Response: {
  success: true,
  rewards: {
    pending: [ ReferralReward objects ],
    claimed: [ ReferralReward objects ],
    expired: [ ReferralReward objects ]
  }
}
```

---

## Frontend Layer (React Components)

### Component Hierarchy

```
Dashboard/ReferralDashboard
├── Social Share Section (share via WhatsApp, Instagram, etc.)
├── Stats Display
│   ├── Friends Invited
│   ├── Friends Converted
│   ├── Rewards Earned
│   └── Leaderboard Rank
├── Leaderboard View (Top 10)
├── Referral History Table
└── Action Buttons
    ├── Open Share Modal
    ├── Open Invite Modal
    └── Open Rewards Center

ReferralDashboard
├── ReferralShareModal (for sharing code)
├── ReferralRedeemModal (for entering code)
├── ReferralInviteModal (for selecting friends)
├── ReferralLeaderboard (dedicated leaderboard view)
└── ReferralRewardsCenter (rewards management)
```

### Components Created

#### 1. **ReferralDashboard** (`src/components/ReferralDashboard.js`)
- **Purpose**: Main dashboard showing all referral data
- **Features**:
  - Referral code display with copy button
  - Social media share buttons (6 platforms)
  - Real-time stats (friends invited, converted, rewards)
  - Top 10 leaderboard
  - Referral history with pagination
  - Earned rewards display
- **Props**: 
  - `onOpenShareModal`: callback to open share modal
  - `onOpenRedeemModal`: callback to open redeem modal
- **State Management**:
  - `stats`: User's referral statistics
  - `pendingRewards`: Rewards not yet claimed
  - `loading`: Loading state
  - Auto-refreshes every 30 seconds

#### 2. **ReferralShareModal** (`src/components/ReferralShareModal.js`)
- **Purpose**: Modal for sharing referral code on social media
- **Features**:
  - Display referral code and link
  - Copy to clipboard functionality
  - Native share API integration
  - Pre-written share messages
  - QR code generation
- **Supported Channels**:
  - WhatsApp (with custom message)
  - Instagram Story/DM
  - LinkedIn (professional network)
  - Facebook
  - Email
  - Generic link copy

#### 3. **ReferralRedeemModal** (`src/components/ReferralRedeemModal.js`)
- **Purpose**: Modal for users to enter referral code
- **Features**:
  - Code input with validation
  - Display rewards offered
  - Error handling with user feedback
  - Success confirmation
  - Case-insensitive code handling
  - Form validation

#### 4. **ReferralInviteModal** (`src/components/ReferralInviteModal.js`)
- **Purpose**: Invite specific friends with referral code
- **Features**:
  - Friends list with search/filter
  - Multi-select friends
  - Choose invite method (Link, SMS, Email)
  - Select All checkbox
  - Display reward offer
  - Send tracking
- **Props**:
  - `isOpen`: Modal visibility
  - `onClose`: Close callback
  - `onSuccess`: Success callback
- **Methods Called**:
  - `referralService.getFriends()`
  - `referralService.sendInvites()`

#### 5. **ReferralLeaderboard** (`src/components/ReferralLeaderboard.js`)
- **Purpose**: Dedicated leaderboard view for viral mechanics
- **Features**:
  - Top 10/20 referrers with rankings
  - Medal icons for top 3
  - User's current rank highlighted
  - Timeframe filtering (All-time, This Month, This Week)
  - Achievement badges and milestones
  - Real-time rank updates
  - Sortable by different metrics
- **Props**:
  - `limit`: Number of referrers to display
  - `onClose`: Close callback
- **Badge System**:
  - 🌟 Rising Star (5 referrals)
  - ✨ Top Referrer (20 referrals)
  - 👑 Referral Champion (50 referrals)
  - 🚀 Viral Ambassador (100 referrals)

#### 6. **ReferralRewardsCenter** (`src/components/ReferralRewardsCenter.js`)
- **Purpose**: Comprehensive rewards management interface
- **Features**:
  - Rewards grouped by status: Pending, Claimed, Expired
  - Summary stats (pending and claimed rewards)
  - Individual reward cards with details
  - Claim reward buttons
  - Claim All button for batch claiming
  - Expiration warnings (7 days or less)
  - Reward history with timestamps
  - "How It Works" guide
- **Props**:
  - `onClose`: Close callback
- **Reward Display**:
  - Icon and type (Premium Days, Superlikes, Coins, Boost Tokens)
  - Amount value
  - Expiration date
  - Source referral ID
  - Status badge

---

## Frontend Service Layer

### referralService (`src/services/referralService.js`)

API client wrapper providing clean abstraction to React components:

```javascript
// Get or create referral code
getReferralCode(): Promise<{ success, code, link }>

// Get user's referral statistics
getReferralStats(): Promise<{ success, stats }>

// Accept/redeem a referral code
acceptReferralCode(code): Promise<{ success, rewards }>

// Get referral history with pagination
getReferralHistory(page, limit): Promise<{ success, data, total }>

// Get leaderboard data
getLeaderboard(limit, timeframe): Promise<{ success, data, userRank }>

// Validate code before signup
validateCode(code): Promise<{ success, valid, ... }>

// Get all rewards
getAllRewards(): Promise<{ success, data: { pending, claimed, expired } }>

// Get pending rewards only
getPendingRewards(): Promise<{ success, rewards }>

// Claim single reward
claimReward(rewardId): Promise<{ success }>

// Claim all pending rewards
claimAllRewards(): Promise<{ success, count }>

// Send invites to friends
sendInvites(friends, method, code): Promise<{ success }>

// Get friends list
getFriends(): Promise<{ success, data }>

// Copy referral link to clipboard
copyToClipboard(text): void
```

---

## Styling

All components include comprehensive CSS with:
- Gradient backgrounds (purple gradient theme)
- Responsive design (Mobile, Tablet, Desktop)
- Hover effects and animations
- Loading states and skeletons
- Error and success messages
- Dark mode support
- Accessibility features (high contrast, focus states)

**CSS Files Created:**
- `ReferralDashboard.css` - Main dashboard styling (450+ lines)
- `ReferralRedeemModal.css` - Redeem modal styling (350+ lines)
- `ReferralLeaderboard.css` - Leaderboard styling (400+ lines)
- `ReferralInviteModal.css` - Invite modal styling (450+ lines)
- `ReferralRewardsCenter.css` - Rewards center styling (450+ lines)
- `ReferralShareModal.css` - Share modal styling (existing)

---

## User Flows

### Flow 1: Share Referral Code

```
User Opens Dashboard
    ↓
Sees Referral Code + Link
    ↓
Clicks "Share" Button
    ↓
Choose Platform (WhatsApp/Instagram/etc)
    ↓
Custom Message Pre-filled
    ↓
Friend Receives Invitation
    ↓
Friend Signs Up with Code
    ↓
Both Receive Rewards (7 days + 5 superlikes)
```

### Flow 2: Invite Specific Friends

```
User Clicks "Invite Friends"
    ↓
See Friends List
    ↓
Search/Filter Friends
    ↓
Select Friends (Multi-select)
    ↓
Choose Invite Method (Link/SMS/Email)
    ↓
Send Invitations
    ↓
Confirmation & Track Status
    ↓
Friends Receive Invites
```

### Flow 3: Enter Referral Code (New User)

```
New User Sees Referral Prompt
    ↓
Enters Code During Signup
    ↓
Code Validates (format, exists, not expired)
    ↓
Creates Referral Relationship
    ↓
User Completes Profile
    ↓
Both Users Receive Rewards
    ↓
Rewards Appear in Rewards Center (Pending)
    ↓
User Claims Rewards
    ↓
Rewards Apply (Premium Days, Superlikes)
```

### Flow 4: Manage Rewards

```
User Opens Rewards Center
    ↓
See Pending/Claimed/Expired Tabs
    ↓
View Reward Cards with Details
    ↓
Expiration Warnings for Soon-to-Expire
    ↓
Click "Claim Reward" or "Claim All"
    ↓
Rewards Update Status to "Claimed"
    ↓
Benefits Applied to Account
    ↓
Move to "Claimed" Tab
```

---

## Integration Points

### With Premium System
```javascript
// When reward is claimed:
// Update User.premium_expiry += rewardValue days
// Or create PremiumSubscription record
// Trigger premium feature activation
```

### With Discovery/Boost System
```javascript
// When superlikes reward is claimed:
// Add superlikeCount to User account
// Make available in profile editor
// Update DiscoveryBoostPoints if applicable
```

### With Notifications
```javascript
// Send notifications on:
// - Friend uses referral code
// - Rewards awarded
// - Rewards claimed
// - Leaderboard rank changes
// - Achievement milestones reached
```

### With Analytics
```javascript
// Track metrics:
// - Referral code generation rate
// - Code redemption rate
// - Conversion rate (referral → premium)
// - Reward claim rate
// - Viral coefficient
// - User retention from referrals
```

---

## Fraud Prevention

### Mechanisms Implemented

1. **Self-Referral Prevention**
   - User cannot use their own code
   - Checked in `submitReferralCode()`

2. **Duplicate Prevention**
   - Same user pair cannot create multiple referrals
   - Checked in database constraints

3. **Code Validation**
   - Format validation (LINK + userID + 8 hex chars)
   - Expiration checking (365 days)
   - Status verification (not already completed)

4. **Atomic Transactions**
   - Reward distribution all-or-nothing
   - Database transaction wrapping
   - Rollback on any error

5. **Rate Limiting** (Recommended)
   - Limit referral code generation per user per day
   - Limit code redemptions per user per day
   - Implement in middleware

6. **Email Verification** (Recommended)
   - Verify email for referred users
   - Prevent disposable email accounts
   - Track IP/device fingerprints

---

## Performance Optimization

### Database Optimizations

1. **Indexes**
   ```sql
   CREATE INDEX idx_referral_referrer ON referrals(referrer_user_id, status);
   CREATE INDEX idx_referral_referred ON referrals(referred_user_id);
   CREATE INDEX idx_referral_code ON referrals(referral_code);
   CREATE INDEX idx_reward_user ON referral_rewards(user_id, status, expires_at);
   ```

2. **ReferralStat Cache**
   - Denormalized statistics for fast queries
   - Updated on each reward claim
   - Used for leaderboard queries

3. **Pagination**
   - History and leaderboard use pagination
   - Prevents loading huge result sets

### Frontend Optimizations

1. **Component Splitting**
   - Each modal is separate component
   - Lazy loading where appropriate
   - Prevents unnecessary re-renders

2. **Real-time Updates**
   - Auto-refresh every 30 seconds
   - Socket.io integration possible (optional)
   - User-triggered refresh buttons

3. **Caching**
   - Service layer can cache results
   - Implement TTL for cache invalidation

---

## Testing Checklist

### Unit Tests
- [ ] Code generation (uniqueness, format)
- [ ] Code validation (expiration, format)
- [ ] Reward calculation (correct amounts)
- [ ] Duplicate prevention logic
- [ ] Self-referral prevention

### Integration Tests
- [ ] Complete referral flow end-to-end
- [ ] Reward distribution and claiming
- [ ] Leaderboard ranking calculations
- [ ] Statistics aggregation
- [ ] Transaction rollback on error

### UI Tests
- [ ] Component rendering
- [ ] Form validation
- [ ] Copy to clipboard functionality
- [ ] Social share buttons
- [ ] Modal open/close
- [ ] Pagination

### Performance Tests
- [ ] Leaderboard query performance
- [ ] Large referral history pagination
- [ ] Reward claiming at scale
- [ ] Concurrent referral submissions

---

## Future Enhancements

1. **Email Notifications**
   - Friend invited notifications
   - Referral completed notifications
   - Reward expiration reminders
   - Leaderboard position updates

2. **Gamification**
   - Achievement system
   - Badges and trophies
   - Milestone celebrations
   - Streak tracking

3. **Advanced Sharing**
   - Custom referral messages
   - A/B testing different messages
   - Referral link analytics (click tracking)
   - QR code generation and tracking

4. **Social Integration**
   - Import friends from social accounts
   - Bulk invite capability
   - Social media follow integration

5. **Analytics Dashboard**
   - Referral source attribution
   - Conversion funnel analysis
   - Cohort analysis
   - Viral coefficient measurement

6. **Tiered Rewards**
   - Bonus for multiple successful referrals
   - VIP rewards for top referrers
   - Limited-time boost campaigns

---

## Deployment Checklist

Before going live:

- [ ] All components compile without errors
- [ ] CSS files load correctly
- [ ] API endpoints tested in Postman
- [ ] Database migrations run successfully
- [ ] Referral codes generate uniquely
- [ ] Reward distribution works atomically
- [ ] Frontend forms validate correctly
- [ ] Mobile responsive design works
- [ ] Social share buttons work on target platforms
- [ ] Error messages display correctly
- [ ] Loading states appear during requests
- [ ] Pagination works for large lists
- [ ] Leaderboard calculates rankings correctly
- [ ] Rewards expire after 30 days
- [ ] Premium days apply correctly
- [ ] Superlikes appear in user account
- [ ] Rate limiting implemented (if required)
- [ ] Email notifications configured (if applicable)
- [ ] Analytics events tracked
- [ ] Error logging configured
- [ ] Backup/restore procedures tested

---

## Support & Maintenance

### Common Issues

**Issue**: Code expired warning
**Solution**: User created code but hasn't shared within 365 days

**Issue**: Reward not appearing
**Solution**: Check ReferralReward table status, ensure reward date
**Action**: Manual reward grant if necessary

**Issue**: Leaderboard rank incorrect
**Solution**: Check ReferralStat cache, run cache refresh query

**Issue**: Duplicate referral error
**Solution**: Check referral history, advise user to use different code

### Monitoring

Monitor these metrics:
- Referral code generation rate
- Code redemption rate (daily, weekly, monthly)
- Rewards claimed vs pending
- Average referral value
- User retention rate from referrals
- Leaderboard participation

---

## Conclusion

The Social Referral Program provides a complete, production-ready viral growth mechanism for DatingHub. With comprehensive tracking, attractive UI, and multiple sharing channels, it creates strong incentives for users to invite their friends while maintaining data integrity through atomic transactions and fraud prevention measures.
