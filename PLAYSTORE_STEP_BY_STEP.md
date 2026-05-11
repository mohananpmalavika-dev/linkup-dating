# LinkUp Dating App - Step-by-Step Play Store Submission Guide

**For First-Time Publishers**  
**Last Updated:** May 3, 2026

---

## 🎯 Quick Overview

This guide walks you through EVERY step to publish LinkUp Dating on Google Play Store. Follow each section in order.

---

## PHASE 1: Setup Google Play Developer Account

### 📍 Step 1.1: Create Developer Account

**Time Required:** 15-20 minutes

1. Go to: https://play.google.com/console
2. Sign in with your Google account (personal Gmail recommended)
3. Accept Developer Agreement & Policies
4. Fill registration form:
   - Name: Your full name
   - Email: Your email
   - Phone: Your phone number
   - Website: Optional
5. **Pay $25 USD fee** (one-time, non-refundable)
   - Credit/Debit card required
   - Will appear as "Google Play Developer" on bank statement
6. Wait for account activation (usually instant)

**Result:** You now have a Google Play Developer account ✅

---

## PHASE 2: Create Your App on Play Console

### 📍 Step 2.1: Create New App

**Time Required:** 5 minutes

1. Go to: https://play.google.com/console
2. Click **Create app** (blue button, top right)
3. Fill in app details:

| Field | Value |
|-------|-------|
| **App name** | LinkUp Dating |
| **Default language** | English |
| **App or game** | App |
| **Free or paid** | Free |
| **Declaration** | Check "I declare this is a dating app intended for adults 18+" |

4. Click **Create app**

**Result:** App created in Play Console ✅

---

## PHASE 3: Complete App Setup

### 📍 Step 3.1: App Access

**Time Required:** 5 minutes  
**Location:** Policies > App access

1. Answer three questions:
   - "Does your app use Device Policy Controller?" → **NO**
   - "Is your app a launcher?" → **NO**
   - "Does your app use SMS or Call Log?" → **YES** (for SMS verification)
     - Explain: "SMS verification for account security and 2FA"

2. If permissions questions appear, answer truthfully

3. Save changes

---

### 📍 Step 3.2: Content Rating (IMPORTANT)

**Time Required:** 15-20 minutes  
**Location:** Setup > Content rating

1. Click **Complete questionnaire**
2. Select email (yours)
3. Answer questions honestly:

**Dating App Questions:**
- Violence: NO
- Sexual content: YES (dating app nature) → Select "Suggestive themes"
- Profanity: MAYBE
- Alcohol/Tobacco: NO
- Gambling: NO
- Scary: NO
- Discriminatory: NO
- Other Mature Themes: YES → "Dating/romance"

4. Submit questionnaire
5. Receive rating: **T (Teen)** or **M (Mature)**
   - Dating apps typically get these ratings
6. Save rating

**Expected Result:** Content rating assigned ✅

---

### 📍 Step 3.3: Target Audience

**Time Required:** 5 minutes  
**Location:** Setup > Target audience

1. **Intended age group:** Select "Ages 18+"
2. **Location availability:** 
   - Tick countries where app is available
   - Start with: India, USA, UK, Canada
   - Can add more later
3. Save

---

### 📍 Step 3.4: Category & Content Rating

**Time Required:** 5 minutes  
**Location:** Setup > Category

1. **Primary category:** Lifestyle
2. **Content rating:** (Auto-filled from questionnaire)
3. **Requires high-speed internet:** Yes
4. **Requires other hardware:** No
5. Save

---

## PHASE 4: Create Store Listing

### 📍 Step 4.1: App Title & Subtitle

**Time Required:** 5 minutes  
**Location:** Store listing > App title

**App Title** (50 characters max):
```
LinkUp - Meet Your Match
```
Character count: 27 ✅

**Short description** (80 characters max):
```
Smart dating app to find your perfect match safely and securely.
```
Character count: 65 ✅

---

### 📍 Step 4.2: Full Description

**Time Required:** 10 minutes  
**Location:** Store listing > Full description

Copy from [PLAYSTORE_PUBLISHING_GUIDE.md](PLAYSTORE_PUBLISHING_GUIDE.md) "Full Description" section (4000 chars max)

---

### 📍 Step 4.3: Screenshots

**Time Required:** 30-45 minutes  
**Location:** Store listing > Screenshots

**Requirements:**
- Minimum: 2 images
- Maximum: 8 images
- Format: PNG or JPG
- Size: 1080x1920 px (portrait)
- No blurred images
- Language: Match your app language

**Create Screenshots (You need to do this):**

1. **Screenshot 1: Swiping Interface**
   - Show main swipe screen
   - Include some profiles
   - Add text: "Swipe to Match"

2. **Screenshot 2: Matching**
   - Show match notification
   - Include match card
   - Text: "Connect Instantly"

3. **Screenshot 3: Messaging**
   - Show chat interface
   - Show conversation
   - Text: "Real Conversations"

