# Tier 3 Quick Reference

**Quick lookup for Tier 3 implementation**

---

## Endpoints At A Glance

### Friend Referrals (91-94)
| # | Method | Endpoint | Auth | Purpose |
|---|--------|----------|------|---------|
| 91 | POST | /dating/referrals/introduce | ✅ | Set friend up |
| 92 | GET | /dating/referrals/incoming | ✅ | View referrals |
| 93 | POST | /dating/referrals/:id/accept | ✅ | Accept referral |
| 94 | GET | /dating/referrals/success | ✅ | Track success |

### Video Dating (95-98)
| # | Method | Endpoint | Auth | Premium | Purpose |
|---|--------|----------|------|---------|---------|
| 95 | POST | /dating/video-dates/request/:matchId | ✅ | - | Request video |
| 96 | GET | /dating/video-dates/pending | ✅ | - | View pending |
| 97 | POST | /dating/video-dates/:id/complete | ✅ | - | Rate video |
| 98 | GET | /dating/video-dates/history | ✅ | - | History |

### Events (99-102)
| # | Method | Endpoint | Auth | Premium | Purpose |
|---|--------|----------|------|---------|---------|
| 99 | GET | /dating/events/nearby | ✅ | - | Find events |
| 100 | POST | /dating/events/:id/attend | ✅ | - | Attend event |
| 101 | GET | /dating/events/:id/attendees | ✅ | ✅ | Who's attending |
| 102 | GET | /dating/matching/event-based | ✅ | - | Event matches |

### Achievements (103-104)
| # | Method | Endpoint | Auth | Purpose |
|---|--------|----------|------|---------|
| 103 | GET | /dating/achievements | ✅ | View badges |
| 104 | GET | /dating/leaderboard | ✅ | Top users |

### Archetypes (105-107)
| # | Method | Endpoint | Auth | Purpose |
|---|--------|----------|------|---------|
| 105 | GET | /dating/personality-archetype | ✅ | Get archetype |
| 106 | GET | /dating/archetype/:a1/compatibility/:a2 | ✅ | Check compatibility |
| 107 | POST | /dating/profiles/archetype-preference | ✅ | Set preferences |

### Goals (108-110)
| # | Method | Endpoint | Auth | Purpose |
|---|--------|----------|------|---------|
| 108 | POST | /dating/goals | ✅ | Create goal |
| 109 | GET | /dating/goals/progress | ✅ | Track progress |
| 110 | GET | /dating/goals/statistics | ✅ | View stats |

### Bonus (111)
| # | Method | Endpoint | Auth | Purpose |
|---|--------|----------|------|---------|
| 111 | GET | /dating/event-attendees/:userId | ✅ | User's events |

---

## Models Summary

| Model | Fields | Purpose |
|-------|--------|---------|
| FriendReferral | 7 | Set friends up |
| VideoDate | 10 | Virtual dates |
| UserAchievement | 7 | Badge system |
| PersonalityArchetype | 10 | Personality matching |
| DatingGoal | 9 | Goal tracking |
| DatingEvent | 10 | Event discovery |
| EventAttendees | 5 | Attendance tracking |

---

## Database Indexes

```sql
-- FriendReferral
CREATE INDEX idx_friend_referral_referrer ON friend_referrals(referrer_user_id);
CREATE INDEX idx_friend_referral_recipient ON friend_referrals(recipient_user_id);

-- VideoDate
CREATE INDEX idx_video_date_match ON video_dates(match_id);
CREATE INDEX idx_video_date_status ON video_dates(status);

-- UserAchievement
CREATE INDEX idx_achievement_user ON user_achievements(user_id);
CREATE INDEX idx_achievement_badge ON user_achievements(badge_type);

-- PersonalityArchetype
CREATE INDEX idx_archetype_user ON personality_archetypes(user_id);
CREATE INDEX idx_archetype_code ON personality_archetypes(archetype_code);

-- DatingGoal
CREATE INDEX idx_goal_user ON dating_goals(user_id);
CREATE INDEX idx_goal_status ON dating_goals(status);

-- DatingEvent
CREATE INDEX idx_event_city ON dating_events(location_city);
CREATE INDEX idx_event_date ON dating_events(event_date);
CREATE INDEX idx_event_category ON dating_events(category);

-- EventAttendees
CREATE INDEX idx_attendee_event ON event_attendees(event_id);
CREATE INDEX idx_attendee_user ON event_attendees(user_id);
CREATE UNIQUE INDEX idx_attendee_unique ON event_attendees(event_id, user_id);
```

---

## Testing Checklist

### Friend Referrals
- [ ] Create referral with valid friend
- [ ] View incoming referrals
- [ ] Accept referral → creates match
- [ ] Check success stats
- [ ] Verify "Great Matchmaker" badge at 3 referrals

### Video Dating
- [ ] Request video date with valid time
- [ ] View pending requests
- [ ] Complete video date with rating
- [ ] Check history and statistics

