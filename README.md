# LinkUp Dating - Modern Dating App

A full-featured React-based dating application with swipe discovery, advanced profile search, real-time messaging, and video dating capabilities.

## 🌟 Features

### Discovery
✅ **Swipe Cards** - Intuitive swipe-based profile discovery
✅ **Matching System** - Get notified of mutual matches
✅ **Quick Profile Preview** - See key info at a glance

### Browsing
✅ **Advanced Filters** - Age, location, height, relationship goals
✅ **Grid Browse** - Visual profile grid with filtering
✅ **Profile Details** - Complete profile information

### Connections
✅ **Matches Management** - View all your matches
✅ **Real-time Messaging** - Chat with matched profiles
✅ **Video Dating** - Schedule and conduct video calls
✅ **Interaction History** - Track likes and passes

### Profiles
✅ **Comprehensive Profiles** - Photos, bio, interests, verification
✅ **Multi-Photo Support** - Upload and showcase multiple photos
✅ **Identity Verification** - Email, phone, and ID verification
✅ **Badge System** - Verified, premium status

### Security
✅ **User Authentication** - Email/password registration
✅ **Profile Verification** - Multi-layer identity verification
✅ **Privacy Controls** - Control who can message you

---

## 🚀 Quick Start

### Installation
```bash
cd c:\Users\Dhanya\LinkUp
npm install
```

### Build for Web
```bash
npm start
```

### Build for Android
```bash
npm run build                    # Build web assets
npx cap add android              # Add Android platform (first time only)
npx cap sync android             # Sync to Android project
npx cap open android             # Open in Android Studio
```

---

## 📁 Project Structure

```
src/
├── components/
│   ├── DiscoveryCards.js         # Swipe card interface
│   ├── BrowseProfiles.js         # Grid search & filters
│   ├── Matches.js                # Match management
│   ├── DatingMessaging.js        # In-app messaging
│   ├── VideoDating.js            # Video call interface
│   ├── DatingProfile.js          # User profile view/edit
│   ├── DatingSignUp.js           # Multi-step registration
│   ├── DatingNavigation.js       # Bottom navigation
│   └── ...
├── services/
│   ├── datingProfileService.js   # Dating API calls
│   ├── notificationService.js    # Push notifications
│   └── ...
├── data/
│   ├── datingModels.js           # Data schemas
│   └── translations.js           # i18n strings
├── styles/
│   ├── DiscoveryCards.css
│   ├── BrowseProfiles.css
│   ├── Matches.css
│   ├── DatingMessaging.css
│   ├── VideoDating.css
│   ├── DatingProfile.css
│   ├── DatingSignUp.css
│   └── DatingNavigation.css
└── App.js                        # Main app component
```

---

## 🎮 Main Pages

### 1. **Discovery** (Swipe Cards)
- Swipe left to pass profiles
- Swipe right (♥) to like
- Get matched when both like each other
- See profile info: photos, age, location, bio, interests

### 2. **Browse** (Advanced Search)
- Filter by age range (18-100)
- Filter by distance (1-100 km)
- Filter by relationship goals
- Filter by height and interests
- View results in grid format

### 3. **Matches**
- List all your matches
- See recent activity
- Start messaging
- Quick match overview

### 4. **Messages**
- Real-time messaging with matches
- Typing indicators
- Message history
- Launch video calls from chat

### 5. **Video Dating**
- Real-time video calls
- Audio/video controls
- In-call chat
- Call history

### 6. **Profile**
- View your complete profile
- Edit bio and interests
- Manage photos
- Verification status
- Statistics (likes, matches, profile completion)

---

## 🔧 Configuration

### Environment Variables
```
REACT_APP_API_URL=http://your-backend-url
REACT_APP_SOCKET_URL=http://your-socket-url
```

### API Endpoints
- `GET /api/dating/discovery` - Get profiles for discovery
- `POST /api/dating/search` - Search with filters
- `POST /api/dating/interactions/like` - Like a profile
- `POST /api/dating/interactions/pass` - Pass on profile
- `GET /api/dating/matches` - Get all matches
- `GET /api/dating/profiles/me` - Get user's profile
- `PUT /api/dating/profiles/me` - Update profile

---

## 🛡️ Security Features

