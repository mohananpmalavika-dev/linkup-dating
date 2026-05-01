# DatingHub - PHASE 2: Testing & Deployment

## 🎯 Overview

Phase 2 focuses on **validating Phase 1** and **preparing for Play Store launch**. This includes:
1. External service configuration (Razorpay, Sentry, Google Vision)
2. Comprehensive testing (unit, integration, end-to-end)
3. Staging deployment
4. Android device testing
5. Critical missing feature integration
6. Build signing & release preparation

**Timeline**: 2-3 weeks
**Target**: Ready for Play Store submission by Week 4

---

## 📋 Task Checklist

### SECTION 1: Configuration & Setup (Day 1-2)

- [ ] **1.1 Create `.env` file with required credentials**
  - Razorpay API keys
  - Sentry DSN
  - Google Vision API key (optional)
  - Database connection string
  - JWT secret
  
- [ ] **1.2 Verify database connections**
  - PostgreSQL running and accessible
  - All Phase 1 migrations applied
  - Test queries on each table
  
- [ ] **1.3 Verify all npm dependencies installed**
  - Frontend: `npm install` in root
  - Backend: `npm install` in `/backend`
  
- [ ] **1.4 Test API server startup**
  - Backend starts without errors
  - All routes registered
  - Socket.IO connection works

### SECTION 2: Phase 1 Feature Testing (Day 2-4)

#### Legal & Compliance
- [ ] **2.1 Verify legal documents are accessible**
  - [ ] `/legal/terms-of-service` loads T&C
  - [ ] `/legal/privacy-policy` loads Privacy Policy
  - [ ] `/legal/refund-policy` loads Refund Policy
  
- [ ] **2.2 Check legal links in app**
  - [ ] Footer has legal links
  - [ ] Links open in new tab
  - [ ] Content readable

#### Age Verification
- [ ] **2.3 Test age gate on signup**
  - [ ] User under 18: Signup blocked
  - [ ] User age 18: Signup allowed
  - [ ] User age 60+: Signup allowed
  - [ ] Invalid DOB: Error message shown
  - [ ] Database records age verification
  
- [ ] **2.4 Test age gate API**
  ```bash
  curl -X POST http://localhost:3001/api/age-verification/verify \
    -H "Content-Type: application/json" \
    -d '{"dateOfBirth":"2008-01-15"}'
  # Expected: {valid: false, age: 15, message: "Must be 18+"}
  
  curl -X POST http://localhost:3001/api/age-verification/verify \
    -H "Content-Type: application/json" \
    -d '{"dateOfBirth":"2000-01-15"}'
  # Expected: {valid: true, age: 25}
  ```

#### Razorpay Payments
- [ ] **2.5 Test subscription plans endpoint**
  ```bash
  curl http://localhost:3001/api/payments/plans
  # Expected: Array of 3 plans (₹99, ₹499, ₹999)
  ```
  
- [ ] **2.6 Test create order flow**
  - [ ] Click "Subscribe" → Choose plan
  - [ ] Submit → Razorpay order created
  - [ ] Check database: Payment record with pending status
  
- [ ] **2.7 Test payment verification**
  - [ ] Complete payment in Razorpay test mode
  - [ ] Payment signature verified
  - [ ] Subscription created in database
  - [ ] User sees "Active subscription"
  
- [ ] **2.8 Test refund process**
  - [ ] User initiates refund
  - [ ] 48-hour window enforced
  - [ ] Refund request in database
  - [ ] Manual refund processing works
  
- [ ] **2.9 Test payment history**
  ```bash
  curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/payments/receipts
  # Expected: Array of payment records with status
  ```

#### Content Moderation
- [ ] **2.10 Test text scanning**
  ```bash
  curl -X POST http://localhost:3001/api/moderation/scan-text \
    -H "Content-Type: application/json" \
    -d '{"text":"This is a clean message"}'
  # Expected: {clean: true, severity: "none", flags: []}
  
  curl -X POST http://localhost:3001/api/moderation/scan-text \
    -H "Content-Type: application/json" \
    -d '{"text":"This message has a profanity word"}'
  # Expected: {clean: false, severity: "medium", flags: ["profanity"]}
  ```
  
