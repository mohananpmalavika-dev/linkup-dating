# LinkUp Play Store Launch TODO

## TIER 1 — Critical Launch Features

### Priority 1: Route Wiring (COMPLETE ✅)
- [x] Wire all 49 routes (8 public + 2 admin + 39 dating)
- [x] Add component imports to App.js
- [x] Fix import paths (5 files)
- [x] Fix CSS import issues (2 files)
- [x] Create apiClient.js service
- [x] Verify build: npm run build ✅

### Priority 2: Admin Dashboard Integration (70% COMPLETE 🔄)
- [x] Fix AdminModeration API endpoints (3 calls)
  - [x] getModerationQueue() instead of /api/moderation/pending-flags
  - [x] getModerationAnalytics() instead of /api/moderation/stats
  - [x] reviewModerationFlag() instead of /api/moderation/resolve-flag
- [x] Fix useEffect dependency warnings (useCallback pattern)
- [x] Build verified: ✅
- [ ] **NEXT: End-to-end testing (15 min)**
  - [ ] Test admin login → dashboard loads
  - [ ] Verify moderation queue fetches data
  - [ ] Test flag resolution workflow
  - [ ] Verify analytics tab loads
- [ ] **NEXT: Polish & error handling (10 min)**
  - [ ] Add loading spinners
  - [ ] Improve error messages
  - [ ] Test network error scenarios

### Priority 3: Content Moderation UI (PENDING ⏳)
- [ ] Wire content scanning to message send
- [ ] Add moderation warnings
- [ ] Integrate with moderation service

### Priority 4: Sentry Error Tracking (PENDING ⏳)
- [ ] Create Sentry account
- [ ] Configure DSN
- [ ] Initialize in app

### Priority 5: Socket.IO Handlers (PENDING ⏳)
- [ ] Register real-time event handlers
- [ ] Activate typing indicators
- [ ] Activate presence tracking
- [ ] Activate message reactions

### Priority 6: Firebase Push Notifications (PENDING ⏳)
- [ ] Configure Firebase
- [ ] Set up push service
- [ ] Enable notifications

## TIER 2 — Feature Completeness

### Socket Handlers (COMPLETE ✅)
- [x] Fix `backend/sockets/achievementSocketHandlers.js`
- [x] Register all socket handlers
- [x] Verify syntax

### Custom Hooks Integration (PENDING)
- [ ] Integrate `useAchievements` into `AchievementsPage.js`
- [ ] Integrate `useActivityStatus` into `DatingProfileView.js`
- [ ] Integrate `useStatusPreference` into `StatusPreferenceManager.jsx`
- [ ] Integrate `useMessageReactions` + `useEngagementScore` + `useStreak` into `DatingMessaging.js`
- [ ] Integrate `useDailyChallenges` into `DailyChallengesWidget.jsx`

## Estimated Timeline
- ✅ Phase 1 (Route Wiring): 3 hours
- 🔄 Phase 2 (Admin Integration): 1 hour remaining (of 4 total)
- ⏳ Phase 3 (Content Moderation): 3 hours
- ⏳ Phase 4 (Sentry): 2 hours
- ⏳ Phase 5 (Socket Handlers): 2 hours
- ⏳ Phase 6 (Push Notifications): 4 hours

**Total Estimated**: 19 hours to 95% launch readiness
