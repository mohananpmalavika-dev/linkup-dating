# Dating App Module - Functional Improvements TODO

## Status: Phase 1 Partially Complete

### ✅ Completed

#### 1. Backend: User Preferences Endpoints
- **File**: `backend/routes/dating.js`
- **Added**:
  - `GET /dating/preferences` - Retrieve user preferences with defaults
  - `PUT /dating/preferences` - Update user preferences (upsert)
- **Features**: Age range, location radius, gender preferences, relationship goals, interests, height range, body types, privacy settings

#### 2. Frontend Service: Preferences Methods
- **File**: `src/services/datingProfileService.js`
- **Added**:
  - `getPreferences()` - Fetch user preferences
  - `updatePreferences(preferences)` - Save user preferences

### 🔄 Remaining Phase 1 Tasks

#### 3. Frontend: Preferences UI Component
- **Create**: `src/components/DatingPreferences.js`
- **Features needed**:
  - Tabbed interface in AccountSettings OR standalone component
  - Age range slider/inputs
  - Location radius slider
  - Gender preference checkboxes
  - Relationship goal checkboxes
  - Interest selection
  - Height range inputs
  - Body type checkboxes
  - Privacy toggles (show profile, allow messages, notifications)

#### 4. Backend: Discovery Location Filtering
- **File**: `backend/routes/dating.js`
- **Current issue**: Discovery query doesn't use `locationRadius` from preferences
- **Fix needed**: Add geospatial distance calculation using lat/lng

#### 5. Backend: Gender Preference Filtering
- **File**: `backend/routes/dating.js`
- **Current issue**: Discovery doesn't filter by gender preferences
- **Fix needed**: Add gender filter to discovery query

#### 6. Superlike Feature
- **Backend**: Add `POST /interactions/superlike` endpoint
- **Frontend**: Add superlike button to DiscoveryCards
- **Limit**: 1/day free, 5/day premium

#### 7. Daily Like Limits
- **Backend**: Track daily likes in UserAnalytics
- **Limit**: 50/day free, unlimited premium
- **Frontend**: Show remaining likes counter

---

## Phase 2: Engagement Features (Pending)

### 8. Top Picks / Most Compatible
- Daily curated list based on compatibility score
- Premium refresh feature

### 9. Rewind Feature (Undo Pass)
- Store last 10 passes for undo
- 3/day free limit

### 10. Media Sharing in Chat
- Image upload support
- Voice notes
- Backend message media support

### 11. Daily Questions/Prompts
- Profile prompts for better conversations
- Display in profile view

### 12. Enhanced Notifications
- Per-type notification preferences
- Email digest option

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
| Today | `backend/routes/dating.js` | Added GET/PUT /preferences endpoints |
| Today | `src/services/datingProfileService.js` | Added getPreferences/updatePreferences methods |

---

## Next Steps

1. **Complete DatingPreferences component** - Create proper JSX component with all closing tags
2. **Integrate preferences into DiscoveryCards** - Use preferences for filtering
3. **Add superlike button** - To DiscoveryCards component
4. **Implement daily like limits** - Backend tracking + frontend display