- [ ] **2.11 Test image scanning**
  ```bash
  curl -X POST http://localhost:3001/api/moderation/scan-image \
    -H "Content-Type: application/json" \
    -d '{"imageUrl":"https://example.com/image.jpg"}'
  # Expected: {clean: true/false, nsfw: boolean, issues: []}
  ```
  
- [ ] **2.12 Test profile scanning**
  - [ ] Create profile with clean content → passes
  - [ ] Try profile with spam → blocked
  - [ ] Try profile with NSFW images → flagged
  
- [ ] **2.13 Test user flagging**
  - [ ] User reports another user → Flag created
  - [ ] Admin sees flag in dashboard
  - [ ] Admin approves/rejects flag
  - [ ] Action logged in database

#### Sentry Error Tracking
- [ ] **2.14 Test backend error capture**
  - [ ] Trigger error in API (e.g., invalid request)
  - [ ] Check Sentry dashboard: Error appears
  - [ ] Verify stack trace readable
  
- [ ] **2.15 Test frontend error capture**
  - [ ] Open browser console
  - [ ] Trigger error in React (e.g., click broken button)
  - [ ] Check Sentry dashboard: Error appears
  
- [ ] **2.16 Test Sentry user context**
  - [ ] Login to app
  - [ ] Check Sentry: User ID shown
  - [ ] Trigger error: Error linked to user
  
- [ ] **2.17 Test Sentry breadcrumbs**
  - [ ] Navigate through app
  - [ ] Trigger error
  - [ ] Check Sentry: Breadcrumbs show navigation path

#### Admin Moderation Dashboard
- [ ] **2.18 Test admin dashboard access**
  - [ ] Non-admin user: Cannot access /admin/moderation
  - [ ] Admin user: Can access dashboard
  
- [ ] **2.19 Test review queue**
  - [ ] Create multiple flags
  - [ ] Dashboard shows pending count
  - [ ] Click flag: Details shown
  - [ ] Approve/reject flag
  - [ ] Flag removed from queue
  
- [ ] **2.20 Test moderation statistics**
  - [ ] Stats tab loads
  - [ ] Pending count accurate
  - [ ] Resolved count accurate
  - [ ] Action breakdown shows correct data

### SECTION 3: Critical Missing Features Integration (Day 5-6)

Based on MISSING_FEATURES_REPORT.md, integrate the most critical missing features:

#### Priority 1: Message Reactions (Quick Win)
- [ ] **3.1 Wire message reactions into DatingMessaging**
  - [ ] Find `ReactionPicker` component
  - [ ] Add to message context menu
  - [ ] Test emoji reactions on messages
  - [ ] Verify reactions persist in database
  - [ ] Time: 2-3 hours

#### Priority 2: Live Activity Status (Quick Win)
- [ ] **3.2 Add activity status indicators**
  - [ ] Find `ActivityStatus` component
  - [ ] Add to DiscoveryCards
  - [ ] Add to Matches list
  - [ ] Add to ChatWindow
  - [ ] Test socket broadcast
  - [ ] Time: 2-3 hours

#### Priority 3: Boost System (UI Integration)
- [ ] **3.3 Integrate boost button into Discovery**
  - [ ] Add BoostButton to DiscoveryCard
  - [ ] Test boost purchase flow
  - [ ] Verify boost cooldown works
  - [ ] Time: 1-2 hours

#### Optional: Opening Message Templates
- [ ] **3.4 Add icebreaker suggestions to messaging**
  - [ ] Add "Suggest message" button in DatingMessaging
  - [ ] Show IcereakerSuggestions modal
  - [ ] Copy suggestion → Send message
  - [ ] Time: 1-2 hours