### Events
- [ ] Get nearby events (with location)
- [ ] Attend event
- [ ] View attendees (Premium check)
- [ ] Get event-based matches
- [ ] Verify Haversine distance calculation

### Achievements
- [ ] View all badges
- [ ] Check leaderboard ranking
- [ ] Verify streaks display

### Archetypes
- [ ] Get personality archetype (auto-create if missing)
- [ ] Check archetype compatibility
- [ ] Update preferences

### Goals
- [ ] Create goal with deadline
- [ ] Check progress
- [ ] View statistics

---

## Common Queries

### Find events within 50km
```javascript
GET /dating/events/nearby?lat=40.7128&lng=-74.0060&radius_km=50
```

### Get user's achievements
```javascript
GET /dating/achievements
```

### Refer a friend
```javascript
POST /dating/referrals/introduce
{
  "friend_user_id": 123,
  "referral_message": "Meet my friend Alex!"
}
```

### Request video date
```javascript
POST /dating/video-dates/request/456
{
  "proposed_time": "2026-05-15T19:00:00Z",
  "duration_minutes": 30
}
```

### Attend event
```javascript
POST /dating/events/789/attend
```

### Check archetype compatibility
```javascript
GET /dating/archetype/romantic/compatibility/protector
```

### Create goal
```javascript
POST /dating/goals
{
  "goal_type": "go_on_dates",
  "goal_description": "Meet someone in person",
  "deadline": "2026-06-30",
  "target_count": 3
}
```

---

## Subscription Tiers

### Free
- Referrals: Unlimited
- Video dates: 3/day
- Events: View nearby, attend, see public info
- Achievements: View, display
- Archetypes: View archetype, basic compatibility
- Goals: Create, track

### Premium
- Video dates: Unlimited
- Events: See all attendees (Endpoint 101)
- Everything else from Free

### Gold
- Everything from Premium
- Concierge matches (from Tier 2)
- Event organizer tools

---

## Error Codes

| Code | Scenario |
|------|----------|
| 400 | Missing required fields |
| 403 | Premium feature (not subscribed) or not authorized |
| 404 | Resource not found (friend, event, etc.) |
| 500 | Server error |

---

## Response Formats

### Referral Response
```json
{
  "referral": {
    "id": 1,
    "referrer_user_id": 100,
    "referred_user_id": 101,
    "recipient_user_id": 102,
    "match_result": "pending"
  },
  "message": "Referral sent!"
}
```

### Video Date Response
```json
{
  "videoDate": {
    "id": 1,
    "match_id": 50,
    "status": "pending",
    "start_time": "2026-05-15T19:00:00Z"
  }
}
```

### Achievement Response
```json
{
  "badges": [
    {
      "badge_type": "first_match",
      "earned_at": "2026-04-20"
    }
  ],
  "current_streaks": {
    "daily_login": 15,
    "messaging": 8
  }
}
```

### Event Response
```json
{
  "events": [
    {
      "id": 1,
      "title": "Hiking Meetup",
      "event_date": "2026-05-20",
      "location_city": "New York",
      "distance_km": 2.5
    }
  ]
}
```

### Goal Response
```json
{
  "id": 1,
  "goal_type": "go_on_dates",
  "target_count": 3,
  "current_progress": 1,
  "deadline": "2026-06-30",
  "status": "active"
}
```

---

## Integration Checklist

- [ ] FriendReferral model auto-registered
- [ ] VideoDate model auto-registered
- [ ] UserAchievement model auto-registered
- [ ] PersonalityArchetype model auto-registered
- [ ] DatingGoal model auto-registered
- [ ] DatingEvent model auto-registered
- [ ] EventAttendees model auto-registered
- [ ] All 21 endpoints loaded
- [ ] All 7 models included in db object

---

## Performance Notes

- Haversine queries: O(n) with LIMIT 50
- Achievement queries: Indexed by user_id
- Goal queries: Indexed by user_id + status
- Event queries: Indexed by city + date + category
- Leaderboard: Uses COUNT aggregation (may need caching)

---

## File Locations

```
backend/
├── models/
│   ├── FriendReferral.js
│   ├── VideoDate.js
│   ├── UserAchievement.js
│   ├── PersonalityArchetype.js
│   ├── DatingGoal.js
│   ├── DatingEvent.js
│   └── EventAttendees.js
└── routes/
    └── dating.js (endpoints 91-111)
```

---

## Quick Start

1. Migrate databases: 7 new tables
2. Deploy code with endpoints 91-111
3. Test referral flow: 91→92→93→94
4. Test video dating: 95→96→97→98
5. Test events: 99→100→101→102
6. Test gamification: 103→104
7. Test archetypes: 105→106→107
8. Test goals: 108→109→110

---

✅ **TIER 3 - QUICK REFERENCE COMPLETE**
