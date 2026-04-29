# LinkUp - Android Build Guide

## Project Overview

**LinkUp** is a standalone Android messaging and chatroom communication application built with React, Capacitor, and Node.js backend.

**Features:**
- ✅ Real-time messaging (Direct chats & Group chats)
- ✅ Chatrooms with member management
- ✅ Text, file, and voice messages
- ✅ Message reactions and threading
- ✅ Typing indicators and delivery status
- ✅ User authentication
- ✅ Responsive design for mobile

---

## Prerequisites

Before building, ensure you have installed:

### 1. **Node.js & npm**
```bash
# Download and install from https://nodejs.org (LTS recommended)
node --version  # Should be v18 or higher
npm --version   # Should be v8 or higher
```

### 2. **Java Development Kit (JDK)**
```bash
# Download from https://www.oracle.com/java/technologies/downloads/
# Or use OpenJDK 11 or higher
java -version   # Verify installation
```

### 3. **Android Studio & SDK**
```bash
# Download from https://developer.android.com/studio
# Install Android SDK Platform Tools and Android SDK (API 34+)
```

### 4. **Android Environment Variables**
Set the following in your system environment:

**Windows (Command Prompt as Admin):**
```cmd
# Set ANDROID_HOME to your Android SDK location
setx ANDROID_HOME "C:\Users\YourUsername\AppData\Local\Android\Sdk"

# Add tools to PATH
setx PATH "%PATH%;%ANDROID_HOME%\tools;%ANDROID_HOME%\tools\bin;%ANDROID_HOME%\platform-tools"
```

**Verify:**
```cmd
adb --version
emulator -version
```

---

## Setup Steps

### Step 1: Navigate to LinkUp Project
```bash
cd C:\Users\Dhanya\LinkUp
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Create Environment Configuration
```bash
# Copy the example file
copy .env.example .env

