# DatingHub App - Render Deployment Guide

## 🚀 Deploy to Render (Free Tier)

Render is a modern cloud platform with **free tier support** for web apps and PostgreSQL databases.

---

## 📋 Prerequisites

1. **GitHub Account** - https://github.com
2. **Render Account** - https://render.com (sign up free)
3. **Your code pushed to GitHub**

---

## 🔧 Step 1: Push Code to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "DatingHub dating app - ready for deployment"

# Add GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/datinghub.git
git branch -M main
git push -u origin main
```

---

## 🎯 Step 2: Deploy on Render

### Option A: One-Click Deploy (Recommended)

1. Go to: https://render.com
2. Click **"New +"** → **"Web Service"**
3. Select **"Build and deploy from a Git repository"**
4. Connect your GitHub account
5. Select **`datinghub`** repository
6. Click **"Create Web Service"**

### Option B: Deploy Using render.yaml

1. Go to: https://render.com/dashboard
2. Click **"New +"** → **"Blueprint"**
3. Paste your GitHub repository URL
4. Click **"Create from Blueprint"**
5. Render will read `render.yaml` and create all services automatically

---

## ⚙️ Step 3: Configure Services

### Frontend Service
1. Name: `linkup-frontend`
2. Build Command: `npm install --legacy-peer-deps && npm run build`
3. Publish Directory: `build`
4. Environment Variables:
   ```
   REACT_APP_API_URL=https://linkup-backend.onrender.com/api
   REACT_APP_BACKEND_URL=https://linkup-backend.onrender.com
   ```

### Backend Service
1. Name: `linkup-backend`
2. Start Command: `npm start`
3. Build Command: `npm install --legacy-peer-deps`
4. Environment Variables:
   ```
   NODE_ENV=production
   PORT=5000
   JWT_SECRET=[auto-generated]
   FRONTEND_URL=https://linkup-frontend.onrender.com
   DATABASE_URL=[auto-filled]
   ```

### PostgreSQL Database
1. Name: `linkup-db`
2. PostgreSQL Version: 15
3. Plan: Free Tier

---

## 📝 Step 4: Update Files for Production

### A. Update backend/.env.production

```bash
cd backend
cat > .env.production << EOF
NODE_ENV=production
PORT=5000
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
FRONTEND_URL=${FRONTEND_URL}
API_BASE_URL=${RENDER_EXTERNAL_URL}
EOF
```

### B. Update database.js for production

The database connection will automatically use `DATABASE_URL` on Render.

### C. Update backend/server.js to use environment database

Your current setup already handles this with:
```javascript
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'linkup_dating',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});
```

For Render, update to parse `DATABASE_URL`:
```javascript
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || buildLocalConnection()
});
```

---

## 🔗 Step 5: Connect Frontend to Backend

After deployment, Render provides URLs:
- **Frontend:** https://linkup-frontend.onrender.com
- **Backend:** https://linkup-backend.onrender.com

Update environment variables:
```
REACT_APP_API_URL=https://linkup-backend.onrender.com/api
REACT_APP_BACKEND_URL=https://linkup-backend.onrender.com
```

Render will automatically rebuild frontend with these values.

---

## 🧪 Step 6: Test Deployment

### Check Backend Health
```bash
curl https://linkup-backend.onrender.com/health
```

Expected response:
```json
{
  "status": "Backend is running",
  "timestamp": "2026-04-26T..."
}
```

### Test Frontend
1. Open: https://linkup-frontend.onrender.com
2. Try signing up
3. Test messaging

### Monitor Logs
In Render Dashboard:
- Backend → Logs
- Frontend → Logs
- Database → Logs

---

## 🔐 Security Configuration

### Enable Auto-Deploy
1. Backend Service → Settings → "Auto-Deploy" → "Yes"
2. Frontend Service → Settings → "Auto-Deploy" → "Yes"
3. Now: Every `git push` automatically deploys!

### Update JWT Secret
On Render Dashboard:
1. Backend Service → Environment
2. Find `JWT_SECRET`
3. Click "Regenerate" for production secret

### Custom Domain (Optional)
1. Backend Service → Settings → "Custom Domain"
2. Add: `api.yourdomain.com`
3. Frontend Service → Settings → "Custom Domain"
4. Add: `yourdomain.com`

---

## 📊 Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Render account created
- [ ] GitHub connected to Render
- [ ] render.yaml configured
- [ ] Frontend environment variables set
- [ ] Backend environment variables set
- [ ] PostgreSQL database created
- [ ] Database schema initialized (Render auto-runs on deploy)
- [ ] Health check passing
- [ ] Signup/login working
- [ ] Messaging working
- [ ] Auto-deploy enabled

---

## 🚨 Troubleshooting

### Backend Build Fails
```
Error: npm ERR! npm ERR! code E403
```

**Solution:** Use `--legacy-peer-deps` flag:
```bash
npm install --legacy-peer-deps
```

This is already in `package.json` scripts.

### Database Connection Error
```
Error: connect ECONNREFUSED
```

**Solution:** Check `DATABASE_URL` is set:
1. Render Dashboard → Backend Service → Environment
2. Verify `DATABASE_URL` is present
3. Restart service

### Frontend Can't Reach Backend
```
Failed to fetch from https://linkup-backend.onrender.com/api
```

**Solution:** Check CORS is enabled:
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
```

### CORS Error on Frontend
```
Access-Control-Allow-Origin
```

**Solution:** Update backend CORS:
```javascript
app.use(cors({
  origin: 'https://linkup-frontend.onrender.com',
  credentials: true
}));
```

---

## 📈 Performance Tips

### Optimize Build Time
- Skip tests: `npm run build` (no test runs)
- Clear cache: Render → Service → "Clear Build Cache"

### Database Optimization
- Add indices (already done in schema)
- Monitor query performance: Render Logs
- Backup data regularly

### Frontend Optimization
```bash
npm run build
# Check bundle size
npm run build -- --analyze
```

---

## 💾 Backup Strategy

### Database Backups
1. Render Dashboard → Database
2. Enable automatic backups (free tier: manual only)
3. Manual backup: `pg_dump linkup_dating > backup.sql`

### Code Backups
GitHub is your backup! Every commit is saved.

```bash
# Clone latest
git clone https://github.com/YOUR_USERNAME/datinghub.git
```

---

## 🔄 Update & Redeploy

### Deploy Code Changes
```bash
git add .
git commit -m "Updated feature"
git push origin main
```

Render automatically redeploys! (if auto-deploy enabled)

### Update Environment Variables
1. Render Dashboard → Service → Environment
2. Edit variable
3. Service auto-restarts

### Scale Backend (Paid)
If you need more power:
1. Render Dashboard → Backend Service
2. Click "Upgrade"
3. Choose paid tier (starts at $7/month)

---

## 📞 Support & Resources

- **Render Docs:** https://render.com/docs
- **Render Support:** https://support.render.com
- **Your Dashboard:** https://render.com/dashboard

---

## ✅ You're Live!

Your dating app is now **deployed to production**!

- ✅ Frontend: https://linkup-frontend.onrender.com
- ✅ Backend: https://linkup-backend.onrender.com
- ✅ Database: PostgreSQL (Free tier, 90 days idle)
- ✅ Auto-deploy: Enabled
- ✅ SSL/HTTPS: Automatic

---

## 🎉 Next Steps

1. **Share your app** - Send link to friends
2. **Monitor performance** - Check Render logs
3. **Gather feedback** - Improve features
4. **Add analytics** - Track user behavior
5. **Scale up** - Upgrade as you grow

---

**Your dating app is live! Congrats! 🚀💕**
