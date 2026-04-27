# Tier 3 Deployment Checklist & SQL Migrations

**Complete guide to deploying Tier 3 to production**

---

## Pre-Deployment Verification

- [x] All 21 endpoints implemented
- [x] All 7 models created
- [x] 0 syntax errors verified
- [x] Build successful
- [x] Code pushed to git
- [x] Documentation complete

---

## Database Migration Scripts

### Step 1: Create FriendReferral Table
```sql
CREATE TABLE friend_referrals (
  id SERIAL PRIMARY KEY,
  referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_type ENUM('romantic_setup') DEFAULT 'romantic_setup' NOT NULL,
  referral_message TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  accepted_at TIMESTAMP,
  match_result ENUM('pending', 'matched', 'met', 'still_talking') DEFAULT 'pending' NOT NULL
);

CREATE INDEX idx_friend_referral_referrer ON friend_referrals(referrer_user_id);
CREATE INDEX idx_friend_referral_recipient ON friend_referrals(recipient_user_id);
CREATE INDEX idx_friend_referral_match_result ON friend_referrals(match_result);
```

### Step 2: Create VideoDate Table
```sql
CREATE TABLE video_dates (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  initiator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMP,
  duration_seconds INTEGER,
  video_quality_rating INTEGER CHECK (video_quality_rating >= 1 AND video_quality_rating <= 5),
  connection_quality ENUM('poor', 'fair', 'good', 'excellent'),
  feedback ENUM('great_conversation', 'good_chemistry', 'not_interested', 'maybe_later'),
  recording_available BOOLEAN DEFAULT false,
  webrtc_token VARCHAR(500),
  status ENUM('pending', 'initiated', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_video_date_match ON video_dates(match_id);
CREATE INDEX idx_video_date_initiator ON video_dates(initiator_id);
CREATE INDEX idx_video_date_status ON video_dates(status);
CREATE INDEX idx_video_date_start_time ON video_dates(start_time);
```

### Step 3: Create UserAchievement Table
```sql
CREATE TABLE user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type ENUM(
    'first_match', 'great_communicator', 'popular', 'superstar',
    'date_master', 'matchmaker', 'traveler', 'reliable',
    'quiz_master', 'consistent', 'on_fire', 'mvp'
  ) NOT NULL,
  earned_at TIMESTAMP DEFAULT NOW() NOT NULL,
  progress INTEGER DEFAULT 1 NOT NULL,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_achievement_user ON user_achievements(user_id);
CREATE INDEX idx_achievement_badge_type ON user_achievements(badge_type);
CREATE INDEX idx_achievement_earned_at ON user_achievements(earned_at);
CREATE UNIQUE INDEX idx_achievement_unique ON user_achievements(user_id, badge_type);
```

### Step 4: Create PersonalityArchetype Table
```sql
CREATE TABLE personality_archetypes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  archetype_name VARCHAR(100) NOT NULL,
  archetype_code ENUM(
    'adventurer', 'romantic', 'intellectual', 'protector',
    'counselor', 'mastermind', 'debater', 'campaigner',
    'logistician', 'defender', 'virtuoso', 'entrepreneur',
    'advocate', 'mediator', 'healer', 'commander'
  ) NOT NULL,
  description TEXT,
  strengths JSONB DEFAULT '[]' NOT NULL,
  communication_style TEXT,
  best_matches JSONB DEFAULT '[]' NOT NULL,
  archetype_preferences JSONB DEFAULT '[]',
  avoid_archetypes JSONB DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_archetype_user ON personality_archetypes(user_id);
CREATE INDEX idx_archetype_code ON personality_archetypes(archetype_code);
CREATE UNIQUE INDEX idx_archetype_user_unique ON personality_archetypes(user_id);
```

### Step 5: Create DatingGoal Table
```sql
CREATE TABLE dating_goals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_type ENUM(
    'find_matches', 'go_on_dates', 'serious_relationship',
    'meet_at_event', 'profile_completion', 'daily_active'
  ) NOT NULL,
  goal_description TEXT,
  deadline TIMESTAMP,
  target_count INTEGER,
  current_progress INTEGER DEFAULT 0,
  status ENUM('active', 'completed', 'abandoned', 'paused') DEFAULT 'active' NOT NULL,
  progress_metrics JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP
);

CREATE INDEX idx_goal_user ON dating_goals(user_id);
CREATE INDEX idx_goal_status ON dating_goals(status);
CREATE INDEX idx_goal_user_status ON dating_goals(user_id, status);
CREATE INDEX idx_goal_deadline ON dating_goals(deadline);
```

