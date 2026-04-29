# Database Error Fixes - April 29, 2026

## Issues Fixed

### 1. **Superlike Error: User Analytics `created_at` NULL Constraint Violation**

**Problem:** When users sent a superlike, the system tried to insert into `user_analytics` table without providing a `created_at` value. The table schema has `created_at` as NOT NULL, causing this error:
```
error: null value in column "created_at" of relation "user_analytics" violates not-null constraint
```

**Root Cause:** Raw SQL INSERT queries were missing the `created_at` column in the column list and NULL value in the VALUES clause.

**Files Fixed:** 
- `backend/routes/dating.js` - Lines 5721, 5898, 6128, 6888, 8516, 8523, 8703, 8946, 16081, 16149

**Solution:**
Updated all 10 INSERT INTO user_analytics queries to include `created_at` with `NOW()`:

```sql
-- Before:
INSERT INTO user_analytics (user_id, activity_date, superlikes_sent)
VALUES ($1, $2, 1)

-- After:
INSERT INTO user_analytics (user_id, activity_date, superlikes_sent, created_at)
VALUES ($1, $2, 1, NOW())
```

Affected actions:
- Superlike profile
- Like profile  
- Rewind pass
- Use boost
- Make match
- Video rewind
- Record profile view

---

### 2. **IP Blocklist Table Missing**

**Problem:** The `ip_blocklist` table doesn't exist in the database, causing queries to fail:
```
error: relation "ip_blocklist" does not exist
```

**Root Cause:** The Sequelize model sync may not have been executed, or the table was dropped during migration.

**Solution:**

#### Option A: Run the Sync Script (Recommended)
```bash
cd backend
node scripts/syncDatabase.js
```

This script:
1. Authenticates to the database
2. Runs `syncModelsInOrder()` which creates missing tables in dependency order
3. Ensures all models are synced with their current schema

#### Option B: Manual SQL Execution
If the sync script fails, manually execute the SQL to create the table:

```bash
# Using psql
psql -h localhost -U postgres -d linkup_dating -f backend/scripts/create-ip-blocklist.sql

# Or from your database tool, execute the SQL in:
backend/scripts/create-ip-blocklist.sql
```

---

## Files Created/Modified

### New Files:
1. **`backend/scripts/syncDatabase.js`** - Database sync utility script
   - Authenticates to database
   - Runs controlled model sync in dependency order
   - Reports success/failure with clear logging

2. **`backend/scripts/create-ip-blocklist.sql`** - SQL fallback script
   - Creates `ip_blocklist` table with full schema
   - Adds performance indexes
   - Can be run directly if Sequelize sync fails

### Modified Files:
- **`backend/routes/dating.js`** - Fixed 10 user_analytics INSERT queries

---

## Testing the Fixes

### Test 1: Verify User Analytics Insert
```bash
# Send a superlike and check server logs
# Should not see: "null value in column created_at"
```

### Test 2: Verify IP Blocklist Table Exists
```bash
# Connect to database and run:
SELECT * FROM ip_blocklist LIMIT 1;

# Should return: (no rows) or error about no data
# Should NOT return: "relation does not exist" error
```

### Test 3: Run Complete Backend Test Suite
```bash
cd backend
npm test
```

---

## Prevention for Future

1. **Use Sequelize ORM** instead of raw SQL when possible - it handles timestamps automatically
2. **Run sync on deployment** - Ensure database schema is synchronized before starting app:
   ```bash
   npm run sync:db  # Add this script to package.json
   ```

3. **Add database health check** to startup sequence:
   ```javascript
   await models.sequelize.authenticate();
   await syncModelsInOrder(models.sequelize, models, logger);
   ```

---

## Summary of Changes

- ✅ Fixed 10 user_analytics INSERT queries (added created_at)
- ✅ Created database sync script
- ✅ Created SQL fallback for ip_blocklist table
- ✅ Documented troubleshooting steps
