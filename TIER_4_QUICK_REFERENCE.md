# TIER 4: Trust & Safety - Quick Reference

**Quick lookup guide for developers**

---

## Endpoints at a Glance

| # | Method | Endpoint | Purpose | Auth | Admin Only |
|---|--------|----------|---------|------|-----------|
| 112 | POST | /dating/verify/run-fraud-check | Run AI fraud detection | ✅ | Admin |
| 113 | GET | /dating/profile-trust-score/:userId | Get profile trust score | ✅ | No |
| 114 | GET | /dating/users/:userId/red-flags | Check red flags for matches | ✅ | No |
| 115 | POST | /dating/report-suspicious-profile/:userId | Report fraudulent profile | ✅ | No |
| 116 | GET | /dating/conversation-safety/tips | Get safety tips & education | ✅ | No |

---

## Models Summary

### ProfileVerificationScore
```
PK: id
FK: user_id (UNIQUE)
Fields:
  - photo_authenticity_score (0-100)
  - bio_consistency_score (0-100)
  - activity_pattern_score (0-100)
  - location_consistency_score (0-100)
  - profile_field_consistency_score (0-100)
  - overall_trust_score (0-100)
  - fraud_risk_level: ENUM (low, medium, high, critical)
  - verification_level: ENUM (unverified, basic, verified, verified_trusted, flagged)
  - red_flags: JSON array
  - badge_earned: STRING
  - is_hidden: BOOLEAN
  - last_check_date: DATETIME
Indexes: user_id, fraud_risk_level, verification_level, is_hidden
```

### SuspiciousProfileReport
```
PK: id
FK: reporting_user_id, reported_user_id, moderator_id
Fields:
  - reason: ENUM (catfishing, fake_profile, bot, scam, harassment, other)
  - message_ids: JSON array
  - notes: TEXT
  - status: ENUM (reported, investigating, confirmed, dismissed, action_taken)
  - moderator_notes: TEXT
  - action_taken: STRING
  - created_at, updated_at: DATETIME
Indexes: reported_user_id, reporting_user_id, status, reason, created_at
```

---

## Database Indexes (SQL)

```sql
-- ProfileVerificationScore indexes
CREATE INDEX idx_pvs_user_id ON profile_verification_scores(user_id);
CREATE INDEX idx_pvs_fraud_risk ON profile_verification_scores(fraud_risk_level);
CREATE INDEX idx_pvs_verification ON profile_verification_scores(verification_level);
CREATE INDEX idx_pvs_hidden ON profile_verification_scores(is_hidden);

-- SuspiciousProfileReport indexes
CREATE INDEX idx_spr_reported_user ON suspicious_profile_reports(reported_user_id);
CREATE INDEX idx_spr_reporting_user ON suspicious_profile_reports(reporting_user_id);
CREATE INDEX idx_spr_status ON suspicious_profile_reports(status);
CREATE INDEX idx_spr_reason ON suspicious_profile_reports(reason);
CREATE INDEX idx_spr_created ON suspicious_profile_reports(created_at);
```

---

## Endpoint Details

### 112: POST /dating/verify/run-fraud-check

**Admin endpoint to trigger AI fraud detection**

**Request**:
```json
{
  "target_user_id": 123
}
```

**Success Response** (200):
```json
{
  "message": "Fraud check completed",
  "user_id": 123,
  "fraud_risk_level": "low",
  "verification_level": "verified_trusted",
  "trust_score": 82,
  "scores": {
    "photo_authenticity": 85,
    "bio_consistency": 80,
    "activity_pattern": 75,
    "location_consistency": 80,
    "profile_field_consistency": 78
  },
  "red_flags": [],
  "is_hidden": false
}
```

**Error Responses**:
- 403: Not authorized (non-admin)
- 404: User not found

---

### 113: GET /dating/profile-trust-score/:userId

**Get profile's verification and trust score**

**Success Response** (200):
```json
{
  "user_id": 123,
  "verification_level": "verified_trusted",
  "overall_trust_score": 82,
  "badge": "verified_trusted_profile",
  "red_flags": [],
  "reason_safe": "Photo verified, complete profile, active user",
  "is_visible": true
}
```

**Error Responses**:
- 404: Verification score not found

---

### 114: GET /dating/users/:userId/red-flags

**Check what red flags are visible to other matches**

**Success Response** (200):

If clean:
```json
{
  "user_id": 123,
  "has_red_flags": false,
  "warning_level": "none",
  "visible_to_matches": true
}
```

If high risk:
```json
{
  "user_id": 456,
  "has_red_flags": true,
  "warning_level": "high",
  "warning_message": "This profile may not be authentic. Proceed with caution.",
  "red_flags": ["new_account_with_issues"]
}
```

If critical (hidden):
```json
{
  "user_id": 789,
  "has_red_flags": true,
  "warning_level": "critical",
  "visible_to_matches": false
}
```

---

### 115: POST /dating/report-suspicious-profile/:userId

**Report a suspicious or fraudulent profile**

**Request**:
```json
{
  "reason": "catfishing",
  "message_ids": [101, 102],
  "additional_notes": "Photos don't match person"
}
```

**Valid Reasons**: 
- catfishing
- fake_profile
- bot
- scam
- harassment
- other

**Success Response** (201):
```json
{
  "message": "Profile reported successfully",
  "report_id": 1,
  "status": "reported",
  "reason": "catfishing",
  "reported_user_id": 123,
  "timestamp": "2026-04-27T10:15:00Z"
}
```

