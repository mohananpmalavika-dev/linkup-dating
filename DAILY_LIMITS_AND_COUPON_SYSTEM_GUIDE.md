# Daily Likes/Superlikes Limits & Coupon System Implementation Guide

**Date**: April 29, 2026  
**Status**: ✅ IMPLEMENTATION COMPLETE  
**Last Updated**: Configuration & Coupon System Ready

---

## Overview

This implementation allows:
1. **Admin-controlled daily limits** for likes and superlikes (no more hardcoded values)
2. **Coupon code system** for admins to grant additional likes/superlikes to users
3. **Flexible credit management** combining base limits + reward credits + coupon credits

---

## Architecture

### Database

The system uses the following tables:

**admin_settings** - Stores configurable limits
```sql
- setting_key: 'daily_like_limit_free', 'daily_like_limit_premium', 'daily_like_limit_gold'
- setting_key: 'daily_superlike_limit_free', 'daily_superlike_limit_premium', 'daily_superlike_limit_gold'
- setting_value: Integer (limit count)
- setting_type: 'integer'
```

**coupons** - Coupon definitions
```sql
- code: Unique uppercase code (e.g., 'SUMMER2024')
- coupon_type: 'likes', 'superlikes', or 'both'
- likes_value: Number of like credits
- superlikes_value: Number of superlike credits
- max_redemptions: Total allowed redemptions (null = unlimited)
- current_redemptions: Number of times redeemed so far
- expiry_date: When coupon expires (null = never)
- start_date: When coupon becomes active
- is_active: Boolean - whether coupon can be redeemed
- min_user_level: Minimum user level required
- target_user_ids: Comma-separated list of allowed user IDs (null = all users)
```

**coupon_usages** - Tracks coupon redemptions
```sql
- coupon_id: FK to coupons
- user_id: FK to users
- likes_granted: Likes from this redemption
- superlikes_granted: Superlikes from this redemption
- redeemed_at: Timestamp
- ip_address: Redemption IP
- user_agent: Redemption user agent
```

---

## Backend Implementation

### 1. Default Daily Limits

**Free Users**: 50 likes, 1 superlike per day
**Premium Users**: 250 likes, 5 superlikes per day
**Gold Users**: 500 likes, 10 superlikes per day

These are now stored in `admin_settings` table and can be modified via admin endpoints.

### 2. Configurable Limits Function

**Function**: `getConfiguredDailyLimits()` - Located in `backend/routes/dating.js`

```javascript
const limits = await getConfiguredDailyLimits();
// Returns:
// {
//   likeLimitFree: 50,
//   likeLimitPremium: 250,
//   likeLimitGold: 500,
//   superlikeLimitFree: 1,
//   superlikeLimitPremium: 5,
//   superlikeLimitGold: 10
// }
```

### 3. Daily Limit Snapshot Function

**Function**: `getDailyLimitSnapshot(userId)` - Calculates user's current limits including:
- Base limit based on subscription tier
- Already used today
- Remaining base limit
- Reward credits (from achievements)
- Coupon credits (from redeemed coupons)
- Total remaining (base + rewards + coupons)

### 4. Fixed Endpoints

**Before**: Like endpoint had hardcoded `const likeLimit = 50;`

**After**: Uses `getDailyLimitSnapshot()` which:
- Fetches configured limits from admin_settings
- Includes coupon credits in calculation
- Properly handles limit checking

### 5. Coupon Redemption Endpoint

**Endpoint**: `POST /api/redeem-coupon`

**Request**:
```json
{
  "couponCode": "SUMMER2024"
}
```

**Response** (Success):
```json
{
  "message": "Coupon redeemed successfully!",
  "usage": { ... },
  "likesGranted": 10,
  "superlikesGranted": 5,
  "updatedLimits": {
    "remainingLikes": 65,
    "remainingSuperlikes": 6,
    "couponLikesCredits": 10,
    "couponSuperlikeCredits": 5
  }
}
```

