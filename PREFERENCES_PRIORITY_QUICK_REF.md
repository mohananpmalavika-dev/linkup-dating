# Preferences Priority - Quick Reference

## Feature Overview

Premium subscription ($9.99/month) that gives users top placement in filtered discovery searches with weekly fair rotation.

## Quick Start

### Install/Setup
```bash
# No additional installation needed
# Just run the migration to create the database table
npm run migrate  # or sequelize db:migrate

# Add cron jobs for renewals and rotation (see Cron Jobs section below)
```

### Basic Usage

**Subscribe User:**
```javascript
const preferencesPriorityService = require('./services/preferencesPriorityService');
const result = await preferencesPriorityService.subscribeToPriority(userId, autoRenew);
```

**Check Status:**
```javascript
const status = await preferencesPriorityService.getPriorityStatus(userId);
console.log(status.subscription.isActive);
```

**Get Ranking Multiplier (for search):**
```javascript
const multiplier = await preferencesPriorityService.getSearchRankingMultiplier(userId);
// Returns 100.0 (top placement) or 1.0 (normal)
```

---

## Configuration Quick Reference

**File:** `backend/services/preferencesPriorityService.js`

| Setting | Value | Purpose |
|---------|-------|---------|
| `MONTHLY_PRICE` | $9.99 | Subscription price |
| `MAX_ACTIVE_PER_WEEK` | 10 | Concurrent priority placements |
| `RANKING_BOOST` | 100.0 | Top ranking multiplier |
| Tier: 3 months | 5% off | Loyalty reward |
| Tier: 6 months | 10% off | Loyalty reward |
| Tier: 12 months | 20% off | Loyalty reward |
| Tier: 24+ months | 25% off | Loyalty reward |

**Edit to adjust pricing or loyalty tiers**

---

## API Endpoints

### Public Endpoints
```
GET  /api/preferences-priority/info
```

### Protected Endpoints (Requires Auth)
```
GET  /api/preferences-priority/status
GET  /api/preferences-priority/eligibility
GET  /api/preferences-priority/analytics
POST /api/preferences-priority/subscribe
POST /api/preferences-priority/renew
POST /api/preferences-priority/cancel
```

---

## Database

**Table:** `preferences_priorities`

**Key Fields:**
- `user_id` - User (unique, FK)
- `status` - active/cancelled/expired/paused
- `current_week_active` - Featured this week?
- `impressions_this_month` - Profile views
- `matches_this_month` - New connections
- `total_months_active` - For loyalty calculations
- `loyalty_discount_percent` - Applied discount (0-25%)

**Indexes:**
- `user_id` (primary)
- `status`
- `current_week_active`
- `billing_cycle_end`
- `rotation_week_position`

---

## Cron Jobs Required

Add these to your scheduler (e.g., node-schedule):

### 1. Auto-Renewal (Daily)
```javascript
// Run daily at 2 AM UTC
schedule.scheduleJob('0 2 * * *', async () => {
  await preferencesPriorityService.processRenewals();
});
```

### 2. Weekly Rotation (Weekly)
```javascript
// Run Mondays at 00:00 UTC
schedule.scheduleJob('0 0 * * 0', async () => {
  await preferencesPriorityService.calculateWeeklyRotation();
});
```

---

## Frontend Components

### PrioritySubscriptionPanel
```jsx
import PrioritySubscriptionPanel from './components/PrioritySubscriptionPanel';

<PrioritySubscriptionPanel
  onClose={() => close()}
  onSubscribed={(sub) => handleSubscribed(sub)}
/>
```

**States:**
- Loading
- Upgrade (no premium)
- Offer (subscribe now)
- Active (managing subscription)

### PriorityStatus Badge
```jsx
import PriorityStatus from './components/PriorityStatus';

<PriorityStatus
  userId={userId}
  showDetails={false}
  onSubscribeClick={() => openPanel()}
/>
```

**Displays:**
- Inactive (gray)
- Expired (red)
- Active (gold)
- Featured (gold + pulse)

---

## React Hook

```javascript
import usePreferences from '../hooks/usePreferences';

const {
  priorityStatus,         // Current subscription
  subscriptionInfo,       // Pricing & features
  analytics,             // Analytics data
  loading, error,        // State

  checkPriorityStatus,   // Fetch status
  subscribeToPriority,   // Subscribe
  cancelSubscription,    // Cancel
  getAnalytics          // Get analytics
} = usePreferences();
```

---

## Service Methods

| Method | Returns | Purpose |
|--------|---------|---------|
| `subscribeToPriority(userId, autoRenew)` | {success, subscription} | New subscription |
| `getPriorityStatus(userId)` | {success, subscription} | Current status |
| `renewSubscription(userId)` | {success, renewal} | Renew next month |
| `cancelSubscription(userId, reason)` | {success, ...} | Cancel now |
| `getSearchRankingMultiplier(userId)` | 100.0 or 1.0 | Search ranking |
| `recordImpression(userId)` | true/false | Track view |
| `recordMatch(userId)` | true/false | Track match |
| `getAnalytics(userId)` | {success, analytics} | Full analytics |
| `calculateWeeklyRotation()` | {success, selectedCount} | Weekly selection |
| `processRenewals()` | {success, renewedCount} | Auto-renewal |

