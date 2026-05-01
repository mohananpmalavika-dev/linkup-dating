# 📱 DatingHub Referral Code System - Implementation Guide

## Overview
This guide explains how the referral code system works for DatingHub, allowing users to invite friends and family to join the platform and earn rewards.

---

## 🎯 How It Works

### For Users
1. Each user automatically gets a **unique referral code** (format: `LINK{userId}{randomString}`)
2. Users can find and share their code from the **Referral Dashboard**
3. When a friend joins using the referral code, **both users earn rewards**:
   - +7 premium days
   - +5 superlikes

### For Referrers
- **Unlimited invites** - no limit on how many friends you can refer
- **Rewards compound** - each successful referral brings more rewards
- **Leaderboard** - compete with other referrers for top spots
- **Track progress** - see all your referrals in one place

---

## 🚀 Getting Started

### Option 1: Automatic Generation (Recommended for Live Server)

If you're running the backend server and connected to the database, use the **Admin API** to generate codes for all users:

#### Endpoint
```
POST /api/admin/referrals/generate-all
```

#### Requirements
- Must be logged in as an **admin user**
- Admin flag must be set in user record: `is_admin = true`

#### Usage Example (from browser console or API client):
```javascript
// Using fetch API
fetch('/api/admin/referrals/generate-all', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${yourAuthToken}`
  }
})
.then(res => res.json())
.then(data => {
  console.log('Generated:', data.summary.codesCreated);
  console.log('Skipped:', data.summary.codesSkipped);
  console.log('Details:', data.details);
});
```

#### Response Example
```json
{
  "success": true,
  "message": "Referral code generation completed. Created: 150, Skipped: 0, Errors: 0",
  "summary": {
    "totalUsers": 150,
    "codesCreated": 150,
    "codesSkipped": 0,
    "errors": 0
  },
  "details": [
    {
      "userId": 1,
      "email": "user1@example.com",
      "status": "created",
      "code": "LINK1A2B3C4D",
      "link": "https://datinghub.app/?referral=LINK1A2B3C4D",
      "message": "Referral code created"
    }
  ]
}
```

### Option 2: Node.js Script (For Local Development)

If you have PostgreSQL running locally:

```bash
cd backend
node scripts/generateReferralCodes.js
```

**Note:** This requires a running PostgreSQL database connection.

---

## 📊 Admin Endpoints

### 1. Generate Referral Codes for All Users
```
POST /api/admin/referrals/generate-all
```
Generates referral codes for all users who don't already have one.

**Response:** Includes detailed list of results for each user.

---

### 2. Get Referral Statistics
```
GET /api/admin/referrals/stats
```

Returns system-wide referral statistics.

**Response Example:**
```json
{
  "success": true,
  "stats": {
    "totalUsers": 250,
    "usersWithReferralCodes": 245,
    "coveragePercentage": "98.00%",
    "referralsByStatus": {
      "pending": 240,
      "completed": 5,
      "expired": 0
    }
  }
}
```

---

### 3. Regenerate Referral Code for Specific User
```
POST /api/admin/referrals/regenerate/:userId
```

Regenerates a new referral code for a specific user (marks old code as expired).

**Example:**
```
POST /api/admin/referrals/regenerate/123
```

**Response:**
```json
{
  "success": true,
  "message": "New referral code generated",
  "code": "LINK123X9Y8Z7",
  "link": "https://datinghub.app/?referral=LINK123X9Y8Z7"
}
```

---

## 👥 User-Facing Endpoints

### 1. Get or Create My Referral Code
```
GET /api/referrals/my-code
```
Returns the user's referral code and link.

---

### 2. Accept a Referral Code
```
POST /api/referrals/accept
Body: { "referralCode": "LINK1A2B3C4D" }
```
New user joins with a friend's referral code. Both users get rewards.

---

### 3. Get My Referral Stats
```
GET /api/referrals/stats
```
Shows friends invited, successful referrals, rewards earned.

---

### 4. Get Referral Leaderboard
```
GET /api/referrals/leaderboard?limit=10
```
Shows top 10 referrers.

---

## 🎨 Frontend Components

### Already Implemented
- ✅ `ReferralDashboard.js` - Main dashboard showing stats
- ✅ `ReferralShareModal.js` - Share referral code modal
- ✅ `ReferralInviteModal.js` - Invite friends modal
- ✅ `ReferralLeaderboard.js` - Top referrers leaderboard
- ✅ `ReferralRewardsCenter.js` - View and claim rewards
- ✅ `ReferralRedeemModal.js` - Redeem referral codes

### How to Integrate in Your App

#### 1. Add to User Profile/Home Page
```jsx
import ReferralDashboard from './components/ReferralDashboard';

