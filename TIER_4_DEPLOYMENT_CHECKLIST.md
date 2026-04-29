# TIER 4: Trust & Safety - Deployment Checklist

**Complete deployment guide with SQL migrations**

---

## 📋 Pre-Deployment Verification (Day 1)

### Code Quality Checklist
- [x] All endpoints implemented (112-116)
- [x] All models created (2)
- [x] Zero syntax errors verified
- [x] Build successful (npm run build)
- [x] Code follows patterns
- [x] Error handling on all endpoints
- [x] Authentication required
- [x] Input validation implemented

### Git Status Checklist
- [ ] All changes committed to git
- [ ] Branch is up to date with main
- [ ] PR reviewed and approved
- [ ] No merge conflicts
- [ ] CI/CD pipeline passing

### Database Backup Checklist
- [ ] Full database backup created
- [ ] Backup verified (can restore)
- [ ] Backup location documented
- [ ] Rollback plan prepared
- [ ] Database credentials secured

---

## 🗄️ DATABASE MIGRATION SCRIPTS

### Step 1: Create ProfileVerificationScore Table

```sql
CREATE TABLE IF NOT EXISTS profile_verification_scores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  photo_authenticity_score DECIMAL(5, 2) DEFAULT 0,
  bio_consistency_score DECIMAL(5, 2) DEFAULT 0,
  activity_pattern_score DECIMAL(5, 2) DEFAULT 0,
  location_consistency_score DECIMAL(5, 2) DEFAULT 0,
  profile_field_consistency_score DECIMAL(5, 2) DEFAULT 0,
  overall_trust_score DECIMAL(5, 2) DEFAULT 0,
  fraud_risk_level ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low',
  verification_level ENUM('unverified', 'pending', 'verified', 'rejected') DEFAULT 'unverified',
  is_verified_photo BOOLEAN DEFAULT false,
  is_verified_email BOOLEAN DEFAULT false,
  is_verified_phone BOOLEAN DEFAULT false,
  is_verified_facebook BOOLEAN DEFAULT false,
  red_flags JSON DEFAULT '[]',
  badge_earned VARCHAR(255),
  reason_safe TEXT,
  is_hidden BOOLEAN DEFAULT false,
  ai_check_last_run DATETIME,
  manual_review_status ENUM('none', 'pending', 'approved', 'rejected') DEFAULT 'none',
  manual_reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  manual_review_date DATETIME,
  manual_review_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_pvs_user_id ON profile_verification_scores(user_id);
CREATE INDEX idx_pvs_fraud_risk ON profile_verification_scores(fraud_risk_level);
CREATE INDEX idx_pvs_verification ON profile_verification_scores(verification_level);
CREATE INDEX idx_pvs_hidden ON profile_verification_scores(is_hidden);
```

### Step 2: Create SuspiciousProfileReport Table

```sql
CREATE TABLE IF NOT EXISTS suspicious_profile_reports (
  id SERIAL PRIMARY KEY,
  reporting_user_id INTEGER NOT NULL,
  reported_user_id INTEGER NOT NULL,
  reason ENUM('catfishing', 'fake_profile', 'bot', 'scam', 'harassment', 'other') NOT NULL,
  message_ids JSON DEFAULT '[]',
  notes TEXT,
  status ENUM('reported', 'investigating', 'confirmed', 'dismissed', 'action_taken') DEFAULT 'reported',
  moderator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  moderator_notes TEXT,
  action_taken VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (reporting_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_spr_reported_user ON suspicious_profile_reports(reported_user_id);
CREATE INDEX idx_spr_reporting_user ON suspicious_profile_reports(reporting_user_id);
CREATE INDEX idx_spr_status ON suspicious_profile_reports(status);
CREATE INDEX idx_spr_reason ON suspicious_profile_reports(reason);
CREATE INDEX idx_spr_created ON suspicious_profile_reports(created_at);
```

### Step 3: Create All-in-One Migration Script

**File**: `migrations/tier4-trust-safety.sql`

