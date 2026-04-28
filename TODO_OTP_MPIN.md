# OTP (Phone + Email) & MPIN Implementation TODO

## Backend
- [ ] 1. Add DB migration: `mpin_hash`, `phone_verified`, `email_verified` to `users`
- [ ] 2. Update `backend/models/User.js` with new fields
- [ ] 3. Create `backend/utils/twilio.js` for SMS OTP delivery
- [ ] 4. Update `backend/routes/auth.js`:
  - Dual OTP send (email / phone via Twilio)
  - OTP verify sets `email_verified` / `phone_verified`
  - `POST /login-mpin` endpoint
  - `POST /set-mpin` endpoint (authenticated)
  - `GET /me` returns verification flags & `hasMpin`
- [ ] 5. Update `backend/middleware/validation.js` with MPIN validators
- [ ] 6. Update `backend/middleware/auth.js` token payload with `loginMethod`

## Frontend
- [ ] 7. Update `src/components/Login.js`:
  - Channel selection (Email OTP / Phone OTP / MPIN)
  - MPIN login tab
- [ ] 8. Create `src/components/MPINSetup.js` for post-login MPIN setting
- [ ] 9. Update `src/data/translations.js` with OTP/MPIN copy
- [ ] 10. Update `src/utils/auth.js` to track preferred login method
- [ ] 11. Integrate MPIN setup in `src/App.js` flow

## Testing & Deployment
- [ ] 12. Install `twilio` in backend
- [ ] 13. Test signup → email OTP → phone OTP → set MPIN → login via MPIN