### SECTION 4: Testing (Day 7-8)

#### Automated Tests
- [ ] **4.1 Run backend unit tests**
  ```bash
  cd backend
  npm test
  ```
  - [ ] Age verification tests
  - [ ] Payment tests
  - [ ] Moderation tests
  
- [ ] **4.2 Run frontend unit tests**
  ```bash
  npm test
  ```
  - [ ] Component tests
  - [ ] Hook tests
  - [ ] Utility tests

#### Manual Integration Testing
- [ ] **4.3 Complete signup flow**
  - [ ] Sign up with valid age
  - [ ] Complete profile
  - [ ] Upload photos
  - [ ] Save preferences
  
- [ ] **4.4 Complete purchase flow**
  - [ ] Browse subscription plans
  - [ ] Click subscribe
  - [ ] Complete Razorpay payment
  - [ ] Verify subscription active
  
- [ ] **4.5 Complete messaging flow**
  - [ ] Match with user
  - [ ] Send message
  - [ ] Receive message
  - [ ] React to message
  - [ ] See typing indicator
  
- [ ] **4.6 Complete moderation flow**
  - [ ] Report user/message
  - [ ] As admin: Review flag
  - [ ] Approve/reject flag
  - [ ] Action applied to user

#### Device Testing
- [ ] **4.7 Test on Android device**
  - [ ] Build APK: `cd android && ./gradlew assembleDebug`
  - [ ] Install on device: `adb install app-debug.apk`
  - [ ] Test signup flow
  - [ ] Test payment flow
  - [ ] Test messaging flow
  - [ ] Check for console errors
  - [ ] Check memory usage
  - [ ] Check battery drain
  
- [ ] **4.8 Test on iOS simulator (if available)**
  - [ ] Same flows as Android
  - [ ] Check for platform-specific issues

#### Performance Testing
- [ ] **4.9 Measure load times**
  - [ ] App startup time: Target <3 seconds
  - [ ] Page load times: Target <1 second
  - [ ] Image load times: Target <500ms
  - [ ] API response times: Target <500ms
  
- [ ] **4.10 Check for memory leaks**
  - [ ] Open DevTools
  - [ ] Navigate through app
  - [ ] Check memory chart: Should not grow continuously
  - [ ] Check console: No duplicate listeners

#### Security Testing
- [ ] **4.11 Test authentication**
  - [ ] Invalid token: Request rejected
  - [ ] Expired token: Refresh token works
  - [ ] No token: Redirect to login
  
- [ ] **4.12 Test authorization**
  - [ ] Non-admin accessing /admin: 403 Forbidden
  - [ ] User accessing other user's data: 403 Forbidden
  
- [ ] **4.13 Test payment security**
  - [ ] Invalid signature: Payment rejected
  - [ ] Duplicate order ID: Blocked
  - [ ] Signature verification working

### SECTION 5: Staging Deployment (Day 9)

- [ ] **5.1 Set up staging database**
  - [ ] Create staging PostgreSQL database
  - [ ] Run all migrations
  - [ ] Seed with test data
  
- [ ] **5.2 Deploy backend to staging server**
  ```bash
  # Option A: Heroku (free tier)
  heroku login
  heroku create linkup-staging
  git push heroku main
  
  # Option B: Your own server
  ssh user@staging.datinghub.app
  cd /var/www/linkup
  git pull origin main
  npm install
  npm start
  ```
  
- [ ] **5.3 Deploy frontend to staging**
  ```bash
  # Build React app
  npm run build
  
  # Deploy to Netlify (free) or your server
  # npm install -g netlify-cli
  # netlify deploy --prod --dir=build
  ```
  
- [ ] **5.4 Update environment variables**
  - [ ] Point frontend to staging API
  - [ ] Verify Sentry sends to staging project
  - [ ] Test complete flow on staging

### SECTION 6: Build & Release Prep (Day 10)

