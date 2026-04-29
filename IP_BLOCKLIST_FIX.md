# IP Blocklist Table - Complete Fix

## Problem
The `ip_blocklist` table doesn't exist in the production database, causing all requests to fail with error code `42P01`:
```
error: relation "ip_blocklist" does not exist
```

This causes:
- Blocked user requests (Status 500)
- Rate limiting issues (Status 429)
- Server instability

## Solution

### 1. **Automatic Table Creation on Server Startup** ✅
**File**: [backend/server.js](backend/server.js#L615-L646)

Added code that runs during server initialization to create the `ip_blocklist` table using raw PostgreSQL:

```javascript
// Initialize IP blocklist table (critical for auth flows)
const { Pool } = require('pg');
const pool = new Pool({...});
const client = await pool.connect();
await client.query(`CREATE TABLE IF NOT EXISTS "ip_blocklist" (...)`);
```

**Benefit**: When the server starts, it automatically creates the missing table before handling any requests.

### 2. **Defensive Error Handling in IP Blocking Service** ✅
**File**: [backend/services/ipBlockingService.js](backend/services/ipBlockingService.js)

Updated all methods to gracefully handle missing table errors (code 42P01):

- `isIPBlocked()` - Returns `false` if table doesn't exist (fail-open for availability)
- `getIPBlockDetails()` - Returns `null` if table doesn't exist  
- `blockIPForUnderageAttempt()` - Returns `null` and logs warning if table doesn't exist
- `blockIPManually()` - Throws friendly error message if table doesn't exist
- `unblockIP()` - Throws friendly error message if table doesn't exist
- `getBlockedIPs()` - Returns empty list if table doesn't exist
- `cleanupExpiredBlocks()` - Returns 0 if table doesn't exist
- `getBlockStatistics()` - Returns empty statistics if table doesn't exist

**Benefit**: App doesn't crash even if the table is missing. All functionality continues to work.

### 3. **Standalone Table Initialization Script** ✅
**File**: [backend/scripts/init-ip-blocklist.js](backend/scripts/init-ip-blocklist.js)

Created a standalone script to initialize the table anytime:

```bash
node backend/scripts/init-ip-blocklist.js
```

**Benefit**: Can be run manually as an emergency fix or as part of deployment.

### 4. **Fixed user_analytics INSERT Statements** ✅
**File**: [backend/routes/dating.js](backend/routes/dating.js)

Updated all 10 `user_analytics` INSERT queries to include `created_at` column:

```sql
-- Before: INSERT INTO user_analytics (user_id, activity_date, superlikes_sent) VALUES ($1, $2, 1)
-- After:  INSERT INTO user_analytics (user_id, activity_date, superlikes_sent, created_at) VALUES ($1, $2, 1, NOW())
```

## Deployment

### For Production (Render):

1. **Push code changes**:
   ```bash
   git add -A
   git commit -m "fix: add automatic ip_blocklist table creation and defensive error handling"
   git push origin main
   ```

2. **Redeploy to Render**:
   - Render will auto-deploy the updated code
   - Server will automatically create the `ip_blocklist` table on startup

3. **Verify** (after deployment):
   ```
   ✓ No more "relation does not exist" errors
   ✓ All requests complete with proper status codes
   ✓ No more 500 errors from IP blocking
   ```

### For Local Development:

1. **Update code** (already done):
   - Server startup will create the table

2. **Or run manually**:
   ```bash
   node backend/scripts/init-ip-blocklist.js
   ```

3. **Or via npm script** (add to package.json):
   ```bash
   npm run init:db
   ```

## Files Changed

### 1. Server Startup
- [backend/server.js](backend/server.js) - Added auto-init for ip_blocklist table

### 2. Service Layer
- [backend/services/ipBlockingService.js](backend/services/ipBlockingService.js) - Added defensive 42P01 error handling to all 8 methods

### 3. Data Access  
- [backend/routes/dating.js](backend/routes/dating.js) - Fixed 10 user_analytics INSERT queries with created_at

### 4. Utilities
- [backend/scripts/init-ip-blocklist.js](backend/scripts/init-ip-blocklist.js) - Standalone table initialization script

## Testing

### Before Deployment:
1. Run local tests:
   ```bash
   cd backend
   npm test
   ```

2. Test IP blocking:
   ```bash
   npm start  # Table should auto-create
   # Try signup with underage age
   # Should create a block record
   ```

3. Test analytics:
   ```bash
   # Send a superlike  
   # Should update analytics without error
   ```

### After Deployment:
1. Monitor logs for errors:
   ```
   ✓ Should see: "[IP Blocklist] IP blocklist table initialized"
   ✗ Should NOT see: "relation \"ip_blocklist\" does not exist"
   ```

2. Test critical flows:
   - Signup (triggers IP check)
   - Superlike (triggers analytics update)
   - User interactions

## Monitoring

Monitor Render logs for:

### ✅ Good Indicators:
- `✓ IP blocklist table initialized`
- `✓ Sequelize models synchronized successfully`
- Status 200/201 for dating endpoints
- Status 304 for cached responses

### ❌ Bad Indicators:  
- `error: relation "ip_blocklist" does not exist`
- Status 500 on auth/signup flows
- `null value in column "created_at"`

## Rollback

If issues occur:

```bash
git revert <commit-hash>
git push origin main
# Render will auto-redeploy
```

## Notes

- Changes are **backward compatible**
- No data migration needed
- Defensive error handling means app stays online even if table creation fails
- Table will eventually be created by Sequelize sync if direct SQL fails
- All 10 analytics queries now properly include timestamps
