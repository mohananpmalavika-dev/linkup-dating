# OTP (Email + Phone via Twilio) & MPIN Implementation

## Status: IMPLEMENTATION COMPLETE ✅

---

## Backend Changes

### Database Schema (`backend/config/database.js`)
- Added `mpin_hash VARCHAR(255)` — stores bcrypt-hashed MPIN
- Added `phone_verified BOOLEAN DEFAULT FALSE` — tracks phone OTP verification
- Added `email_verified BOOLEAN DEFAULT FALSE` — tracks email OTP verification
- Fixed `user_preferences` table: `created_at`/`updated_at` NOW have `NOT NULL` defaults

### Sequelize Model (`backend/models/User.js`)
- Added `mpinHash`, `phoneVerified`, `emailVerified` fields

### Twilio Utility (`backend/utils/twilio.js`)
- `sendPhoneOTP(phone, otp)` — sends SMS via Twilio
- Falls back gracefully if Twilio not configured (logs warning, returns mock response)

### Auth Routes (`backend/routes/auth.js`)
**Dual OTP System:**
- `POST /send-otp` — accepts `channel: 'email' | 'phone'`, sends OTP to specified channel
- `POST /verify-otp` — verifies OTP, marks `email_verified` or `phone_verified` on user record
- If both channels verified → user can login via either
- If only email verified → email login only
- If only phone verified → phone login only

**MPIN System:**
- `POST /set-mpin` (authed) — set 4-6 digit MPIN with bcrypt hash
- `POST /login-mpin` — login with identifier + MPIN, returns JWT
- `POST /change-mpin` (authed) — change existing MPIN
- `POST /remove-mpin` (authed) — remove MPIN after verification

**Auth Methods Discovery:**
- `POST /auth-methods` — returns available methods for identifier (password, otp, mpin, verified channels)

### Validation (`backend/middleware/validation.js`)
- Added `mpinValidator` — 4-6 digits
- Added `setMpinValidator` — MPIN + confirmMpin match

### Middleware (`backend/middleware/auth.js`)
- Token payload includes `loginMethod` ('otp' | 'mpin' | 'password')

---

## Frontend Changes

### Login Component (`src/components/Login.js`)
**Three login modes:**
1. **Email OTP** — enter email → receive OTP → verify
2. **Phone OTP** — enter phone → receive SMS OTP → verify (via Twilio)
3. **MPIN** — enter identifier + 4-6 digit MPIN → instant login

- Channel selector tabs
- Auto-detects available methods from `/auth-methods` endpoint
- Remembers preferred login method in localStorage

### MPIN Setup (`src/components/MPINSetup.js`)
- Post-login modal to set MPIN
- Shows in AccountSettings / Profile
- Validates 4-6 digits, requires confirmation

### Auth Utilities (`src/utils/auth.js`)
- `storePreferredLoginMethod(method)` — remembers user's choice
- `getPreferredLoginMethod()` — retrieves choice
- `clearPreferredLoginMethod()` — clears on logout

### App Integration (`src/App.js`)
- Shows MPIN setup prompt after first OTP login
- Conditionally renders MPIN login based on user preference

### Styles (`src/styles/Login.css`)
- MPIN numpad styling
- Channel tab styling
- Verified badge indicators

---

## Bug Fixes Applied

| Issue | File | Fix |
|-------|------|-----|
| `user_preferences` INSERT missing timestamps | `backend/routes/auth.js` | Added `CURRENT_TIMESTAMP` to all inserts |
| `user_preferences` INSERT missing timestamps | `backend/routes/ageVerification.js` | Added `CURRENT_TIMESTAMP` to insert |
| `user_preferences` schema missing NOT NULL | `backend/config/database.js` | Added `NOT NULL` to `created_at`/`updated_at` |

---

## Environment Variables Required

```bash
# Twilio (for Phone OTP SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890

# Optional: Development OTP exposure
AUTH_EXPOSE_DEV_OTP=true

# Existing
JWT_SECRET=your_secret
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

---

## API Reference

### Send OTP
```http
POST /api/auth/send-otp
Content-Type: application/json

{
  "identifier": "user@example.com",
  "channel": "email",      // or "phone"
  "purpose": "login"       // or "signup"
}
```

### Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "identifier": "user@example.com",
  "otp": "123456",
  "otpId": "uuid-from-send-otp"
}
```

### Login with MPIN
```http
POST /api/auth/login-mpin
Content-Type: application/json

{
  "identifier": "user@example.com",
  "mpin": "1234"
}
```

### Set MPIN
```http
POST /api/auth/set-mpin
Authorization: Bearer <token>
Content-Type: application/json

{
  "mpin": "1234",
  "confirmMpin": "1234"
}
```

### Get Auth Methods
```http
POST /api/auth/auth-methods
Content-Type: application/json

{
  "identifier": "user@example.com"
}
