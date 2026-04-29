# Tier 2 Quick Reference Guide

## What's New

**9 Models + 18 Endpoints** for advanced dating app features

### Models Created
| Model | Purpose | Key Fields |
|-------|---------|-----------|
| ProfileAnalytics | Daily engagement tracking | profiles_viewed, likes, matches, messages |
| PhotoPerformance | Per-photo metrics | views, swipe_rates, engagement_score |
| MatchmakerExplanation | Algorithm transparency | compatibility_score, factors, recommendations |
| UserDecisionHistory | Swipe history (undo feature) | decision_type, timestamp, undo_action |
| SpotlightListing | Premium visibility | spotlight_type, price ($2.99-$99.99), impressions |
| ConciergeMatch | Hand-curated matches | admin_id, concierge_note, quality_rating |
| SuperLikeGift | Enhanced superlikes | gift_type, gift_message, verification_badge |
| ProfileVerificationScore | AI fraud detection | authenticity_score, risk_level, red_flags |
| ConversationSafetyFlag | Abuse reporting | reason, severity, admin_action |

### Endpoints by Category

#### 📊 Analytics (5 endpoints)
- `GET /analytics/overview` - 30-day summary
- `GET /analytics/trends` - Time-series data  
- `GET /analytics/photo-performance` - Photo rankings
- `GET /analytics/engagement-breakdown` - By demographics
- `GET /analytics/conversation-insights` - Quality metrics

#### 🎯 Matchmaker Transparency (2 endpoints)
- `GET /match-explanation/:userId` - Why matched
- `GET /matching-factors/my-profile` - What drives matches

#### 💎 Premium Features (6 endpoints)
- `GET /decision-history` - All swipes (Premium)
- `POST /undo-pass/:profileId` - Reverse a pass
- `GET /profiles/passed` - Browse passed profiles (Premium)
- `GET /superlikes/stats` - Usage & responses
- `POST /spotlight/purchase` - Buy visibility boost
- `GET /concierge/matches` - Curated matches (Gold tier)

#### 🛡️ Trust & Safety (5 endpoints)
- `POST /verify/run-fraud-check` - AI verification
- `GET /profile-trust-score/:userId` - Trust score
- `POST /conversations/report-harassment/:matchId` - Report abuse
- `GET /conversation-safety/tips` - Best practices
- `GET /spotlight/available-plans` - Pricing tiers

## Monetization Features

### Spotlight Tiers
- **Bronze**: $2.99 (2 hours, 3x visibility)
- **Silver**: $5.99 (24 hours, 5x visibility)
- **Gold**: $19.99 (7 days, 10x visibility)
- **Platinum**: $99.99 (30 days, 15x visibility)

### Premium Subscriptions
- **Premium**: Undo feature (unlimited), decision history, passed profiles
- **Gold**: All Premium + Concierge matches, advanced analytics

## Key Features

### ✨ For Users
- See engagement analytics and trends
- Understand why profiles are suggested
- Undo passes (3/day free)
- Browse profiles you passed
- Gift messages with superlikes
- Purchase visibility boosts
- Get curated matches (Premium)
- Report unsafe behavior
- Check profile trust scores

### 💰 For Revenue
- Spotlight listings (micropayments)
- Concierge matching (premium tier)
- Premium features unlock

### 🔒 For Safety
- AI fraud detection
- Photo authenticity verification
- Harassment reporting (8 categories)
- Auto-blocking for high-severity reports
- Admin investigation workflow
- Red flag detection

## Database Tables Created

```sql
-- Auto-created when models register:
profile_analytics
photo_performance
matchmaker_explanations
user_decision_history
spotlight_listings
concierge_matches
superlike_gifts
profile_verification_scores
conversation_safety_flags
```

## Integration Checklist

- [x] Models created (9 total)
- [x] Endpoints implemented (18 total)
- [x] Database associations configured
- [ ] Database migration script (needed)
- [ ] Frontend components (needed)
- [ ] Stripe payment integration (needed)
- [ ] Admin dashboard (needed)

## Statistics

| Metric | Value |
|--------|-------|
| New Models | 9 |
| New Endpoints | 18 |
| Code Added | ~877 lines |
| Features | 6 major areas |
| Revenue Models | 2 (Spotlight + Concierge) |
| Safety Categories | 8 report types |

## File Locations

```
backend/models/
├── ProfileAnalytics.js
├── PhotoPerformance.js
├── MatchmakerExplanation.js
├── UserDecisionHistory.js
├── SpotlightListing.js
├── ConciergeMatch.js
├── SuperLikeGift.js
├── ProfileVerificationScore.js
└── ConversationSafetyFlag.js

backend/routes/dating.js (endpoints 73-90)
```

## Next: Database Migrations

To activate these models in the database, you'll need to run migrations:

```sql
-- Example for ProfileAnalytics:
CREATE TABLE profile_analytics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  profiles_viewed INTEGER DEFAULT 0,
  likes_sent INTEGER DEFAULT 0,
  likes_received INTEGER DEFAULT 0,
  superlikes_sent INTEGER DEFAULT 0,
  superlikes_received INTEGER DEFAULT 0,
  matches_created INTEGER DEFAULT 0,
  active_matches INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, activity_date)
);

CREATE INDEX idx_profile_analytics_user_date ON profile_analytics(user_id, activity_date);
```

## Testing Guide

### Analytics
```bash
# Get 30-day overview
GET /api/dating/analytics/overview

# Get daily trends
GET /api/dating/analytics/trends?days=30

# Check photo performance
GET /api/dating/analytics/photo-performance
```

### Premium Features
```bash
# View decision history (must be Premium/Gold)
GET /api/dating/decision-history

# Undo a pass
POST /api/dating/undo-pass/123

# Purchase spotlight
POST /api/dating/spotlight/purchase
{ "spotlightType": "silver" }
```

### Safety
```bash
# Report harassment
POST /api/dating/conversations/report-harassment/456
{
  "reason": "sexual_harassment",
  "description": "Inappropriate messages",
  "messageIds": [1, 2, 3]
}

# Get safety tips
GET /api/dating/conversation-safety/tips
```

---

**Status**: ✅ READY FOR TESTING  
**Date**: 2024  
**Tier**: 2 of 3 (planned)
