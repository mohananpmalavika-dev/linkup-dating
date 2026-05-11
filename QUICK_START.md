# DatingHub Android Build - Quick Start

## 5-Minute Setup

### Step 1: Install Dependencies
```bash
cd C:\Users\Dhanya\DatingHub
npm install
```

### Step 2: Build Web Assets
```bash
npm run build
```

### Step 3: Add Android Platform
```bash
npx cap add android
```

### Step 4: Sync to Android
```bash
npx cap sync android
```

### Step 5: Build APK
```bash
npx cap open android
```
Then in Android Studio: **Build → Build APK(s)**

---

## All Commands at Once

```bash
cd C:\Users\Dhanya\DatingHub
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

---

## Build Outputs

- **Debug APK:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK:** `android/app/build/outputs/apk/release/app-release.apk`

---

## Test on Device/Emulator

### Start Android Emulator
```bash
emulator -avd Pixel_6_API_34
```

### Install APK
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Run App
```bash
adb shell am start -n com.datinghub.app/.MainActivity
```

---

## Project Location
`C:\Users\Dhanya\DatingHub`

---

## Important Notes

1. **Backend Connection:** Update `REACT_APP_BACKEND_URL` in `.env`
2. **Emulator:** Use `10.0.2.2` instead of `localhost`
3. **Physical Device:** Use your machine's local IP (e.g., `192.168.x.x`)

For detailed guide, see [ANDROID_BUILD_GUIDE.md](./ANDROID_BUILD_GUIDE.md)
