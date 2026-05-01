# Adding "DHANYA" Coupon Code - Setup Guide

## Overview
The "DHANYA" coupon code grants **100 call credits** to users when they redeem it on the Calls page.

## Changes Made

### 1. Backend Database Migration
- **File**: `backend/migrations/add-call-credits-to-coupons.js`
- **Change**: Adds `call_credits_value` column to `coupons` table to store call credit values

### 2. Backend Model Update
- **File**: `backend/models/Coupon.js`
- **Changes**:
  - Added `'callcredits'` to `couponType` ENUM
  - Added `callCreditsValue` field to store call credits value

### 3. Backend API Update
- **File**: `backend/routes/dating.js`
- **Endpoint**: `POST /api/redeem-coupon`
- **Changes**:
  - Added support for `call_credits_value` from coupons
  - When a coupon with call credits is redeemed, it updates the user's `call_credits` table
  - Returns `creditsGranted` in the response

### 4. Frontend UI Update
- **File**: `src/components/CouponRedemption.js`
- **Changes**:
  - Updated modal to display call credits if granted
  - Updated description to mention "likes, superlikes, or call credits"

## Setup Steps

### Step 1: Run the Migration
Run the migration to add the `call_credits_value` column to the coupons table:

```bash
# From project root
npm run migrate
# Or if using sequelize-cli directly:
npx sequelize-cli db:migrate
```

### Step 2: Run the Seed Script
Execute the seed script to create the "DHANYA" coupon:

```bash
# From project root
node backend/scripts/seed-dhanya-coupon.js
```

**Expected Output**:
```
🔌 Connecting to database...
✅ Successfully created "DHANYA" coupon!
   ID: [coupon_id]
   Code: DHANYA
   Call Credits: 100
   Created: [timestamp]
```

### Step 3: Verify in Database
You can verify the coupon was created by running this query:

```sql
SELECT id, code, coupon_type, call_credits_value, is_active FROM coupons WHERE code = 'DHANYA';
```

Expected result:
```
| id | code   | coupon_type | call_credits_value | is_active |
|----|--------|-------------|-------------------|-----------|
| 1  | DHANYA | callcredits | 100              | true      |
```

## Usage

### For Users
1. Open the **Calls** page
2. Click **"Redeem Coupon"** button
3. Enter code: `DHANYA`
4. Click **"Redeem Coupon"**
5. See 100 call credits added to their account

### For Admin
The coupon appears in the Admin Dashboard under **Coupon Management** with:
- **Type**: callcredits
- **Value**: 100 credits
- **Status**: Active
- **Max Redemptions**: Unlimited
- **Expiry**: Never

## Key Features

✅ Unlimited redemptions (users can redeem multiple times)
✅ No expiry date
✅ Available to all user levels
✅ No minimum user level required
✅ Can be tracked in admin usage analytics
✅ Automatically updates user's call wallet balance

## Testing

### Test the Coupon Redemption

1. **Manual Test**:
   - Login as a test user
   - Navigate to Calls page
   - Click "Redeem Coupon"
   - Enter "DHANYA"
   - Verify 100 credits are added

2. **API Test**:
   ```bash
   curl -X POST http://localhost:5000/api/redeem-coupon \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"couponCode":"DHANYA"}'
   ```

   **Expected Response**:
   ```json
   {
     "message": "Coupon redeemed successfully!",
     "likesGranted": 0,
     "superlikesGranted": 0,
     "creditsGranted": 100,
     "updatedLimits": {...}
   }
   ```

## Rollback (If Needed)

To remove the "DHANYA" coupon:

```sql
DELETE FROM coupons WHERE code = 'DHANYA';
```

To undo the migration:

```bash
npx sequelize-cli db:migrate:undo --name add-call-credits-to-coupons
```

## Troubleshooting

### Issue: Seed script fails with "Column already exists"
- This is fine - the migration ran correctly

### Issue: Coupon not appearing in admin panel
- Clear browser cache and reload
- Verify `is_active` is set to `true` in database

### Issue: Coupon can't be redeemed
- Check coupon `is_active` status
- Verify coupon `start_date` is not in the future
- Check if coupon has `expiry_date` in the past

## Additional Information

- **Coupon Code**: DHANYA (case-insensitive)
- **Credit Type**: Call Credits (for voice/video calls)
- **Amount**: 100 credits
- **Created By**: System seed script
- **Created Date**: [run date of seed script]