**Validations**:
- Coupon must exist
- Coupon must be active
- Coupon must not be expired
- Coupon must not exceed max redemptions
- User must not have already redeemed this coupon
- User must meet min level requirement
- If target_user_ids specified, user must be in list

### 6. Admin Settings Endpoints

**Get Daily Limits**:
```
GET /api/admin/daily-limits/settings
Response: All configured limits
```

**Update Daily Limits**:
```
POST /api/admin/daily-limits/settings
{
  "likeLimitFree": 50,
  "likeLimitPremium": 250,
  "likeLimitGold": 500,
  "superlikeLimitFree": 1,
  "superlikeLimitPremium": 5,
  "superlikeLimitGold": 10
}
```

---

## Admin Features

### New Admin Component: AdminCouponManager

**Location**: `/src/components/AdminCouponManager.js`

**Features**:

#### 1. Coupon List Tab
- View all coupons
- Pagination
- See code, type, limits, redemptions, expiry, status
- Quick actions: View usage, edit, delete

#### 2. Create Coupon Tab
- Create new coupon with:
  - Code (uppercase alphanumeric, max 50 chars)
  - Type (likes only, superlikes only, or both)
  - Values (how many of each credit)
  - Max redemptions (optional)
  - Expiry date (optional)
  - Min user level (optional)
  - Target user IDs (optional - for exclusive coupons)
  - Description (internal notes)

#### 3. Edit Coupon Tab
- Update coupon status (active/inactive)
- Change max redemptions
- Update expiry date
- Update description
- View creation date & current stats

#### 4. Usage Analytics Tab
- See who redeemed each coupon
- User email, name, credits granted
- Redemption timestamps
- Total credits granted across all redemptions

### Admin API Endpoints

**Create Coupon**:
```
POST /api/admin/coupons
{
  "code": "SUMMER2024",
  "couponType": "both",
  "likesValue": 10,
  "superlikesValue": 5,
  "maxRedemptions": 100,
  "expiryDate": "2024-09-01T00:00:00Z",
  "description": "Summer special offer",
  "minUserLevel": 0,
  "targetUserIds": null
}
```

**Get All Coupons**:
```
GET /api/admin/coupons?page=1&limit=10&isActive=true
```

**Update Coupon**:
```
PUT /api/admin/coupons/:couponId
{
  "isActive": true,
  "maxRedemptions": 50,
  "expiryDate": "2024-09-01T00:00:00Z",
  "description": "Updated description"
}
```

**Delete Coupon**:
```
DELETE /api/admin/coupons/:couponId
```

**Get Coupon Usage**:
```
GET /api/admin/coupons/:couponId/usage
Response: {
  "usages": [...],
  "total": 45
}
```

---

## User Features

### New User Component: CouponRedemption

**Location**: `/src/components/CouponRedemption.js`

**Features**:
- Modal dialog to enter coupon code
- Real-time validation
- Success feedback showing credits granted
- Display of updated remaining likes/superlikes
- Tips and guidance

**How to Integrate**:

```jsx
import CouponRedemption from './CouponRedemption';

// In your component:
const [showCoupon, setShowCoupon] = useState(false);

const handleRedemptionSuccess = (redemptionData) => {
  // Refresh limits, show notification, etc.
  console.log('Redeemed:', redemptionData);
};

return (
  <>
    <button onClick={() => setShowCoupon(true)}>
      Redeem Coupon
    </button>
    
    <CouponRedemption
      isOpen={showCoupon}
      onClose={() => setShowCoupon(false)}
      onRedemptionSuccess={handleRedemptionSuccess}
    />
  </>
);
```

---

## Usage Examples

### Example 1: Create Summer Promotion Coupon

**Admin Action**:
1. Navigate to Admin Dashboard → Coupon Management → Create Coupon
2. Enter:
   - Code: `SUMMER2024`
   - Type: `both`
   - Likes: `10`
   - Superlikes: `5`
   - Max Redemptions: `500`
   - Expiry: `Sept 1, 2024`
