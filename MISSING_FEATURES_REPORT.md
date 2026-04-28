# LinkUp — Missing Features Report

> Comprehensive audit of implemented vs. disconnected features across the entire LinkUp module.

---

## Executive Summary

The backend infrastructure is extremely comprehensive: **models, migrations, services, and routes exist for nearly every documented feature**. However, the frontend has a major integration gap. `App.js` only routes to 6–7 core screens, leaving **20+ fully-built feature modules disconnected** from the user experience.

**Bottom line:** All the parts are in the garage — most are not installed in the car.

---

## ✅ What IS Properly Integrated

| Feature | Backend | Frontend | Routed in App.js |
|---|---|---|---|
| Discovery (Swipe Cards) | ✅ | ✅ | ✅ |
| Browse / Search | ✅ | ✅ | ✅ |
| Matches | ✅ | ✅ | ✅ |
| Real-time Messaging | ✅ | ✅ | ✅ |
| Video Dating / Calls | ✅ | ✅ | ✅ |
| Dating Profile (View / Edit) | ✅ | ✅ | ✅ |
| Social Hub / Chatrooms / Lobby | ✅ | ✅ | ✅ |
| Admin Dashboard | ✅ | ✅ | ✅ |
| Authentication (Login/Signup) | ✅ | ✅ | ✅ |
| Push Notifications (basic) | ✅ | ✅ | ✅ |

---

## ❌ Category A: Fully Built But NOT Wired Into the App

These modules have **backend routes + services + models + frontend components**, but are **not accessible** in the app because they lack routes in `App.js` and navigation links.

| # | Feature | Backend | Frontend Components | Missing Integration |
|---|---------|---------|---------------------|---------------------|
| 1 | **Achievements & Leaderboards** | `routes/achievements.js`, `services/achievementService.js`, `services/leaderboardService.js`, models | `AchievementNotification`, `BadgeDisplay`, `LeaderboardDisplay`, `EngagementScoreDisplay`, `MilestoneNotification` | ❌ No route in `App.js`. ❌ Achievement notifications never rendered. ❌ `achievements.js` uses `protect` middleware instead of `authenticateToken`. |
| 2 | **Daily Challenges** | `routes/challenges.js`, `services/challengeService.js` | `DailyChallengesModal`, `DailyChallengesWidget` | ❌ No route/page in `App.js`. ❌ Not linked from Profile or Social. |
| 3 | **Boost System** | `routes/boosts.js`, `services/boostService.js` | `BoostButton`, `BoostPurchasePanel`, `BoostAnalytics` | ❌ No dedicated page/route. ❌ `BoostButton` not integrated into Discovery/Browse cards. |
| 4 | **Analytics Dashboard** | `routes/analytics.js`, `services/analyticsService.js` | `AnalyticsDashboard`, `PersonalStatsCard`, `MonthlyReportCard`, `ProfileComparisonCard`, `ProfilePerformanceCard` | ❌ Not routed in `App.js`. ❌ No navigation link from Profile. |
| 5 | **Conversation Quality Meter** | `routes/conversationQuality.js`, `services/conversationQualityService.js` | `ConversationQualityMeter`, `ConversationQualityInsights`, `ConversationQualitySuggestions` | ❌ Not integrated into `DatingMessaging` or chat UI. ❌ No route. |
| 6 | **Photo A/B Testing** | `routes/photoABTesting.js`, `services/photoABTestService.js` | `PhotoABTestDashboard`, `PhotoABTestResults`, `PhotoABTestUpload` | ❌ Not routed in `App.js`. ❌ No nav link from Profile. |
| 7 | **Catfish Prevention AI** | `routes/catfishDetection.js`, `services/catfishDetectionService.js` | `CatfishDetectionDashboard`, `MessageSecurityWarning` | ❌ Not routed. ❌ `MessageSecurityWarning` not integrated into `DatingMessaging`. |
| 8 | **Video Verification / Verified Badge** | `routes/videoVerification.js`, `services/videoVerificationService.js` | `VideoVerificationPrompt`, `VideoDatingBadge` | ❌ `VideoDatingBadge` not shown on profile cards. ❌ `VideoVerificationPrompt` not wired to discovery flow. |
| 9 | **Date Safety Kit** | `routes/dateSafety.js`, `services/dateSafetyService.js` | `DateSafetyKit`, `LiveLocationSharing`, `SOSButton`, `CheckInPrompt`, `SafetyTips` | ❌ Not routed. ❌ Not integrated into date planning flow or profile. |
| 10 | **Events** | `routes/events.js`, `services/eventService.js` | `EventsList`, `EventDetail` | ❌ Not routed in `App.js`. ❌ No nav item in bottom bar. |
| 11 | **Double Dates** | `routes/doubleDates.js`, `services/doubleDateService.js` | `DoubleDateGroups`, `DoubleDateProposal`, `DoubleDateRequests`, `DateJourneyPanel` | ❌ Not routed. ❌ No navigation link. |
| 12 | **Icebreaker Videos** | `routes/icebreakerVideos.js`, `services/icebreakerVideoService.js` | `IcebreakerVideoRecorder`, `IcebreakerVideoPlayer`, `IcebreakerVideoGallery` | ❌ Not routed in `App.js`. ❌ Not accessible from profile view. |
| 13 | **Moments (Stories)** | `routes/moments.js`, `services/momentService.js` | `MomentsFeed`, `MomentsUpload`, `MomentsViewer` | ❌ Not routed. ❌ Not in navigation. |
| 14 | **Opening Message Templates** | Endpoints in `routes/dating.js`, `services/icereakerSuggestionService.js` | `IcereakerSuggestions`, `TemplatePerformance`, `IntroductionCard`, `IntroductionsWidget` | ❌ Not integrated into `DatingMessaging` or `DatingProfileView`. ❌ No button to trigger suggestions modal. |
| 15 | **Profile Reset** | `routes/profileReset.js`, `services/profileResetService.js` | `ProfileResetPanel` | ❌ Not routed. ❌ Not accessible from Account Settings. |
| 16 | **Referral Program** | `routes/referrals.js`, `services/referralService.js` | `ReferralDashboard`, `ReferralInviteModal`, `ReferralLeaderboard`, `ReferralRedeemModal`, `ReferralRewardsCenter`, `ReferralShareModal` | ❌ Not routed in `App.js`. ❌ No navigation link. |
| 17 | **Streak Tracking** | `routes/streaks.js`, `services/streakService.js` | `StreakBadge`, `StreakLeaderboard` | ❌ Not routed. ❌ Not integrated into Profile or Messaging. |
| 18 | **Message Reactions** | `routes/messageReactions.js`, `services/messageReactionService.js` | `ReactionPicker`, `MessageReactionDisplay` | ❌ Not integrated into `DatingMessaging` / `MessageThread`. |
| 19 | **Live Activity Status** | Socket handlers exist in `server.js` | `ActivityStatus`, `UserStatusIndicator`, `EnhancedUserStatusIndicator`, `ConnectionStatus` | ❌ Not integrated into `DiscoveryCards`, `Matches`, or `ChatWindow`. |
| 20 | **Smart Rewind** | Service exists (`services/rewindService.js`) | `SmartRewindHistory`, `RewindQuotaBar` (in `dating/` folder) | ❌ Not integrated into Discovery or Browse flow. |
| 21 | **Preferences Priority** | `routes/preferencesPriority.js`, `services/preferencesPriorityService.js` | `PriorityStatus`, `PrioritySubscriptionPanel`, `StatusPreferenceManager` | ❌ Not routed. ❌ Not integrated into signup or profile. |

