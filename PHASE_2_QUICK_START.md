# Phase 2 - Quick Action Guide

## 🚀 START HERE - First Steps This Week

### Day 1: Setup & Configuration (2-3 hours)

**Step 1: Verify .env file exists with credentials**
```bash
# Check if .env file exists
cat .env

# If empty or needs updating, use .env.example as template
# Get your credentials from these services:
```

**Getting Your API Credentials (30 mins each):**

1. **Razorpay** (for payments)
   - Go to: https://dashboard.razorpay.com/app/settings/api-keys
   - You'll need: `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
   - Test mode is active by default (doesn't charge)

2. **Sentry** (for error tracking)
   - Go to: https://sentry.io/signup/
   - Create account, create project
   - Copy DSN value to: `SENTRY_DSN` and `REACT_APP_SENTRY_DSN`

3. **Google Cloud Vision** (optional, for image moderation)
   - Go to: https://console.cloud.google.com/
   - Enable Vision API
   - Create service account key
   - Copy to: `GOOGLE_CLOUD_VISION_API_KEY`

**Step 2: Verify Database**
```bash
# Check PostgreSQL is running
psql -U postgres -l  # Should list databases

# If DatingHub database doesn't exist, create it:
createdb linkup

# Run migrations
cd backend
npm run migrate

# Check migrations applied:
psql linkup -c "\dt"  # Should show 15+ tables
```

**Step 3: Start Backend**
```bash
cd backend
npm start

# Should see:
# ✅ Server running on port 3001
# ✅ Database connected
# ✅ Sentry initialized (if DSN set)
# ✅ Razorpay configured
```

**Step 4: Start Frontend**
```bash
# In new terminal window
npm start

# Should open http://localhost:3000
# Check console for no errors
```

---

### Day 2-4: Run Phase 1 Tests (3-5 hours)

**Test Age Verification:**
```bash
# Open browser console and go to signup
# Try DOB 2008-01-15 (age 15) → should BLOCK
# Try DOB 2000-01-15 (age 24) → should ALLOW
```

**Test Payments (Razorpay Test Mode):**
```bash
# Go to Subscription page
# Click "Subscribe" → Choose ₹99 plan
# Fill: Card: 4111 1111 1111 1111, Expiry: any future date, CVV: 123
# Should complete payment without real charge
```

**Test Content Moderation:**
```bash
# Go to messaging → Try sending message with "xyz" (profanity)
# Message should be flagged/blocked
# Check admin dashboard for flag
```

**Test Sentry (Error Tracking):**
```bash
# Go to browser console
# Type: throw new Error("Test error")
# Wait 5 seconds
# Go to https://sentry.io/organizations/your-org/issues/
# Should see error appear
```

**Test Admin Dashboard:**
```bash
# Go to /admin/moderation
# Should show review queue
# Create a flag and approve it to test workflow
```

---

### Day 5-6: Wire In Quick Missing Features (2-3 hours)

**Option A: Add Message Reactions** (Easiest)
```bash
# 1. Find these files:
#    - src/components/DatingMessaging/MessageThread.jsx
#    - src/components/DatingMessaging/ReactionPicker.jsx

# 2. Add reaction button to each message
# 3. Test by reacting to a message
# 4. Check database: reactions appear in message_reactions table
```

**Option B: Add Activity Status Indicator** (Medium)
```bash
# 1. Find: src/components/ActivityStatus.jsx
# 2. Add to DiscoveryCards component
# 3. Add to Matches list
# 4. Test: User should show "online" or "last seen 5m ago"
```

**Option C: Add Boost Button** (Easiest)
```bash
# 1. Find: src/components/BoostButton.jsx
# 2. Add to DiscoveryCard
# 3. Test: Click boost, purchase boost with Razorpay
```

---

### Day 7-8: Full Testing (4-6 hours)

**Complete Signup Flow:**
```bash
# 1. Open http://localhost:3000
# 2. Click Sign Up
# 3. Enter: Email, Password, DOB (25 years old)
# 4. Click Continue
# 5. Fill Profile: Name, Gender, Location, Bio, Interests
# 6. Upload 3+ photos
# 7. Click Done
# Expected: ✅ Logged in, shown Discovery page
```

**Complete Payment Flow:**
```bash
# 1. Click Subscription
# 2. Choose ₹499 plan
# 3. Click "Subscribe Now"
# 4. Razorpay modal opens
# 5. Use test card: 4111 1111 1111 1111
# 6. Complete payment
# Expected: ✅ Subscription active, "Premium Member" shown
```

**Complete Messaging Flow:**
```bash
# 1. Go to Matches
# 2. Click a match
# 3. Type message: "Hi, how are you?"
# 4. Send (Ctrl+Enter)
# 5. Try reaction on message (emoji button)
# Expected: ✅ Message sent, reaction added, no errors
```

**Check Device (Android):**
```bash
# 1. Build debug APK:
#    cd android
#    ./gradlew assembleDebug
# 2. Install on device:
#    adb install app-debug.apk
# 3. Open app, repeat signup flow
# 4. Expected: ✅ Works smoothly, no crashes
# 5. Check Sentry for any errors
```

---

### Day 9: Deploy to Staging (2 hours)

**Option A: Deploy to Heroku (Easiest)**
```bash
# Backend
heroku login
heroku create linkup-staging
git push heroku main

# Frontend (Netlify)
npm run build
npm install -g netlify-cli
netlify deploy --prod --dir=build
```

**Option B: Deploy to Your Own Server**
```bash
# SSH into server
ssh user@staging.datinghub.app

# Pull latest code
cd /var/www/linkup
git pull origin main
npm install
npm start

# Check it's running
curl http://localhost:3001/health
```

---

### Day 10: Build Release APK/AAB (1 hour)

**Generate Signing Key** (one-time):
```bash
keytool -genkey -v -keystore linkup-release.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias linkup-key \
  -keypass "your-key-password" \
  -storepass "your-store-password"
```

**Build Release AAB:**
```bash
cd android
./gradlew bundleRelease

# Output location:
# android/app/build/outputs/bundle/release/app-release.aab (50-80 MB)
```

**Verify Signing:**
```bash
jarsigner -verify -verbose android/app/build/outputs/bundle/release/app-release.aab
# Should say: "jar verified" ✅
```

---

### Days 11-12: Create Play Store Listing (2 hours)

**Go to Play Console:**
1. https://play.google.com/console
2. Click "Create App"
3. Fill in:
   - **App name:** DatingHub - Dating & Connections
   - **Type:** Application
   - **Category:** Social
   - **Content rating:** 17+
   - **Pricing:** Free

**Fill App Details:**
1. **Description:**
   ```
   DatingHub is a safe, verified dating and connection platform 
   where real people find genuine matches. Connect, chat, 
   video date, and meet amazing people in your area.
   
   🔐 Safety Features:
   - 18+ age verification
   - Photo verification
   - Block & report users
   - Real-time moderation
   
   💬 Messaging:
   - Real-time chat
   - Message reactions
   - Video dating
   - Voice messages
   
   💳 Premium Features:
   - Unlimited swipes
   - See who liked you
   - Advanced filters
   - Boost visibility
   ```

2. **Screenshots:** (5 required)
   - Signup screen
   - Discovery/Swipe cards
   - Messaging screen
   - Subscription screen
   - Profile screen

3. **Content rating:**
   - Complete questionnaire
   - Select "17+ for Social/Dating apps"

4. **Privacy Policy:**
   - Link to `/legal/privacy-policy`

5. **Terms of Service:**
   - Link to `/legal/terms-of-service`

---

### Day 13: Final Review (1-2 hours)

**Use PRE_LAUNCH_CHECKLIST.md:**
```bash
# Go through all 150+ items
# Mark each complete
# Fix any issues found
```

**Final App Test:**
```bash
✅ Signup with age 25
✅ Complete profile with photos
✅ Browse and swipe 5 matches
✅ Send message to match
✅ React to message
✅ Subscribe to premium
✅ Check Sentry: No critical errors
✅ Check console: No JavaScript errors
✅ Load time: <3 seconds
✅ Memory: Stable, no leaks
```

---

### Day 14: LAUNCH! 🚀 (30 mins)

**Submit to Play Store:**
1. Go to Play Console
2. Click your app
3. Click "Create new release"
4. Upload `app-release.aab`
5. Write release notes: `v1.0: Initial launch`
6. Click "Review & rollout"
7. Set rollout to 100%
8. Click "Start rollout"

**Monitor:**
- ✅ Check email for review status
- ✅ Expected: 24-48 hours approval
- ✅ Once approved: Live on Play Store! 🎉

---

## 📊 Progress Tracking

| Task | Status | Owner | Timeline |
|------|--------|-------|----------|
| Configure APIs | ⏳ | You | Day 1 |
| Phase 1 Testing | ⏳ | You | Days 2-4 |
| Missing Features | ⏳ | You | Days 5-6 |
| Full Testing | ⏳ | You | Days 7-8 |
| Staging Deploy | ⏳ | You | Day 9 |
| Build Release | ⏳ | You | Day 10 |
| Play Store Setup | ⏳ | You | Days 11-12 |
| Final Review | ⏳ | You | Day 13 |
| Launch | ⏳ | You | Day 14 |

---

## ❓ Common Questions

**Q: Do I need all three APIs (Razorpay, Sentry, Google Vision)?**
A: 
- ✅ Razorpay: YES (required for payments)
- ✅ Sentry: YES (required for error tracking)
- ❌ Google Vision: Optional (for image moderation, can use regex only)

**Q: Can I test payments without real money?**
A: YES! Use Razorpay test mode:
- Card: 4111 1111 1111 1111
- Expiry: Any future date
- CVV: Any 3 digits
- No real charge

**Q: How long does Play Store review take?**
A: Usually 24-48 hours. Can sometimes be faster or slower.

**Q: What if Play Store rejects my app?**
A: They'll email the reason. Common reasons:
- Age verification not working → Fix & resubmit
- Policy violation → Update & resubmit
- Adult content → Update content rating

---

## 🎯 End Goal

By end of Phase 2, you'll have:
- ✅ Working app with Phase 1 features verified
- ✅ Staging environment for testing
- ✅ Release build signed and ready
- ✅ Play Store listing complete
- ✅ App submitted for review
- ✅ Ready for launch!

---

**Questions? Issues? Check PHASE_2_TESTING_AND_DEPLOYMENT.md for detailed guide!**

