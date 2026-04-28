# Database Initialization Fix - TODO

## Issues
1. Missing `profile_views` table in raw SQL init
2. UUID vs INTEGER schema mismatch in 5 Sequelize models
3. Case-sensitive table name references (`'Users'` vs `'users'`)
4. Individual `.sync()` calls causing race conditions

## Steps
- [ ] 1. Fix `backend/config/database.js` - Add `profile_views` table creation
- [ ] 2. Fix `backend/models/VideoCallAnalytics.js`
- [ ] 3. Fix `backend/models/VideoCallRating.js`
- [ ] 4. Fix `backend/models/DateSafetyKit.js`
- [ ] 5. Fix `backend/models/TrustedFriend.js`
- [ ] 6. Fix `backend/models/VideoCompatibilityScore.js`
- [ ] 7. Test backend restart

