# Complete Setup & Deployment Guide - DatingHub App

## 🎯 Overview

Your DatingHub dating app consists of two parts:
1. **Frontend**: React app (Port 3000)
2. **Backend**: Node.js + Express API (Port 5000)

This guide walks you through complete setup, testing, and deployment.

---

## 📋 Prerequisites

- **Node.js** v14+ ([Download](https://nodejs.org/))
- **PostgreSQL** v12+ ([Download](https://www.postgresql.org/download/))
- **npm** (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))

### Verify Installation
```bash
node --version
npm --version
psql --version
```

---

## 🚀 Part 1: Local Development Setup

### Step 1: Set Up PostgreSQL Database

**Windows/Mac (using PostgreSQL installer):**
1. Open PostgreSQL (pgAdmin comes with installer)
2. Create new database named `linkup_dating`
3. Note your username/password (default is `postgres`)

**Linux:**
```bash
sudo service postgresql start
createdb linkup_dating
```

### Step 2: Set Up Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your database credentials
# DB_USER=postgres
# DB_PASSWORD=your_password
# DB_NAME=linkup_dating
```

### Step 3: Start Backend Server

```bash
# From backend directory
npm run dev
```

Expected output:
```
✓ Connected to PostgreSQL
✓ Database schema initialized
🚀 Dating app backend running on http://localhost:5000
📱 WebSocket enabled for real-time features
```

### Step 4: Set Up Frontend

```bash
# Navigate to root directory
cd ..

# Install dependencies (if not already done)
npm install

# Ensure .env file exists with correct API URL
# REACT_APP_API_URL=http://localhost:5000/api
# REACT_APP_BACKEND_URL=http://localhost:5000
```

### Step 5: Start Frontend Development Server

```bash
npm start
```

Frontend will open at `http://localhost:3000`

---

## 🧪 Testing the App

### Create Test Account

1. Go to **Sign Up** page
2. Enter email: `test@example.com`
3. Enter password: `Test123!`
4. Fill in profile details
5. Upload profile photos

### Test Key Features

**Discovery (Swipe Cards):**
- Click "🔥 Discover" tab
- Swipe through profiles with Like/Pass buttons
- When mutual match happens, notification appears

**Browse Profiles:**
- Click "👀 Browse" tab
- Use filters for age, distance, interests
- Search and like profiles

**Matches:**
- Click "❤️ Matches" tab
- View all your matches
- Click on match to message

**Messaging:**
- Click on a match to open chat
- Type and send messages in real-time
- Messages sync across tabs

**Video Dating:**
- Click 📹 video button in match
- Start video call (requires WebRTC setup)

**Profile:**
- Click "👤 Profile" tab
- View profile completion %
- Edit bio and interests

---

## 📦 Production Deployment

### Option 1: Deploy to Heroku (Recommended for Beginners)

#### Frontend (React App)

```bash
# Install Heroku CLI from https://devcenter.heroku.com/articles/heroku-cli

# Login to Heroku
heroku login

# Create Heroku app
heroku create your-linkup-app

# Set environment variables
heroku config:set REACT_APP_API_URL=https://your-backend-app.herokuapp.com/api

# Deploy
git push heroku main
```

#### Backend (Node.js API)

```bash
# Create backend app
heroku create your-linkup-api

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:hobby-dev --app your-linkup-api

# Set environment variables
heroku config:set JWT_SECRET=your_production_secret --app your-linkup-api
heroku config:set FRONTEND_URL=https://your-linkup-app.herokuapp.com --app your-linkup-api

# Deploy backend
cd backend
git push heroku main
```

### Option 2: Deploy to Azure (Free Tier Available)

#### Frontend
1. Build React app: `npm run build`
2. Deploy to Azure Static Web Apps
3. Update REACT_APP_API_URL to your backend URL

#### Backend
1. Create Azure App Service (Node.js)
2. Connect PostgreSQL database
3. Set environment variables
4. Deploy using Git or Azure CLI

### Option 3: Self-Hosted (VPS)

#### Prerequisites
- Linux VPS (Ubuntu 20.04+)
- SSH access
- Domain name (optional)

#### Setup Backend

```bash
# SSH into VPS
ssh root@your_vps_ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Clone your repository
git clone your-repo-url
cd linkup/backend

# Install PM2 for process management
sudo npm install -g pm2

# Install dependencies
npm install

# Create .env with production settings
nano .env

# Start with PM2
pm2 start server.js --name "linkup-api"
pm2 startup
pm2 save
```

#### Setup Frontend

```bash
# Install nginx
sudo apt-get install -y nginx

# Build React app
npm run build

# Copy build to nginx
sudo cp -r build/* /var/www/html/

# Restart nginx
sudo systemctl restart nginx
```

---

## 🔒 Security Checklist

- [ ] Change `JWT_SECRET` to strong random string
- [ ] Use HTTPS in production (not HTTP)
- [ ] Set `FRONTEND_URL` to your production domain
- [ ] Enable CORS for your frontend domain only
- [ ] Use environment variables for all secrets
- [ ] Never commit `.env` file to Git
- [ ] Add rate limiting for API endpoints
- [ ] Enable database backups
- [ ] Use SSL certificates (Let's Encrypt)

---

## 🐛 Troubleshooting

### Backend Won't Start
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:** PostgreSQL not running
```bash
# Windows: Open Services, restart PostgreSQL
# Mac: brew services start postgresql
# Linux: sudo service postgresql start
```

### Frontend Can't Reach Backend
```
Failed to fetch from http://localhost:5000/api
```
**Solution:** Ensure backend is running and ports match
```bash
# Check backend is running on port 5000
lsof -i :5000

# Check frontend API URL in .env
cat .env | grep REACT_APP
```

### Port Already in Use
```
Error: listen EADDRINUSE :::5000
```
**Solution:** Kill process using the port
```bash
# Mac/Linux
lsof -ti:5000 | xargs kill -9

# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Database Connection Error
```
FATAL: role "postgres" does not exist
```
**Solution:** Verify PostgreSQL user exists
```bash
# Mac/Linux
sudo -u postgres psql
\du  # List users
```

---

## 📚 API Documentation

All API endpoints require authentication except `/auth` routes.

### Authentication
- **POST** `/api/auth/signup` - Create account
- **POST** `/api/auth/login` - Login
- **GET** `/api/auth/verify` - Verify token

### Dating
- **GET** `/api/dating/discovery` - Get swipe cards
- **POST** `/api/dating/interactions/like` - Like profile
- **GET** `/api/dating/matches` - Get matches
- **GET** `/api/dating/profiles/me` - Get your profile

### Messaging
- **GET** `/api/messaging/matches/:matchId/messages` - Get messages
- **POST** `/api/messaging/matches/:matchId/messages` - Send message

Full API docs: See `/backend/README.md`

---

## 🚀 Performance Optimization

### Frontend
```bash
# Build optimized production bundle
npm run build

# Check bundle size
npm run build -- --analyze
```

### Backend
- Enable database query caching
- Add Redis for session caching
- Implement CDN for images
- Use database connection pooling (already configured)

### Database
```sql
-- Add important indices (already done)
CREATE INDEX idx_matches ON matches(user_id_1, user_id_2);
CREATE INDEX idx_messages ON messages(match_id, created_at);
```

---

## 📱 Mobile App (Android/iOS)

Your React app is already configured for Capacitor mobile deployment!

```bash
# Build for mobile
npm run capacitor:build

# For Android
npx cap add android
npm run capacitor:open:android

# For iOS (Mac only)
npx cap add ios
npm run capacitor:open:ios
```

---

## 💾 Backup & Recovery

### Database Backup
```bash
# Backup PostgreSQL
pg_dump linkup_dating > backup.sql

# Restore from backup
psql linkup_dating < backup.sql
```

### Code Backup
```bash
# Push to GitHub (recommended)
git add .
git commit -m "Dating app backup"
git push origin main
```

---

## 📊 Monitoring & Analytics

### Check Backend Health
```bash
curl http://localhost:5000/health
```

Response:
```json
{
  "status": "Backend is running",
  "timestamp": "2026-04-26T..."
}
```

### Monitor Database
```bash
psql linkup_dating
\d                  # List tables
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM messages;
```

---

## 🎓 Next Steps

1. ✅ **Verify Setup Works Locally** - Test signup, messaging, matches
2. ✅ **Customize Branding** - Update colors, name, logo
3. ✅ **Add More Features** - Video calls, payments, notifications
4. ✅ **Deploy to Production** - Choose Heroku, Azure, or self-hosted
5. ✅ **Monitor Performance** - Track logs, errors, user activity
6. ✅ **Gather User Feedback** - Improve based on real usage

---

## 🆘 Getting Help

- **Backend Issues:** Check `/backend/README.md`
- **Frontend Issues:** Check `/DATING_APP_GUIDE.md`
- **Database Issues:** PostgreSQL docs: https://www.postgresql.org/docs/
- **Deployment Issues:** Check hosting provider docs

---

## 📞 Summary

**You now have:**
- ✅ Complete dating app with swipe interface
- ✅ Real-time messaging with WebSocket
- ✅ Advanced search & filtering
- ✅ Match notifications
- ✅ Video dating support
- ✅ Production-ready backend
- ✅ Mobile-responsive design

**Ready to launch!** 🎉 Deploy to production and start connecting people. 💕
