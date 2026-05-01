# 🔍 Render Deployment - Complete Debug & Fix Guide

## 📊 Current Status

### What's Working ✓
- Backend is **running** at https://linkup-backend.onrender.com
- API root endpoint responds
- Health check: /health working
- Database is **connected**

### What's Not Working ✗
- Frontend can't authenticate/signup
- API endpoints returning 404 or 401
- Environment variables not applied

---

## 🚨 Root Causes & Solutions

### Issue #1: Frontend Environment Variables Not Applied

**Problem:** You set REACT_APP_API_URL but frontend still uses old URL

**Solution - STEP BY STEP:**

1. **Go to Render Dashboard:**
   - https://render.com/dashboard

2. **Click "linkup-frontend" service**

3. **Click "Environment" tab**

4. **Check these variables exist:**
   ```
   REACT_APP_API_URL = https://linkup-backend.onrender.com/api
   REACT_APP_BACKEND_URL = https://linkup-backend.onrender.com
   ```

5. **If they don't exist:**
   - Click "Add Environment Variable"
   - Key: `REACT_APP_API_URL`
   - Value: `https://linkup-backend.onrender.com/api`
   - Click "Save"
   
   - Click "Add Environment Variable" again
   - Key: `REACT_APP_BACKEND_URL`
   - Value: `https://linkup-backend.onrender.com`
   - Click "Save"

6. **Important:** Wait for the **complete rebuild**
   - Render will show "Building..." then "Deployed"
   - This can take 5-10 minutes
   - During build, site shows "Building" page

7. **After deployment:**
   - Hard refresh: **Ctrl+F5** (Windows) or **Cmd+Shift+R** (Mac)
   - Clear cache: **Ctrl+Shift+Delete**
   - Open frontend fresh

---

### Issue #2: Backend Environment Variables

**Problem:** Backend might not have DATABASE_URL or JWT_SECRET

**Solution:**

1. **Click "linkup-backend" service**

2. **Click "Environment" tab**

3. **Verify these exist:**
   ```
   DATABASE_URL = postgres://user:pass@hostname:5432/linkup_dating
   JWT_SECRET = some-secret-key
   FRONTEND_URL = https://linkup-frontend.onrender.com
   NODE_ENV = production
   ```

4. **If DATABASE_URL is missing:**
   - Go back to Dashboard
   - Click "linkup-db" (your PostgreSQL database)
   - Copy the "Internal Database URL"
   - Go back to Backend service → Environment
   - Add DATABASE_URL variable with copied value

5. **After any changes:**
   - Click "Redeploy" button (top of page)
   - Wait for redeployment

---

## 🧪 Test Each Step

### Test 1: Backend is Running
```bash
curl https://linkup-backend.onrender.com/

# Should return:
# {
#   "message": "DatingHub API Backend",
#   "version": "1.0.0",
#   "status": "running",
#   ...
# }
```

### Test 2: Health Check
```bash
curl https://linkup-backend.onrender.com/health

# Should return:
# {
#   "status": "Backend is running",
#   "timestamp": "2026-04-26T..."
# }
```

### Test 3: Frontend Loads
1. Open: https://linkup-frontend.onrender.com
2. Should see **Sign Up** form
3. **DevTools** (F12) → Console tab
4. Should show **NO 404 errors**

### Test 4: Signup Works
1. Fill form:
   - Email: test@example.com
   - Password: Test123!
   - Confirm: Test123!
2. Click **Sign Up**
3. Should either:
   - ✓ Success: Redirect to profile
   - ✗ Error: Check console for error message

---

## 🔧 Manual Verification

### Check Frontend Environment Variables

In browser DevTools, run this in Console:
```javascript
console.log({
  apiUrl: process.env.REACT_APP_API_URL,
  backendUrl: process.env.REACT_APP_BACKEND_URL
})
```

Should output:
```javascript
{
  apiUrl: "https://linkup-backend.onrender.com/api",
  backendUrl: "https://linkup-backend.onrender.com"
}
```

If not, your environment variables **didn't apply**. Rebuild frontend:
1. Render Dashboard → linkup-frontend
2. Top button → "Redeploy latest commit"
3. Wait 5-10 minutes

---

### Check Backend Database Connection

Open Render Backend Logs:
1. Render Dashboard → linkup-backend
2. Click "Logs" tab (bottom)
3. Should see:
   ```
   ✓ Connected to PostgreSQL
   ✓ Database schema initialized
   🚀 Dating app backend running...
   ```

If not, you see database error:
```
Error: connect ECONNREFUSED
Error: password authentication failed
```

**Fix database connection:**
1. Check DATABASE_URL is set in Environment
2. Copy exact URL from linkup-db service
3. Paste into Backend environment
4. Redeploy backend

---

## 🎯 Complete Fix Checklist

- [ ] **Step 1:** Frontend environment variables set
  - [ ] REACT_APP_API_URL set to https://linkup-backend.onrender.com/api
  - [ ] REACT_APP_BACKEND_URL set to https://linkup-backend.onrender.com
  - [ ] Frontend rebuilt (check "Deployed" status)

- [ ] **Step 2:** Backend environment variables set
  - [ ] DATABASE_URL set
  - [ ] JWT_SECRET set
  - [ ] FRONTEND_URL set to https://linkup-frontend.onrender.com
  - [ ] NODE_ENV set to production
  - [ ] Backend redeployed

