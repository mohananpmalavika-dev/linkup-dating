# LinkUp Premium Launch TODO — May 1 Kerala

## Phase 1: Premium Design System ⏳ IN PROGRESS
- [ ] Create `src/styles/designSystem.css` — CSS variables, typography, shadows, animations
- [ ] Update `public/index.html` — Add Google Fonts (Inter, Manjari)
- [ ] Update `src/index.css` — Import design system, base dark mode
- [ ] Update `src/App.css` — Page transitions, premium loading overlay

## Phase 2: Navigation & Icons Overhaul ⏳ PENDING
- [ ] Update `src/components/DatingNavigation.js` — SVG icons instead of text chars
- [ ] Update `src/styles/DatingNavigation.css` — Active animations, press states
- [ ] Update `src/components/FeatureHub.js` — Replace emojis with SVG icons
- [ ] Update `src/styles/FeatureHub.css` — Premium card hover effects

## Phase 3: Premium Loading & Empty States ⏳ PENDING
- [ ] Create `src/components/SkeletonLoader.js` + `.css` — Shimmer skeletons
- [ ] Create `src/components/EmptyState.js` — Premium animated empty states
- [ ] Update `DatingProfile.js`, `DiscoveryCards.js`, `Matches.js` to use skeletons

## Phase 4: Kerala-Specific Enhancements ⏳ PENDING
- [ ] Update `public/index.html` — Conditional Manjari font for Malayalam
- [ ] Update `src/components/EventsList.jsx` — Kerala festival badges
- [ ] Update `src/components/DateSafetyKit.js` — Kerala safe meetup spots

## Phase 5: Missing Feature Integration ⏳ PENDING
- [ ] Integrate reactions into `DatingMessaging.js`
- [ ] Integrate badges/status into `DatingProfileView.js`
- [ ] Integrate boost/rewind into `DiscoveryCards.js`
- [ ] Wire up custom hooks (`useAchievements`, `useStreaks`, etc.)

## Phase 6: Launch Polish ⏳ PENDING
- [ ] Update `public/manifest.json` — Kerala branding
- [ ] Add route transition wrapper in `App.js`
- [ ] Premium gold accents for subscription states
- [ ] Final build verification