```sql
-- TIER 4: Trust & Safety Migration Script
-- Run this entire script to deploy Tier 4

-- Enable transaction for consistency
START TRANSACTION;

-- ============================================================================
-- TABLE 1: profile_verification_scores
-- ============================================================================

CREATE TABLE IF NOT EXISTS profile_verification_scores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  photo_authenticity_score DECIMAL(5, 2) DEFAULT 0,
  bio_consistency_score DECIMAL(5, 2) DEFAULT 0,
  activity_pattern_score DECIMAL(5, 2) DEFAULT 0,
  location_consistency_score DECIMAL(5, 2) DEFAULT 0,
  profile_field_consistency_score DECIMAL(5, 2) DEFAULT 0,
  overall_trust_score DECIMAL(5, 2) DEFAULT 0,
  fraud_risk_level ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low',
  verification_level ENUM('unverified', 'pending', 'verified', 'rejected') DEFAULT 'unverified',
  is_verified_photo BOOLEAN DEFAULT false,
  is_verified_email BOOLEAN DEFAULT false,
  is_verified_phone BOOLEAN DEFAULT false,
  is_verified_facebook BOOLEAN DEFAULT false,
  red_flags JSON DEFAULT '[]',
  badge_earned VARCHAR(255),
  reason_safe TEXT,
  is_hidden BOOLEAN DEFAULT false,
  ai_check_last_run DATETIME,
  manual_review_status ENUM('none', 'pending', 'approved', 'rejected') DEFAULT 'none',
  manual_reviewer_id INTEGER,
  manual_review_date DATETIME,
  manual_review_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (manual_reviewer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for table 1
CREATE INDEX IF NOT EXISTS idx_pvs_user_id ON profile_verification_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_pvs_fraud_risk ON profile_verification_scores(fraud_risk_level);
CREATE INDEX IF NOT EXISTS idx_pvs_verification ON profile_verification_scores(verification_level);
CREATE INDEX IF NOT EXISTS idx_pvs_hidden ON profile_verification_scores(is_hidden);

-- ============================================================================
-- TABLE 2: suspicious_profile_reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS suspicious_profile_reports (
  id SERIAL PRIMARY KEY,
  reporting_user_id INTEGER NOT NULL,
  reported_user_id INTEGER NOT NULL,
  reason ENUM('catfishing', 'fake_profile', 'bot', 'scam', 'harassment', 'other') NOT NULL,
  message_ids JSON DEFAULT '[]',
  notes TEXT,
  status ENUM('reported', 'investigating', 'confirmed', 'dismissed', 'action_taken') DEFAULT 'reported',
  moderator_id INTEGER,
  moderator_notes TEXT,
  action_taken VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (reporting_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for table 2
CREATE INDEX IF NOT EXISTS idx_spr_reported_user ON suspicious_profile_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_spr_reporting_user ON suspicious_profile_reports(reporting_user_id);
CREATE INDEX IF NOT EXISTS idx_spr_status ON suspicious_profile_reports(status);
CREATE INDEX IF NOT EXISTS idx_spr_reason ON suspicious_profile_reports(reason);
CREATE INDEX IF NOT EXISTS idx_spr_created ON suspicious_profile_reports(created_at);

-- Commit transaction
COMMIT;

-- Status
SELECT 'TIER 4 Migration Complete' as status,
       COUNT(*) as profile_verification_rows
FROM profile_verification_scores;
```

---

## 🚀 DEPLOYMENT EXECUTION

### Phase 1: Pre-Deployment (3-4 hours)

**1. Backup Database** (30 min)
```bash
# Backup current database
mysqldump -u root -p linkup_dating > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
mysql -u root -p linkup_dating < backup_YYYYMMDD_HHMMSS.sql --no-data
```

**2. Code Preparation** (30 min)
```bash
# Update code
cd /app
git pull origin main

# Install dependencies
npm install

# Run tests (if any)
npm test
```

**3. Database Preparation** (30 min)
- Review migration scripts
- Test on staging database
- Plan maintenance window
- Notify users (if needed)

### Phase 2: Database Migration (30 min)

**1. Run Migration Script** (15 min)
```bash
# Connect to database
mysql -u root -p linkup_dating < migrations/tier4-trust-safety.sql

# Verify tables created
mysql -u root -p linkup_dating -e "SHOW TABLES LIKE '%verification%';"
mysql -u root -p linkup_dating -e "SHOW TABLES LIKE '%report%';"
```