4. **Screenshot 4: Video Dating**
   - Show video call interface
   - Text: "Face-to-Face Video Chat"

5. **Screenshot 5: Premium Features**
   - Show premium badge
   - Text: "Unlock Premium Features"

6. **Screenshot 6: Safety Features**
   - Show verification badge
   - Show safety kit
   - Text: "Your Safety Matters"

**How to Create:**
- Take screenshots from running app
- Use Google Play Console preview tool
- Or hire designer ($50-100)

---

### 📍 Step 4.4: Feature Graphic

**Time Required:** 15 minutes  
**Location:** Store listing > Feature graphic

**Requirements:**
- Size: 1024x500 px
- Format: PNG or JPG
- No transparency needed

**What to show:**
- Attractive dating app UI
- Large text: "Find Your Perfect Match"
- LinkUp branding
- Colors: Use app theme colors

**How to create:**
- Use Canva (canva.com) - free
- Use design tool
- Or hire designer

---

### 📍 Step 4.5: App Icon

**Time Required:** 5 minutes  
**Location:** Store listing > App icon

**Requirements:**
- Size: 512x512 px
- Format: PNG
- No rounded corners
- Include transparency (32-bit PNG)

**Using your existing icon:**
- Should already exist in your project
- If not, create using Canva
- File path: `src/assets/app-icon-512.png`

---

## PHASE 5: Privacy & Compliance

### 📍 Step 5.1: Privacy Policy URL

**Time Required:** 30-45 minutes  
**Location:** Store listing > App details > Privacy policy

**Create Privacy Policy:**

1. **Option A: Use Template**
   - Go to: https://termly.io (has free dating app templates)
   - Generate privacy policy
   - Copy full text

2. **Option B: GitHub Pages (Free)**
   - Create GitHub account (if not exist)
   - Create repo: `linkup-privacy-policy`
   - Create file: `privacy-policy.md`
   - Enable GitHub Pages for this file
   - Use generated URL

3. **Option C: Firebase Hosting (Free)**
   - Use Firebase hosting
   - Deploy HTML file with privacy policy
   - Get public URL

**Privacy Policy Must Include:**
- What data you collect (emails, location, photos, etc.)
- How you use the data
- Third-party sharing (Firebase, Razorpay, SMS service)
- User rights (delete, export data)
- GDPR compliance (EU users)
- DPDPA compliance (Indian users)
- Contact email for privacy concerns

**Add to Play Console:**
1. Paste full URL
2. Click Save

---

### 📍 Step 5.2: Terms of Service URL (Optional but Recommended)

**Time Required:** 20-30 minutes  
**Location:** Store listing > App details > Content rating

Similar to privacy policy:
- Create using termly.io or GitHub Pages
- Get public URL
- Add to Play Console

**Terms Must Include:**
- User age requirement (18+)
- Prohibited conduct rules
- Account responsibility
- Content moderation
- Liability limitations
- Contact for legal issues

---

## PHASE 6: Upload Build & Test

### 📍 Step 6.1: Upload to Internal Testing

**Time Required:** 5 minutes  
**Location:** Release > Testing > Internal testing

1. Go to Google Play Console
2. Navigate to **Release** tab
3. Select **Testing** → **Internal testing**
4. Click **Create new release**
5. Scroll to **App bundles and APKs**
6. Click **Upload** button
7. Select file: `c:\Users\Dhanya\LinkUp\android\app\build\outputs\bundle\release\app-release.aab` ✅
8. Wait for upload (usually 1-2 minutes)
9. Click **Save**

**Result:** Build uploaded ✅

---

### 📍 Step 6.2: Add Release Notes

**Location:** Same page, scroll down

**Fill Release Notes:**
```
Version 1.0 - Launch Release

🎉 Welcome to LinkUp Dating!

LinkUp is your new favorite dating app. Connect with people, 
find your match, and enjoy video dating!

✨ Features in this release:
- Smart swiping interface
- Real-time matching
- Instant messaging
- Video dating calls
- Safety verification
- Premium membership
- Achievement badges
- Daily challenges

Download now and find your perfect match! 💕
```

---

### 📍 Step 6.3: Test the Build

**Time Required:** 30-60 minutes

1. After upload, you get a testing link
2. Share link with yourself or testers
3. Install app from Play Store link
4. **Test on real device (not emulator):**
   - Login/Registration
   - Swiping
   - Matching
   - Messaging
   - Video calls
   - Payment (if applicable)
   - All features

5. **Check for crashes:**
   - Monitor Play Console > Crashes
   - Fix any crashes found
   - Re-upload new build
   - Re-test

6. Once confirmed working → Move to next step

---

## PHASE 7: Submit for Review

### 📍 Step 7.1: Create Production Release

**Time Required:** 5 minutes  
**Location:** Release > Production

