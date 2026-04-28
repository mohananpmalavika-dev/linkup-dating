# Firebase Phone Auth Integration - TODO

## Plan: Firebase Phone Auth Integration (Free OTP SMS)

### Steps
- [x] 1. Add `firebase-admin` to `backend/package.json`
- [x] 2. Add `firebase` to frontend `package.json`
- [x] 3. Create `backend/config/firebase.js` — Firebase Admin SDK initialization
- [x] 4. Create `src/config/firebase.js` — Firebase JS SDK config for frontend
- [x] 5. Add `POST /firebase-verify-phone` endpoint to `backend/routes/auth.js`
- [x] 6. Modify `src/components/Login.js` — Add Firebase Phone Auth login method
- [x] 7. Add styles to `src/styles/Login.css`
- [x] 8. Update environment variable documentation

---

## Environment Variables Required

### Backend `.env`
```bash
# Firebase Admin SDK (service account)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
```

### Frontend `.env`
```bash
# Firebase Web App Config
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

---

## Followup Steps
1. `npm install` in both `backend/` and root directories
2. Create Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
3. Enable **Phone** sign-in method in Firebase Authentication
4. Download service account key for backend; copy web app config for frontend
5. Populate `.env` variables
6. Test with a real Indian phone number

---

## How It Works

1. User selects **"Phone (SMS)"** tab in login screen
2. Enters phone number with country code (e.g., `+91xxxxxxxxxx`)
3. Frontend creates invisible reCAPTCHA verifier and calls `signInWithPhoneNumber()`
4. Firebase sends SMS OTP to the phone number
5. User enters 6-digit OTP
6. Frontend confirms OTP with Firebase, gets Firebase ID token
7. Frontend sends ID token to backend `/api/auth/firebase-verify-phone`
8. Backend verifies token with Firebase Admin SDK
9. Backend finds or creates user, marks `phone_verified = TRUE`
10. Backend issues your existing JWT token
11. User is logged in — same flow as email/OTP login

---

## API Reference

### Firebase Phone Verify
```http
POST /api/auth/firebase-verify-phone
Content-Type: application/json

{
  "idToken": "firebase-id-token-from-frontend",
  "email": "optional@email.com"
}
```

Response (same shape as `verify-otp`):
```json
{
  "success": true,
  "token": "your-jwt-token",
  "user": { ... },
  "needsUsernameSetup": false,
  "verifiedChannel": "phone",
  "isNewUser": false
}
