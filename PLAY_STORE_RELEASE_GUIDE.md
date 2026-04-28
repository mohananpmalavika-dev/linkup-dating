# Play Store Release & Build Signing Guide

## Overview

This guide covers everything needed to sign your Android APK/AAB and submit LinkUp to Google Play Store for publication.

---

## Prerequisites

### Required Tools

```bash
# Install Java Development Kit (JDK)
# Required for keytool and signing

# Check if you have Java
java -version

# If not installed, download JDK 11+
# Windows: https://www.oracle.com/java/technologies/downloads/
# Mac: brew install openjdk@11
# Linux: sudo apt install openjdk-11-jdk

# Install Android SDK (if not already installed via Android Studio)
# Includes aapt, zipalign, etc.
```

### Account Requirements

1. **Google Play Developer Account**
   - Cost: $25 (one-time)
   - Website: https://play.google.com/apps/publish/
   - Requires valid Google account

2. **Payment Method**
   - Credit/debit card required for account setup
   - Used only once for registration

3. **Developer Identity**
   - Legal name and address
   - Email address
   - Phone number

---

## Step 1: Create Signing Key

### Generate Keystore File

This creates a cryptographic key for signing your APK/AAB.

**Windows (PowerShell)**:
```powershell
$keystorePath = "C:\Users\YourUsername\LinkUp\linkup-release.keystore"

keytool -genkey -v -keystore $keystorePath `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -alias linkup-release -storepass your_store_password `
  -keypass your_key_password `
  -dname "CN=YourName,O=LinkUp,L=Kochi,ST=Kerala,C=IN"
```

**Mac/Linux**:
```bash
keytool -genkey -v -keystore ~/LinkUp/linkup-release.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias linkup-release -storepass your_store_password \
  -keypass your_key_password \
  -dname "CN=YourName,O=LinkUp,L=Kochi,ST=Kerala,C=IN"
```

### Parameters Explained

| Parameter | Meaning | Example |
|-----------|---------|---------|
| `-keystore` | File path to save key | `~/LinkUp/linkup-release.keystore` |
| `-keyalg` | Algorithm (RSA recommended) | `RSA` |
| `-keysize` | Key size in bits | `2048` |
| `-validity` | Days key is valid | `10000` (27 years) |
| `-alias` | Key alias/identifier | `linkup-release` |
| `-storepass` | Password for keystore | Your secure password |
| `-keypass` | Password for key | Your secure password |
| `-dname` | Distinguished name (user info) | `CN=Name,O=Company,C=IN` |

### Store Credentials Safely

**⚠️ IMPORTANT**: Your keystore file and passwords are required to update your app. Losing them means you cannot update the app!

```bash
# Save to secure location
# Windows: C:\Users\YourUsername\LinkUp\linkup-release.keystore
# Mac: ~/LinkUp/linkup-release.keystore