- [ ] **Step 3:** Clear browser
  - [ ] Hard refresh (Ctrl+F5)
  - [ ] Clear cache
  - [ ] Open frontend in new tab

- [ ] **Step 4:** Test backend
  - [ ] Root: https://linkup-backend.onrender.com ✓
  - [ ] Health: https://linkup-backend.onrender.com/health ✓

- [ ] **Step 5:** Test frontend
  - [ ] Loads without 404 errors ✓
  - [ ] Sign Up form visible ✓
  - [ ] Can enter email/password ✓

- [ ] **Step 6:** Test signup
  - [ ] Submit signup form
  - [ ] Check console for errors
  - [ ] Success or clear error message

---

## 🚨 If Still Not Working

### Check Backend Logs in Detail

1. Render Dashboard → linkup-backend
2. "Logs" tab → Expand full logs
3. Look for these errors and solutions:

**Error 1: "Cannot find module"**
```
Cannot find module '@render/database'
```
Solution: Clear cache, redeploy:
1. Settings → "Clear Build Cache"
2. "Redeploy" button

**Error 2: "connect ECONNREFUSED"**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
Solution: DATABASE_URL not set
1. Copy from linkup-db service
2. Add to Environment
3. Redeploy

**Error 3: "JWT_SECRET not set"**
```
TypeError: Cannot read 'JWT_SECRET'
```
Solution: Set JWT_SECRET variable:
1. Environment tab
2. Add JWT_SECRET = any-random-string
3. Redeploy

---

### Check Frontend Console

Press **F12** → Console:

**Error 1: "Cannot GET /api/auth/signup"**
```
Failed to load resource: /api/auth/signup 404
```
Solution: API URL wrong
1. Check REACT_APP_API_URL in environment
2. Should be: https://linkup-backend.onrender.com/api
3. Rebuild frontend

**Error 2: "Cannot connect to server"**
```
Cannot connect to https://linkup-backend.onrender.com
```
Solution: Backend not running
1. Check linkup-backend service status (green?)
2. Check /health endpoint
3. Check database is connected (see logs)

**Error 3: "CORS error"**
```
Access-Control-Allow-Origin header
```
Solution: CORS not configured
1. Check backend CORS settings
2. Should allow FRONTEND_URL
3. Currently set to any origin (*)

---

## 📋 What Each Service Does

### linkup-backend (Node.js)
- **URL:** https://linkup-backend.onrender.com
- **Job:** API server, database connection, WebSocket
- **Needs:** DATABASE_URL, JWT_SECRET
- **Status:** Check green indicator + /health endpoint

### linkup-frontend (React)
- **URL:** https://linkup-frontend.onrender.com
- **Job:** Web interface, calls API
- **Needs:** REACT_APP_API_URL, REACT_APP_BACKEND_URL
- **Status:** Check loads without 404 errors

### linkup-db (PostgreSQL)
- **Type:** Database
- **Job:** Stores user data, profiles, messages
- **Status:** Should show "Available"
- **Internal URL:** Use Internal Database URL (not External)

---

## 🔄 How to Force a Complete Rebuild

If things still aren't working:

**Frontend:**
1. Render Dashboard → linkup-frontend
2. Settings → "Clear Build Cache"
3. "Redeploy latest commit"
4. Wait 10 minutes for rebuild

**Backend:**
1. Render Dashboard → linkup-backend
2. Settings → "Clear Build Cache"
3. "Redeploy latest commit"
4. Wait 10 minutes for rebuild

**Both:**
1. Clear browser cache locally
2. Hard refresh all tabs (Ctrl+F5)
3. Open frontend in incognito window

---

## ✅ Success Indicators

You'll know it's working when:

1. ✅ Backend root returns JSON
   ```bash
   curl https://linkup-backend.onrender.com/
   # Returns JSON with endpoints info
   ```

2. ✅ Frontend loads clean
   - No 404 errors in console
   - Sign Up form visible
   - All buttons clickable

3. ✅ Signup request goes through
   - Submit form
   - See response in Network tab
   - Either success or clear error

4. ✅ Multiple accounts work
   - Create account 1
   - Create account 2 (different email)
   - Both can login

5. ✅ Matching works
   - Account 1 likes Account 2
   - Account 2 likes Account 1
   - Both see "It's a Match!"

---

## 📞 When All Else Fails

If after all this it's still not working, try:

### Option A: Rebuild Everything
```bash
# Locally:
git add .
git commit -m "Force rebuild"
git push origin main

# Render will auto-redeploy
# Wait 10-15 minutes
```

### Option B: Check Render Status
- Is Render having issues? https://status.render.com
- Is your service spinning (redeploying)?
- Check "Events" tab for errors

### Option C: Local Testing
```bash
cd backend
npm run dev

# New terminal:
npm start

# Test on http://localhost:3000
```

If it works locally but not on Render, it's an environment variable issue.

---

## 🎯 Quick Reference URLs

| Service | URL | What to Check |
|---------|-----|---------------|
| Frontend | https://linkup-frontend.onrender.com | Loads, no 404s |
| Backend | https://linkup-backend.onrender.com | Returns JSON |
| Health | https://linkup-backend.onrender.com/health | Returns status |
| Logs | Render Dashboard → Service → Logs | Look for errors |
| Env Vars | Render Dashboard → Service → Environment | All required vars set |

---

**After completing all steps above, your app WILL work!** 💕

If you get stuck on any step, check the Logs tab - that's where all the clues are!
