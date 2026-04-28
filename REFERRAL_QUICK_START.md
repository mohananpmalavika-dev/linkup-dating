# ⚡ Referral Code System - Quick Reference

## 🚀 FASTEST WAY TO GENERATE CODES FOR ALL USERS

### Step 1: Get an Admin Token
1. Log in as an admin user on your app
2. Open browser DevTools (F12)
3. Go to **Application > Local Storage**
4. Find and copy your **JWT token** (usually stored as `token` or `authToken`)

### Step 2: Run This Command
Open DevTools **Console** tab and run:

```javascript
fetch('/api/admin/referrals/generate-all', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer YOUR_TOKEN_HERE`
  }
})
.then(r => r.json())
.then(d => {
  console.log('✅ Generated:', d.summary.codesCreated);
  console.log('⏭️ Skipped:', d.summary.codesSkipped);
  console.log('❌ Errors:', d.summary.errors);
  console.log('📊 Full Results:', d.details);
});
```

**Replace `YOUR_TOKEN_HERE`** with your actual token!

---

## ✅ Check if Codes Were Generated

```javascript
fetch('/api/admin/referrals/stats', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer YOUR_TOKEN_HERE`
  }
})
.then(r => r.json())
.then(d => console.log(d.stats));
```

**Expected Output:**
```json
{
  "totalUsers": 250,
  "usersWithReferralCodes": 245,
  "coveragePercentage": "98.00%",
  "referralsByStatus": {
    "pending": 240,
    "completed": 5,
    "expired": 0
  }
}
```

---

## 🔧 Regenerate Code for One User

```javascript
fetch('/api/admin/referrals/regenerate/123', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer YOUR_TOKEN_HERE`
  }
})
.then(r => r.json())
.then(d => {
  console.log('New Code:', d.code);
  console.log('Link:', d.link);
});
```

Replace `123` with the user ID.

---

## 📋 API Endpoints

| Action | Method | URL |
|--------|--------|-----|
| Generate all codes | POST | `/api/admin/referrals/generate-all` |
| Check stats | GET | `/api/admin/referrals/stats` |
| Regenerate for user | POST | `/api/admin/referrals/regenerate/{userId}` |
| My referral code | GET | `/api/referrals/my-code` |
| Accept code (signup) | POST | `/api/referrals/accept` |
| My stats | GET | `/api/referrals/stats` |
| Leaderboard | GET | `/api/referrals/leaderboard?limit=10` |

---

## 🎯 Common Issues

| Problem | Solution |
|---------|----------|
| 403 Forbidden | User is not an admin. Use admin account. |
| Network error | Backend server not running. Start it with `npm start` |
| Token invalid | Copy token again from localStorage |
| Codes exist but coverage < 100% | Some users may have created codes manually. Run generation again - it skips existing ones |

---

## 📊 Database Queries

Check referral status:
```sql
-- Overall stats
SELECT COUNT(*) as total_users,
       COUNT(DISTINCT referrer_user_id) as with_codes,
       COUNT(DISTINCT referred_user_id) as successful_referrals
FROM referrals;

-- Top 10 referrers
SELECT u.id, u.email, COUNT(*) as referral_count
FROM referrals r
JOIN users u ON r.referrer_user_id = u.id
WHERE r.status = 'completed'
GROUP BY u.id
ORDER BY referral_count DESC LIMIT 10;
```

---

## 🎉 After Generation

Users can now:
1. Visit their profile → **Referrals** tab
2. See their unique code (e.g., `LINK123ABC456`)
3. Share code with friends
4. When friend joins with code, both get rewards:
   - ✅ +7 premium days
   - ✅ +5 superlikes

---

**All users should now have referral codes!** 🚀