export default function UserProfile() {
  const [showShareModal, setShowShareModal] = useState(false);
  
  return (
    <>
      <ReferralDashboard 
        onOpenShareModal={() => setShowShareModal(true)}
        onOpenRedeemModal={() => {/* ... */}}
      />
      {/* Other components */}
    </>
  );
}
```

#### 2. Add to Navigation Menu
```jsx
<Link to="/referrals">
  <span>🎉 Refer Friends</span>
  <span className="badge">{pendingRewards}</span>
</Link>
```

---

## 💎 Reward Details

### Per Successful Referral
- **Referrer Gets:**
  - 7 days of premium access
  - 5 superlikes
  
- **New User (Referred) Gets:**
  - 7 days of premium access
  - 5 superlikes

### Reward Expiration
- Rewards expire in 30 days if not claimed
- Use the Rewards Center to view and claim pending rewards

---

## 🔒 Security & Validation

### Referral Code Validation
- Codes are **unique** per user
- Codes are **case-sensitive**
- **1-year expiration** default
- Can't use the same code twice
- Can't refer yourself
- Each new user can only use **one referral code**

### Rate Limiting
- Applies to referral endpoints
- Prevents abuse and spam

---

## 🐛 Troubleshooting

### Problem: "User not found" when generating codes
**Solution:** Ensure all users have entries in the `users` table. The script only generates codes for users that exist.

### Problem: "Referral code already exists"
**Solution:** This is expected - the system won't create duplicate codes. Use the `/admin/referrals/stats` endpoint to check coverage.

### Problem: Codes not appearing for users
**Solution:** 
1. Check that referral codes were generated: `GET /api/admin/referrals/stats`
2. If coverage < 100%, run the generation endpoint again
3. Check user's `GET /api/referrals/my-code` to confirm they have a code

### Problem: Referral rewards not applying
**Solution:**
1. Verify new user accepted the referral code during signup
2. Check that referral status is "completed" in database
3. Have user visit Rewards Center to claim pending rewards

---

## 📈 Metrics to Track

```sql
-- See referral coverage
SELECT 
  COUNT(DISTINCT referrer_user_id) as users_with_codes,
  COUNT(DISTINCT referred_user_id) as successful_referrals,
  COUNT(DISTINCT CASE WHEN status='completed' THEN id END) as completed_referrals
FROM referrals;

-- Get top referrers
SELECT referrer_user_id, COUNT(*) as count
FROM referrals 
WHERE status = 'completed'
GROUP BY referrer_user_id
ORDER BY count DESC LIMIT 10;
```

---

## 📞 API Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/referrals/my-code` | User | Get my referral code |
| POST | `/api/referrals/accept` | User | Accept referral code |
| GET | `/api/referrals/stats` | User | My referral stats |
| GET | `/api/referrals/rewards/pending` | User | View pending rewards |
| POST | `/api/referrals/rewards/claim` | User | Claim rewards |
| GET | `/api/referrals/leaderboard` | User | View top referrers |
| POST | `/api/admin/referrals/generate-all` | Admin | Generate all codes |
| GET | `/api/admin/referrals/stats` | Admin | System statistics |
| POST | `/api/admin/referrals/regenerate/:userId` | Admin | Regenerate one code |

---

## 🎉 Next Steps

1. **Generate Codes**: Run `/api/admin/referrals/generate-all` for all users
2. **Verify**: Check `/api/admin/referrals/stats` to confirm coverage
3. **Integrate Frontend**: Add ReferralDashboard to user profiles
4. **Test**: Create test accounts and verify referral flow works
5. **Monitor**: Track engagement in leaderboard and reward claims

---

**Need Help?** Check the backend logs for detailed error messages or review the referralService.js for implementation details.