- [ ] **6.1 Generate signing keystore**
  ```bash
  keytool -genkey -v -keystore linkup-release.keystore \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -alias linkup-key
  ```
  - [ ] Keystore created
  - [ ] Keystore password saved securely
  - [ ] Key password saved securely
  
- [ ] **6.2 Configure Gradle signing**
  - [ ] Edit `android/app/build.gradle`
  - [ ] Add `signingConfigs.release` block
  - [ ] Point to keystore
  - [ ] Use environment variables for passwords
  
- [ ] **6.3 Build release AAB**
  ```bash
  cd android
  ./gradlew bundleRelease
  ```
  - [ ] Build succeeds
  - [ ] Output: `android/app/build/outputs/bundle/release/app-release.aab`
  - [ ] File size reasonable (~50-80 MB)
  
- [ ] **6.4 Verify signing**
  ```bash
  jarsigner -verify -verbose android/app/build/outputs/bundle/release/app-release.aab
  ```
  - [ ] Signing verified
  - [ ] Certificate valid

### SECTION 7: Play Store Preparation (Day 11-12)

- [ ] **7.1 Create Play Store developer account**
  - [ ] Go to https://play.google.com/console
  - [ ] Pay $25 registration
  - [ ] Complete account setup
  
- [ ] **7.2 Create app listing**
  - [ ] App name: "DatingHub - Dating & Connections"
  - [ ] App category: Social
  - [ ] Content rating: 17+ (for dating features)
  
- [ ] **7.3 Complete app details**
  - [ ] Full description (4000 chars)
  - [ ] Short description (80 chars)
  - [ ] Add promotional graphics
  - [ ] Add app icon (512x512)
  
- [ ] **7.4 Upload screenshots & preview**
  - [ ] Phone screenshots (5+): Signup, Discovery, Messages, Payments, Profile
  - [ ] Tablet screenshots (optional)
  - [ ] Feature graphic (1024x500)
  - [ ] Video preview (30 seconds, optional)
  
- [ ] **7.5 Content rating questionnaire**
  - [ ] Complete all questions
  - [ ] Select appropriate age rating
  - [ ] Save content rating
  
- [ ] **7.6 Set up privacy & permissions**
  - [ ] Link Privacy Policy
  - [ ] Link Terms of Service
  - [ ] Select target audience
  - [ ] Declare data practices
  
- [ ] **7.7 Set pricing & distribution**
  - [ ] Price: Free
  - [ ] Countries: All (or select)
  - [ ] Device categories: Phone, Tablet
  - [ ] Require Android 7.0+ (API 24)

### SECTION 8: Final Pre-Launch Review (Day 13)

- [ ] **8.1 Use PRE_LAUNCH_CHECKLIST.md**
  - [ ] Go through all 150+ checkpoints
  - [ ] Mark each as complete
  - [ ] Document any issues found
  
- [ ] **8.2 Final app test**
  - [ ] Complete signup (age 25)
  - [ ] Complete profile with all fields
  - [ ] Upload 3+ photos
  - [ ] Browse & swipe 5 matches
  - [ ] Send message to match
  - [ ] Subscribe to premium
  - [ ] Verify content moderation works
  - [ ] Check all error handling
  
- [ ] **8.3 Check Sentry integration**
  - [ ] Dashboard shows clean status
  - [ ] No unresolved critical issues
  - [ ] Performance metrics good
  
- [ ] **8.4 Verify Play Store listing**
  - [ ] All fields filled correctly
  - [ ] Screenshots clear and professional
  - [ ] Description accurate
  - [ ] Policy links working
  - [ ] No grammatical errors

### SECTION 9: Launch! (Day 14)

- [ ] **9.1 Upload AAB to Play Console**
  - [ ] Go to "Create new release"
  - [ ] Upload `app-release.aab`
  - [ ] Write release notes (v1.0: Initial launch)
  
- [ ] **9.2 Submit for review**
  - [ ] Click "Review & rollout"
  - [ ] Configure rollout: 100% (full release)
  - [ ] Click "Start rollout"
  
