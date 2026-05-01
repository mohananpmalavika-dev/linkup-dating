# DatingHub Pre-Launch Checklist

## Phase 1: Legal & Compliance (Week 1-2)

- [ ] **Terms of Service**
  - [ ] Published at `/TERMS_OF_SERVICE.md`
  - [ ] Available in-app (Settings → Legal)
  - [ ] Updated with payment terms
  - [ ] Reviewed by lawyer (optional but recommended)

- [ ] **Privacy Policy**
  - [ ] Published at `/PRIVACY_POLICY.md`
  - [ ] GDPR compliant
  - [ ] DPDPA compliant
  - [ ] 72-hour breach notification clause included
  - [ ] Data deletion policy clear

- [ ] **Refund/Subscription Policy**
  - [ ] Published at `/REFUND_SUBSCRIPTION_POLICY.md`
  - [ ] 48-hour refund window explained
  - [ ] Auto-renewal cancellation process documented
  - [ ] GST 18% clearly shown

---

## Phase 2: Age Verification (Week 1-2)

- [ ] **Backend Implementation**
  - [ ] Age verification routes created (`/backend/routes/ageVerification.js`)
  - [ ] Database migration applied (`20260428_add_age_verification.sql`)
  - [ ] Validation logic tested for edge cases
  - [ ] No user under 18 can create account

- [ ] **Frontend Implementation**
  - [ ] AgeGate component created (`/src/components/AgeGate/AgeGate.jsx`)
  - [ ] Component CSS styled (`/src/components/AgeGate/AgeGate.css`)
  - [ ] Integrated into signup flow
  - [ ] Error messages clear and helpful

- [ ] **Testing**
  - [ ] Try age 16 (should reject)
  - [ ] Try age 18 (should accept)
  - [ ] Try invalid dates (should reject)
  - [ ] Test on mobile devices

---

## Phase 3: Payments (Week 2-3)

- [ ] **Backend Payment Service**
  - [ ] Razorpay service created (`/backend/services/razorpayService.js`)
  - [ ] Payment routes created (`/backend/routes/payments.js`)
  - [ ] Database migrations applied (`20260428_add_payment_tables.sql`)
  - [ ] Webhook handling implemented and tested
  - [ ] Test payments verified

- [ ] **Frontend Payment UI**
  - [ ] SubscriptionPage component created
  - [ ] Subscription plans display correctly
  - [ ] Payment checkout works end-to-end
  - [ ] Payment confirmation screen shows

- [ ] **Razorpay Account**
  - [ ] Account created at https://razorpay.com
  - [ ] API keys generated and saved
  - [ ] Webhook configured to your server
  - [ ] Test mode payments working
  - [ ] Production keys ready (but not yet activated)

- [ ] **Testing Payments**
  - [ ] Test card: 4111 1111 1111 1111
  - [ ] Test UPI: success@razorpay (simulat success)
  - [ ] Test net banking
  - [ ] Verify database records created
  - [ ] Test refund process

---

## Phase 4: Content Moderation (Week 3-4)

- [ ] **Moderation Service**
  - [ ] Service created (`/backend/services/contentModerationService.js`)
  - [ ] Profanity filtering configured
  - [ ] Google Vision API configured (or disabled gracefully)
  - [ ] Spam detection working

- [ ] **Moderation Routes**
  - [ ] Routes created (`/backend/routes/moderation.js`)
  - [ ] Database migrations applied (`20260428_add_moderation_tables.sql`)
  - [ ] Admin endpoints protected with auth
  - [ ] Endpoints tested with mock data

- [ ] **Admin Dashboard**
  - [ ] Dashboard component created (`/src/components/AdminModeration/AdminModeration.jsx`)
  - [ ] CSS styling complete (`/src/components/AdminModeration/AdminModeration.css`)
  - [ ] Review queue functional
  - [ ] Statistics display correctly
  - [ ] Test as admin user

- [ ] **Integration**
  - [ ] Moderation routes mounted in `backend/server.js`
  - [ ] Admin routes protected with middleware
  - [ ] Admin user role created in database

---

## Phase 5: Error Tracking (Week 3)

- [ ] **Sentry Backend**
  - [ ] Sentry account created at https://sentry.io
  - [ ] Backend project created
  - [ ] DSN configured in backend
  - [ ] Backend Sentry initialized (`/backend/config/sentryBackend.js`)
  - [ ] Test error captures successfully

- [ ] **Sentry Frontend**
  - [ ] Frontend project created in Sentry
  - [ ] DSN configured in React app
  - [ ] Frontend Sentry initialized (`/src/config/sentryReact.js`)
  - [ ] Error boundary component added
  - [ ] Test error captures successfully