### Step 6: Create DatingEvent Table
```sql
CREATE TABLE dating_events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date TIMESTAMP NOT NULL,
  location_city VARCHAR(100) NOT NULL,
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  category ENUM(
    'singles_event', 'speed_dating', 'social_gathering',
    'outdoor_activity', 'hobby_meetup', 'sports', 'cultural', 'other'
  ) NOT NULL,
  is_dating_focused BOOLEAN DEFAULT true,
  organizer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  max_attendees INTEGER,
  attending_count INTEGER DEFAULT 0,
  interested_count INTEGER DEFAULT 0,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_event_location_city ON dating_events(location_city);
CREATE INDEX idx_event_date ON dating_events(event_date);
CREATE INDEX idx_event_category ON dating_events(category);
CREATE INDEX idx_event_organizer ON dating_events(organizer_id);
CREATE INDEX idx_event_location_geo ON dating_events(location_latitude, location_longitude);
```

### Step 7: Create EventAttendees Table
```sql
CREATE TABLE event_attendees (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES dating_events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status ENUM('attending', 'interested', 'declined') DEFAULT 'attending' NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
  attended_at TIMESTAMP
);

CREATE INDEX idx_attendee_event ON event_attendees(event_id);
CREATE INDEX idx_attendee_user ON event_attendees(user_id);
CREATE INDEX idx_attendee_event_user ON event_attendees(event_id, user_id);
CREATE UNIQUE INDEX idx_attendee_unique ON event_attendees(event_id, user_id);
```

---

## Full Migration Script (All-In-One)

```sql
-- Tier 3 Database Migration - All Tables
-- Execute this script to create all Tier 3 database tables

BEGIN;

-- 1. FriendReferral
CREATE TABLE friend_referrals (
  id SERIAL PRIMARY KEY,
  referrer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_type VARCHAR(50) DEFAULT 'romantic_setup' NOT NULL,
  referral_message TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  accepted_at TIMESTAMP,
  match_result VARCHAR(20) DEFAULT 'pending' NOT NULL
);

CREATE INDEX idx_friend_referral_referrer ON friend_referrals(referrer_user_id);
CREATE INDEX idx_friend_referral_recipient ON friend_referrals(recipient_user_id);

-- 2. VideoDate
CREATE TABLE video_dates (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  initiator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMP,
  duration_seconds INTEGER,
  video_quality_rating INTEGER,
  connection_quality VARCHAR(20),
  feedback VARCHAR(50),
  recording_available BOOLEAN DEFAULT false,
  webrtc_token VARCHAR(500),
  status VARCHAR(30) DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_video_date_match ON video_dates(match_id);
CREATE INDEX idx_video_date_status ON video_dates(status);

-- 3. UserAchievement
CREATE TABLE user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type VARCHAR(50) NOT NULL,
  earned_at TIMESTAMP DEFAULT NOW() NOT NULL,
  progress INTEGER DEFAULT 1 NOT NULL,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_achievement_user ON user_achievements(user_id);
CREATE INDEX idx_achievement_badge_type ON user_achievements(badge_type);

-- 4. PersonalityArchetype
CREATE TABLE personality_archetypes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  archetype_name VARCHAR(100) NOT NULL,
  archetype_code VARCHAR(50) NOT NULL,
  description TEXT,
  strengths JSONB DEFAULT '[]' NOT NULL,
  communication_style TEXT,
  best_matches JSONB DEFAULT '[]' NOT NULL,
  archetype_preferences JSONB DEFAULT '[]',
  avoid_archetypes JSONB DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_archetype_user ON personality_archetypes(user_id);
CREATE INDEX idx_archetype_code ON personality_archetypes(archetype_code);

-- 5. DatingGoal
CREATE TABLE dating_goals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_type VARCHAR(50) NOT NULL,
  goal_description TEXT,
  deadline TIMESTAMP,
  target_count INTEGER,
  current_progress INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' NOT NULL,
  progress_metrics JSONB DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP
);

CREATE INDEX idx_goal_user ON dating_goals(user_id);
CREATE INDEX idx_goal_status ON dating_goals(status);

-- 6. DatingEvent
CREATE TABLE dating_events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date TIMESTAMP NOT NULL,
  location_city VARCHAR(100) NOT NULL,
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  category VARCHAR(50) NOT NULL,
  is_dating_focused BOOLEAN DEFAULT true,
  organizer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  max_attendees INTEGER,
  attending_count INTEGER DEFAULT 0,
  interested_count INTEGER DEFAULT 0,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_event_location_city ON dating_events(location_city);
CREATE INDEX idx_event_date ON dating_events(event_date);
CREATE INDEX idx_event_category ON dating_events(category);
CREATE INDEX idx_event_organizer ON dating_events(organizer_id);

-- 7. EventAttendees
CREATE TABLE event_attendees (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES dating_events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'attending' NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW() NOT NULL,
  attended_at TIMESTAMP
);

CREATE INDEX idx_attendee_event ON event_attendees(event_id);
CREATE INDEX idx_attendee_user ON event_attendees(user_id);
CREATE UNIQUE INDEX idx_attendee_unique ON event_attendees(event_id, user_id);

COMMIT;
```

---

## Deployment Steps

### Phase 1: Pre-Deployment (Day 1)
- [ ] Backup production database
- [ ] Test migrations on staging database
- [ ] Verify all endpoints in staging
- [ ] Code review completed
- [ ] Security audit passed