- ✅ Email verification
- ✅ Phone verification
- ✅ ID verification badge
- ✅ Video verification option
- ✅ Blocked profile management
- ✅ Report inappropriate users
- ✅ Privacy-first design

---

## 📱 Responsive Design

Fully responsive for:
- ✅ Desktop browsers
- ✅ Tablets
- ✅ Mobile devices
- ✅ Android app (via Capacitor)
- ✅ iOS app (via Capacitor)

---

## 🧪 Testing

```bash
npm test                         # Run tests
npm run coverage                 # Generate coverage report
```

---

## 📚 Technologies Used

- **React 18** - UI Framework
- **React Router v7** - Navigation
- **Axios** - HTTP client
- **Socket.io** - Real-time messaging
- **Capacitor 5** - Mobile cross-platform
- **i18next** - Internationalization
- **CSS3** - Styling

---

## 📄 License

Private - All rights reserved

---

## 👥 Support

For issues or questions:
1. Check the [QUICK_START.md](./QUICK_START.md)
2. Review [USER_AUTHENTICATION_GUIDE.md](./USER_AUTHENTICATION_GUIDE.md)
3. Check [ANDROID_BUILD_GUIDE.md](./ANDROID_BUILD_GUIDE.md)

---

**LinkUp Dating** - Find your match, start the conversation! 💕

✅ **Rich Media**
- Send text, images, and files
- Voice message recording
- Message search and filtering

✅ **User Experience**
- Clean, intuitive UI
- Message reactions & threading
- User presence indicators

✅ **Mobile Optimized**
- Responsive design
- Native Android integration via Capacitor
- Offline support

---

## Development

### Commands

```bash
npm start              # Start development server
npm run build          # Build for production
npm test               # Run tests
npm run capacitor:build # Build and open Android Studio
```

### Project Structure

```
src/
├── components/        # React components
├── contexts/          # Global state management
├── modules/
│   └── messaging/     # Messaging module with chatrooms
├── utils/             # Helper functions
└── styles/            # CSS stylesheets
```

---

## Android Build

### Debug Build
```bash
npx cap sync android
cd android
./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

### Release Build
```bash
# Generate signing key
keytool -genkey -v -keystore linkup-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias linkup

# Update build.gradle with signing config
# Build release APK
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

---

## Configuration

### Environment Variables
Create a `.env` file:
```env
REACT_APP_BACKEND_URL=http://10.0.2.2:5000
REACT_APP_SOCKET_URL=http://10.0.2.2:5000
```

**For emulator:** Use `10.0.2.2` instead of `localhost`

### Capacitor Config
Edit `capacitor.config.json`:
```json
{
  "appId": "com.linkup.messaging",
  "appName": "LinkUp",
  "webDir": "build"
}
```

---

## Backend Requirements

The app requires a backend API with these endpoints:

```
Authentication:
- POST   /auth/login
- POST   /auth/signup

Messaging:
- GET    /messaging/messages
- POST   /messaging/messages
- GET    /messaging/chats

Chatrooms:
- GET    /messaging/chatrooms
- POST   /messaging/chatrooms
- PUT    /messaging/chatrooms/:id
- DELETE /messaging/chatrooms/:id

WebSocket Events:
- message:new
- message:delivered
- typing:on / typing:off
```

---

## Troubleshooting

### Backend not connecting
- Check `REACT_APP_BACKEND_URL` in `.env`
- Ensure backend server is running
- For emulator: use `10.0.2.2` not `localhost`

### Build fails
```bash
# Clear gradle cache
cd android
./gradlew clean
./gradlew assembleDebug
```

### Android SDK issues
- Download SDK API 34+ via Android Studio
- Set `ANDROID_HOME` environment variable
- Verify `adb` is in PATH

---

## Technologies Used

- **Frontend:** React 18, React Router 7
- **Mobile:** Capacitor 6, Android SDK
- **Real-time:** Socket.IO
- **Styling:** CSS3 with responsive design
- **State:** React Context API
- **Backend:** Node.js / Express (separate repository)

---

## License

Proprietary - LinkUp

---

## Support

For detailed Android build instructions, see [ANDROID_BUILD_GUIDE.md](./ANDROID_BUILD_GUIDE.md)

**Project Location:** `C:\Users\Dhanya\LinkUp`