---

## ❌ Category B: Socket Handlers Built But NOT Registered in `server.js`

| File | Purpose | Status |
|---|---|---|
| `backend/sockets/achievementSocketHandlers.js` | Real-time achievement unlocks | ❌ Not imported/used |
| `backend/sockets/privacyAwareActivityHandlers.js` | Privacy-safe online status broadcast | ❌ Not imported/used |
| `backend/sockets/reactionSocketHandlers.js` | Real-time message reactions | ❌ Not imported/used |
| `backend/sockets/realTimeEventHandlers.js` | Real-time events (typing, presence) | ❌ Not imported/used |

---

## ❌ Category C: Custom Hooks Built But Completely Unused

| Hook | Purpose | Status |
|---|---|---|
| `src/hooks/useAchievements.js` | Track achievement state | ❌ Never imported |
| `src/hooks/useActivityStatus.js` | Track user online status | ❌ Never imported |
| `src/hooks/useBoosts.js` | Boost state management | ❌ Never imported |
| `src/hooks/useDailyChallenges.js` | Challenge state | ❌ Never imported |
| `src/hooks/useEvent.js` | Event browsing state | ❌ Never imported |
| `src/hooks/useIntroductions.js` | Introduction template state | ❌ Never imported |
| `src/hooks/useProfileReset.js` | Profile reset flow | ❌ Never imported |
| `src/hooks/useQuickViewMode.js` | Quick-view discovery mode | ❌ Never imported |
| `src/hooks/useReactions.js` | Message reactions state | ❌ Never imported |
| `src/hooks/useStreaks.js` | Streak tracking state | ❌ Never imported |
| `src/hooks/useVoice.js` | Voice message state | ❌ Never imported |

---

## ❌ Category D: Navigation / UX Gaps

| Gap | Details |
|---|---|
| **No "Events" tab** | Events and Double Dates have no entry point in `DatingNavigation`. |
| **No "Moments" tab** | Story-like ephemeral sharing is inaccessible without a route. |
| **No "Referrals" link** | Referral program completely hidden from users. |
| **No "Safety" section** | Date Safety Kit not linked from date planning or profile. |
| **No "Achievements" link** | Gamification fully hidden. |
| **No "Analytics" link** | Personal analytics dashboard unreachable. |
| **Missing bottom nav items** | Only Discover, Browse, Matches, Messages, Social, Profile exist. No space for Events, Moments, Achievements, etc. |
| **Opening Templates inaccessible** | The smart-message AI exists but no button opens it from a chat or profile. |
| **Streaks invisible** | Streak tracking runs in background but users have no UI visibility.
