# DatingHub Module Roadmap

Last reviewed: 2026-04-27

## Current Reality

The dating module is already strong. These areas are live in the current codebase:

- Profile creation, editing, completion, verification, photos
- Discovery feeds: regular, smart queue, trending, new profiles, top picks
- Interactions: like, superlike, pass, rewind, favorites
- Match management, likes received, who liked me, message requests
- Direct messaging with reactions, read receipts, typing, media, voice notes
- Video call scheduling and live calls
- Daily prompts, compatibility scoring, icebreakers, profile views, subscriptions

The biggest opportunity is no longer "add basic dating." It is:

1. Finish the advanced features that already exist in pieces
2. Reduce maintenance risk in the backend
3. Add retention and conversion features that make the module feel premium

## Main Gaps

### Product gaps

- Advanced messaging tools exist but are not fully activated in the dating chat flow
- Voice intro support exists in backend planning but is not a core surfaced UX
- Saved filter presets and discovery personalization are underexposed
- Social features exist separately but are not connected tightly to dating
- There is no full "date planning" layer after matching

### Technical gaps

- `backend/routes/dating.js` is too large and appears to contain duplicated legacy route blocks later in the file
- `backend/routes/messagingEnhanced.js` exists, but the server currently mounts only the basic messaging router
- Some rich components exist but are not surfaced in the current dating screens

## Roadmap Principles

- Favor features that reuse existing backend and UI work
- Improve retention before adding broad new surface area
- Keep premium features meaningful, not cosmetic only
- Clean up route structure before adding too many more branches

## Phase 0: Foundation Cleanup

Target: 3-5 days

### Goal

Make the dating module safer to extend.

### Tickets

1. Split `backend/routes/dating.js` into smaller route modules
- Suggested splits: `profiles`, `discovery`, `interactions`, `matches`, `premium`, `analytics`
- Keep the existing API paths unchanged

2. Remove or consolidate duplicated legacy dating endpoints
- Audit the later repeated blocks in `backend/routes/dating.js`
- Keep one canonical endpoint per feature
- Add smoke tests for the kept endpoints

3. Mount advanced messaging routes in the backend
- Wire `backend/routes/messagingEnhanced.js` into `backend/server.js`
- Decide whether to mount under `/api/messaging` or `/api/messaging/enhanced`

4. Add a dating-module regression checklist
- Like back
- Match creation
- Message requests
- Rewind
- Favorite
- Block/report
- Profile view tracking

### Acceptance

- One source of truth for dating endpoints
- No duplicate active route definitions
- Advanced messaging endpoints reachable from the server

## Phase 1: Advanced Messaging for Dating

Target: 1-2 weeks

### Goal

Turn chat into a strong retention feature.

### Features

1. Activate message toolbar inside dating chat
- Use `MessageToolbar`
- Enable templates, search, export, attachments, location share

2. Add disappearing messages UX
- Use the existing enhanced messaging API
- Let users choose duration: 1 hour, 24 hours, 7 days
- Show clear countdown/status in thread

3. Add chat backup and export
- Export formats: JSON, CSV, PDF
- Manual backup per match
- Optional "export conversation" entry from match actions

4. Add encryption setup flow
- Initialize per-match encryption from chat settings
- Show key status and fallback state cleanly

5. Improve first-message conversion
- Reuse icebreakers and quick prompts in chat composer
- Add "send opener" chips when a match is new

### Suggested files

- `backend/server.js`
- `backend/routes/messagingEnhanced.js`
- `src/components/DatingMessaging.js`
- `src/components/MessageToolbar.js`
- `src/components/MessageTemplates.js`
- `src/components/MessageExport.js`
- `src/components/MessageSearch.js`

### Acceptance

- Users can search, export, and enhance chats from the dating message screen
- Enhanced messaging endpoints are actually used by the UI
- New matches get better guided conversation starts

## Phase 2: Discovery and Profile Expressiveness

Target: 1 week

### Goal

Make profiles feel more human and discovery feel more intentional.

### Features

1. Voice intro on profiles
- Upload 15-30 second intro
- Show playback on profile cards and profile detail page
- Add moderation/length validation

2. Saved filter presets
- Save current discovery filters with a name
- Quick apply from discovery screen
- Examples: `Nearby`, `Serious`, `Creative`, `Weekend vibe`

3. Better discovery mode switching
- Add a small "Discovery Hub" header with:
  - For You
  - Top Picks
  - Trending
  - New
  - Presets

4. Online/active now hints
- Show "active recently" or "online now" where safe
- Use existing heartbeat support

5. Discovery explanation
- Show why a person is being recommended:
  - Shared interests
  - Similar goals
  - Close distance
  - High compatibility

### Suggested files

- `backend/routes/dating.js`
- `src/components/DiscoveryCards.js`
- `src/components/DatingProfile.js`
- `src/components/DatingProfileView.js`
- `src/services/datingProfileService.js`