- [ ] **9.3 Monitor review**
  - [ ] Check email for review status
  - [ ] Expected: 24-48 hours
  - [ ] Address any policy violations
  - [ ] Resubmit if needed
  
- [ ] **9.4 Post-launch monitoring**
  - [ ] Monitor crash reports
  - [ ] Check Sentry alerts
  - [ ] Monitor user reviews
  - [ ] Prepare hotfix if needed

---

## 📊 Testing Coverage Matrix

| Feature | Unit Test | Integration Test | Manual Test | Device Test |
|---------|-----------|------------------|-------------|------------|
| Age Verification | ✅ | ✅ | ✅ | ✅ |
| Razorpay Payments | ✅ | ✅ | ✅ | ✅ |
| Content Moderation | ✅ | ✅ | ✅ | ✅ |
| Admin Dashboard | ❌ | ✅ | ✅ | ✅ |
| Sentry Tracking | ❌ | ✅ | ✅ | ✅ |
| Authentication | ✅ | ✅ | ✅ | ✅ |
| Messaging | ✅ | ✅ | ✅ | ✅ |
| Profile | ✅ | ✅ | ✅ | ✅ |

---

## 🚨 Critical Path Dependencies

```
Week 1 (Days 1-3):
  └─ Configuration (Razorpay, Sentry, Database)
     └─ Phase 1 Feature Testing (Days 2-4)
        └─ Critical Missing Features (Days 5-6)
           └─ Testing (Days 7-8)
              └─ Staging Deployment (Day 9)
                 └─ Build Preparation (Day 10)
                    └─ Play Store Setup (Days 11-12)
                       └─ Final Review (Day 13)
                          └─ LAUNCH (Day 14)
```

---

## 📝 Configuration Template

Create `.env` file in project root:

```env
# Backend Configuration
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://user:password@localhost:5432/linkup
JWT_SECRET=your-super-secret-jwt-key-here

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Sentry
SENTRY_DSN=https://your_sentry_dsn@sentry.io/project_id

# Google Vision (Optional)
GOOGLE_CLOUD_VISION_API_KEY=your_vision_api_key

# Frontend Configuration
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SENTRY_DSN=https://your_sentry_dsn@sentry.io/project_id
REACT_APP_SOCKET_URL=http://localhost:3001
```

---

## 🎯 Success Criteria

✅ **Phase 2 Complete When:**

1. **Configuration**: All external services configured and verified
2. **Phase 1 Testing**: All Phase 1 features pass testing
3. **Integration**: Critical missing features wired in
4. **Staging**: App deployed and working on staging
5. **Build**: Release AAB generated and signed
6. **Play Store**: App listing complete and ready
7. **Launch**: Ready to click "Submit for review"

---

## 📞 Support & Troubleshooting

### Common Issues & Solutions

**Issue**: Razorpay tests failing
**Solution**: 
- Verify API keys in `.env`
- Check Razorpay account has test mode enabled
- Verify webhook URL in Razorpay dashboard

**Issue**: Sentry not capturing errors
**Solution**:
- Verify DSN in `.env`
- Check Sentry project settings
- Look for beforeSend filters blocking errors

**Issue**: App crashing on device
**Solution**:
- Check Android Logcat: `adb logcat`
- Check Sentry for crash details
- Test on emulator first

**Issue**: Payment signature verification failing
**Solution**:
- Verify RAZORPAY_KEY_SECRET is correct
- Check order ID matching
- Verify payment response JSON format

---

## ✨ Next Phase: Phase 3 (After Launch)

Once Phase 2 is complete and app is live:

- **Week 1-2**: Monitor crashes, fix bugs, respond to reviews
- **Week 2-3**: Wire remaining 10+ missing features
- **Week 3-4**: Add Phase 3 features (video calls, events, etc.)
- **Month 2**: Growth marketing & ASO

---

**Ready to start Phase 2? Run through this checklist step-by-step!** 🚀