3. Click Create

**User Action**:
1. Click "Redeem Coupon" button
2. Enter `SUMMER2024`
3. Get 10 likes + 5 superlikes instantly

### Example 2: VIP User Exclusive Coupon

**Admin Action**:
1. Create Coupon:
   - Code: `VIP2024`
   - Type: `superlikes`
   - Superlikes: `20`
   - Max Redemptions: `1` (one per user)
   - Min User Level: `5`
   - Target User IDs: `123,456,789` (specific users only)

**Result**: Only users with IDs 123, 456, 789 and level ≥ 5 can redeem this coupon once each.

### Example 3: Direct User Credit Grant

**Admin Scenario**: Want to give User #100 extra 20 likes as compensation

**Method**:
1. Create a coupon with Target User IDs: `100`
2. Give coupon code to user
3. User redeems it
4. Or: Could also manually update database or create helper endpoint

---

## Daily Limits Configuration

### Changing Default Limits

**Admin**: Navigate to Admin Dashboard

**Method 1: Via API**:
```
POST /api/admin/daily-limits/settings
{
  "likeLimitFree": 75,        // Changed from 50
  "likeLimitPremium": 300,    // Changed from 250
  "likeLimitGold": 600,       // Changed from 500
  "superlikeLimitFree": 2,    // Changed from 1
  "superlikeLimitPremium": 8, // Changed from 5
  "superlikeLimitGold": 15    // Changed from 10
}
```

**Effect**: Immediately applies to all users going forward

### Viewing Current Limits

```
GET /api/admin/daily-limits/settings
Response: {
  "daily_like_limit_free": "50",
  "daily_like_limit_premium": "250",
  "daily_like_limit_gold": "500",
  "daily_superlike_limit_free": "1",
  "daily_superlike_limit_premium": "5",
  "daily_superlike_limit_gold": "10"
}
```

---

## Like & Superlike Endpoints Update

### Like Profile (Fixed)

**Endpoint**: `POST /api/interactions/like`

**Changes**:
- ✅ No longer hardcoded to 50 likes
- ✅ Uses `getDailyLimitSnapshot()` for limits
- ✅ Includes coupon credits in calculation
- ✅ Returns remaining likes info

**Response**:
```json
{
  "message": "Profile liked",
  "isMatch": false,
  "remainingLikes": 25,
  "couponLikesCredits": 10
}
```

### Superlike Profile (Updated)

**Endpoint**: `POST /api/interactions/superlike`

**Changes**:
- ✅ Uses `getDailyLimitSnapshot()` instead of inline logic
- ✅ Consistent limit checking with like endpoint
- ✅ Proper coupon credit integration

**Response**:
```json
{
  "message": "Profile super liked",
  "isMatch": false,
  "remainingSuperlikes": 4,
  "rewardCreditsRemaining": 2,
  "couponSuperlikeCredits": 5
}
```

### Get Daily Limits

**Endpoint**: `GET /api/daily-limits`

**Response**: Comprehensive limits snapshot
```json
{
  "plan": "gold",
  "isPremium": true,
  "isGold": true,
  "likeLimit": 500,
  "superlikeLimit": 10,
  "rewindLimit": 3,
  "boostLimit": 5,
  "likesSent": 480,
  "superlikesSent": 8,
  "remainingLikes": 35,
  "remainingSuperlikes": 7,
  "couponLikesCredits": 10,
  "couponSuperlikeCredits": 5,
  "rewardSuperlikeCredits": 2,
  "rewardBoostCredits": 1,
  "resetsAt": "2024-04-30T00:00:00Z"
}
```

---

## Frontend Integration

### Show Daily Limits to User

