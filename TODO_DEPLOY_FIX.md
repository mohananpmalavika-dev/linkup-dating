# Deployment Fix TODO

## Plan
Fix two critical errors causing Render deployment failure:
1. SyntaxError in model files due to uncommented SQL CREATE INDEX statements
2. Redis double-TLS handshake causing "packet length too long"

## Steps
- [x] 1. Create this TODO.md
- [x] 2. Fix DateSafetyKit.js - remove dangling CREATE INDEX block
- [x] 3. Fix TrustedFriend.js - remove dangling CREATE INDEX block
- [x] 4. Fix VideoCallAnalytics.js - remove dangling CREATE INDEX block
- [x] 5. Fix VideoCallRating.js - remove dangling CREATE INDEX block
- [x] 6. Fix VideoCompatibilityScore.js - remove dangling CREATE INDEX block
- [x] 7. Fix redis.js - prevent double TLS when REDIS_URL is used
- [x] 8. Update TODO.md to mark all steps complete

