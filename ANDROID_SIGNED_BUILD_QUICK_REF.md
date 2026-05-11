# LinkUp Android Play Store Build - Quick Reference

## ⚡ Quick Start (5 Minutes)

### 1️⃣ Open Terminal
```bash
cd C:\Users\Dhanya\LinkUp\android
```

### 2️⃣ Run Build Script
```bash
# Windows PowerShell
.\build-signed-release.ps1

# Windows Command Prompt
build-signed-release.bat
```

### 3️⃣ Follow Prompts
- Create keystore (one time only)
- Enter password
- Choose build type (APK or AAB)
- Wait for build to complete

### 4️⃣ Find Your Build
- **APK**: `app/build/outputs/apk/release/app-release.apk`
- **AAB**: `app/build/outputs/bundle/release/app-release.aab`

---

## 📋 Command Reference

### Generate Keystore
```bash
cd android/app

keytool -genkey -v -keystore linkup-release-key.jks ^
  -keyalg RSA -keysize 2048 -validity 10000 -alias linkup-key
```

### Build APK
```bash
cd android
set KEYSTORE_PASSWORD=your_password
set KEY_PASSWORD=your_password
gradlew.bat assembleRelease
```

### Build AAB (Recommended for Play Store)
```bash
cd android
set KEYSTORE_PASSWORD=your_password
set KEY_PASSWORD=your_password
gradlew.bat bundleRelease
```

### Test APK on Device
```bash
adb install -r app\build\outputs\apk\release\app-release.apk
```

---

## 🚀 Play Store Upload Steps

1. Go to: https://play.google.com/console
2. Create/Select your app
3. Navigate to: **Release** > **Production**
4. Click: **Create new release**
5. Upload: `app/build/outputs/bundle/release/app-release.aab`
6. Add: Release notes
7. Review: App policies
8. Submit: For review

---

## ⚠️ Important Notes

- **Keystore Password**: Save securely! If lost, you can't update the app
- **Version Code**: Must increment with each update
- **AAB vs APK**: Use AAB for Play Store, APK for manual testing
- **Build Time**: First build takes 3-5 minutes, subsequent builds 1-2 minutes

---

## 📦 File Locations

| Item | Location |
|------|----------|
| Keystore | `android/app/linkup-release-key.jks` |
| Release APK | `android/app/build/outputs/apk/release/app-release.apk` |
| Release AAB | `android/app/build/outputs/bundle/release/app-release.aab` |
| Build Config | `android/app/build.gradle` |
| Capacitor Config | `capacitor.config.json` |

---

## 🆘 Common Issues

### Build fails with keystore error
→ Ensure `linkup-release-key.jks` exists in `android/app/`

### "Could not find Java"
→ Install JDK 11+ from https://www.oracle.com/java/

### Password incorrect
→ Passwords are case-sensitive. Check caps lock.

### APK too large
→ Enable ProGuard/R8 minification in build.gradle

---

## ✅ Pre-Upload Checklist

- [ ] Keystore created and password saved
- [ ] APK tested on device
- [ ] Backend API working
- [ ] All features tested
- [ ] Privacy policy ready
- [ ] Screenshots prepared (8 recommended)
- [ ] App icon ready (512x512)
- [ ] Release notes written
- [ ] AAB built and ready
- [ ] Developer account created

---

## 📞 Useful Links

- Android Docs: https://developer.android.com
- Play Console: https://play.google.com/console
- Capacitor: https://capacitorjs.com
- Java Downloads: https://www.oracle.com/java/

---

**Version**: 1.0  
**App**: LinkUp Dating  
**Package**: com.linkup.dating  
**Last Updated**: May 2026
