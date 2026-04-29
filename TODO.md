# Fix Discovery Tabs Empty Data Issue

## Problem
In the Discover page, "New", "Trending", and "Top Picks" tabs show no data.

## Root Cause
The `buildDiscoveryQuery` function and inline queries in `/trending` and `/new-profiles` had an overly aggressive interaction exclusion that blocked:
- Profiles that liked you (you couldn't like them back)
- Profiles you only viewed (viewing shouldn't hide profiles)
- All profiles with ANY interaction in EITHER direction

This quickly exhausted available profiles, causing empty tabs.

## Steps

- [x] Step 1: Fix `buildDiscoveryQuery` interaction exclusion in `backend/routes/dating.js`
- [x] Step 2: Fix `/trending` endpoint interaction exclusion + add fallback
- [x] Step 3: Fix `/new-profiles` endpoint interaction exclusion + add fallback
- [x] Step 4: Add fallback to `/top-picks` endpoint
- [x] Step 5: Update `DiscoveryCards.js` empty state messages
- [x] Step 6: Verify changes and cleanup

## Files Edited
- `backend/routes/dating.js`
- `src/components/DiscoveryCards.js`

## Summary of Changes

### Backend (`backend/routes/dating.js`)
1. **Fixed `buildDiscoveryQuery` interaction exclusion**: Changed from excluding ALL profiles with ANY interaction (both directions) to only excluding:
   - Profiles the user PASSED on (user said no)
   - Mutual matches (both users liked each other - already matched)
   
2. **Fixed `/trending` inline exclusion**: Same fix applied to the trending endpoint's inline query.

3. **Fixed `/new-profiles` inline exclusion**: Same fix applied to the new profiles endpoint's inline query.

4. **Added `/new-profiles` fallback**: When no profiles created in last 14 days, falls back to recently updated active profiles.

5. **Added `/top-picks` fallback**: When no compatible top picks found, falls back to regular discovery profiles.

### Frontend (`src/components/DiscoveryCards.js`)
6. **Improved empty state messages**: Tab-specific messages now show:
   - Trending: "No profiles are trending yet. Check back soon as more users join and engage!"
   - New: "No new profiles this week. We will show you recently active profiles instead."
   - Top Picks: "We are still learning your preferences. Check back soon for personalized top picks!"