# Also save passwords securely (password manager)
# Keystore password: _______________
# Key password: _______________
# Key alias: linkup-release
```

---

## Step 2: Configure Build Signing

### Update build.gradle (Android)

In `android/app/build.gradle`:

```gradle
android {
    compileSdkVersion 34
    
    // Signing configuration
    signingConfigs {
        release {
            storeFile file("../linkup-release.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    
    buildTypes {
        debug {
            debuggable true
            minifyEnabled false
        }
        
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            
            // Build options
            manifestPlaceholders = [
                appLabel: "LinkUp",
                enableSentryBeforeSend: "true"
            ]
        }
    }
}
```

### Update local.properties

Create or update `android/local.properties`:

```properties
# SDK path (adjust based on your system)
sdk.dir=/Users/username/Library/Android/sdk

# For Windows:
# sdk.dir=C:\\Users\\username\\AppData\\Local\\Android\\Sdk

# Signing credentials (use environment variables in CI/CD)
# Never commit passwords to git!
```

### Create .env.release File

Create `android/.env.release` (DO NOT COMMIT):

```bash
KEYSTORE_PASSWORD=your_keystore_password
KEY_ALIAS=linkup-release
KEY_PASSWORD=your_key_password
```

Add to `.gitignore`:
```bash
.env.release
linkup-release.keystore
```

---

## Step 3: Build APK/AAB

### Generate AAB (Recommended for Play Store)

AAB (Android App Bundle) allows Google Play to generate optimized APKs for each device configuration.

**Windows**:
```powershell
cd android
./gradlew bundleRelease
```

**Mac/Linux**:
```bash
cd android
./gradlew bundleRelease
```

**Output Location**:
```
android/app/build/outputs/bundle/release/app-release.aab
```

**Build Time**: 5-15 minutes (first time may be slower)

### Generate APK (If AAB not supported)

```bash
cd android
./gradlew assembleRelease
```

**Output Location**:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Verify Signing

Check if APK/AAB is signed correctly:

```bash
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab
```

Output should show:
```
jar verified.
```

---

## Step 4: Play Store Account Setup

### 1. Create Developer Account

1. Go to https://play.google.com/apps/publish/
2. Click "Create account"
3. Sign in with Google account (or create new one)
4. Accept terms and conditions
5. Pay $25 registration fee

### 2. Complete Account Setup

**In Developer Console** → **Settings** → **Account details**:
- [ ] Legal name
- [ ] Address
- [ ] Phone number
- [ ] Email

**In Developer Console** → **Settings** → **Payment methods**:
- [ ] Add credit/debit card (for future billing if monetized)

### 3. Generate Signing Certificate SHA-1

You'll need this for services like Google Sign-In:

```bash
# Get SHA-1 of your signing key
keytool -list -v -keystore ~/LinkUp/linkup-release.keystore -alias linkup-release
```

Look for:
```
SHA1: AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01
```

---

## Step 5: Create App Listing

### 1. Create New App

In **Google Play Console**:
1. Click "Create app"
2. Fill in:
   - **App name**: LinkUp
   - **Default language**: English
   - **App or game**: App
   - **Category**: Dating
   - **Type**: Free (initially)
3. Click "Create app"

### 2. Set Up App

### Dashboard → All apps → LinkUp

#### App details

- **App name**: LinkUp
- **Short description** (80 chars):
  "Meet and connect with amazing people around you through real-time messaging."
- **Full description** (4000 chars):

```
LinkUp is a vibrant dating and social platform designed to help you meet 
and connect with people around you. Features include:

✨ Real-Time Messaging
- Instant messaging with matches
- Group chat rooms
- Voice & video calls

💝 Smart Matching
- AI-powered compatibility scoring
- Personalized recommendations
- Discovery presets

🎯 Safe Dating
- 18+ age verification
- Verified profiles
- Report and block features

📸 Profile Management
- Beautiful profile creation
- Photo verification
- Personality matching

🎉 Social Features
- Group chat rooms
- Dating events
- Friend referrals

---

Requirements:
- Age 18+
- Valid email/phone
- Authentic photos only
- 50MB storage space

Privacy & Safety:
We take safety seriously with encrypted messaging, verified profiles, 
and swift moderation. See our Privacy Policy for details.

Terms of Service & Community Guidelines: [Links]
```

- **Icon**: 512x512 PNG (with transparency)
- **Feature graphic**: 1024x500 PNG
- **Screenshots**: 4-8 screenshots showing:
  1. Login/signup
  2. Profile creation
  3. Matching/discovery
  4. Messaging
  5. Payments (if applicable)
  6. Settings/safety features

**Screenshot examples** (2-3 key screens):
```
Screenshot 1: "Discover amazing people"
- Show profile discovery screen

Screenshot 2: "Message in real-time"
- Show messaging interface

Screenshot 3: "Find your match"
- Show matching/compatibility
```

- **Video preview** (15-30 seconds): Optional but recommended
  - Intro to app features
  - Show key workflows

### 3. Content Rating

**Dashboard** → **Setup** → **Content rating**

Click "Fill out questionnaire":

1. **Email address**: developer@linkup.io
2. **App category**: Dating
3. Questions (answer honestly):
   - Violence: No
   - Sexual content: No (but dating context)
   - Inappropriate language: Some (user-generated)
   - Alcohol/tobacco: No
   - Horror/fear: No
   - Gambling: No
   - User interaction/location: Yes
   - User-generated content: Yes

**Result**: Should be rating 12+ or 16+

### 4. Privacy & Permissions

**Dashboard** → **Setup** → **App details**

- **Privacy policy**: [Your privacy policy URL]
- **Email address**: support@linkup.io
- **Website**: https://www.linkup.io
- **Target audience**:
  - Age: 18-65+
  - Gender: Everyone
  - Interests: Dating, Social
- **Target countries**: India (initially)

### 5. Pricing & Distribution

**Dashboard** → **Setup** → **Pricing & distribution**

- **Price**: Free
- **Countries**: Select India (and others)
- **Device**: All devices
- **Content**: PEGI 16 / IAMAI Green
- **Distribute**: Checked

---

## Step 6: Prepare Release

### Release Management

**Dashboard** → **Release** → **Create new release**

1. **Select type**: AAB or APK
2. **Upload file**:
   - Browse to `android/app/build/outputs/bundle/release/app-release.aab`
   - Upload

3. **Release notes** (multi-language):
   ```
   Version 1.0.0 - Launch

   🎉 LinkUp is officially live!
   
   ✨ Features:
   - Real-time messaging
   - AI-powered matching
   - Safe dating features
   - Group chat rooms
   - Voice & video calls

   This is version 1.0.0. We're excited to have you on LinkUp!
   ```

4. **Test release** (optional):
   - Send to internal testers
   - Get feedback
   - Fix bugs before production

5. **Review & roll-out**:
   - 100% rollout (full release)
   - Or phased rollout (10% → 50% → 100%)

---

## Step 7: App Compliance

### Content Policies

Ensure your app complies with:

- **Play Store Policies**: https://play.google.com/about/privacy-security-deception/
- **Dating apps**: Special requirements

**Key requirements**:
- [ ] 18+ age verification
- [ ] User moderation system
- [ ] Report/block features
- [ ] Privacy policy (accessible in-app)
- [ ] GDPR/DPDPA compliance
- [ ] No spam/artificial engagement
- [ ] No location stalking
- [ ] Authentic user accounts

### Pre-Launch Checklist

- [ ] Privacy policy URL works
- [ ] Terms of Service available
- [ ] Contact email provided
- [ ] Age verification working
- [ ] Payment processing tested
- [ ] Crash reporting (Sentry) enabled
- [ ] No debug builds
- [ ] Signing certificate correct
- [ ] All permissions justified
- [ ] No hardcoded sensitive data

---

## Step 8: Submit for Review

### Final Review

Before submitting:

1. **Test the app thoroughly**:
   - Create test account
   - Sign up/login flow
   - Payment flow (if applicable)
   - Profile creation
   - Messaging
   - Report features

2. **Check all links**:
   - Privacy policy
   - Terms of Service
   - Support email
   - Website

3. **Verify metadata**:
   - Screenshots accurate
   - Description updated
   - Icons correct
   - Language appropriate

### Submit Release

**Dashboard** → **Release** → **Staged rollout** → **Review and rollout**

1. Review all details
2. Confirm app details
3. Click "Start rollout" (→ "Start rollout to 100%")
4. Confirm submission

**⏱️ Review time**: Usually 24-48 hours

### Post-Submission

**You will receive email**:
- App approved ✅
- OR App rejected ❌ (with reasons)

**If rejected**:
- Review rejection reasons carefully
- Make required changes
- Re-submit (immediately available)

---

## After Launch

### Monitoring

**Dashboard** → **Analytics**

Monitor:
- Installs
- Crashes
- Ratings & reviews
- Retention metrics
- Uninstall rate

### Collect Feedback

- Read user reviews
- Respond professionally
- Fix reported bugs
- Add requested features

### Update Strategy

**Version 1.1.0** (Bug fixes):
```
Fix: Crash on old Android versions
Fix: Login issue with special characters
Improve: Faster loading
```

**Version 1.2.0** (New features):
```
New: Video profiles
New: Group video chat
Improve: Better matches
Fix: Various bugs
```

**Schedule**: Push updates every 2-4 weeks with improvements

---

## Troubleshooting

### Build Fails: "Signing key not found"

**Solution**:
```bash
# Verify keystore path is correct
# Check file exists at: ~/LinkUp/linkup-release.keystore

# Regenerate if lost:
keytool -list -keystore ~/LinkUp/linkup-release.keystore
```

### Build Fails: "Invalid keystore format"

**Solution**:
```bash
# Verify keystore integrity
keytool -list -v -keystore ~/LinkUp/linkup-release.keystore

# If corrupted, regenerate keystore (lose ability to update app!)
```

### App Rejected: "Policy Violation"

**Common reasons**:
- Age not 18+ (add age gate if missing)
- Privacy policy missing
- No moderation system
- Misleading description
- Spam/inappropriate content

**Solution**:
- Address specific reason
- Make changes
- Resubmit

### App Rejected: "Mature content"

**Solution**:
- Ensure content rating is appropriate
- Hide NSFW content by default
- Add content filters
- Update description

---

## Costs & Timeline

### One-Time Costs
- Developer account: $25
- Signing certificate: FREE (valid 10,000 days)

### Ongoing Costs
- Hosting backend: ~$50-200/month
- Database: ~$20-100/month
- Payment processing: 2-3% + fixed fee
- SMS/Email: $0.01-0.05 per message

### Timeline
- **Week 1**: Build & sign
- **Week 2**: Create app listing
- **Week 3**: Submit for review
- **Week 4**: Approved (hopefully!) 🎉

---

## Post-Launch Growth

### App Store Optimization (ASO)

**Optimize for**:
- Keywords in title/description
- User ratings (target 4.5+)
- User reviews (respond to all)
- Screenshots (A/B test)
- Update regularly (show app is active)

### Marketing

- Social media: Instagram, Twitter, TikTok
- PR: Tech blogs, dating blogs
- Influencers: Dating/app reviewers
- Referral program: Incentivize users

### Growth Targets

- **Month 1**: 1,000 downloads
- **Month 2**: 5,000 downloads
- **Month 3**: 20,000 downloads
- **Month 6**: 100,000+ downloads

---

## Support & Resources

- **Play Store Help**: https://support.google.com/googleplay
- **Android Signing**: https://developer.android.com/studio/publish/app-signing
- **Content Policy**: https://play.google.com/about/developer-content-policy/
- **Dating Apps Policy**: https://support.google.com/googleplay/answer/9918931

---

## Checklist: Ready to Launch?

- [ ] APK/AAB built and signed
- [ ] App name finalized
- [ ] Icons and screenshots ready
- [ ] Description & keywords set
- [ ] Privacy policy linked
- [ ] Terms of Service available
- [ ] Content rating complete
- [ ] Age verification working
- [ ] Payment processing tested
- [ ] Support email set up
- [ ] Crash reporting enabled
- [ ] Content moderation ready
- [ ] Admin dashboard working
- [ ] Dev account created
- [ ] App listing complete
- [ ] Ready for review!

**Launch Date**: [Date]