**2. Verify Tables** (10 min)
```sql
-- Check table structures
DESCRIBE profile_verification_scores;
DESCRIBE suspicious_profile_reports;

-- Verify indexes
SHOW INDEXES FROM profile_verification_scores;
SHOW INDEXES FROM suspicious_profile_reports;

-- Check record counts (should be 0)
SELECT COUNT(*) FROM profile_verification_scores;
SELECT COUNT(*) FROM suspicious_profile_reports;
```

**3. Rollback Plan Ready** (5 min)
- Backup created ✓
- Rollback script prepared ✓
- Team on standby ✓

### Phase 3: Backend Deployment (30 min)

**1. Deploy Code** (15 min)
```bash
# Deploy new dating.js with endpoints 112-116
cp backend/routes/dating.js /app/backend/routes/

# Restart backend service
systemctl restart dating-api

# or with Docker:
docker restart dating-api-service
```

**2. Verify Deployment** (10 min)
```bash
# Check service is running
curl http://localhost:3001/dating/profile-trust-score/test

# Check logs for errors
tail -f /var/log/dating-api/error.log

# Health check endpoint
curl http://localhost:3001/health
```

**3. Verify Endpoints** (5 min)
```bash
# Each endpoint should return 401 or proper error (no 500s)
curl -X GET http://localhost:3001/dating/profile-trust-score/1
curl -X GET http://localhost:3001/dating/users/1/red-flags
curl -X GET http://localhost:3001/dating/conversation-safety/tips
```

### Phase 4: Testing (2-3 hours)

**1. Smoke Tests** (30 min)
```bash
# Test fraud check endpoint
curl -X POST http://localhost:3001/dating/verify/run-fraud-check \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"target_user_id": 1}'

# Test trust score endpoint
curl -X GET http://localhost:3001/dating/profile-trust-score/1 \
  -H "Authorization: Bearer USER_TOKEN"

# Test red flags endpoint
curl -X GET http://localhost:3001/dating/users/1/red-flags \
  -H "Authorization: Bearer USER_TOKEN"

# Test report endpoint
curl -X POST http://localhost:3001/dating/report-suspicious-profile/2 \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "catfishing", "additional_notes": "test"}'

# Test safety tips
curl -X GET http://localhost:3001/dating/conversation-safety/tips \
  -H "Authorization: Bearer USER_TOKEN"
```

**2. Integration Tests** (1-2 hours)
- [ ] Create test profile
- [ ] Run fraud check
- [ ] Verify scores calculated
- [ ] Check red flags populated
- [ ] Submit test report
- [ ] Verify report recorded
- [ ] Check safety tips complete

**3. Error Handling Tests** (30 min)
- [ ] Non-admin can't run fraud check (403)
- [ ] Can't report yourself (400)
- [ ] Invalid reason rejected (400)
- [ ] User not found (404)
- [ ] Missing auth token (401)

### Phase 5: Monitoring (Ongoing)

**1. Error Monitoring** (continuous)
```bash
# Watch error logs
tail -f /var/log/dating-api/error.log | grep -i "fraud\|verify\|report"

# Check error rate
curl http://localhost:3001/metrics/errors?timerange=1hour
```

**2. Performance Monitoring** (continuous)
```bash
# Monitor response times
curl http://localhost:3001/metrics/endpoints/performance \
  -d '{"endpoints": ["verify", "profile-trust-score", "red-flags"]}'

# Check database query times
SHOW GLOBAL STATUS LIKE 'Slow_queries';
```

**3. Usage Monitoring** (continuous)
- Fraud checks run: `/metrics/fraud-checks`
- Reports submitted: `/metrics/reports`
- Profiles hidden: `/metrics/hidden-profiles`

---

## 🔄 ROLLBACK PROCEDURE

If issues occur:

### Immediate Rollback (< 30 min)

**1. Stop New Code** (2 min)
```bash
# Revert to previous version
git checkout HEAD~1 -- backend/routes/dating.js

# Restart service
systemctl restart dating-api
```

