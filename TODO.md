# Dating App Module - Functional Improvements TODO

## Status: Phase 1 Complete ✅ | Phase 2 Complete ✅ | Phase 3 Complete ✅

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

## Phase 3: Safety & Premium ✅ COMPLETE

### 13. Enhanced Photo Verification ✅
- [x] Backend: `GET /verify-photo/challenge` - Generate pose challenge
- [x] Backend: `POST /profiles/me/verify-photo` - Submit verification selfie
- [x] Backend: `GET /profiles/me/verification-status` - Check verification status
- [x] Backend: Added verification fields to DatingProfile model (verificationPhotoUrl, verificationStatus, verifiedAt)
- [x] Frontend: Photo verification flow with camera capture in DatingProfile
- [x] Frontend: Verification status badge in profile header

### 14. Premium Subscription System ✅
- [x] Backend: Subscription model (Subscription.js) with plan, status, expiresAt
- [x] Backend: `GET /subscription/plans` - List plans (Free, Premium $19.99, Gold $29.99)
- [x] Backend: `GET /subscription/me` - Current subscription status
- [x] Backend: `POST /subscription/create` - Activate subscription (simulated, no Stripe)
- [x] Backend: `DELETE /subscription/cancel` - Cancel subscription
- [x] Backend: `POST /profiles/me/boost` - Profile boost (30 min, Premium/Gold only)
- [x] Backend: `GET /who-liked-me` - List likers (blurred for free users)
- [x] Backend: Daily limits check subscription status (unlimited for subscribers)
- [x] Frontend: Premium upgrade UI with plan cards in DatingProfile
- [x] Frontend: Subscription management (view/cancel)
- [x] Frontend: "Who Liked You" tab in Matches (blurred for free, revealed for Premium)
- [x] Frontend: Boost button in DiscoveryCards toolbar

### 15. Message Requests (Non-Match) ✅
- [x] Backend: MessageRequest model (MessageRequest.js) with from/to/message/status
- [x] Backend: `POST /message-requests` - Send request (Gold only)
- [x] Backend: `GET /message-requests` - List incoming requests
- [x] Backend: `POST /message-requests/:id/accept` - Accept and create match
- [x] Backend: `POST /message-requests/:id/decline` - Decline request
- [x] Frontend: Send message request from DatingProfileView (Gold users)
- [x] Frontend: Incoming requests tab in Matches with accept/decline

### 16. Admin Safety Dashboard 🔄 PARTIAL
- [x] Backend: User report endpoints already exist in dating.js
- [x] Backend: Photo verification status tracked
- [ ] Frontend: Dedicated admin verification review panel (can be added to AdminDashboard)

---

## Phase 4: Performance (Pending)

### 17. Redis Caching
- Cache profiles (5min TTL)
- Cache matches (2min TTL)

### 18. Optimistic Updates
- Instant like/pass feedback

### 19. Offline Support
- Service worker caching

---

## Files Modified

| Date | File | Change |
|------|------|--------|
| Phase 1 | `backend/routes/dating.js` | Added preferences, superlike, daily limits |
| Phase 1 | `src/services/datingProfileService.js` | Added preferences, superlike, daily limits methods |
| Phase 1 | `src/components/DiscoveryCards.js` | Added superlike button, daily limits display |
| Phase 1 | `src/components/DatingProfile.js` | Added daily limits stats |
| Phase 2 | `backend/routes/dating.js` | Added top-picks, rewind, media, prompts, notification preferences |
| Phase 2 | `src/services/datingProfileService.js` | Added top-picks, rewind, prompts, notification methods |
| Phase 2 | `src/services/datingMessagingService.js` | Added media sharing methods |
| Phase 2 | `src/components/DiscoveryCards.js` | Added top-picks toggle, rewind button |
| Phase 2 | `src/components/DatingMessaging.js` | Added media sharing UI |
| Phase 2 | `src/components/DatingProfile.js` | Added prompts, notification preferences |
| Phase 3 | `backend/models/Subscription.js` | New model for premium subscriptions |
| Phase 3 | `backend/models/MessageRequest.js` | New model for non-match message requests |
| Phase 3 | `backend/models/DatingProfile.js` | Added verification fields |
| Phase 3 | `backend/routes/dating.js` | Added photo verification, subscriptions, boost, who-liked-me, message-requests |
| Phase 3 | `src/services/datingProfileService.js` | Added verification, subscription, boost, message request methods |
| Phase 3 | `src/components/DatingProfile.js` | Added photo verification flow, subscription panel |
| Phase 3 | `src/components/DiscoveryCards.js` | Added boost button, subscription-aware limits |
| Phase 3 | `src/components/Matches.js` | Added "Who Liked You" and "Message Requests" tabs |
| Phase 3 | `src/components/DatingProfileView.js` | Added send message request button (Gold users) |

---

## Next Steps

1. **Run database migrations** - Create `subscriptions` and `message_requests` tables
2. **Test all new Phase 3 endpoints** - Verify backend functionality for verification, subscriptions, boosts
3. **Run frontend build** - Check for compilation errors in new components
4. **Begin Phase 4** - Performance optimizations (Redis caching, optimistic updates, offline support)