# Edit .env with your backend URL
# REACT_APP_BACKEND_URL=http://your-backend-api.com
```

**For local development:**
```env
REACT_APP_BACKEND_URL=http://10.0.2.2:5000
# Note: Use 10.0.2.2 instead of localhost in Android emulator
```

### Step 4: Build Web Assets
```bash
npm run build
```

This creates optimized production build in the `build/` folder.

---

## Add Android Platform

### Step 1: Add Android to Capacitor
```bash
npx cap add android
```

This creates an `android/` folder with native Android project.

### Step 2: Open Android Studio
```bash
npx cap open android
```

Or manually:
```bash
cd android
# Open with Android Studio
```

---

## Configure Android App

### Update App Name & Package ID

Edit `android/app/build.gradle`:
```gradle
android {
    ...
    defaultConfig {
        applicationId "com.linkup.messaging"  // Package ID
        minSdkVersion 24
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
}
```

### Update App Branding

1. **Android Manifest** - `android/app/src/main/AndroidManifest.xml`:
```xml
<application
    android:label="@string/app_name"
    ...>
</application>
```

2. **Add App Name** - `android/app/src/main/res/values/strings.xml`:
```xml
<resources>
    <string name="app_name">LinkUp</string>
</resources>
```

3. **App Icon** - Replace files in:
   - `android/app/src/main/res/mipmap-*/ic_launcher.png`
   - (Recommended: Use Android Studio's Image Asset tool)

---

## Build Android APK

### Option 1: Debug Build (Development)

```bash
# Copy web assets to Android project
npx cap sync android

# Build APK using Android Studio
# File → Build → Build Bundle(s) / APK(s) → Build APK(s)
```

Or using command line:
```bash
cd android
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

### Option 2: Release Build (Production)

#### Step 1: Create Signing Key
```bash
cd android/app

# Generate keystore
keytool -genkey -v -keystore linkup-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias linkup

# You'll be prompted for:
# - Password
# - Key store password
# - Organization details
```

#### Step 2: Configure Signing in build.gradle
Edit `android/app/build.gradle`:
```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file('linkup-keystore.jks')
            storePassword 'your-keystore-password'
            keyAlias 'linkup'
            keyPassword 'your-key-password'
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

#### Step 3: Build Release APK
```bash
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

---

## Testing the Build

### On Android Emulator

1. **Start Emulator:**
```bash
emulator -avd AVD_Name
# Or use Android Studio: Virtual Device Manager
```

2. **Install APK:**
```bash
adb install -r path/to/app-debug.apk
```

3. **Run and Test:**
```bash
adb shell am start -n com.linkup.messaging/.MainActivity
```

### On Physical Device

1. **Enable USB Debugging:**
   - Settings → Developer Options → USB Debugging (toggle ON)

2. **Connect Device:**
```bash
adb devices  # Should list your device
```

3. **Install APK:**
```bash
adb install -r path/to/app-debug.apk
```

4. **Check Logs:**
```bash
adb logcat | grep LinkUp
```

---

## Common Issues & Solutions

### Issue: "ANDROID_HOME is not set"
```bash
# Windows - Set environment variable
setx ANDROID_HOME "C:\Users\YourUsername\AppData\Local\Android\Sdk"

# Linux/Mac
export ANDROID_HOME=$HOME/Android/Sdk
```

### Issue: "Backend connection refused"
- Ensure backend server is running
- Check `REACT_APP_BACKEND_URL` in `.env`
- For emulator, use `10.0.2.2` instead of `localhost`

### Issue: "Capacitor is not installed"
```bash
npm install @capacitor/cli @capacitor/core
```

### Issue: "Gradle build fails"
```bash
# Clean gradle cache
cd android
./gradlew clean

# Rebuild
./gradlew assembleDebug
```

### Issue: "Port already in use (if running locally)"
```bash
# Kill process on port 5000
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :5000
kill -9 <PID>
```

---

## Optimization Tips

### Size Optimization
```bash
# Enable ProGuard (minification)
# Edit android/app/build.gradle
buildTypes {
    release {
        minifyEnabled true
    }
}
```

### Performance
- Use release builds for production
- Enable R8 code shrinking
- Compress images and assets

### Testing
```bash
npm run test  # Run unit tests before building
npm run build  # Verify build succeeds
```

---

## Distribution & Release

### Step 1: Prepare for Google Play
1. Create Google Play Developer account
2. Create app on Google Play Console
3. Upload release APK
4. Add app description, screenshots, privacy policy

### Step 2: Build & Sign Release APK
```bash
./gradlew assembleRelease
```

### Step 3: Upload to Google Play
- Go to Google Play Console
- Select app → Release → Create release
- Upload APK → Review & publish

---

## Project Structure

```
LinkUp/
├── public/                 # HTML entry point
├── src/
│   ├── components/        # React components
│   │   ├── Login.js      # Authentication
│   │   └── ErrorBoundary.js
│   ├── contexts/          # React contexts
│   │   └── AppContext.js
│   ├── modules/
│   │   └── messaging/     # Main messaging module
│   ├── utils/             # Utilities
│   │   ├── auth.js
│   │   └── api.js
│   ├── styles/            # CSS files
│   ├── App.js            # Main app component
│   └── index.js          # React entry point
├── android/              # Android native project
├── package.json          # Dependencies
├── capacitor.config.json # Capacitor config
└── .env                  # Environment variables
```

---

## Backend Connection

### Expected API Endpoints

The app connects to your backend at `REACT_APP_BACKEND_URL`:

```
POST   /auth/login              # User login
POST   /auth/signup             # User registration
GET    /messaging/messages      # Load messages
POST   /messaging/messages      # Send message
GET    /messaging/chats         # List chats
GET    /messaging/chatrooms     # List chatrooms
POST   /messaging/chatrooms     # Create chatroom
```

### WebSocket Connection
```javascript
// Socket.IO connection established at backend URL
// Events: 'message:new', 'message:delivered', 'typing:on', etc.
```

---

## Support & Troubleshooting

1. **Check logs:**
```bash
adb logcat -s ReactNative:V
```

2. **Verify setup:**
```bash
npm run build  # Build web assets
npx cap sync android  # Sync to Android
npx cap open android  # Open in Android Studio
```

3. **Report issues:**
   - Check console errors
   - Verify backend connection
   - Ensure all dependencies installed

---

## Version Information

- **React:** 18.3.1
- **Capacitor:** 6.1.0
- **Android SDK:** API 34+
- **Minimum SDK:** API 24
- **JDK:** 11+

---

**Last Updated:** April 26, 2026

For more info: [Capacitor Documentation](https://capacitorjs.com/docs)