- [ ] **Alerts**
  - [ ] Slack integration configured
  - [ ] Email alerts for critical errors
  - [ ] Alert thresholds set appropriately

---

## Phase 6: Database & Infrastructure (Week 1-4)

- [ ] **Database**
  - [ ] PostgreSQL production instance running
  - [ ] All migrations applied:
    - [ ] Age verification tables
    - [ ] Payment tables
    - [ ] Moderation tables
  - [ ] Backups configured and tested
  - [ ] Connection pooling optimized

- [ ] **Backend Server**
  - [ ] Node.js environment configured
  - [ ] All environment variables set (.env)
  - [ ] Redis cache (if used) running
  - [ ] SSL certificate installed
  - [ ] CORS configured correctly

- [ ] **Frontend Build**
  - [ ] Production build created: `npm run build`
  - [ ] Build size checked (should be <2MB gzipped)
  - [ ] Source maps generated for debugging
  - [ ] Environment variables configured

---

## Phase 7: Security & Compliance (Week 4)

- [ ] **Authentication**
  - [ ] JWT tokens working correctly
  - [ ] Password hashing with bcrypt
  - [ ] Session management secure
  - [ ] Token expiration set appropriately (24h recommended)

- [ ] **Data Protection**
  - [ ] Sensitive data encrypted at rest
  - [ ] HTTPS enforced (no HTTP)
  - [ ] Database credentials not in code
  - [ ] API keys not exposed in frontend

- [ ] **Compliance**
  - [ ] Age verification enforced
  - [ ] Privacy policy accessible in-app
  - [ ] Terms of Service accessible in-app
  - [ ] Data deletion working (GDPR requirement)
  - [ ] DPDPA compliance verified

- [ ] **Admin Access**
  - [ ] Admin routes protected
  - [ ] Admin authentication required
  - [ ] Admin actions logged
  - [ ] Super admin role implemented

---

## Phase 8: Testing & QA (Week 4)

- [ ] **Functional Testing**
  - [ ] Signup with age verification
  - [ ] Create profile with photos
  - [ ] Browse matches
  - [ ] Send messages
  - [ ] Make a payment
  - [ ] View payment history
  - [ ] Cancel subscription
  - [ ] Report/block user
  - [ ] View admin dashboard

- [ ] **Device Testing**
  - [ ] iPhone (iOS 13+)
  - [ ] Android (API 24+)
  - [ ] Tablet devices
  - [ ] Different screen sizes

- [ ] **Performance Testing**
  - [ ] App loads in <3 seconds
  - [ ] Messages send/receive in <1 second
  - [ ] Payments process in <5 seconds
  - [ ] Admin dashboard responsive

- [ ] **Security Testing**
  - [ ] SQL injection attempts blocked
  - [ ] CSRF protection working
  - [ ] XSS attacks prevented
  - [ ] Unauthorized API access blocked

- [ ] **Error Handling**
  - [ ] Network errors handled gracefully
  - [ ] Validation errors displayed
  - [ ] Server errors logged to Sentry
  - [ ] User-friendly error messages shown

---

## Phase 9: Build & Signing (Week 5)

- [ ] **Generate Signing Key**
  - [ ] Keystore file created
  - [ ] Passwords saved securely
  - [ ] Backup keystore made
  - [ ] Certificate valid 10+ years

- [ ] **Configure Gradle**
  - [ ] `android/app/build.gradle` updated with signing config
  - [ ] `android/local.properties` configured
  - [ ] Environment variables set for CI/CD
  - [ ] `.gitignore` updated (no passwords committed)

- [ ] **Build Release APK/AAB**
  - [ ] Release build generated: `./gradlew bundleRelease`
  - [ ] AAB file located: `android/app/build/outputs/bundle/release/app-release.aab`
  - [ ] Signing verified: `jarsigner -verify ...`
  - [ ] File size reasonable (<100MB)

- [ ] **Test Release Build**
  - [ ] Install on test device
  - [ ] All features working
  - [ ] No crashes
  - [ ] Performance acceptable

---

## Phase 10: Play Store Setup (Week 5)

- [ ] **Developer Account**
  - [ ] Google Play account created
  - [ ] $25 registration fee paid
  - [ ] Account details completed:
    - [ ] Legal name
    - [ ] Address
    - [ ] Phone number
    - [ ] Payment method

- [ ] **App Creation**
  - [ ] App name: "DatingHub"
  - [ ] App category: Dating
  - [ ] App created in Play Console

- [ ] **App Details**
  - [ ] Short description (80 chars): Clear, engaging
  - [ ] Full description (4000 chars): Features, requirements, safety
  - [ ] App icon: 512x512 PNG (transparent background)
  - [ ] Feature graphic: 1024x500 PNG
  - [ ] Screenshots: 4-8 screenshots showing key features
  - [ ] Video preview: (optional) 15-30 second intro

