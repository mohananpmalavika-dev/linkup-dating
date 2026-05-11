# DatingHub - Android Signed Build Guide for Play Store

## 📋 Overview

This guide walks you through building a **signed APK/AAB** for uploading to Google Play Store.

- **APK**: Single installable file (good for testing)
- **AAB**: Android App Bundle (recommended for Play Store - smaller downloads)

---

## ✅ Prerequisites

Before starting, ensure you have:

1. **Java Development Kit (JDK)** - Version 11 or higher
   ```bash
   java -version
   ```
   Download from: https://www.oracle.com/java/technologies/downloads/

2. **Android SDK Tools**
   - Included with Android Studio
   - Download: https://developer.android.com/studio

3. **Environment Variables Set**
   ```bash
   # ANDROID_HOME should point to your SDK installation
   # PATH should include %ANDROID_HOME%\tools and %ANDROID_HOME%\platform-tools
   ```

---

## 🔑 Step 1: Generate Signing Keystore

A keystore is a file that contains your app's signing key. This is required to sign APKs/AABs for Play Store.

### Option A: Automated Script (Recommended)

**Windows (PowerShell):**
```powershell
cd C:\Users\Dhanya\LinkUp\android
.\build-signed-release.ps1
```

**Windows (Command Prompt):**
```cmd
cd C:\Users\Dhanya\LinkUp\android
build-signed-release.bat
```

**macOS/Linux:**
```bash
cd ~/LinkUp/android
bash build-signed-release.sh
```

### Option B: Manual Keystore Generation

```bash
cd C:\Users\Dhanya\LinkUp\android\app

keytool -genkey -v -keystore linkup-release-key.jks ^
  -keyalg RSA ^
  -keysize 2048 ^
  -validity 10000 ^
  -alias linkup-key
```

**When prompted, enter:**
- **Keystore password**: Choose a strong password (min 6 characters)
- **Key password**: Same as keystore password (recommended)
- **First and last name**: DatingHub
- **Organizational unit**: DatingHub
- **Organization**: LinkUp
- **City/Locality**: Bangalore
- **State/Province**: Karnataka
- **Country Code**: IN

**⚠️ CRITICAL:** Save the keystore file and password securely! If lost, you **cannot update the app** on Play Store.

---

## 📦 Step 2: Build Signed APK

### Option A: Using the Script

```bash
# Windows PowerShell
cd android
.\build-signed-release.ps1

# Windows Command Prompt
cd android
build-signed-release.bat
```

### Option B: Manual Build

```bash
cd C:\Users\Dhanya\LinkUp\android

# Set environment variables
set KEYSTORE_PASSWORD=your_password_here
set KEY_PASSWORD=your_password_here
set KEYSTORE_PATH=app\linkup-release-key.jks

# Build release APK
gradlew.bat assembleRelease

# Or build Android App Bundle (AAB) - recommended for Play Store
gradlew.bat bundleRelease
```

### Output Files

**After successful build, you'll find:**

- **APK**: `android/app/build/outputs/apk/release/app-release.apk`
- **AAB**: `android/app/build/outputs/bundle/release/app-release.aab`

---

## 🧪 Step 3: Test Before Upload

### Test the APK on Device/Emulator

```bash
# Install on connected device or emulator
adb install -r android/app/build/outputs/apk/release/app-release.apk

# Or from Windows File Explorer, drag & drop to Android Studio emulator

# View app logs
adb logcat -s DatingHub:V
```

### Verify App Works

1. Open the app on device
2. Test key features:
   - User authentication
   - Messaging
   - Dating features
   - Payment system (if applicable)
   - Real-time features

---

## 📱 Step 4: Prepare Play Store Listing

Before uploading, prepare the following:

### 1. App Graphics

- **Icon** (512 x 512 PNG)
  - Location: `src/assets/icon.png`
  - Format: PNG with transparent background
  - File size: < 1 MB

- **Feature Graphic** (1024 x 500 PNG)
  - Promotional banner
  - Shows what your app does

- **Screenshots** (min 2, recommended 8)
  - For phones: 1080 x 1920 or 540 x 960
  - For tablets: 1280 x 720 or 1600 x 900
  - Format: PNG or JPEG
  - Show key features: messaging, dating, chatrooms