```jsx
const DailyLimitsDisplay = () => {
  const [limits, setLimits] = useState(null);

  useEffect(() => {
    datingProfileService.getDailyLimits().then(setLimits);
  }, []);

  if (!limits) return null;

  return (
    <div className="limits">
      <p>Likes Today: {limits.remainingLikes} / {limits.likeLimit}</p>
      <p>Superlikes Today: {limits.remainingSuperlikes} / {limits.superlikeLimit}</p>
      {limits.couponLikesCredits > 0 && (
        <p>From Coupons: +{limits.couponLikesCredits} likes</p>
      )}
    </div>
  );
};
```

### Handle Limit Exceeded

```jsx
const handleLike = async (profileId) => {
  try {
    const result = await datingProfileService.likeProfile(profileId);
    // Handle success
  } catch (error) {
    if (error.includes('Daily like limit reached')) {
      // Show coupon redemption modal
      setShowCouponModal(true);
    }
  }
};
```

---

## Testing Checklist

- [ ] Admin can create coupon via admin dashboard
- [ ] Admin can set expiry date for coupon
- [ ] Admin can set max redemptions
- [ ] Admin can set target user IDs (exclusive coupons)
- [ ] Admin can deactivate coupon
- [ ] Admin can view coupon usage analytics
- [ ] User can redeem coupon code
- [ ] User cannot redeem expired coupon
- [ ] User cannot redeem if max redemptions reached
- [ ] User cannot redeem same coupon twice
- [ ] User cannot redeem if not in target list (if applicable)
- [ ] User cannot redeem if user level too low (if applicable)
- [ ] Likes work with configured limits
- [ ] Superlikes work with configured limits
- [ ] Coupon credits are included in remaining count
- [ ] Admin can change daily limits
- [ ] Changed limits apply to new likes/superlikes
- [ ] Daily limits reset at midnight

---

## Migration & Data

### Initialize Default Settings

The system automatically initializes default settings on first run. To manually reset:

```sql
DELETE FROM admin_settings WHERE setting_key LIKE 'daily_%_limit_%';
-- Then system will reinitialize with defaults
```

### Existing Users

- No migration needed
- Existing likes/superlikes counters continue to work
- New coupon system is opt-in for admins
- Users who never redeemed coupons have zero coupon credits

---

## Future Enhancements

1. **Batch Coupon Creation**: Generate bulk codes at once
2. **Coupon Analytics Dashboard**: Trends, revenue, user segments
3. **Automated Coupon Campaigns**: Seasonal, holiday, retention campaigns
4. **Usage Limits Per User**: e.g., "Max 3 coupons per user per month"
5. **Tiered Coupons**: Different values for different user segments
6. **Mobile Support**: More visible coupon button in mobile UI

---

## Troubleshooting

### Issue: Coupon not redeeming

**Check**:
- [ ] Coupon code matches (case-insensitive, but must exist)
- [ ] Coupon is_active = true
- [ ] Current date is between start_date and expiry_date
- [ ] current_redemptions < max_redemptions
- [ ] User hasn't already redeemed it
- [ ] If target_user_ids set, user ID is in list
- [ ] If min_user_level set, user level is >= min_user_level

### Issue: Like limit not working

**Check**:
- [ ] admin_settings table has daily_like_limit_* entries
- [ ] User subscription plan is correct (free/premium/gold)
- [ ] user_analytics has entry for today
- [ ] getDailyLimitSnapshot is being called in like endpoint

### Issue: Coupon credits not showing

**Check**:
- [ ] coupon_usages record was created
- [ ] Coupon record exists with correct likes_value/superlikes_value
- [ ] getDailyLimitSnapshot includes getUserCouponCredits call
- [ ] GET /daily-limits returns couponLikesCredits field

---

## Support

For issues or questions:
1. Check logs: `backend/logs/exceptions.log`
2. Verify database integrity
3. Check admin_settings table values
4. Test coupon redemption API directly

---

**Implementation Date**: April 29, 2026  
**Ready for**: Production deployment with admin testing
