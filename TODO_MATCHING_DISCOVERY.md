# Matching & Discovery Algorithm Implementation

## Plan
- [ ] Step 1: Database Schema & Index Updates (`backend/config/database.js`)
  - Add `discovery_queue_shown` table for session deduplication
  - Add performance indexes on `dating_profiles`
- [ ] Step 2: Enhanced `/discovery` Endpoint with DB-Level Filtering (`backend/routes/dating.js`)
  - SQL Haversine distance filtering
  - Apply age, gender, goals, interests, height, body type filters in DB
  - Exclude interacted/blocked/hidden profiles at DB level
- [ ] Step 3: Smart Personalized Discovery Queue (`/discovery-queue`) (`backend/routes/dating.js`)
  - Multi-factor ranking (compatibility 40%, behavioral 25%, recency 15%, trending 10%, diversity 10%)
  - Session deduplication integration
- [ ] Step 4: Trending & New Profiles Endpoints (`backend/routes/dating.js`)
  - `GET /trending`
  - `GET /new-profiles`
- [ ] Step 5: Frontend Service Updates (`src/services/datingProfileService.js`)
  - Add methods for new endpoints
- [ ] Step 6: Frontend Discovery Enhancements (`src/components/DiscoveryCards.js`)
  - New modes: trending, newProfiles
  - Expanded filter panel
- [ ] Step 7: Browse Profiles Filter Expansion (`src/components/BrowseProfiles.js`)
  - Body type and location radius filters
- [ ] Step 8: Testing & Verification

