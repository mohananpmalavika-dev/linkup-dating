# Deployment Instructions for Database Fixes

## Critical: Must Deploy Both Code Changes and Run Database Sync

### Changes Made:
1. ✅ **Fixed 10 user_analytics INSERT queries** in `backend/routes/dating.js`
   - Added `created_at` column with `NOW()` value
   - Affects: Superlike, Like, Rewind, Boost, Match, Profile View actions

2. ✅ **Created database sync utility** at `backend/scripts/syncDatabase.js`
   - Automatically creates missing tables

3. ✅ **Created SQL backup** at `backend/scripts/create-ip-blocklist.sql`
   - Fallback option to manually create ip_blocklist table

---

## Deployment Steps

### Step 1: Push Code Changes to Production
```bash
git add -A
git commit -m "fix: add created_at to user_analytics inserts and create db sync script"
git push origin main
```

### Step 2: Deploy to Render

The code changes will deploy automatically. The next step is critical:

### Step 3: Run Database Sync on Production

**Option A: SSH into Render and Run Script (Recommended)**
```bash
# After deployment, SSH into your Render service
# Then run:
cd /opt/render/project/src/backend
npm run sync:db  # or node scripts/syncDatabase.js
```

**Option B: Add Sync to Deployment Process**

Edit your `Render.yaml` or deployment configuration to auto-run sync:

```yaml
build:
  - npm install
  - npm run build

start:
  - npm run sync:db  # Add this line
  - npm start
```

Or update `backend/server.js` to ensure sync runs on startup:

```javascript
// server.js - already in place, verify it's running
const { syncModelsInOrder } = require('./utils/syncModels');
syncModelsInOrder(dbModels.sequelize, dbModels, logger)
  .then(() => logger.info('✓ Models synced'))
  .catch(err => logger.error('Sync failed', err));
```

### Step 4: Verify Fixes

After deployment and sync, verify:

```bash
# Check server logs for no "created_at" errors
tail -f render.log | grep "created_at"  # Should be empty

# Test superlike action - should not throw error
# Check database - ip_blocklist table should exist
```

---

## Rollback (if needed)

If issues occur:

1. Revert the code changes:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. Redeploy to Render

3. The raw SQL queries still work, but will fail if created_at is required

---

## Monitoring

After deployment, monitor for:
- ❌ **DO NOT IGNORE**: Any "created_at" null constraint errors
- ❌ **DO NOT IGNORE**: Any "ip_blocklist does not exist" errors

These indicate the fixes didn't apply correctly.

---

## Additional Notes

- The code fixes are backward compatible - existing data won't break
- The database sync uses `{ alter: true }` to handle existing columns gracefully
- If Render's database already has these tables, the sync will just verify schema correctness
- All changes are non-breaking and safe to deploy immediately