---

## Key Concepts

### Weekly Rotation
- Runs **Monday 00:00 UTC**
- Selects top 10 users (configurable) for priority placement
- Prevents monopolization
- Sorted by: Loyalty (months active) → Recency (not selected recently) → ID

### Ranking Multiplier
- **100.0** = Top placement (selected for this week)
- **1.0** = Normal ranking (not selected)
- Used in search sorting

### Loyalty Discounts
- Applied automatically on renewal
- Based on total_months_active
- Tier 3-24+ months: 5-25% off
- Reset on cancellation

### Analytics
- **Impressions**: Profile views during priority placement
- **Matches**: New connections from priority placement
- **Engagement**: (Matches / Impressions) × 100
- **Lifetime**: Total spent, months active, discount level

---

## Integration Checklist

- [x] Database migration created
- [x] Service layer implemented
- [x] API routes implemented
- [x] Frontend hook created
- [x] UI components created
- [x] Routes registered in server.js
- [ ] Cron jobs configured
- [ ] Search endpoint integration
- [ ] Match tracking integration
- [ ] Build verification

---

## Common Tasks

### Set Up Subscriptions
```javascript
// Admin function
async function setUpTestSubscriptions() {
  const userIds = ['user1', 'user2', 'user3'];
  for (const id of userIds) {
    await preferencesPriorityService.subscribeToPriority(id, true);
  }
  console.log('Test subscriptions created');
}
```

### Check Weekly Selection
```javascript
// Get featured users this week
const featured = await PreferencesPriority.findAll({
  where: { current_week_active: true }
});
console.log(`${featured.length} users featured this week`);
```

### Manual Rotation
```javascript
// Force rotation (normally runs automatically)
const result = await preferencesPriorityService.calculateWeeklyRotation();
console.log(`Rotated - selected ${result.selectedCount}`);
```

### Get Revenue Stats
```javascript
// Calculate monthly revenue
const result = await sequelize.query(`
  SELECT 
    COUNT(*) as subscribers,
    SUM(price_per_month * (1 - loyalty_discount_percent/100)) as revenue
  FROM preferences_priorities
  WHERE status = 'active'
`);
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| User can't subscribe | No premium subscription | Upgrade to premium first |
| Weekly rotation not running | Cron job not configured | Add rotation job to scheduler |
| Ranking multiplier always 1.0 | User not featured | Check `current_week_active` flag |
| Loyalty discount not applied | Database not updated | Run renewal process |
| Impressions not tracking | Search endpoint not integrated | Add recordImpression() call |

---

## Testing

**Manual Test Flow:**
1. Subscribe user: `POST /api/preferences-priority/subscribe`
2. Check status: `GET /api/preferences-priority/status`
3. Get analytics: `GET /api/preferences-priority/analytics`
4. Force rotation: Call `calculateWeeklyRotation()` in service
5. Verify: `current_week_active` should be true for selected users
6. Cancel: `POST /api/preferences-priority/cancel`

**API Test:**
```bash
# Get info
curl http://localhost:5000/api/preferences-priority/info

# Subscribe (with auth token)
curl -X POST http://localhost:5000/api/preferences-priority/subscribe \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"

# Check status
curl http://localhost:5000/api/preferences-priority/status \
  -H "Authorization: Bearer TOKEN"
```

---

## Files Created

| File | Purpose |
|------|---------|
| `backend/models/PreferencesPriority.js` | Database model |
| `backend/services/preferencesPriorityService.js` | Business logic (900+ lines) |
| `backend/routes/preferencesPriority.js` | API endpoints (250+ lines) |
| `backend/migrations/20260428_create_preferences_priority.js` | Database setup |
| `src/hooks/usePreferences.js` | React state management |
| `src/components/PrioritySubscriptionPanel.jsx` | Subscription UI (400+ lines) |
| `src/components/PrioritySubscriptionPanel.css` | Panel styling (600+ lines) |
| `src/components/PriorityStatus.jsx` | Badge component (200+ lines) |
| `src/components/PriorityStatus.css` | Badge styling (300+ lines) |
| `backend/server.js` | Updated with route registration |

---

## Next Steps

1. **Configure cron jobs** - Set up renewal and rotation jobs
2. **Integrate search** - Call `getSearchRankingMultiplier()` in discovery endpoints
3. **Track analytics** - Call `recordImpression()` and `recordMatch()`
4. **Test flow** - Subscribe, check status, cancel
5. **Build & deploy** - Run `npm run build` then deploy

---

## Support

For detailed information, see **PREFERENCES_PRIORITY_GUIDE.md**

For questions on specific components:
- Backend: Check `backend/services/preferencesPriorityService.js`
- Routes: Check `backend/routes/preferencesPriority.js`
- Frontend: Check `src/hooks/usePreferences.js` and components
- Database: Check `backend/migrations/20260428_create_preferences_priority.js`

---

**Status:** ✅ IMPLEMENTATION COMPLETE
**Lines of Code:** 2,500+
**Components:** 9 files
**Next:** Cron jobs, search integration, build verification

Last Updated: April 28, 2026