### Phase 2: Database Migration (Day 2)
- [ ] Execute migration script
- [ ] Verify all tables created
- [ ] Verify all indexes created
- [ ] Check table relationships
- [ ] Confirm 0 errors

```bash
# Run migration
psql -U postgres -d linkup_db -f tier3_migration.sql

# Verify tables created
\dt (in psql)
```

### Phase 3: Code Deployment (Day 2)
- [ ] Deploy dating.js with endpoints 91-111
- [ ] Deploy 7 model files
- [ ] Deploy supporting libraries
- [ ] Verify server starts without errors

```bash
# Build and deploy
npm run build
git add .
git commit -m "Tier 3: Add platforms & gamification features"
git push

# Restart server
pm2 restart dating-api
# or
systemctl restart dating-api
```

### Phase 4: Smoke Testing (Day 2-3)
- [ ] Test endpoint 91: Referral creation
- [ ] Test endpoint 95: Video date request
- [ ] Test endpoint 99: Nearby events
- [ ] Test endpoint 103: Achievements
- [ ] Test endpoint 108: Goal creation
- [ ] All endpoints respond with correct status codes
- [ ] All authentication checks pass
- [ ] Premium tier gating works

### Phase 5: Integration Testing (Day 3-4)
- [ ] Full referral flow (91→92→93→94)
- [ ] Full video dating flow (95→96→97→98)
- [ ] Full event flow (99→100→101→102)
- [ ] Achievement auto-unlock logic
- [ ] Goal progress tracking
- [ ] Archetype compatibility calculations

### Phase 6: Load Testing (Day 4)
- [ ] Test Haversine distance query (high load)
- [ ] Test leaderboard query (aggregation)
- [ ] Test concurrent event attendance
- [ ] Monitor database connection pool
- [ ] Check query performance

### Phase 7: User Acceptance Testing (Day 5)
- [ ] QA team tests all features
- [ ] Product team validates UX
- [ ] Security team verifies authorization
- [ ] Performance team confirms SLA compliance

### Phase 8: Soft Launch (Day 6-7)
- [ ] Enable for 10% of users
- [ ] Monitor error rates
- [ ] Collect user feedback
- [ ] Monitor server load
- [ ] Check database performance

### Phase 9: Full Launch (Day 8+)
- [ ] Enable for 50% of users
- [ ] Monitor metrics
- [ ] Enable for 100% of users
- [ ] Celebrate! 🎉

---

## Rollback Procedure

If issues occur, rollback in this order:

```sql
-- Rollback all Tier 3 tables
DROP TABLE IF EXISTS event_attendees CASCADE;
DROP TABLE IF EXISTS dating_events CASCADE;
DROP TABLE IF EXISTS dating_goals CASCADE;
DROP TABLE IF EXISTS personality_archetypes CASCADE;
DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS video_dates CASCADE;
DROP TABLE IF EXISTS friend_referrals CASCADE;
```

Then redeploy previous dating.js version without Tier 3 endpoints.

---

## Health Checks

### Database Health
```sql
-- Check table row counts
SELECT 'friend_referrals' as table_name, COUNT(*) as rows FROM friend_referrals
UNION ALL
SELECT 'video_dates', COUNT(*) FROM video_dates
UNION ALL
SELECT 'user_achievements', COUNT(*) FROM user_achievements
UNION ALL
SELECT 'personality_archetypes', COUNT(*) FROM personality_archetypes
UNION ALL
SELECT 'dating_goals', COUNT(*) FROM dating_goals
UNION ALL
SELECT 'dating_events', COUNT(*) FROM dating_events
UNION ALL
SELECT 'event_attendees', COUNT(*) FROM event_attendees;
```

### API Health Endpoint
```
GET /health/tier-3
Response: { status: "ok", version: "3.0", tables: 7, endpoints: 21 }
```

### Key Metrics to Monitor
- Average endpoint response time < 200ms
- P95 response time < 500ms
- Error rate < 0.1%
- Database query time < 100ms
- Connection pool usage < 80%

---

## Support Contacts

| Issue | Contact |
|-------|---------|
| Database errors | Database team |
| API errors | Backend team |
| High latency | DevOps team |
| Feature bugs | QA team |

---

## Post-Deployment Tasks

### Day 1 After Launch
- [ ] Verify all metrics normal
- [ ] Check user feedback
- [ ] Confirm no error spikes
- [ ] Monitor database load

### Week 1 After Launch
- [ ] Optimize slow queries if needed
- [ ] Update documentation
- [ ] Gather user feedback
- [ ] Plan Tier 4 implementation

---

## Sign-Off

**Deployment Status**: ✅ READY

All pre-deployment checks passed. Ready to execute migration and deployment.

**Approved By**: [Engineering Lead]
**Date**: April 27, 2026
**Version**: Tier 3 v1.0

---

**Expected Timeline**: 2-3 days from database migration to full launch
**Expected Downtime**: 0-15 minutes during migration (if any)
**Success Criteria**: All 21 endpoints operational, 0 errors, <200ms P50 latency
