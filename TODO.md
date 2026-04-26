# Dating App Model Improvements - TODO

## Phase 1: Critical Infrastructure ✅ COMPLETE

### Step 1: Install Dependencies
- [x] Update backend/package.json with new dependencies
- [x] Run npm install in backend/ (164 packages added)

### Step 2: Sequelize ORM Setup
- [x] Create backend/.sequelizerc (Sequelize CLI config)
- [x] Create backend/config/sequelize.js (environment-based DB config)
- [x] Create backend/models/index.js (Sequelize initialization)
- [x] Create backend/models/User.js
- [x] Create backend/models/DatingProfile.js
- [x] Create backend/models/UserPreference.js
- [x] Create backend/models/Interaction.js
- [x] Create backend/models/Match.js
- [x] Create backend/models/Message.js
- [x] Create backend/models/ProfilePhoto.js
- [x] Create backend/models/UserBlock.js
- [x] Create backend/models/UserReport.js
- [x] Create backend/models/Chatroom.js
- [x] Create backend/models/ChatroomMember.js
- [x] Create backend/models/ChatroomMessage.js
- [x] Create backend/models/LobbyMessage.js
- [x] Create backend/models/VideoDate.js
- [x] Create backend/models/VerificationToken.js
- [x] Create backend/models/MessageReaction.js
- [x] Create backend/models/AdminAction.js
- [x] Create backend/models/UserAnalytics.js
- [x] Create backend/models/UserSessionLog.js
- [x] Create backend/models/SpamFlag.js
- [x] Create backend/models/FraudFlag.js
- [x] Create backend/models/SystemMetric.js

### Step 3: Database Migrations
- [ ] Initialize Sequelize CLI (`npx sequelize-cli init`)
- [ ] Create migration for all tables
- [ ] Create migration for indexes

### Step 4: Redis Setup
- [x] Create backend/utils/redis.js (Redis client with OTP helpers)
- [x] Update auth.js to use Redis for OTP (removed in-memory Map)

### Step 5: Validation Middleware
- [x] Create backend/middleware/validation.js (express-validator)
- [x] Add validators for auth routes (signup, login, OTP, username)
- [x] Add validators for dating routes (profile, photos, blocks, reports)

### Step 6: Rate Limiting
- [x] Create backend/middleware/rateLimit.js (Redis-backed rate limiting)
- [x] Apply to auth routes (5 attempts per 15 min)
- [x] Apply to OTP routes (3 attempts per hour)
- [x] Apply to API routes (100 requests per 15 min)

### Step 7: Logging
- [x] Create backend/utils/logger.js (Winston logging)
- [x] Integrate with Express (request logging middleware)

### Step 8: Update Server
- [x] Add request logging middleware
- [x] Configure Helmet with CSP headers
- [x] Add Sequelize sync (development mode)
- [x] Integrate Winston error logging

## Phase 2: Database & Performance (Next)
- [ ] Migrate photos to Cloudinary/S3 (remove base64 from DB)
- [ ] Add geospatial indexes for location matching
- [ ] Add missing database indexes (composite, GIN for JSONB)
- [ ] Add database transactions for match creation
- [ ] Add soft deletes for GDPR compliance
- [ ] Redis caching for popular profiles

## Phase 3: Dating Core Improvements (Next)
- [ ] Fix discovery algorithm (respect preferences, exclude blocks)
- [ ] Add geospatial queries (PostGIS/Earthdistance)
- [ ] Improve compatibility scoring algorithm
- [ ] Add user activity tracking
- [ ] Create RecommendationService

## Phase 4: Safety & Moderation (Next)
- [ ] Block-aware middleware for all routes
- [ ] Auto-moderation for spam/fraud flagged users
- [ ] Rate limit messaging per user
- [ ] Content moderation queue