- [ ] **Content Rating**
  - [ ] Questionnaire completed honestly
  - [ ] Appropriate rating received (12+ or 16+ expected)
  - [ ] Ratings verified

- [ ] **Privacy & Permissions**
  - [ ] Privacy policy URL linked and verified
  - [ ] Support email set
  - [ ] Website linked
  - [ ] Target audience set
  - [ ] Data permissions justified

- [ ] **Pricing & Distribution**
  - [ ] Price set to Free
  - [ ] Countries selected (India, others)
  - [ ] Device filtering: All devices
  - [ ] Content rating confirmed

---

## Phase 11: Final Review & Testing (Day Before Launch)

- [ ] **App Listing Review**
  - [ ] All screenshots accurate
  - [ ] Description matches app features
  - [ ] Icons correct size and format
  - [ ] No grammatical errors
  - [ ] No typos

- [ ] **Policy Compliance**
  - [ ] Age 18+ enforced ✓
  - [ ] Privacy policy linked ✓
  - [ ] Terms of Service linked ✓
  - [ ] No deceptive practices ✓
  - [ ] No spam/repetitive content ✓

- [ ] **Full App Test**
  - [ ] Complete signup flow
  - [ ] Profile creation with age verification
  - [ ] Browse & matching
  - [ ] Real-time messaging
  - [ ] Payment flow
  - [ ] Admin dashboard
  - [ ] Report feature
  - [ ] Settings & privacy options

- [ ] **Backend Verification**
  - [ ] All services running
  - [ ] Database connected
  - [ ] Logs monitoring (Sentry)
  - [ ] Payment processor ready
  - [ ] Email/SMS working

- [ ] **Documentation**
  - [ ] User guide written
  - [ ] Privacy policy reviewed
  - [ ] Terms accepted by reviewer
  - [ ] Support contact verified

---

## Launch Day Checklist

- [ ] **Final Checks** (1 hour before)
  - [ ] Server status: ✅ All green
  - [ ] Database: ✅ Connected
  - [ ] Backups: ✅ Recent backup confirmed
  - [ ] Monitoring: ✅ Sentry, logs configured
  - [ ] Team ready: ✅ Support team briefed

- [ ] **Submit Release**
  - [ ] Click "Start rollout" in Play Console
  - [ ] Confirm 100% rollout
  - [ ] Submit for review
  - [ ] Receive confirmation email

- [ ] **Monitor**
  - [ ] Monitor Sentry for errors
  - [ ] Check Play Store console for reviews
  - [ ] Respond to user comments
  - [ ] Track install numbers

- [ ] **Celebrate! 🎉**
  - [ ] Your app is live!
  - [ ] Share on social media
  - [ ] Announce to users
  - [ ] Invite beta testers

---

## Post-Launch (First Week)

- [ ] **Monitor Closely**
  - [ ] Check crash reports daily
  - [ ] Respond to reviews
  - [ ] Fix critical bugs immediately
  - [ ] Monitor server load

- [ ] **User Communication**
  - [ ] Announce launch on social media
  - [ ] Send email to beta testers
  - [ ] Post launch blog post
  - [ ] Engage with early users

- [ ] **First Update (v1.0.1)**
  - [ ] Fix any critical bugs
  - [ ] Address user feedback
  - [ ] Publish update within 1 week
  - [ ] Shows app is actively maintained

- [ ] **Analytics**
  - [ ] Track DAU (Daily Active Users)
  - [ ] Monitor retention
  - [ ] Check crash rates
  - [ ] Review user feedback

---

## Success Metrics (30 Days)

- **Target Downloads**: 1,000+
- **Target Rating**: 4.0+ stars
- **Crash Rate**: <1%
- **DAU/MAU Ratio**: >30%
- **Feature Adoption**: 80%+ sign up, 50%+ messaging

---

## Critical Issues (Immediate Action Required)

If any of these happen, immediately:

1. **Server Down**: 
   - Notify team
   - Restore from backup
   - Update Play Store status
   - Post status on social media

2. **Data Breach**:
   - Contact law enforcement
   - Notify affected users
   - Disable compromised accounts
   - Review security

3. **Legal Issue**:
   - Contact lawyer
   - Remove violating content
   - Respond to cease & desist
   - File documentation

4. **High Crash Rate (>10%)**:
   - Rollback to previous version
   - Disable problematic feature
   - Fix and republish

---

## Document Version

**Last Updated**: April 28, 2026
**Status**: READY FOR LAUNCH ✅

---

**Launch Date**: [INSERT DATE]
**Responsible**: [INSERT NAME]
**Contact**: [INSERT EMAIL]

