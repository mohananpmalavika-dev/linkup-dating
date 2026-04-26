# Dating App Module - Functional Improvements TODO

## Status: Phase 1 Complete ✅ | Phase 2 In Progress 🔄

---

## Phase 1: Core Feature Completion ✅ COMPLETE

### 1. Backend: User Preferences Endpoints
- **File**: `backend/routes/dating.js`
- **Added**:
  - `GET /dating/preferences` - Retrieve user preferences with defaults
  - `PUT /dating/preferences` - Update user preferences (upsert)
- **Features**: Age range, location radius, gender preferences, relationship goals, interests, height range, body types, privacy settings

### 2. Frontend Service: Preferences Methods
- **File**: `src/services/datingProfileService.js`
- **Added**:
  - `getPreferences()` - Fetch user preferences
  - `updatePreferences(preferences)` - Save user preferences

### 3. Superlike Feature ✅
- **Backend**: `POST /interactions/superlike` endpoint with daily limit
- **Frontend**: Superlike button in DiscoveryCards
- **Limit**: 1/day free

### 4. Daily Like Limits ✅
- **Backend**: Track daily likes in UserAnalytics
- **Limit**: 50/day free
- **Frontend**: Show remaining likes/superlikes counter in DiscoveryCards and DatingProfile

---

## Phase 2: Engagement Features 🔄 MOSTLY COMPLETE

### 8. Top Picks / Most Compatible ✅
- [x] Backend: `GET /top-picks` endpoint with compatibility scoring
- [x] Frontend: `getTopPicks()` service method
- [x] Frontend: Top Picks toggle in DiscoveryCards

### 9. Rewind Feature (Undo Pass) ✅
- [x] Backend: `POST /interactions/rewind` endpoint
- [x] Backend: Daily rewind limit (3/day free)
- [x] Frontend: `rewindPass()` service method
- [x] Frontend: Rewind button in DiscoveryCards

### 10. Media Sharing in Chat ✅
- [x] Backend: Extend messages with mediaType/mediaUrl
- [x] Backend: `POST /matches/:matchId/media` endpoint
- [x] Frontend: Image upload in DatingMessaging
- [x] Frontend: Voice note recorder in DatingMessaging
- [x] Frontend: Media message rendering

### 11. Daily Questions/Prompts ✅
- [x] Backend: `GET /daily-prompts` endpoint with question bank
- [x] Backend: Store user responses
- [x] Frontend: Prompt selection in profile editing
- [x] Frontend: Display prompts in profile view

### 12. Enhanced Notifications ✅
- [x] Backend: Extend preferences with notification types
- [x] Backend: `PUT /notification-preferences` endpoint
- [x] Backend: Email digest option
- [x] Frontend: Notification preference toggles
- [x] Frontend: Email digest frequency selector

---

## Phase 3: Safety & Premium (Pending)

### 13. Photo Verification
- Selfie verification flow
- "Photo verified" badge

### 14. Premium Features
- Unlimited likes, boosts, rewind
- See who liked you
- Stripe integration

### 15. Message Requests
- Non-match message requests
- Accept/decline flow

---

## Phase 4: Performance (Pending)

### 16. Redis Caching
- Cache profiles (5min TTL)
- Cache matches (2min TTL)

### 17. Optimistic Updates
- Instant like/pass feedback

### 18. Offline Support
- Service worker caching

---

## Files Modified

| Date | File | Change |
|------|------|--------|
| Phase 1 | `backend/routes/dating.js` | Added preferences, superlike, daily limits |
| Phase 1 | `src/services/datingProfileService.js` | Added preferences, superlike, daily limits methods |
| Phase 1 | `src/components/DiscoveryCards.js` | Added superlike button, daily limits display |
| Phase 1 | `src/components/DatingProfile.js` | Added daily limits stats |
| Phase 2 | `backend/routes/dating.js` | Added top-picks, rewind, media, prompts |
| Phase 2 | `src/services/datingProfileService.js` | Added top-picks, rewind methods |
| Phase 2 | `src/services/datingMessagingService.js` | Added media sharing methods |
| Phase 2 | `src/components/DiscoveryCards.js` | Added top-picks toggle, rewind button |
| Phase 2 | `src/components/DatingMessaging.js` | Added media sharing UI |
| Phase 2 | `src/components/DatingProfile.js` | Added prompts, notification preferences |

---

## Next Steps

1. **Complete Phase 2 implementation** - Top picks, rewind, media sharing, prompts, enhanced notifications
2. **Test all new endpoints** - Verify backend functionality
3. **Run frontend build** - Check for compilation errors
4. **Begin Phase 3** - Safety & premium features