**Error Responses**:
- 400: Invalid reason
- 400: Can't report yourself
- 404: User not found

---

### 116: GET /dating/conversation-safety/tips

**Get safety education and best practices**

**Success Response** (200):
```json
{
  "safety_tips": {
    "general_safety": [
      "Trust your instincts - if something feels off, it probably is",
      "Never share your home address until you have met in person multiple times",
      ...
    ],
    "online_communication": [...],
    "meeting_in_person": [...],
    "recognizing_red_flags": [...],
    "reporting_issues": [...]
  },
  "general_advice": "Your safety is our priority...",
  "emergency_resources": {
    "national_sexual_assault_hotline": "1-800-656-4673",
    "national_domestic_violence_hotline": "1-800-799-7233"
  }
}
```

---

## Common Queries

### Get all profiles with high fraud risk
```sql
SELECT user_id, fraud_risk_level, red_flags, overall_trust_score
FROM profile_verification_scores
WHERE fraud_risk_level IN ('high', 'critical')
ORDER BY updated_at DESC;
```

### Get all reports about a specific user
```sql
SELECT id, reporting_user_id, reason, status, created_at
FROM suspicious_profile_reports
WHERE reported_user_id = 123
ORDER BY created_at DESC;
```

### Get moderator review queue
```sql
SELECT id, reported_user_id, reason, notes, created_at
FROM suspicious_profile_reports
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 20;
```

### Get verified users to highlight
```sql
SELECT u.id, u.name, pvs.overall_trust_score, pvs.badge_earned
FROM users u
INNER JOIN profile_verification_scores pvs ON u.id = pvs.user_id
WHERE pvs.verification_level = 'verified_trusted'
ORDER BY pvs.overall_trust_score DESC
LIMIT 100;
```

### Get profiles hidden due to critical fraud
```sql
SELECT user_id, red_flags, reason_safe, manual_review_notes
FROM profile_verification_scores
WHERE is_hidden = true
ORDER BY updated_at DESC;
```

---

## Testing Checklist

### Endpoint 112: Fraud Check
- [ ] Admin can run fraud check
- [ ] Non-admin gets 403 error
- [ ] All 5 scores calculated
- [ ] Fraud risk level assigned correctly
- [ ] Red flags populated
- [ ] Badge earned if verified_trusted
- [ ] Profile hidden if critical

### Endpoint 113: Trust Score
- [ ] Returns verification score
- [ ] Shows badge if earned
- [ ] Shows red flags
- [ ] Returns is_visible correctly
- [ ] 404 if no score exists

### Endpoint 114: Red Flags
- [ ] Clean profile shows no flags
- [ ] High risk profile shows warning
- [ ] Critical profile shows hidden message
- [ ] Visible_to_matches correct

### Endpoint 115: Report Profile
- [ ] Successful report created
- [ ] Report ID returned
- [ ] Can't report yourself (400)
- [ ] Invalid reason rejected (400)
- [ ] Multiple reports trigger flag
- [ ] Auto-queued for manual review

### Endpoint 116: Safety Tips
- [ ] All 5 tip categories returned
- [ ] Emergency resources shown
- [ ] Tips are comprehensive
- [ ] No errors on repeated calls

---

## Subscription Tiers

| Feature | Free | Premium |
|---------|------|---------|
| View safety tips | ✅ | ✅ |
| Report profiles | ✅ | ✅ |
| See red flags | ✅ | ✅ |
| Get trust score | ✅ | ✅ |
| Advanced fraud detection | ❌ | ✅ |
| Priority report review | ❌ | ✅ |

---

## Error Codes

| Code | Meaning | Endpoint |
|------|---------|----------|
| 400 | Invalid reason / Can't report self | 115 |
| 403 | Not authorized (non-admin) | 112 |
| 404 | User not found / Score not found | 112, 113 |
| 500 | Server error | All |

---

## Response Formats

### All Endpoints Return JSON

**Success**: 200, 201 status with JSON payload  
**Client Error**: 400, 403, 404 status with error message  
**Server Error**: 500 status with error message

---

## Performance Notes

| Endpoint | Speed | Bottleneck |
|----------|-------|-----------|
| 112 | 500-800ms | AI calculations |
| 113 | 50-100ms | DB lookup |
| 114 | 50-100ms | DB lookup |
| 115 | 100-200ms | Count query |
| 116 | <10ms | Cached response |

**Optimization Tips**:
- Cache endpoint 116 response (rarely changes)
- Queue fraud checks asynchronously
- Use indexes on all lookups
- Batch fraud checks for multiple users

---

## Integration Points

- User model (authenticate, verify user exists)
- Match model (check before allowing new matches)
- DatingProfile model (get profile data for scoring)
- Authentication middleware (verify token)

---

## File Locations

- Endpoints: backend/routes/dating.js (lines 9787-10131)
- Models: backend/models/{ProfileVerificationScore, SuspiciousProfileReport}.js

---

## Quick Start

1. **For Admin**: POST /verify/run-fraud-check with target_user_id
2. **For Users**: GET /profile-trust-score/:userId to see scores
3. **Before Match**: GET /users/:userId/red-flags to check safety
4. **Report Issues**: POST /report-suspicious-profile/:userId
5. **Learn Safety**: GET /conversation-safety/tips

---

✅ **TIER 4 ENDPOINTS READY FOR USE**
