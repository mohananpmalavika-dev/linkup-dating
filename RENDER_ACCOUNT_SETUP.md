# 🎯 Render Deployment - Complete Account Setup & Troubleshooting

## 📋 Create Render Account (FREE)

### Step 1: Sign Up for Render
1. Go to: https://render.com
2. Click **"Sign Up"** (top right)
3. Choose **"Sign up with GitHub"** (easiest)
4. Authorize Render to access your GitHub
5. Complete account setup
6. **Congratulations!** Free account created ✓

### Step 2: Dashboard Overview

After login, you'll see Render Dashboard:
- **Services** - Web services you deployed
- **Databases** - PostgreSQL databases
- **Logs** - Real-time service logs
- **Settings** - Account and billing settings

---

## 🚀 Render Account Details

### Your Render Account Info
- **Account Type:** Free (perfect for development!)
- **Services Limit:** Unlimited services
- **Database:** 90 days free PostgreSQL (90-day inactivity limit)
- **Bandwidth:** Unlimited
- **Storage:** Limited by service type

### Free Tier Specs
- **RAM:** 0.5GB per service
- **vCPU:** Shared
- **Database:** 256MB
- **Cost:** $0/month

---

## 📱 Deploy Step-by-Step (Using GitHub)

### Step 1: Create GitHub Repository

```bash
cd LinkUp

# Initialize Git
git init

# Configure Git
git config user.email "your-email@example.com"
git config user.name "Your Name"

# Add all files
git add .

# Commit
git commit -m "LinkUp dating app - production ready"

# Create repo on GitHub.com
# Then:
git remote add origin https://github.com/YOUR_USERNAME/linkup.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Render Dashboard

**Backend Deployment:**
1. Go to https://render.com/dashboard
2. Click **"New +"** → **"Web Service"**
3. Select **"Build and deploy from a Git repository"**
4. Click **"Connect GitHub"**
5. Authorize Render
6. Select **"linkup"** repository
7. Fill in deployment details:
   ```
   Name: linkup-backend
   Environment: Node
   Region: Oregon (or closest to you)
   Branch: main
   Build Command: cd backend && npm install --legacy-peer-deps
   Start Command: cd backend && npm start
   Plan: Free
   ```
8. Click **"Create Web Service"**

**Database Creation:**
1. In the same dashboard, click **"New +"** → **"PostgreSQL"**
2. Fill in:
   ```
   Name: linkup-db
   PostgreSQL Version: 15
   Region: Oregon (same as backend!)
   Plan: Free
   ```
3. Click **"Create Database"**
   - Wait ~5 minutes for creation
   - Copy the **Internal Database URL** from the database details page

**Add Environment Variables to Backend:**
1. Go to Backend Service → **"Environment"**
2. Click **"Add Environment Variable"** for each:
   ```
   Key: DATABASE_URL
   Value: [paste Internal Database URL from PostgreSQL]
   
   Key: JWT_SECRET
   Value: your-super-secret-random-key-change-this
   
   Key: FRONTEND_URL
   Value: https://linkup-frontend.onrender.com
   
   Key: NODE_ENV
   Value: production
   ```
3. Click **"Save"** after each
4. Backend will auto-restart with new variables ✓

**Frontend Deployment:**
1. Click **"New +"** → **"Static Site"**
2. Select **"linkup"** repository again
3. Fill in:
   ```
   Name: linkup-frontend
   Build Command: npm install --legacy-peer-deps && npm run build
   Publish Directory: build
   Branch: main
   Plan: Free
   ```
4. Click **"Create Static Site"**
5. After creation, go to **"Environment"** and add:
   ```
   Key: REACT_APP_API_URL
   Value: https://linkup-backend.onrender.com/api
   
   Key: REACT_APP_BACKEND_URL
   Value: https://linkup-backend.onrender.com
   ```
6. Click **"Save"** → Frontend rebuilds automatically ✓

---

## ✅ Verify Deployment

### Check Backend Health
```bash
# Should return 200 OK with JSON
curl https://linkup-backend.onrender.com/health

