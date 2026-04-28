# Category A Integration TODO

## Step 1: Core App Wiring (App.js)
- [ ] Import all Category A page-level components
- [ ] Add routes for all 21 features
- [ ] Create route groups (Social, Profile tools, etc.)

## Step 2: Navigation (DatingNavigation.js)
- [ ] Add dedicated tabs or overflow menu for Events, Moments, Achievements
- [ ] Add badge support for Challenges, Streaks, Referrals
- [ ] Handle mobile nav overflow

## Step 3: Inline Component Integrations
- [ ] DatingMessaging: MessageReactions, ConversationQualityMeter, MessageSecurityWarning, IcereakerSuggestions
- [ ] DatingProfile: BoostButton, VideoDatingBadge, StreakBadge, DateSafetyKit link, ProfileResetPanel
- [ ] DiscoveryCards: BoostButton, VideoVerificationPrompt, ActivityStatus
- [ ] DatingProfileView: IcebreakerVideoPlayer, VideoDatingBadge
- [ ] Matches: StreakBadge, ActivityStatus, Achievements link

## Step 4: Bottom-bar additions / Overflow menu
- [ ] DatingNavigation: Add Achievements icon, Events icon, Moments icon
- [ ] Or create unified "More" menu with Analytics, Challenges, Referrals, Safety

## Step 5: Backend Fixes
- [ ] Fix `achievements.js` auth middleware (`protect` → `authenticateToken`)

## Step 6: Socket Handler Registration (Bonus: Category B)
- [ ] Import and register socket handlers in `server.js`

## Step 7: Custom Hooks Activation (Bonus: Category C)
- [ ] Ensure hooks are imported where components mount