### 2. App Store Listing Text

- **App Title**: "DatingHub" (max 50 characters)
- **Short Description**: Brief one-liner (max 80 characters)
- **Full Description**: Detailed features and benefits (max 4000 characters)

Example:
```
Short: "Meet, chat, and connect with people near you"

Full: "LinkUp is a modern dating app with real-time messaging, 
video profiles, and advanced matching. Connect with singles 
in your area through voice and video calls..."
```

### 3. Content Rating Questionnaire

Complete at: https://play.google.com/console

Answer questions about:
- Violence
- Adult content
- Profanity
- etc.

### 4. Privacy Policy

Create and host your privacy policy. Example location:
```
https://yourdomainhere.com/privacy-policy
```

See: `privacy-policy.html` in project root

### 5. Release Notes

Brief description of what's new:
```
Version 1.0.0 (Initial Release)
- Real-time messaging and chatrooms
- Video profiles and voice calls
- Advanced user matching
- Payment integration with Razorpay
```

---

## 🚀 Step 5: Upload to Google Play Store

### 1. Create Developer Account

- Visit: https://play.google.com/console
- Sign in with Google account
- Pay one-time fee ($25 USD)
- Complete account setup

### 2. Create App Listing

1. Click "Create app"
2. Enter app name: "DatingHub"
3. Select category: "Dating"
4. Choose content rating
5. Accept agreement and create

### 3. Upload Build

1. Navigate to **Release** > **Production**
2. Click "Create new release"
3. Upload AAB file: `app/build/outputs/bundle/release/app-release.aab`
4. Review the generated APKs for different devices
5. Add release notes
6. Review app policies (privacy, content, etc.)
7. Click "Submit for review"

### 4. Wait for Review

Google typically reviews apps within:
- ⏱️ 2-4 hours for most apps
- 📅 Up to 24 hours in rare cases

You'll receive email notification when review completes.

---

## 🔧 Troubleshooting

### Build Fails with "Could not find tools.jar"

```bash
# Ensure JAVA_HOME is set to JDK directory
setx JAVA_HOME "C:\Program Files\Java\jdk-11.0.x"
```

### Keystore Password Incorrect

If you forget the keystore password, you must:
1. Create a new keystore
2. Create a new app listing on Play Store (you can't reuse package name)

### APK/AAB Too Large

- Run: `gradlew.bat clean bundleRelease`
- Enable minification in `build.gradle`

### Upload Fails with "Keystore not found"

Ensure `linkup-release-key.jks` exists in `android/app/` directory

---

## 📋 Version Updates

When releasing updates:

### Update Version Code/Name

Edit `android/app/build.gradle`:
```gradle
defaultConfig {
    applicationId "com.linkup.dating"
    minSdkVersion 24
    targetSdkVersion 34
    versionCode 2          // Increment this (must be higher than previous)
    versionName "1.0.1"    // Update this for user display
}
```

Then rebuild using same steps above.

---

## 📞 Support & Resources

- **Android Developer Docs**: https://developer.android.com
- **Play Store Console**: https://play.google.com/console
- **Capacitor Docs**: https://capacitorjs.com
- **Gradle Build System**: https://gradle.org

---

## ✅ Checklist for Play Store Upload

- [ ] Keystore created and password saved securely
- [ ] App tested on APK on device/emulator
- [ ] Backend API working and accessible
- [ ] All features functioning correctly
- [ ] Privacy policy drafted
- [ ] App screenshots prepared (8 recommended)
- [ ] App icon finalized (512x512)
- [ ] Feature graphic created
- [ ] Release notes prepared
- [ ] Content rating questionnaire completed
- [ ] AAB built and ready to upload
- [ ] Google Play Developer account created
- [ ] App store listing created
- [ ] AAB uploaded to production
- [ ] Submitted for review

---

## 🎯 What's Next?

After app is published:

1. **Monitor Reviews**: Respond to user feedback
2. **Track Metrics**: Check DAU, retention, crashes in Play Console
3. **Plan Updates**: Push improvements based on user feedback
4. **Marketing**: Promote your app through social media, ads, etc.
5. **Version Updates**: Regularly update with new features

---

**Good luck with your DatingHub app launch! 🎉**