# Should return:
# {
#   "status": "Backend is running",
#   "timestamp": "2026-04-26T..."
# }
```

### Check Frontend Loading
1. Open: https://linkup-frontend.onrender.com
2. Open **DevTools** (F12 → Console)
3. Should see **no 404 errors**
4. Should see user registration form

### Monitor Logs
1. Render Dashboard → Backend Service
2. Click **"Logs"** tab (bottom)
3. Should see: `✓ Connected to PostgreSQL`
4. Should see: `🚀 Dating app backend running...`

---

## 🐛 Fix the 404 Error (Important!)

The error shows: `Failed to load resource: /api/v1/mci 404`

**Why:** Old API path doesn't exist in our backend.

**Solution:** Update Environment Variables

### Step 1: Update Render Environment

**Frontend Service:**
1. Render Dashboard → **linkup-frontend** service
2. Click **"Environment"**
3. Edit both variables:
   ```
   REACT_APP_API_URL = https://linkup-backend.onrender.com/api
   REACT_APP_BACKEND_URL = https://linkup-backend.onrender.com
   ```
4. Click **"Save"** (triggers rebuild)
5. Wait 3-5 minutes for rebuild

**Backend Service:**
1. Render Dashboard → **linkup-backend** service
2. Click **"Environment"**
3. Verify variables are set (listed above)
4. Click **"Redeploy"** (top button)

### Step 2: Clear Browser Cache
1. Open Frontend: https://linkup-frontend.onrender.com
2. Press **Ctrl+Shift+Delete** (Windows) or **Cmd+Shift+Delete** (Mac)
3. Clear **All time**
4. Hard refresh: **Ctrl+F5** (Windows) or **Cmd+Shift+R** (Mac)

### Step 3: Check Again
1. Open DevTools (F12)
2. Go to **Console** tab
3. Errors should be gone! ✓

---

## 📊 Your Render Services

After deployment, you have:

### Services List (Render Dashboard)

| Service | URL | Status | Notes |
|---------|-----|--------|-------|
| linkup-backend | https://linkup-backend.onrender.com | Running | Node.js API |
| linkup-frontend | https://linkup-frontend.onrender.com | Running | React App |
| linkup-db | PostgreSQL | Running | Database (Internal) |

### Database Connection Details
```
Host: [Render-provided hostname]
Port: 5432
Database: linkup_dating
Username: [auto-generated]
Password: [auto-generated]
SSL: Required
Internal URL: postgres://user:pass@host:5432/db
External URL: [for backups only]
```

---

## 🔄 Update Code

After fixing, update your code:

```bash
# Make changes locally
git add .
git commit -m "Fixed API endpoints"
git push origin main
```

**Render auto-deploys on every push!** ✨

---

## 📱 Test Your Live App

### Create Test Account
1. Open: https://linkup-frontend.onrender.com
2. Click **"Sign Up"**
3. Email: test@example.com
4. Password: Test123!
5. Fill profile details
6. Upload photos
7. Click **"Create Profile"**

### Test Features
- ✅ **Sign Up** - Create account
- ✅ **Login** - Login back in
- ✅ **Discovery** - Swipe cards
- ✅ **Browse** - Search profiles
- ✅ **Matches** - View matches
- ✅ **Messages** - Chat real-time
- ✅ **Profile** - View/edit profile

### Create 2nd Account (Different Browser/Incognito)
1. Open in **Incognito Tab**: https://linkup-frontend.onrender.com
2. Create another test account
3. Like each other to test matching
4. Test real-time messaging between accounts

---

## 🔐 Security Settings

### Update JWT Secret (Production)
1. Render Dashboard → Backend Service → Environment
2. Find: `JWT_SECRET`
3. Change from default to strong random key
4. Generate: https://www.uuidgenerator.net/ or use `openssl rand -base64 32`
5. Save and redeploy

### Enable Custom Domain (Optional)
1. Backend Service → Settings → Custom Domain
2. Add: `api.yourdomain.com` (if you own domain)
3. Frontend Service → Settings → Custom Domain
4. Add: `yourdomain.com`

---

## 📈 Monitor Performance

### View Real-Time Logs
1. Render Dashboard → Service
2. **Logs** tab → Shows all activity
3. Watch for errors in real-time

### Database Usage
1. Render Dashboard → linkup-db database
2. **Stats** tab → Shows query counts
3. **Backups** tab → Manual backups (free tier)

### Service Health
1. Render Dashboard → Service
2. **Health** indicator (green = good)
3. If spinning (yellow) = redeploying
4. If red = error (check logs)

---

## 🆘 Common Issues & Fixes

### Issue 1: 404 Error on API Calls
```
Failed to load resource: the server responded with a status of 404
```
**Fix:** Environment variables not set
- Check REACT_APP_API_URL = https://linkup-backend.onrender.com/api
- Check REACT_APP_BACKEND_URL = https://linkup-backend.onrender.com
- Hard refresh: Ctrl+F5

### Issue 2: "Cannot connect to database"
```
Error: connect ECONNREFUSED
```
**Fix:** DATABASE_URL not set in backend
1. Render Dashboard → Backend Service → Environment
2. Verify DATABASE_URL is present
3. If missing: Copy from PostgreSQL service
4. Redeploy backend

### Issue 3: Backend won't start
```
Error: ERR! npm ERR! code E403
```
**Fix:** Clear build cache
1. Backend Service → Settings
2. Click **"Clear Build Cache"**
3. Click **"Redeploy"** (top button)

### Issue 4: "TypeError: Cannot read properties"
```
Cannot read properties of undefined (reading 'data')
```
**Fix:** User data not loaded from API
1. Check backend is running: curl https://linkup-backend.onrender.com/health
2. Check API_URL is correct in frontend
3. Hard refresh browser
4. Check backend logs for errors

---

## 💾 Backup Your Data

### Manual Database Backup
1. Render Dashboard → linkup-db database
2. Click **"Backups"**
3. Click **"Initiate Backup"** (free tier limited)
4. Download backup file (.sql)

### Code Backup
GitHub is your backup! Every commit is saved.
```bash
git clone https://github.com/YOUR_USERNAME/linkup.git
```

---

## 🚀 Scale & Upgrade Later

### Current Setup
- **Backend:** Free tier (0.5GB RAM)
- **Database:** Free tier (256MB, 90-day idle)
- **Frontend:** Free tier (unlimited bandwidth)
- **Cost:** $0/month

### If You Need More
1. Render Dashboard → Service
2. Click **"Upgrade"**
3. Choose tier (starts at $7/month)
4. Auto-scales as needed

---

## 📞 Your Render Resources

| Resource | Link |
|----------|------|
| Render Home | https://render.com |
| Your Dashboard | https://render.com/dashboard |
| Render Docs | https://render.com/docs |
| Support | https://support.render.com |

---

## ✅ Final Checklist

- [ ] Render account created
- [ ] GitHub repository pushed
- [ ] Backend service deployed
- [ ] PostgreSQL database created
- [ ] Frontend service deployed
- [ ] Environment variables set (both services)
- [ ] Backend health check passing
- [ ] Frontend loading without 404 errors
- [ ] Sign up working
- [ ] Login working
- [ ] Swipe/match working
- [ ] Messaging working in real-time

---

## 🎉 You're Live!

**Your dating app is deployed on Render!**

- 🌐 **Frontend:** https://linkup-frontend.onrender.com
- 🔌 **Backend:** https://linkup-backend.onrender.com
- 💾 **Database:** PostgreSQL (auto-created)
- 📱 **Mobile:** Fully responsive
- ✨ **Real-time:** WebSocket enabled
- 💰 **Cost:** FREE!

---

### Next Steps
1. Share the link with friends
2. Create multiple accounts to test matching
3. Monitor logs for any issues
4. Gather user feedback
5. Deploy updates with `git push`

**Congratulations on launching your dating app!** 💕🚀
