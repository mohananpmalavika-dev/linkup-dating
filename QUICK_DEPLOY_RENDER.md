# 🚀 Deploy DatingHub App to Render

## Quick Deploy (5 minutes)

### Step 1: Push Code to GitHub

```bash
# Navigate to project root
cd DatingHub

# Initialize git if not done
git init

# Configure git
git config user.email "your-email@example.com"
git config user.name "Your Name"

# Add all files
git add .

# Commit
git commit -m "DatingHub dating app - production ready"

# Add GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/datinghub.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Render

1. **Sign up for free:** https://render.com

2. **Connect GitHub:**
   - Click "New +" in Render Dashboard
   - Choose "Web Service"
   - Select "Build and deploy from Git repository"
   - Click "Connect GitHub"
   - Authorize Render to access your GitHub

3. **Select Repository:**
   - Find "datinghub" repository
   - Click "Connect"

4. **Configure Service:**
   - Name: `linkup-backend`
   - Environment: `Node`
   - Build Command: `cd backend && npm install --legacy-peer-deps`
   - Start Command: `cd backend && npm start`
   - Plan: **Free**

5. **Add Database:**
   - Click "Create +" → "PostgreSQL"
   - Name: `linkup-db`
   - Plan: **Free**

6. **Set Environment Variables:**
   ```
   JWT_SECRET=your-random-secret-key-change-in-production
   FRONTEND_URL=https://linkup-frontend.onrender.com
   NODE_ENV=production
   ```

7. **Deploy Frontend:**
   - Click "New +" → "Static Site"
   - Connect same GitHub repo
   - Build Command: `npm install --legacy-peer-deps && npm run build`
   - Publish Directory: `build`
   - Environment Variables:
     ```
     REACT_APP_API_URL=https://linkup-backend.onrender.com/api
     REACT_APP_BACKEND_URL=https://linkup-backend.onrender.com
     ```

8. **Wait for Deployment:**
   - Render deploys automatically
   - Watch the logs for any errors
   - Takes ~5-10 minutes

### Step 3: Test Your Live App

1. Open Frontend URL: https://linkup-frontend.onrender.com
2. Try signing up
3. Test all features (swipe, match, message)

---

## ✅ Deployment Checklist

- [ ] GitHub account created
- [ ] Code pushed to GitHub
- [ ] Render account created
- [ ] GitHub connected to Render
- [ ] Backend service deployed
- [ ] PostgreSQL database created
- [ ] Environment variables set
- [ ] Frontend service deployed
- [ ] Tests passing on live URLs

---

## 🔗 Your Live App URLs

After deployment:
- **Frontend:** https://linkup-frontend.onrender.com
- **Backend:** https://linkup-backend.onrender.com
- **Health Check:** https://linkup-backend.onrender.com/health

---

## 📊 Deployment Status

Monitor your services:
1. Render Dashboard → Your Services
2. Click on service name
3. View logs in real-time
4. Check deployment status

---

## 🔄 Update Your App

After deployment, updates are easy:

```bash
# Make changes locally
git add .
git commit -m "Your changes"
git push origin main
```

Render automatically rebuilds and redeploys! ✨

---

## 🆘 Troubleshooting

### Build Fails with "npm ERR!"
**Solution:** We're using `--legacy-peer-deps` flag, which is already configured.

### "Cannot find module" error
**Solution:** Clear cache:
1. Render Dashboard → Backend Service
2. Settings → "Clear Build Cache"
3. Manual Deploy

### Database connection error
**Solution:** Check DATABASE_URL:
1. Render Dashboard → Backend Service
2. Environment → DATABASE_URL should be set
3. If empty, restart the service

### Frontend can't reach backend
**Solution:** Update CORS in backend:
- Go to backend service settings
- Set FRONTEND_URL to your frontend URL
- Restart service

---

## 📱 Share Your App!

Your dating app is now live and you can:
- ✅ Share the link with friends: https://linkup-frontend.onrender.com
- ✅ Test matching between multiple accounts
- ✅ Use real-time messaging
- ✅ Verify all features work

---

## 💡 Important Notes

### Free Tier Limits
- Backend: 0.5GB RAM, auto-deploys
- Database: 90 days inactivity spindown
- Static frontend: Unlimited bandwidth

### Keep Services Alive
To prevent database from sleeping:
1. Add a simple cron job that pings the API every hour
2. Or upgrade to paid tier (~$7/month)

### Upgrade Later
If you outgrow free tier:
- Render → Service → "Upgrade"
- Pay-as-you-go pricing
- No credit card required for free tier

---

## 🎉 You're Live!

**Congratulations!** Your dating app is deployed to production! 🚀

Share the link: **https://linkup-frontend.onrender.com** 💕

---

**Next Steps:**
1. Test all features on live app
2. Share with friends
3. Gather feedback
4. Monitor logs for issues
5. Deploy updates with `git push`

---

See **RENDER_DEPLOYMENT.md** for detailed deployment guide.
