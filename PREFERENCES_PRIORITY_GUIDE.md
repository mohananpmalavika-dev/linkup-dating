# Preferences Priority System - Complete Implementation Guide

## Overview

**Preferences Priority** is a premium subscription feature ($9.99/month) that gives users top placement in filtered discovery searches. This document provides comprehensive technical documentation for developers.

## Features

### 1. **Top Placement in Search Results**
- User profiles appear first when other users filter matches by preferences
- Example: "Women aged 28-35 looking for relationship" → Priority user appears at top
- Dynamic ranking based on weekly rotation

### 2. **Weekly Fairness Rotation**
- Prevents monopolization by rotating priority slots weekly (Monday UTC)
- Fair scoring algorithm balances loyalty with equal opportunity
- Better engagement leads to higher priority in next rotation

### 3. **Loyalty Rewards**
- 3 months: 5% discount → $9.49/month
- 6 months: 10% discount → $8.99/month
- 12 months: 20% discount → $7.99/month
- 24+ months: 25% discount → $7.49/month

### 4. **Real-Time Analytics**
- Monthly impressions during priority placement
- Match conversion tracking
- Engagement rate calculations
- Billing cycle status with days remaining

### 5. **Flexible Subscriptions**
- Auto-renewal every month (customizable)
- Cancel anytime with immediate effect
- Billing cycle tracking
- Pro-rata refunds not implemented (monthly billing)

---

## Architecture

### Database Schema

**Table:** `preferences_priorities`

```sql
- id (UUID, PK)
- user_id (UUID, FK -> users, unique)
- status (ENUM: active, cancelled, expired, paused)
- price_per_month (DECIMAL 10,2)
- auto_renew (BOOLEAN)
- billing_cycle_start (DATE)
- billing_cycle_end (DATE)
- next_renewal (DATE)
- cancelled_at (DATE, nullable)
- cancellation_reason (TEXT, nullable)
- rotation_week_position (INTEGER) - Times in rotation
- current_week_active (BOOLEAN) - Featured this week?
- last_rotation_date (DATE, nullable)
- weekly_rotation_enabled (BOOLEAN)
- priority_ranking_boost (DECIMAL 10,2) - Default: 100.0
- impressions_this_month (INTEGER)
- matches_this_month (INTEGER)
- total_spent (DECIMAL 10,2)
- total_months_active (INTEGER)
- loyalty_discount_percent (INTEGER) - 0-25%
- created_at (DATE)
- updated_at (DATE)
```

**Indexes:**
- `user_id` (primary lookup)
- `status` (filtering)
- `current_week_active` (weekly rotation queries)
- `billing_cycle_end` (expiration checks)
- `next_renewal` (auto-renewal processing)
- `rotation_week_position` (loyalty bias)
- `total_months_active` (loyalty loyalty calculations)
- Composite: `(status, rotation_week_position DESC)` (weekly distribution)

---

## Backend Implementation

### Service: `backend/services/preferencesPriorityService.js`

**Core Methods:**

#### 1. `subscribeToPriority(userId, autoRenew = true)`
Creates new preference priority subscription for user.

```javascript
const result = await preferencesPriorityService.subscribeToPriority(userId, true);
// Returns: { success: true, subscription: {...} }
```

