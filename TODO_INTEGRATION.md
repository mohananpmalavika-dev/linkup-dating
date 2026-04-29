# LinkUp Feature Integration Tracker

> Started: June 2026  
> Target: Wire all 21 unintegrated features, 4 socket handlers, 11 hooks  
> Phased approach: P0 → P1 → P2 → P3 → P4

---

## Phase 1: P0 CRITICAL FEATURES (Week 1) — IN PROGRESS

### Task 1.1: Register Socket Handlers in backend/server.js
- [ ] Read current server.js socket registration pattern
- [ ] Import `achievementSocketHandlers`
- [ ] Import `privacyAwareActivityHandlers`
- [ ] Import `reactionSocketHandlers`
- [ ] Import `realTimeEventHandlers`
- [ ] Register all 4 handlers in io.on('connection')
- **Est. Effort:** 2 hrs

### Task 1.2: Wire Boost System
- [ ] Verify `BoostPurchasePanel` already routed in App.js
- [ ] Add `BoostButton` to `DiscoveryCards.js`
- [ ] Add `BoostButton` to `BrowseProfiles.js`
- [ ] Test boost purchase flow end-to-end
- **Est. Effort:** 4 hrs

### Task 1.3: Wire Achievements & Badges
- [ ] Verify `AchievementsPage` already routed in App.js
- [ ] Import `useAchievements` hook in `DatingProfile.js`
- [ ] Display `BadgeDisplay` / `AchievementNotification` in Profile
- [ ] Add "Achievements" link/button somewhere accessible
- **Est. Effort:** 3 hrs

### Task 1.4: Wire Streak Tracking
- [ ] Verify `StreakLeaderboard` already routed in App.js
- [ ] Import `useStreaks` hook in `DatingProfile.js`
- [ ] Display `StreakBadge` in Profile header
- [ ] Add streak info to Matches/Messaging components
- **Est. Effort:** 3 hrs

### Task 1.5: Update DatingNavigation
- [ ] Add new nav items or FeatureHub ("More" tab)
- [ ] Ensure mobile overflow handled gracefully
- [ ] Add badges/counts for Achievements, Streaks, Challenges
- **Est. Effort:** 2 hrs

---

## Phase 2: P1 ENGAGEMENT FEATURES (Week 2) — PENDING

### Task 2.1: Wire Moments (Stories)
- [ ] Verify `MomentsFeed` already routed in App.js
- [ ] Add Moments link to SocialHub or DatingNavigation
- [ ] Ensure MomentsViewer accessible from matches

### Task 2.2: Wire Daily Challenges
- [ ] Verify `DailyChallengesModal` route exists
- [ ] Import `useDailyChallenges` hook
- [ ] Add challenges widget to Profile or FeatureHub

### Task 2.3: Wire Photo A/B Testing
- [ ] Verify `PhotoABTestDashboard` route exists
- [ ] Add link in Profile photo management section

### Task 2.4: Wire Referral Program
- [ ] Verify `ReferralDashboard` route exists
- [ ] Import `ReferralShareModal` in Profile
- [ ] Add "Invite Friends" button to Profile menu

### Task 2.5: Activate All Custom Hooks
- [ ] `useAchievements` → AchievementsPage, DatingProfile
- [ ] `useActivityStatus` → DiscoveryCards, Matches, Chat
- [ ] `useBoosts` → DiscoveryCards, BrowseProfiles
- [ ] `useDailyChallenges` → DailyChallengesModal, Profile
- [ ] `useEvent` → EventsList, SocialHub
- [ ] `useIntroductions` → DatingMessaging, DatingProfileView
- [ ] `useProfileReset` → ProfileResetPanel, DatingProfile
- [ ] `useQuickViewMode` → DiscoveryCards
- [ ] `useReactions` → DatingMessaging, MessageThread
- [ ] `useStreaks` → StreakLeaderboard, DatingProfile, Matches
- [ ] `useVoice` → DatingMessaging (voice messages)

---

## Phase 3: P2 SAFETY + PREMIUM (Week 3) — PENDING

### Task 3.1: Wire Catfish Detection AI
- [ ] Verify `CatfishDetectionDashboard` route exists
- [ ] Integrate `MessageSecurityWarning` into `DatingMessaging`
- [ ] Add catfish scan trigger in user flow

### Task 3.2: Wire Video Verification Badge
- [ ] Display `VideoDatingBadge` on profile cards
- [ ] Show `VideoVerificationPrompt` in profile setup
- [ ] Add verified filter in Browse

### Task 3.3: Wire Date Safety Kit
- [ ] Verify `DateSafetyKit` route exists
- [ ] Add safety kit link in VideoDating / date planning
- [ ] Ensure `SOSAlert` accessible from nav

### Task 3.4: Wire Conversation Quality Meter
- [ ] Integrate `ConversationQualityMeter` into `DatingMessaging`
- [ ] Show insights panel in chat UI
- [ ] Trigger suggestions on low-quality conversations

### Task 3.5: Wire Events & Double Dates
- [ ] Verify `EventsList`, `DoubleDateGroups` routes exist
- [ ] Add Events tab/link in DatingNavigation or SocialHub
- [ ] Wire EventDetail routing from EventsList

---

## Phase 4: P3-P4 COMPLETION (Week 4) — PENDING

### Task 4.1: Wire Icebreaker Videos
- [ ] Verify `IcebreakerVideoRecorder` route exists
- [ ] Add Icebreaker video player to `DatingProfileView`
- [ ] Premium gating check

### Task 4.2: Wire Opening Templates
- [ ] Add "Get Opening Line" button in `DatingMessaging`
- [ ] Integrate `TemplatePerformance` for analytics

### Task 4.3: Wire Analytics Dashboard
- [ ] Verify `AnalyticsDashboard` route exists
- [ ] Add link in Profile menu

### Task 4.4: Wire Profile Reset
- [ ] Verify `ProfileResetPanel` route exists
- [ ] Add "Reset Profile" option in Profile settings

### Task 4.5: Wire Preferences Priority
- [ ] Verify `PrioritySubscriptionPanel` route exists
- [ ] Add upgrade prompt in profile/filters

### Task 4.6: Wire Smart Rewind
- [ ] Integrate `SmartRewindHistory` into DiscoveryCards
- [ ] Show rewind quota in UI

### Task 4.7: Wire Live Activity Status
- [ ] Integrate `ActivityStatus` into DiscoveryCards, Matches
- [ ] Show online/typing indicators

### Task 4.8: Wire Message Reactions
- [ ] Integrate `ReactionPicker` into `DatingMessaging`
- [ ] Show `MessageReactionDisplay` on messages

---

## Backend Fixes

- [ ] Fix `achievements.js` auth middleware (`protect` → `authenticateToken`)
- [ ] Verify all 21 routes are properly protected
- [ ] Test Socket.IO handler registration

---

## Progress Summary

| Phase | Features | Status | Completed |
|-------|----------|--------|-----------|
| Phase 0 | Analysis & Planning | ✅ Complete | 21 features identified |
| Phase 1 | P0 Critical | 🔄 In Progress | 0/5 tasks |
| Phase 2 | P1 Engagement | ⏳ Pending | 0/5 tasks |
| Phase 3 | P2 Safety/Premium | ⏳ Pending | 0/5 tasks |
| Phase 4 | P3-P4 Completion | ⏳ Pending | 0/8 tasks |

**Last Updated:** June 2026