### Acceptance

- Users can save and reuse filters
- Profiles support richer self-expression with voice
- Discovery screens clearly explain recommendation quality

## Phase 3: Match-to-Date Journey

Target: 1-2 weeks

### Goal

Help matches turn into real conversations and planned dates.

### Features

1. Date planning flow
- Add `Plan a Date` from match profile or chat
- Suggest time slots
- Suggest date type: coffee, walk, dinner, video date
- Allow accept/reschedule/decline

2. Match milestones
- Show stages:
  - New match
  - First reply sent
  - Conversation started
  - Video date booked
  - Met in person

3. Post-date feedback
- Private feedback after a video date or planned date
- Signals for recommendation quality and safety

4. Conversation nudges
- If no one replies in 24-48 hours, suggest context-aware prompts
- If both are active but stalled, suggest a video date or date-plan prompt

5. Shared-interest actions
- Create "mini activities" inside chat:
  - Ask a question
  - Share a playlist
  - Share a location idea
  - Vote on a plan

### Suggested files

- `backend/routes/video-calls.js`
- `backend/routes/dating.js`
- `src/components/DatingMessaging.js`
- `src/components/Matches.js`
- `src/components/DatingProfileView.js`

### Acceptance

- Matches can move from chat to scheduled plans without leaving the module
- Users get useful nudges without spammy feeling

## Phase 4: Social Layer and Retention

Target: 1 week

### Goal

Use the existing social module to increase trust and recurring usage.

### Features

1. Connections hub
- Surface friend requests, accepted friends, and referrals
- Keep it adjacent to dating, not mixed into the core match flow

2. Public social links on profiles
- Let users optionally show linked Instagram/TikTok-style handles
- Add visibility controls

3. Referral rewards
- Reward invited users and inviters with:
  - Boost credits
  - Extra superlikes
  - Free premium trial days

4. Interest-based rooms
- Reuse chatrooms/lobby for dating-adjacent communities
- Examples:
  - City rooms
  - Hobby rooms
  - New here room
  - Serious dating room

### Suggested files

- `src/components/FriendsList.js`
- `src/components/SocialIntegration.js`
- `src/components/ReferralShareModal.js`
- `src/components/ChatRooms.js`
- `src/components/LobbyChat.js`
- `src/services/socialService.js`

### Acceptance

- Social features feel intentionally connected to dating
- Community spaces increase repeat opens without distracting from matching

## Phase 5: Premium and Conversion

Target: 1 week

### Goal

Make premium feel worth paying for.

### Features

1. Premium dashboard in profile
- Boost status
- Remaining likes/superlikes/rewinds
- Who viewed me
- Who liked me
- Best-performing prompts/photos

2. Better boost UX
- Clear timer, reach estimate, and outcome summary
- Show visits/likes earned during boost window

3. Gold-tier messaging privileges
- Cleaner message-request flow
- Better visibility into request outcomes

4. Advanced analytics
- Match rate
- Reply rate
- Average time to first reply
- Best active hours
- Which profile sections drive interaction

### Suggested files

- `src/components/DatingProfile.js`
- `src/components/Matches.js`
- `backend/routes/dating.js`
- analytics and notification support services

### Acceptance

- Premium benefits are measurable
- Users can see what they are paying for
- Upgrade prompts are tied to value, not random gating

## Priority Ranking

If you want the most impact with the least waste, do it in this order:

1. Phase 0 foundation cleanup
2. Phase 1 advanced messaging activation
3. Phase 2 voice intro + filter presets
4. Phase 3 match-to-date workflow
5. Phase 5 premium dashboard
6. Phase 4 social layer

Reason:

- Phase 1 and Phase 2 reuse the most code you already have
- Phase 3 improves actual dating outcomes
- Phase 5 increases monetization only after the experience is stronger
- Phase 4 is valuable, but it should not distract from the core dating loop too early

## Recommended First Sprint

Sprint length: 1 week

### Sprint scope

1. Route cleanup plan for `dating.js`
2. Mount `messagingEnhanced` routes
3. Add message toolbar to `DatingMessaging`
4. Enable chat search and export from dating chat
5. Add basic saved filter presets API wiring

### Sprint outcome

By the end of this sprint, the app should feel more polished immediately without inventing a brand-new subsystem.

## Success Metrics

Track these after rollout:

- Match-to-first-message rate
- First-message-to-reply rate
- Average messages per match in first 72 hours
- Video-date booking rate
- Profile completion rate
- Voice intro upload rate
- Premium conversion rate after feature exposure

## Notes

- Keep commerce and marketplace work separate from this roadmap unless you decide dating is becoming a broader social super-app
- Avoid adding too many tabs to the bottom navigation before the dating loop is fully polished
- For the next iteration, the best move is depth, not breadth