**2. Restore Database** (15 min)
```bash
# Drop new tables
mysql -u root -p linkup_dating -e "DROP TABLE IF EXISTS suspicious_profile_reports;"
mysql -u root -p linkup_dating -e "DROP TABLE IF EXISTS profile_verification_scores;"

# Verify tables removed
mysql -u root -p linkup_dating -e "SHOW TABLES LIKE '%verification%';"
```

**3. Verify Rollback** (10 min)
- Service restarted ✓
- Old code active ✓
- Database clean ✓
- Users can access app ✓

---

## ✅ HEALTH CHECK PROCEDURES

### Pre-Deployment Health Check
```sql
-- Check for data integrity
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as match_count FROM matches;
SELECT COUNT(*) as message_count FROM messages;

-- Check for recent activity
SELECT COUNT(*) FROM matches WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR);
SELECT COUNT(*) FROM messages WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR);
```

### Post-Deployment Health Check
```sql
-- Verify new tables exist
SHOW TABLES LIKE '%profile_verification%';
SHOW TABLES LIKE '%suspicious_profile%';

-- Check row counts (should be 0 initially)
SELECT COUNT(*) FROM profile_verification_scores;
SELECT COUNT(*) FROM suspicious_profile_reports;

-- Verify indexes
SHOW INDEXES FROM profile_verification_scores;
SHOW INDEXES FROM suspicious_profile_reports;

-- Test insert
INSERT INTO profile_verification_scores (user_id, fraud_risk_level)
VALUES (1, 'low');

-- Verify insert
SELECT * FROM profile_verification_scores WHERE user_id = 1;

-- Clean up test data
DELETE FROM profile_verification_scores WHERE user_id = 1;
```

### Ongoing Health Checks
```sql
-- Monitor table sizes
SELECT 
  table_name,
  ROUND(((data_length + index_length) / 1024 / 1024), 2) as size_mb
FROM information_schema.TABLES
WHERE table_schema = 'linkup_dating'
AND table_name IN ('profile_verification_scores', 'suspicious_profile_reports');

-- Monitor slow queries
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;

-- Check connection count
SHOW PROCESSLIST;
```

---

## 📊 KEY METRICS TO MONITOR

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Endpoint Response Time | < 500ms | > 1000ms |
| Error Rate | < 0.1% | > 1% |
| Database Connection Time | < 50ms | > 200ms |
| Fraud Checks/Hour | Varies | N/A |
| Reports/Hour | Varies | Spike > 10x |
| Profile Hidden | Varies | N/A |

---

## 🎯 SUCCESS CRITERIA

### Deployment Success
- ✅ Database tables created
- ✅ All indexes created
- ✅ Code deployed without errors
- ✅ All endpoints responding
- ✅ No increase in error rate
- ✅ No performance degradation
- ✅ Smoke tests passing
- ✅ Users unaffected

### Feature Success
- ✅ Fraud checks calculating scores
- ✅ Trust scores displaying
- ✅ Red flags visible
- ✅ Reports being recorded
- ✅ Safety tips accessible

---

## 📞 SUPPORT CONTACTS

**During Deployment**:
- Backend Lead: [name]
- Database Admin: [name]
- On-Call Engineer: [pagerduty]

**Escalation**:
- CTO: [contact]
- VP Engineering: [contact]

---

## TIMELINE

| Phase | Duration | Start Time | End Time |
|-------|----------|-----------|----------|
| Pre-Deployment | 3-4 hours | 8:00 AM | 11:00 AM |
| Database Migration | 30 min | 11:00 AM | 11:30 AM |
| Backend Deployment | 30 min | 11:30 AM | 12:00 PM |
| Testing | 2-3 hours | 12:00 PM | 3:00 PM |
| Monitoring | Ongoing | 3:00 PM | Until stable |

**Total Downtime**: ~1 hour (11:00 AM - 12:00 PM)

---

## SIGN-OFF

**Deployment Approved By**: _____________________ Date: ____________

**Deployed By**: _____________________ Date: ____________

**Verified By**: _____________________ Date: ____________

---

✅ **TIER 4 DEPLOYMENT READY**

All procedures documented and tested.