1. Go to **Release** tab
2. Select **Production** (not Testing)
3. Click **Create new release**
4. Upload same AAB file again
5. Add release notes (same or updated)
6. Save

---

### 📍 Step 7.2: Review All Policies

**Time Required:** 10 minutes  
**Location:** Policies tab

Review and confirm:
- [ ] Content policy guidelines
- [ ] Terms of service/Privacy policy
- [ ] Age restrictions (18+)
- [ ] No prohibited content
- [ ] App rating fits content
- [ ] All features compliant

---

### 📍 Step 7.3: Submit for Review

**Time Required:** 2 minutes  
**Location:** Release > Production

1. Scroll down to **Review & release**
2. Review summary of all changes
3. Click **Send for review** button
4. Confirm submission
5. You'll get confirmation email

**You're done!** ✅

---

## PHASE 8: Monitor Review & Launch

### 📍 Step 8.1: Wait for Approval

**Timeline:**
- Typical: 2-4 hours
- Expected range: 2-48 hours
- You'll receive email when approved/rejected

**What to do meanwhile:**
- Check email frequently
- Monitor Play Console
- Have support email ready
- Monitor social media

**If Approved:**
- App goes live automatically
- Available in Play Store
- Searchable after indexing (24-48 hours)
- Notify users to download

**If Rejected:**
- Read rejection reason carefully
- Fix issues
- Resubmit
- Repeat

---

### 📍 Step 8.2: After Launch

**First 24 Hours:**
- [ ] Verify app appears in Play Store
- [ ] Test install from store
- [ ] Monitor crash reports
- [ ] Check server capacity
- [ ] Prepare support responses
- [ ] Monitor social media

**First Week:**
- [ ] Respond to reviews
- [ ] Monitor ratings
- [ ] Fix critical bugs
- [ ] Track install growth
- [ ] Monitor server performance
- [ ] Support customer issues

**First Month:**
- [ ] Analyze user feedback
- [ ] Plan first update
- [ ] Improve app listing if needed
- [ ] Track metrics
- [ ] Plan marketing strategy

---

## 📊 Checklist: Ready to Submit?

Before clicking "Send for review", confirm:

### Content
- [ ] App title set (50 chars max)
- [ ] Short description set (80 chars max)
- [ ] Full description set (4000 chars max)
- [ ] Minimum 2 screenshots added
- [ ] Feature graphic uploaded
- [ ] App icon uploaded (512x512)
- [ ] Release notes added

### Settings
- [ ] App category: Lifestyle
- [ ] Age group: 18+
- [ ] Content rating: From questionnaire
- [ ] Target audience confirmed
- [ ] Permissions justified

### Legal
- [ ] Privacy policy URL added
- [ ] Terms of service URL (recommended)
- [ ] Age verification: 18+ gate active
- [ ] All policies reviewed
- [ ] GDPR/DPDPA compliant

### Technical
- [ ] AAB uploaded and validated
- [ ] App version: 1.0
- [ ] Version code: 1
- [ ] Tested on real device
- [ ] No crashes reported
- [ ] Real backend configured
- [ ] No test credentials

### Quality
- [ ] All features working
- [ ] UI/UX polished
- [ ] No obvious bugs
- [ ] All links working
- [ ] Graphics look good
- [ ] Text properly formatted

---

## ⚠️ Common Issues & Solutions

### Issue 1: Build Upload Fails
**Solution:**
- Ensure AAB file is valid: `app-release.aab` ✅
- Try uploading again
- If still fails, rebuild using: `./gradlew.bat clean bundleRelease`

### Issue 2: App Rejected for Age Issues
**Solution:**
- Add age gate (18+ verification) ✅ Already in LinkUp
- Verify users are actually 18+
- Add stronger warning in app

### Issue 3: App Rejected for Privacy Issues
**Solution:**
- Update privacy policy with all data practices
- Add DPDPA section for Indian users
- Explain all third-party services
- Add delete account functionality

### Issue 4: App Crashes on User Devices
**Solution:**
- Check Play Console crash reports
- Identify crashing lines
- Test on multiple devices
- Fix and upload new build
- Resubmit

### Issue 5: Low Rating After Launch
**Solution:**
- Respond to all reviews professionally
- Fix issues mentioned
- Plan quick update
- Improve app quality
- Add features users request

---

## 📞 Getting Help

### If Rejected
1. Read rejection reason carefully
2. Check Google Play Console > Help
3. Search for rejection reason online
4. Fix issues
5. Resubmit

### Contact Support
- **Play Console Support:** In-app help chat
- **Dating App Policy:** support@google.com
- **Technical Issues:** Android developer help

---

## 🎉 Success!

Once your app is live on Play Store:
1. Share with friends/family
2. Announce on social media
3. Monitor ratings and reviews
4. Support your users
5. Plan continuous improvements
6. Celebrate your launch! 🚀

---

**Total Time to Live:** ~6-10 hours
**Status:** You're ready to publish! 🎯