**Logic:**
- Check if user already has active subscription
- Create billing cycle (current month + 1 month)
- Initialize rotation position = 0
- Set current_week_active = false (joins pool, doesn't get placement immediately)
- Returns subscription object with success message

#### 2. `calculateWeeklyRotation()`
Runs weekly (Monday UTC) to select priority users for this week.

```javascript
const result = await preferencesPriorityService.calculateWeeklyRotation();
// Returns: { success: true, selectedCount: 10, nextRotation: Date }
```

**Algorithm:**
1. Get all active subscriptions with rotation enabled
2. Sort by: total_months_active DESC (loyalty), last_rotation_date ASC (fair rotation), user_id ASC (tiebreaker)
3. Select top N users (MAX_ACTIVE_PER_WEEK = 10)
4. Reset all current_week_active = false
5. Update selected users: current_week_active = true, last_rotation_date = now

**Fairness Logic:**
- Loyalty bias: Users with more months get priority in selection
- Recency bias: Users not selected recently get priority
- Tiebreaker: Alphabetical user ID for consistency
- Weekly reset: All users get equal chance each week

#### 3. `getPriorityStatus(userId)`
Fetch current subscription status for user.

```javascript
const result = await preferencesPriorityService.getPriorityStatus(userId);
// Returns: {
//   success: true,
//   hasSubscription: true,
//   subscription: {
//     id, status, isActive, currentWeekActive,
//     billingStart, billingEnd, nextRenewal,
//     autoRenew, monthlyPrice, loyaltyDiscount,
//     effectivePrice, rotationPosition, totalMonthsActive,
//     impressionsThisMonth, matchesThisMonth, message
//   }
// }
```

#### 4. `renewSubscription(userId)`
Renew subscription for next month (called on auto-renewal date or manually).

```javascript
const result = await preferencesPriorityService.renewSubscription(userId);
// Returns: {
//   success: true,
//   renewal: {
//     monthlyPrice, loyaltyDiscount, effectivePrice,
//     billingStart, billingEnd, totalMonthsActive
//   }
// }
```

**Logic:**
- Check if subscription exists and is active
- Increment total_months_active
- Recalculate loyalty_discount_percent based on new total
- Reset impressions_this_month = 0 (for next billing cycle)
- Reset matches_this_month = 0
- Set new billing cycle dates

#### 5. `cancelSubscription(userId, reason = '')`
Cancel subscription immediately.

```javascript
const result = await preferencesPriorityService.cancelSubscription(userId, reason);
// Returns: { success: true, totalSpent, monthsActive }
```

#### 6. `getSearchRankingMultiplier(userId)`
Get ranking multiplier for search algorithm integration.

```javascript
const multiplier = await preferencesPriorityService.getSearchRankingMultiplier(userId);
// Returns: 100.0 (top placement) or 1.0 (normal ranking)
```

**Used by:** Discovery/search endpoints to boost priority users' profile rankings

#### 7. `recordImpression(userId)` / `recordMatch(userId)`
Track analytics during priority week.

```javascript
await preferencesPriorityService.recordImpression(userId);
await preferencesPriorityService.recordMatch(userId);
```

#### 8. `getAnalytics(userId)`
Get comprehensive analytics for subscriber.

```javascript
const result = await preferencesPriorityService.getAnalytics(userId);
// Returns: {
//   billingCycle: { start, end, daysRemaining, cycleProgress },
//   currentWeek: { isActive, rotationPosition, message },
//   thisMonth: { impressions, matches, engagementRate },
//   lifetime: { totalMonthsActive, totalSpent, loyaltyDiscount, effectivePrice }
// }
```

#### 9. `processRenewals()` (Cron Job)
Find and renew subscriptions with auto_renew = true and next_renewal <= now.

```javascript
const result = await preferencesPriorityService.processRenewals();
// Returns: { success: true, renewedCount: 5, total: 8 }
```

**Recommendation:** Run this daily or twice daily via cron job or scheduled task.

---

### Routes: `backend/routes/preferencesPriority.js`

**Endpoints:**

#### 1. `GET /api/preferences-priority/info`
Get subscription pricing and features.

```javascript
GET /api/preferences-priority/info

Response: {
  success: true,
  subscription: {
    monthlyPrice: 9.99,
    billingCycle: "monthly",
    autoRenewal: true,
    cancelAnytime: true,
    features: [...],
    loyaltyTiers: [...]
  }
}
```

#### 2. `GET /api/preferences-priority/status` ⚠️ Requires Authentication
Get user's priority status.

```javascript
GET /api/preferences-priority/status
Authorization: Bearer <token>

Response: {
  success: true,
  hasSubscription: true,
  subscription: {...}  // See service.getPriorityStatus()
}
```

#### 3. `POST /api/preferences-priority/subscribe` ⚠️ Requires Authentication
Subscribe user to preferences priority.

```javascript
POST /api/preferences-priority/subscribe
Authorization: Bearer <token>
Content-Type: application/json

Body: {
  autoRenew: true  // optional, default: true
}

Response: {
  success: true,
  subscription: {
    id, userId, status, price,
    billingStart, billingEnd, autoRenew,
    message: "Welcome to Preferences Priority!"
  }
}
```

#### 4. `POST /api/preferences-priority/renew` ⚠️ Requires Authentication
Manually renew subscription.

```javascript
POST /api/preferences-priority/renew
Authorization: Bearer <token>

Response: {
  success: true,
  renewal: {
    monthlyPrice, loyaltyDiscount, effectivePrice,
    billingStart, billingEnd, totalMonthsActive
  }
}
```

#### 5. `POST /api/preferences-priority/cancel` ⚠️ Requires Authentication
Cancel subscription.

```javascript
POST /api/preferences-priority/cancel
Authorization: Bearer <token>
Content-Type: application/json

Body: {
  reason: "Too expensive"  // optional
}

Response: {
  success: true,
  message: "Subscription cancelled",
  totalSpent: 29.97,
  monthsActive: 3
}
```

#### 6. `GET /api/preferences-priority/analytics` ⚠️ Requires Authentication
Get detailed analytics for subscriber.

```javascript
GET /api/preferences-priority/analytics
Authorization: Bearer <token>

Response: {
  success: true,
  analytics: {
    billingCycle: {...},
    currentWeek: {...},
    thisMonth: {...},
    lifetime: {...}
  }
}
```

#### 7. `GET /api/preferences-priority/eligibility` ⚠️ Requires Authentication
Check if user can access this feature (needs premium subscription).

```javascript
GET /api/preferences-priority/eligibility
Authorization: Bearer <token>

Response: {
  success: true,
  canAccess: true,
  message: "You can subscribe to preferences priority"
}
```

---

## Frontend Implementation

### Hook: `src/hooks/usePreferences.js`

**State & Actions:**

```javascript
const {
  // State
  priorityStatus,      // Current subscription status
  subscriptionInfo,    // Pricing and features
  analytics,          // Analytics data
  eligibility,        // Can user access?
  loading,            // Loading state
  error,              // Error message

  // Actions
  getSubscriptionInfo,      // Fetch info
  checkPriorityStatus,      // Check status
  checkEligibility,         // Check eligibility
  subscribeToPriority,      // Subscribe
  renewSubscription,        // Renew manually
  cancelSubscription,       // Cancel
  getAnalytics             // Fetch analytics
} = usePreferences();
```

**Usage Example:**

```javascript
import usePreferences from '../hooks/usePreferences';

function PriorityFeature() {
  const { priorityStatus, subscribeToPriority, loading } = usePreferences();

  const handleSubscribe = async () => {
    const result = await subscribeToPriority(true);
    if (result.success) {
      console.log('Subscribed!');
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <button onClick={handleSubscribe}>
      Subscribe to Priority
    </button>
  );
}
```

### Component: `src/components/PrioritySubscriptionPanel.jsx`

**UI States:**

1. **Loading State** - Shows spinner while fetching data
2. **Upgrade State** - Shows if user doesn't have premium subscription
3. **Active Subscription** - Shows current subscription details, cancel button
4. **Subscribe Offer** - Shows pricing, features, loyalty tiers, subscribe button

**Props:**
```javascript
<PrioritySubscriptionPanel
  onClose={() => {}}          // Called when user closes panel
  onSubscribed={(sub) => {}}  // Called when subscription successful
/>
```

**Features:**
- Premium gold theme with gradient backgrounds
- Animated icons and transitions
- Loyalty tier breakdown
- Upcoming rotation date display
- Subscription analytics
- Cancel confirmation dialog
- Responsive design (mobile-optimized)

### Component: `src/components/PriorityStatus.jsx`

**Display Modes:**

1. **Inactive** - User not subscribed (clickable to subscribe)
2. **Expired** - Subscription ended (needs renewal)
3. **Active** - Subscription active, not featured this week
4. **Featured** - Active subscription AND selected for top placement this week (pulse animation)

**Props:**
```javascript
<PriorityStatus
  userId={userId}              // For context
  showDetails={false}          // Show detailed info card
  onSubscribeClick={() => {}}  // Called when user clicks to subscribe
/>
```

**Tooltip Content:**
- Featured week: "🎯 Featured This Week!" + impressions/matches
- Not featured: "In Rotation Pool" + rotation info

---

## Integration Points

### 1. **Discovery/Search Endpoints**

After fetching search results, apply priority boost:

```javascript
// In discovery route handler
const results = await DatingProfile.findAll({...});

// For each result, get ranking multiplier
for (let profile of results) {
  const multiplier = await preferencesPriorityService.getSearchRankingMultiplier(profile.user_id);
  profile.rankingMultiplier = multiplier;
}

// Sort: priority users (multiplier=100) at top, others by default algorithm
results.sort((a, b) => {
  return (b.rankingMultiplier || 1) - (a.rankingMultiplier || 1);
});

// Record impressions for featured users
results.forEach(profile => {
  if (profile.rankingMultiplier === 100) {
    preferencesPriorityService.recordImpression(profile.user_id);
  }
});
```

### 2. **Match/Connection Endpoints**

Track when priority users get matches:

```javascript
// In match creation route
await preferencesPriorityService.recordMatch(userId);
```

### 3. **User Profile Display**

Show priority status on user profiles:

```javascript
// In user profile component
import PriorityStatus from './PriorityStatus';

<PriorityStatus
  userId={profileUserId}
  showDetails={true}
/>
```

### 4. **Premium Settings Page**

Add preferences priority subscription management:

```javascript
// In premium features section
import PrioritySubscriptionPanel from './PrioritySubscriptionPanel';

<PrioritySubscriptionPanel
  onClose={handleClose}
  onSubscribed={handleSubscribed}
/>
```

### 5. **Cron Job Setup**

Set up automatic renewals (add to your scheduler):

```javascript
// In your cron/scheduler file
const schedule = require('node-schedule');
const preferencesPriorityService = require('./services/preferencesPriorityService');

// Run daily at 2 AM UTC
schedule.scheduleJob('0 2 * * *', async () => {
  console.log('Processing preference priority renewals...');
  const result = await preferencesPriorityService.processRenewals();
  console.log(`Renewed ${result.renewedCount}/${result.total} subscriptions`);
});

// Run weekly rotation every Monday at 00:00 UTC
schedule.scheduleJob('0 0 * * 0', async () => {
  console.log('Running weekly priority rotation...');
  const result = await preferencesPriorityService.calculateWeeklyRotation();
  console.log(`Selected ${result.selectedCount} profiles for priority placement`);
});
```

---

## Configuration

**File:** `backend/services/preferencesPriorityService.js`

```javascript
const PRIORITY_CONFIG = {
  MONTHLY_PRICE: 9.99,
  WEEKLY_ROTATION_ENABLED: true,
  ROTATION_DAY: 0,           // Monday
  ROTATION_HOUR: 0,          // 00:00 UTC
  MAX_ACTIVE_PER_WEEK: 10,   // Adjust based on user base
  RANKING_BOOST: 100.0,      // Multiplier for top placement
  LOYALTY_TIERS: {
    3: 0.05,                 // 3 months: 5% discount
    6: 0.10,                 // 6 months: 10% discount
    12: 0.20,                // 12 months: 20% discount
    24: 0.25                 // 24+ months: 25% discount
  }
};
```

**To Adjust:**
- `MAX_ACTIVE_PER_WEEK`: Increase for larger user base
- `LOYALTY_TIERS`: Modify discount thresholds
- `MONTHLY_PRICE`: Change subscription price

---

## Analytics & Monitoring

### Key Metrics

1. **Subscription Metrics**
   - Total active subscriptions
   - Monthly churn rate
   - Average subscription tenure
   - Loyalty tier distribution

2. **Engagement Metrics**
   - Impressions for featured users
   - Match conversion rate during priority week
   - Engagement rate (matches / impressions)
   - Repeat subscription rate

3. **Financial Metrics**
   - Monthly recurring revenue (MRR)
   - Average revenue per user (ARPU)
   - Lifetime value (LTV)
   - Discount impact analysis

### Suggested Queries

```sql
-- Active subscriptions
SELECT COUNT(*) as active_subs
FROM preferences_priorities
WHERE status = 'active' AND billing_cycle_end > NOW();

-- Monthly revenue
SELECT 
  COUNT(*) as subscriber_count,
  SUM(price_per_month * (1 - loyalty_discount_percent/100)) as monthly_revenue
FROM preferences_priorities
WHERE status = 'active' AND billing_cycle_end > NOW();

-- Average engagement
SELECT 
  AVG(impressions_this_month) as avg_impressions,
  AVG(matches_this_month) as avg_matches,
  AVG(CASE WHEN impressions_this_month > 0 
      THEN (matches_this_month::float / impressions_this_month) * 100 
      ELSE 0 END) as avg_engagement_rate
FROM preferences_priorities
WHERE status = 'active' AND current_week_active = true;

-- Loyalty distribution
SELECT 
  CASE 
    WHEN total_months_active >= 24 THEN '24+'
    WHEN total_months_active >= 12 THEN '12-23'
    WHEN total_months_active >= 6 THEN '6-11'
    WHEN total_months_active >= 3 THEN '3-5'
    ELSE '1-2'
  END as tenure_group,
  COUNT(*) as subscriber_count,
  AVG(loyalty_discount_percent) as avg_discount
FROM preferences_priorities
WHERE status = 'active'
GROUP BY tenure_group;
```

---

## Testing

### Unit Tests

```javascript
// Test subscribe
test('subscribeToPriority creates new subscription', async () => {
  const result = await preferencesPriorityService.subscribeToPriority(userId);
  expect(result.success).toBe(true);
  expect(result.subscription.status).toBe('active');
});

// Test rotation
test('calculateWeeklyRotation selects top users fairly', async () => {
  const result = await preferencesPriorityService.calculateWeeklyRotation();
  const activeCount = await PreferencesPriority.count({
    where: { current_week_active: true }
  });
  expect(activeCount).toBeLessThanOrEqual(MAX_ACTIVE_PER_WEEK);
});

// Test renewal
test('renewSubscription increments months and applies discount', async () => {
  const result = await preferencesPriorityService.renewSubscription(userId);
  expect(result.renewal.totalMonthsActive).toBeGreaterThan(0);
});
```

### Integration Tests

1. **Subscribe → Check Status → Cancel** flow
2. **Weekly rotation** fairness verification
3. **Search integration** with ranking boost
4. **Auto-renewal** processing
5. **Loyalty discount** calculations

---

## Error Handling

**Common Errors:**

```javascript
// User already has subscription
{ success: false, message: 'Already have active priority subscription' }

// No active subscription to renew
{ success: false, message: 'No active subscription to renew' }

// No premium subscription (not eligible)
{ success: false, message: 'Upgrade to premium to access preferences priority' }

// Subscription expired
{ success: false, hasSubscription: false }

// Database error
{ success: false, message: 'Failed to [operation]' }
```

---

## Future Enhancements

1. **Payment Integration**
   - Stripe integration for recurring billing
   - Automatic payment failure handling

2. **Advanced Analytics**
   - A/B testing priority placement impact
   - User cohort analysis

3. **Flexible Pricing**
   - Regional pricing adjustments
   - Seasonal promotions

4. **AI-Powered Rotation**
   - Machine learning for optimal rotation
   - Prediction of user activity

5. **Premium Tiers**
   - Basic: $4.99/month (lower ranking boost)
   - Premium: $9.99/month (top placement)
   - Elite: $19.99/month (guaranteed top 3 placement)

---

## Troubleshooting

**Q: Users not appearing in search results with priority?**
A: Check that:
1. User has active subscription
2. `current_week_active` is true
3. Search endpoint is calling `getSearchRankingMultiplier()`
4. Results are sorted by ranking multiplier

**Q: Weekly rotation not happening?**
A: Verify:
1. Cron job is running
2. `WEEKLY_ROTATION_ENABLED` is true
3. Database has active subscriptions
4. No database locks

**Q: Loyalty discounts not applying?**
A: Check:
1. `total_months_active` is being incremented
2. Loyalty tier thresholds match config
3. `loyalty_discount_percent` is calculated correctly

---

## Support & Documentation

For questions or issues:
- Check implementation examples in this document
- Review service method documentation
- Check error messages and logs
- Consult analytics dashboard for trends

Last Updated: April 28, 2026
